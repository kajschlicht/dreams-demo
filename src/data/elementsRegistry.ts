import {
  getExactElementSoundForGlbFile,
  isExactElementSoundForGlbFile,
} from "./elementSoundFiles";
import {
  glbLibrary,
  type ElementAssetType,
  type ElementEffectType,
  type GLBAsset,
  type GLBCategory,
} from "./glbLibrary";

export type ElementSoundPlayback = "once" | "loop" | "interval";

export type ElementsRegistryEntry = {
  id: string;
  name: string;
  type: ElementAssetType;
  category: GLBCategory;
  tags: string[];
  glbFile?: string;
  effectType?: ElementEffectType;
  soundFile?: string;
  soundPlayback: ElementSoundPlayback;
  soundIntervalMinMs: number;
  soundIntervalMaxMs: number;
  defaultSize: number;
  defaultOrientation: number;
  defaultMode: number;
  defaultOffsetX: number;
  defaultFade: number;
};

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function defaultSoundFileForAsset(asset: GLBAsset): string | undefined {
  if ((asset.type ?? "glb") !== "glb") return undefined;
  return getExactElementSoundForGlbFile(asset.file);
}

function sanitizeSoundFileByExactMatch(
  glbFile: string | undefined,
  soundFile: string | undefined
): string | undefined {
  if (!glbFile) return undefined;
  if (!soundFile) return getExactElementSoundForGlbFile(glbFile);
  return isExactElementSoundForGlbFile(glbFile, soundFile)
    ? soundFile
    : getExactElementSoundForGlbFile(glbFile);
}

function toRegistryEntry(asset: GLBAsset): ElementsRegistryEntry {
  const assetType: ElementAssetType = asset.type ?? "glb";
  const glbFile = assetType === "glb" ? asset.file : undefined;
  return {
    id: asset.id,
    name: asset.name,
    type: assetType,
    category: asset.category,
    tags: [...asset.tags],
    glbFile,
    effectType: assetType === "effect" ? asset.effectType : undefined,
    soundFile: defaultSoundFileForAsset(asset),
    soundPlayback: "loop",
    soundIntervalMinMs: 1600,
    soundIntervalMaxMs: 3200,
    defaultSize: 1,
    defaultOrientation: 0,
    defaultMode: 0,
    defaultOffsetX: 0,
    defaultFade: 0.1,
  };
}

export function buildElementsRegistryFromSources(): ElementsRegistryEntry[] {
  return glbLibrary.map(toRegistryEntry);
}

export const defaultElementsRegistry: ElementsRegistryEntry[] = buildElementsRegistryFromSources();

export function normalizeRegistryEntry(
  raw: Partial<ElementsRegistryEntry>,
  fallback?: ElementsRegistryEntry
): ElementsRegistryEntry | null {
  const id = (raw.id ?? fallback?.id ?? "").trim();
  const name = (raw.name ?? fallback?.name ?? "").trim();
  if (!id || !name) return null;

  const type: ElementAssetType =
    (raw.type ?? fallback?.type ?? "glb") === "effect" ? "effect" : "glb";
  const category = raw.category ?? fallback?.category ?? "other";
  const tagsSource = raw.tags ?? fallback?.tags ?? [];
  const tags = Array.isArray(tagsSource)
    ? tagsSource.map((tag) => String(tag).trim()).filter(Boolean)
    : [];

  const soundPlayback = raw.soundPlayback ?? fallback?.soundPlayback ?? "loop";
  const glbFile = type === "glb" ? raw.glbFile ?? fallback?.glbFile ?? undefined : undefined;

  return {
    id,
    name,
    type,
    category,
    tags,
    glbFile,
    effectType: raw.effectType ?? fallback?.effectType ?? undefined,
    soundFile:
      type === "glb"
        ? sanitizeSoundFileByExactMatch(glbFile, raw.soundFile ?? fallback?.soundFile ?? undefined)
        : undefined,
    soundPlayback:
      soundPlayback === "once" || soundPlayback === "interval" ? soundPlayback : "loop",
    soundIntervalMinMs: clamp(
      Number(raw.soundIntervalMinMs ?? fallback?.soundIntervalMinMs ?? 1600),
      100,
      60000
    ),
    soundIntervalMaxMs: clamp(
      Number(raw.soundIntervalMaxMs ?? fallback?.soundIntervalMaxMs ?? 3200),
      100,
      120000
    ),
    defaultSize: clamp(Number(raw.defaultSize ?? fallback?.defaultSize ?? 1), 0.1, 1.5),
    defaultOrientation: clamp(
      Number(raw.defaultOrientation ?? fallback?.defaultOrientation ?? 0),
      -180,
      180
    ),
    defaultMode: clamp(Number(raw.defaultMode ?? fallback?.defaultMode ?? 0), 0, 1),
    defaultOffsetX: clamp(Number(raw.defaultOffsetX ?? fallback?.defaultOffsetX ?? 0), -6, 6),
    defaultFade: clamp(Number(raw.defaultFade ?? fallback?.defaultFade ?? 0.1), 0, 1),
  };
}

export function registryToLibrary(registry: ElementsRegistryEntry[]): GLBAsset[] {
  return registry.map((entry) => ({
    id: entry.id,
    name: entry.name,
    type: entry.type,
    category: entry.category,
    tags: entry.tags,
    file: entry.type === "glb" ? entry.glbFile ?? "" : "",
    effectType: entry.type === "effect" ? entry.effectType : undefined,
  }));
}

export function registryById(registry: ElementsRegistryEntry[]): Map<string, ElementsRegistryEntry> {
  return new Map(registry.map((entry) => [entry.id, entry]));
}
