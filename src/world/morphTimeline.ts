export const MORPH_SPEED = 2.5;
export const BUILD_END = 0.55;
export const HOLD_END = 0.7;
export const DEPTH_FAR_Z = -5;
export const DEPTH_FOCUS_Z = 0;
export const DEPTH_NEAR_Z = 1.5;

export type ArchetypeId = string;

export type ArchetypeDef = {
  id: ArchetypeId;
  label: string;
  url: string;
  originalIndex: number;
};

export type ArchetypeStateItem = ArchetypeDef & {
  active: boolean;
};

const glbModules = import.meta.glob("../assets/glb/*.glb", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

function pathToId(path: string): string {
  const file = path.split("/").pop() ?? path;
  return file.replace(/\.glb$/i, "");
}

export const ARCHETYPES: ArchetypeDef[] = Object.entries(glbModules)
  .map(([path, url]) => ({
    id: pathToId(path),
    label: pathToId(path),
    url,
  }))
  .sort((a, b) => a.id.localeCompare(b.id, undefined, { sensitivity: "base" }))
  .map((a, index) => ({
    ...a,
    originalIndex: index,
  }));

export const ARCHETYPE_URLS = ARCHETYPES.map((a) => a.url);

export function createDefaultArchetypesState(): ArchetypeStateItem[] {
  return ARCHETYPES.map((archetype) => ({ ...archetype, active: false }));
}

export function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

export function smoothstep(edge0: number, edge1: number, x: number): number {
  if (edge0 === edge1) return x < edge0 ? 0 : 1;
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}

export function subtleDepthOffset(localProgress: number): number {
  const p = clamp01(localProgress);
  if (p < 0.5) {
    const t = smoothstep(0, 1, p / 0.5);
    return DEPTH_FAR_Z + (DEPTH_FOCUS_Z - DEPTH_FAR_Z) * t;
  }
  const t = smoothstep(0, 1, (p - 0.5) / 0.5);
  return DEPTH_FOCUS_Z + (DEPTH_NEAR_Z - DEPTH_FOCUS_Z) * t;
}

export function getVisibleArchetypes(archetypes: ArchetypeStateItem[]): ArchetypeDef[] {
  return archetypes.filter((a) => a.active);
}

export function computeSegmentMix(localT: number): { wCloud: number; wTarget: number } {
  const t = clamp01(localT);
  let wTarget = 0;
  if (t <= BUILD_END) {
    wTarget = smoothstep(0, BUILD_END, t);
  } else if (t <= HOLD_END) {
    wTarget = 1;
  } else {
    wTarget = 1 - smoothstep(HOLD_END, 1, t);
  }
  return { wTarget, wCloud: 1 - wTarget };
}

export function computeSegmentState(progress: number, segmentCount: number): {
  segIndex: number;
  localT: number;
  wCloud: number;
  wTarget: number;
} {
  if (segmentCount <= 0) {
    return { segIndex: 0, localT: 0, wCloud: 1, wTarget: 0 };
  }
  const p = clamp01(progress);
  const segFloat = p * segmentCount;
  const segIndex =
    p >= 1
      ? segmentCount - 1
      : Math.max(0, Math.min(segmentCount - 1, Math.floor(segFloat)));
  const localT = p >= 1 ? 1 : segFloat - segIndex;
  const { wCloud, wTarget } = computeSegmentMix(localT);
  return { segIndex, localT, wCloud, wTarget };
}
