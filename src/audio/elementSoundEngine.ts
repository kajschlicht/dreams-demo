import { Howl, Howler } from "howler";
import { getExactElementSoundForGlbFile } from "../data/elementSoundFiles";
import { selectRenderableStoryObjects, useAppStore } from "../core/store";
import { resolveSceneModeAudioSettings } from "../core/sceneMode";
import { applySceneModeAudioFilter } from "./sceneModeAudio";
import type { ElementSoundPlayback } from "../data/elementsRegistry";

export type ElementSoundInput = {
  objectId: string;
  assetId: string;
  weight: number;
};

type ManagedElementSound = {
  soundId: string;
  howl: Howl;
  playback: ElementSoundPlayback;
  hasPlayedOnceInCurrentVisibilityCycle: boolean;
  nextIntervalAtMs: number;
  intervalMinMs: number;
  intervalMaxMs: number;
};

const STOP_FADE_MS = 160;
const ACTIVE_WEIGHT_THRESHOLD = 0.001;
const DEFAULT_INTERVAL_MIN_MS = 3000;
const DEFAULT_INTERVAL_MAX_MS = 7000;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function normalizeAssetKey(value: string): string {
  return value.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function clampIntervalMs(value: number | undefined, fallback: number): number {
  const safe = Number(value);
  if (!Number.isFinite(safe)) return fallback;
  return Math.min(60000, Math.max(200, Math.floor(safe)));
}

function randomIntervalMs(minMs: number, maxMs: number): number {
  if (maxMs <= minMs) return minMs;
  return Math.floor(minMs + Math.random() * (maxMs - minMs));
}

class ElementSoundEngine {
  private managedByObjectId = new Map<string, ManagedElementSound>();
  private missingMappingWarnings = new Set<string>();
  private failedFileWarnings = new Set<string>();
  private invalidObjectWarnings = new Set<string>();
  private mismatchedAssetWarnings = new Set<string>();
  private debugSignature = "";

  resume(): void {
    if (typeof window === "undefined") return;
    const howlerContext = (Howler as unknown as { ctx?: AudioContext }).ctx;
    if (howlerContext && howlerContext.state === "suspended") {
      void howlerContext.resume();
    }
  }

  sync(inputs: ElementSoundInput[]): void {
    if (typeof window === "undefined") return;

    const state = useAppStore.getState();
    const sceneModeValue = state.sceneModeValue;
    const sceneAudio = resolveSceneModeAudioSettings(sceneModeValue);
    applySceneModeAudioFilter(sceneModeValue);

    const renderableStoryObjects = selectRenderableStoryObjects(state);
    const enabledStoryObjectById = new Map(
      renderableStoryObjects
        .filter((storyObject) => storyObject.enabled)
        .map((storyObject) => [storyObject.id, storyObject] as const)
    );

    const dedupedByObjectId = new Map<string, ElementSoundInput>();
    for (const input of inputs) {
      const weight = clamp01(input.weight);
      if (weight <= ACTIVE_WEIGHT_THRESHOLD) continue;

      const storyObject = enabledStoryObjectById.get(input.objectId);
      if (!storyObject) {
        if (!this.invalidObjectWarnings.has(input.objectId)) {
          this.invalidObjectWarnings.add(input.objectId);
          console.warn(
            `[audio] dropping sound input for unknown/inactive object '${input.objectId}' (asset '${input.assetId}').`
          );
        }
        continue;
      }

      const inputAssetKey = normalizeAssetKey(input.assetId);
      const storyAssetKey = normalizeAssetKey(storyObject.assetId);
      if (inputAssetKey !== storyAssetKey) {
        const mismatchKey = `${input.objectId}:${inputAssetKey}->${storyAssetKey}`;
        if (!this.mismatchedAssetWarnings.has(mismatchKey)) {
          this.mismatchedAssetWarnings.add(mismatchKey);
          console.warn(
            `[audio] dropping mismatched sound input for object '${input.objectId}': input='${input.assetId}', story='${storyObject.assetId}'.`
          );
        }
        continue;
      }

      const previous = dedupedByObjectId.get(input.objectId);
      if (!previous || weight > previous.weight) {
        dedupedByObjectId.set(input.objectId, { ...input, weight });
      }
    }

    const activeInputs = Array.from(dedupedByObjectId.values());
    const activeObjectIds = new Set(activeInputs.map((input) => input.objectId));
    this.debugInputs(activeInputs);
    const registryByAssetKey = new Map(
      state.elementsRegistry.map((entry) => [normalizeAssetKey(entry.id), entry] as const)
    );

    for (const [objectId, managed] of this.managedByObjectId.entries()) {
      if (activeObjectIds.has(objectId)) continue;
      this.fadeOutAndDispose(managed.howl);
      this.managedByObjectId.delete(objectId);
    }

    const nowMs = Date.now();
    for (const input of activeInputs) {
      const assetKey = normalizeAssetKey(input.assetId);
      const registryEntry = registryByAssetKey.get(assetKey);
      const soundFile = getExactElementSoundForGlbFile(registryEntry?.glbFile);
      const playback: ElementSoundPlayback = registryEntry?.soundPlayback ?? "loop";
      const intervalMinMs = clampIntervalMs(
        registryEntry?.soundIntervalMinMs,
        DEFAULT_INTERVAL_MIN_MS
      );
      const intervalMaxMs = Math.max(
        intervalMinMs,
        clampIntervalMs(registryEntry?.soundIntervalMaxMs, DEFAULT_INTERVAL_MAX_MS)
      );
      if (!soundFile) {
        if (!this.missingMappingWarnings.has(assetKey)) {
          this.missingMappingWarnings.add(assetKey);
          console.warn(
            `[audio] no exact element sound match for asset '${input.assetId}' (object '${input.objectId}').`
          );
        }
        const existingMissing = this.managedByObjectId.get(input.objectId);
        if (existingMissing) {
          this.fadeOutAndDispose(existingMissing.howl);
          this.managedByObjectId.delete(input.objectId);
        }
        continue;
      }

      const targetVolume = clamp01(input.weight * sceneAudio.volumeMultiplier);
      const playbackKey = `${assetKey}:${soundFile}`;
      const existing = this.managedByObjectId.get(input.objectId);

      if (existing && existing.soundId === playbackKey && existing.playback === playback) {
        existing.intervalMinMs = intervalMinMs;
        existing.intervalMaxMs = intervalMaxMs;
        this.applyPlaybackMode(existing, targetVolume, nowMs);
        continue;
      }

      if (existing) {
        this.fadeOutAndDispose(existing.howl);
        this.managedByObjectId.delete(input.objectId);
      }

      const howl = new Howl({
        src: [soundFile],
        loop: playback === "loop",
        volume: 0,
        html5: false,
        onloaderror: (_id: number, error: unknown) => {
          const key = `${playbackKey}:load`;
          if (this.failedFileWarnings.has(key)) return;
          this.failedFileWarnings.add(key);
          console.warn(`[audio] failed to load element sound '${soundFile}'.`, error);
        },
        onplayerror: (_id: number, error: unknown) => {
          const key = `${playbackKey}:play`;
          if (this.failedFileWarnings.has(key)) return;
          this.failedFileWarnings.add(key);
          console.warn(`[audio] failed to play element sound '${soundFile}'.`, error);
        },
      });

      this.managedByObjectId.set(input.objectId, {
        soundId: playbackKey,
        howl,
        playback,
        hasPlayedOnceInCurrentVisibilityCycle: false,
        nextIntervalAtMs: nowMs,
        intervalMinMs,
        intervalMaxMs,
      });

      this.applyPlaybackMode(this.managedByObjectId.get(input.objectId)!, targetVolume, nowMs);
    }
  }

  private applyPlaybackMode(
    managed: ManagedElementSound,
    targetVolume: number,
    nowMs: number
  ): void {
    const { howl, playback } = managed;

    // Playback mode is registry-driven per element:
    // once = one trigger per visibility cycle, loop = continuous while visible, interval = timed retriggers.
    if (playback === "once") {
      howl.loop(false);
      if (!managed.hasPlayedOnceInCurrentVisibilityCycle) {
        try {
          howl.play();
          managed.hasPlayedOnceInCurrentVisibilityCycle = true;
        } catch (error) {
          console.warn(`[audio] failed to play once sound '${managed.soundId}'.`, error);
        }
      }
      howl.volume(targetVolume);
      return;
    }

    if (playback === "interval") {
      howl.loop(false);
      if (!howl.playing() && nowMs >= managed.nextIntervalAtMs) {
        try {
          howl.play();
        } catch (error) {
          console.warn(`[audio] failed to play interval sound '${managed.soundId}'.`, error);
        }
        managed.nextIntervalAtMs =
          nowMs + randomIntervalMs(managed.intervalMinMs, managed.intervalMaxMs);
      }
      howl.volume(targetVolume);
      return;
    }

    howl.loop(true);
    if (!howl.playing()) {
      try {
        howl.play();
      } catch (error) {
        console.warn(`[audio] failed to restart loop sound '${managed.soundId}'.`, error);
      }
    }
    howl.volume(targetVolume);
  }

  private fadeOutAndDispose(howl: Howl): void {
    const currentVolume = howl.volume();
    howl.fade(currentVolume, 0, STOP_FADE_MS);
    window.setTimeout(() => {
      howl.stop();
      howl.unload();
    }, STOP_FADE_MS + 20);
  }

  private debugInputs(inputs: ElementSoundInput[]): void {
    if (!import.meta.env.DEV) return;
    const signature = inputs
      .map((input) => `${input.objectId}:${normalizeAssetKey(input.assetId)}:${input.weight.toFixed(3)}`)
      .sort()
      .join("|");
    if (signature === this.debugSignature) return;
    this.debugSignature = signature;
    console.debug("[element-audio] active inputs", inputs);
  }
}

const sharedElementSoundEngine = new ElementSoundEngine();

export function resumeElementSoundEngine(): void {
  sharedElementSoundEngine.resume();
}

export function syncElementSounds(inputs: ElementSoundInput[]): void {
  sharedElementSoundEngine.sync(inputs);
}
