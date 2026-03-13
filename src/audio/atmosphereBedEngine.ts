import { Howl, Howler } from "howler";
import { useAppStore } from "../core/store";
import { resolveSceneModeAudioSettings } from "../core/sceneMode";
import { atmospheres } from "../data/atmospheres";
import { applySceneModeAudioFilter } from "./sceneModeAudio";

// Historical naming kept for compatibility with existing imports.
const atmosphereById = new Map(atmospheres.map((atmosphere) => [atmosphere.id, atmosphere]));
const CROSSFADE_MS = 420;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

class AtmosphereBedEngine {
  private currentHowl: Howl | null = null;
  private currentAtmosphereId: string | null = null;
  private missingFileWarnings = new Set<string>();
  private failedFileWarnings = new Set<string>();
  private unknownWarnings = new Set<string>();
  private lastDebugSignature = "";

  resume(): void {
    if (typeof window === "undefined") return;
    const howlerContext = (Howler as unknown as { ctx?: AudioContext }).ctx;
    if (howlerContext && howlerContext.state === "suspended") {
      void howlerContext.resume();
    }
  }

  sync(selectedAtmosphereId: string | null, level: number): void {
    if (typeof window === "undefined") return;

    const sceneModeValue = useAppStore.getState().sceneModeValue;
    const sceneAudio = resolveSceneModeAudioSettings(sceneModeValue);
    applySceneModeAudioFilter(sceneModeValue);
    const safeLevel = clamp01(level * sceneAudio.volumeMultiplier);

    if (!selectedAtmosphereId) {
      this.debugSync(selectedAtmosphereId, undefined, safeLevel);
      this.fadeOutCurrent();
      return;
    }

    const atmosphere = atmosphereById.get(selectedAtmosphereId);
    if (!atmosphere) {
      if (!this.unknownWarnings.has(selectedAtmosphereId)) {
        this.unknownWarnings.add(selectedAtmosphereId);
        console.warn(`[audio] unknown atmosphere '${selectedAtmosphereId}'.`);
      }
      this.debugSync(selectedAtmosphereId, undefined, safeLevel);
      this.fadeOutCurrent();
      return;
    }

    this.debugSync(atmosphere.id, atmosphere.soundFile, safeLevel);

    if (!atmosphere.soundFile) {
      if (!this.missingFileWarnings.has(atmosphere.id)) {
        this.missingFileWarnings.add(atmosphere.id);
        console.warn("Atmosphere sound missing:", atmosphere.soundFile);
        console.warn(`[audio] atmosphere audio not available for '${atmosphere.id}'.`);
      }
      this.fadeOutCurrent();
      return;
    }

    if (this.currentHowl && this.currentAtmosphereId === atmosphere.id) {
      this.currentHowl.volume(safeLevel);
      return;
    }

    const nextHowl = new Howl({
      src: [atmosphere.soundFile],
      loop: true,
      volume: 0,
      html5: false,
      onloaderror: (_id: number, error: unknown) => {
        const key = `${atmosphere.id}:load`;
        if (this.failedFileWarnings.has(key)) return;
        this.failedFileWarnings.add(key);
        console.warn("Atmosphere sound missing:", atmosphere.soundFile);
        console.warn(`[audio] failed to load atmosphere sound '${atmosphere.soundFile}'.`, error);
      },
      onplayerror: (_id: number, error: unknown) => {
        const key = `${atmosphere.id}:play`;
        if (this.failedFileWarnings.has(key)) return;
        this.failedFileWarnings.add(key);
        console.warn(`[audio] failed to play atmosphere sound '${atmosphere.soundFile}'.`, error);
      },
    });

    try {
      nextHowl.play();
    } catch (error) {
      console.warn(`[audio] could not start atmosphere '${atmosphere.id}'.`, error);
      return;
    }

    const previousHowl = this.currentHowl;
    const previousVolume = previousHowl?.volume() ?? 0;

    this.currentHowl = nextHowl;
    this.currentAtmosphereId = atmosphere.id;

    nextHowl.fade(0, safeLevel, CROSSFADE_MS);

    if (previousHowl) {
      previousHowl.fade(previousVolume, 0, CROSSFADE_MS);
      window.setTimeout(() => {
        previousHowl.stop();
        previousHowl.unload();
      }, CROSSFADE_MS + 20);
    }
  }

  private fadeOutCurrent(): void {
    if (!this.currentHowl) {
      this.currentAtmosphereId = null;
      return;
    }

    const previousHowl = this.currentHowl;
    const previousVolume = previousHowl.volume();
    this.currentHowl = null;
    this.currentAtmosphereId = null;

    previousHowl.fade(previousVolume, 0, CROSSFADE_MS);
    window.setTimeout(() => {
      previousHowl.stop();
      previousHowl.unload();
    }, CROSSFADE_MS + 20);
  }

  private debugSync(
    selectedAtmosphereId: string | null,
    soundFile: string | undefined,
    level: number
  ): void {
    if (!import.meta.env.DEV) return;
    const signature = `${selectedAtmosphereId ?? "none"}|${soundFile ?? "none"}|${level.toFixed(3)}`;
    if (signature === this.lastDebugSignature) return;
    this.lastDebugSignature = signature;
    console.debug("[atmosphere-audio]", {
      selectedAtmosphereId,
      soundFile: soundFile ?? null,
      atmosphereIntensity: Number(level.toFixed(3)),
    });
  }
}

const sharedAtmosphereBedEngine = new AtmosphereBedEngine();

export function resumeAtmosphereBedEngine(): void {
  sharedAtmosphereBedEngine.resume();
}

export function syncAtmosphereBed(selectedAtmosphereId: string | null, level: number): void {
  sharedAtmosphereBedEngine.sync(selectedAtmosphereId, level);
}
