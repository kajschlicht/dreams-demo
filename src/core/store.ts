import { create } from "zustand";
import type { DreamParams } from "./params";
import { defaultParams, normalizeParams } from "./params";
import type { ExperienceEvent, ExperienceState } from "../story/stateMachine";
import { nextState } from "../story/stateMachine";
import type { SceneModel } from "../story/sceneModel";
import { generateSceneFromParams } from "../story/generateScene";
import { atmospheres } from "../data/atmospheres";
import {
  buildElementsRegistryFromSources,
  defaultElementsRegistry,
  normalizeRegistryEntry,
  registryById,
  type ElementsRegistryEntry,
} from "../data/elementsRegistry";
import { DEFAULT_THEME_NAME, type ThemeName } from "../theme";
import {
  createDefaultArchetypesState,
  type ArchetypeStateItem,
} from "../world/morphTimeline";

function normalizedArchetypeKey(value: string): string {
  return value.replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function archetypeIdFromAssetFile(file: string): string {
  const fileName = file.split("/").pop() ?? file;
  return fileName.replace(/\.glb$/i, "");
}

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function clampStoryScale(value: number): number {
  return Math.min(1.5, Math.max(0.1, value));
}

function clampStoryOffsetX(value: number): number {
  return Math.min(6, Math.max(-6, value));
}

function clampStoryTransition(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function clampStoryStay(value: number): number {
  return Math.min(2, Math.max(0, value));
}

function clampVolume(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function moveItem<T>(array: T[], fromIndex: number, toIndex: number): T[] {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= array.length ||
    toIndex >= array.length ||
    fromIndex === toIndex
  ) {
    return array;
  }
  const next = [...array];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
}

export type AppMode = "edit" | "experience";
export type TopPanel = "story" | "elements" | "atmosphere";
const atmosphereIds = new Set(atmospheres.map((atmosphere) => atmosphere.id));
const ELEMENTS_REGISTRY_STORAGE_KEY = "traumarchiv.elementsRegistry";
const GLOBAL_ELEMENT_FADE_STORAGE_KEY = "traumarchiv.globalElementFade";

export type StoryObject = {
  id: string;
  assetId: string;
  enabled: boolean;
  expanded: boolean;
  orientationX: number;
  orientationY: number;
  orientationZ: number;
  transitionIn: number;
  stay: number;
  transitionOut: number;
  param1: number;
  param2: number;
  param3: number;
};

export type DemoScene = {
  storyObjects: StoryObject[];
  selectedAtmosphereId: string | null;
  sceneModeValue: number;
  storyText: string;
};

function createStoryObjectId(assetId: string): string {
  return `${assetId}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

function cloneStoryObjects(storyObjects: StoryObject[]): StoryObject[] {
  return storyObjects.map((storyObject) => ({ ...storyObject }));
}

function syncArchetypesFromStoryObjects(
  archetypes: ArchetypeStateItem[],
  storyObjects: StoryObject[],
  assetFileById: Map<string, string>
): ArchetypeStateItem[] {
  const archetypeByKey = new Map(
    archetypes.map((archetype) => [normalizedArchetypeKey(archetype.id), archetype])
  );
  const activeKeys = new Set<string>();
  const orderedActiveKeys: string[] = [];

  for (const storyObject of storyObjects) {
    if (!storyObject.enabled) continue;
    const file = assetFileById.get(storyObject.assetId);
    if (!file) continue;
    const key = normalizedArchetypeKey(archetypeIdFromAssetFile(file));
    if (!archetypeByKey.has(key) || activeKeys.has(key)) continue;
    activeKeys.add(key);
    orderedActiveKeys.push(key);
  }

  const activeArchetypes = orderedActiveKeys
    .map((key) => archetypeByKey.get(key))
    .filter((archetype): archetype is ArchetypeStateItem => Boolean(archetype))
    .map((archetype) => ({ ...archetype, active: true }));
  const inactiveArchetypes = archetypes
    .filter((archetype) => !activeKeys.has(normalizedArchetypeKey(archetype.id)))
    .map((archetype) => ({ ...archetype, active: false }));

  return [...activeArchetypes, ...inactiveArchetypes];
}

const THEME_STORAGE_KEY = "traumarchiv.theme";
const DEMO_SCENE_STORAGE_KEY = "traumarchiv.savedDemoScene";

function readInitialThemeName(): ThemeName {
  if (typeof window === "undefined") return DEFAULT_THEME_NAME;
  const stored = window.localStorage.getItem(THEME_STORAGE_KEY);
  return stored === "dark" || stored === "light" ? stored : DEFAULT_THEME_NAME;
}

function readInitialElementsRegistry(): ElementsRegistryEntry[] {
  if (typeof window === "undefined") return defaultElementsRegistry;
  const raw = window.localStorage.getItem(ELEMENTS_REGISTRY_STORAGE_KEY);
  if (!raw) return defaultElementsRegistry;
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return defaultElementsRegistry;
    const fallbackById = registryById(defaultElementsRegistry);
    const normalized = parsed
      .map((entry) => {
        const fallback = typeof entry?.id === "string" ? fallbackById.get(entry.id) : undefined;
        return normalizeRegistryEntry(entry, fallback);
      })
      .filter((entry): entry is ElementsRegistryEntry => Boolean(entry));
    return normalized.length > 0 ? normalized : defaultElementsRegistry;
  } catch (error) {
    console.warn("[registry] failed to parse elements registry from localStorage.", error);
    return defaultElementsRegistry;
  }
}

function persistElementsRegistry(registry: ElementsRegistryEntry[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ELEMENTS_REGISTRY_STORAGE_KEY, JSON.stringify(registry));
}

function readInitialGlobalElementFade(): number {
  if (typeof window === "undefined") return 0.1;
  const raw = window.localStorage.getItem(GLOBAL_ELEMENT_FADE_STORAGE_KEY);
  const value = Number(raw);
  return Number.isFinite(value) ? clampStoryTransition(value) : 0.1;
}

function persistGlobalElementFade(value: number): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(GLOBAL_ELEMENT_FADE_STORAGE_KEY, String(clampStoryTransition(value)));
}

function normalizeDemoScene(raw: unknown): DemoScene | null {
  if (!raw || typeof raw !== "object") return null;
  const source = raw as Partial<DemoScene> & { storyObjects?: unknown };
  if (!Array.isArray(source.storyObjects)) return null;
  const storyObjects = source.storyObjects
    .filter((entry): entry is StoryObject => Boolean(entry && typeof entry === "object"))
    .map((entry) => ({
      id: String(entry.id ?? ""),
      assetId: String(entry.assetId ?? ""),
      enabled: Boolean(entry.enabled),
      expanded: Boolean(entry.expanded),
      orientationX: Number.isFinite(entry.orientationX) ? Number(entry.orientationX) : 0,
      orientationY: Number.isFinite(entry.orientationY) ? Number(entry.orientationY) : 0,
      orientationZ: Number.isFinite(entry.orientationZ) ? Number(entry.orientationZ) : 0,
      transitionIn: clampStoryTransition(Number(entry.transitionIn ?? 0.1)),
      stay: clampStoryStay(Number(entry.stay ?? 0.5)),
      transitionOut: clampStoryTransition(Number(entry.transitionOut ?? 0.1)),
      param1: clampStoryScale(Number(entry.param1 ?? 1)),
      param2: clampStoryOffsetX(Number(entry.param2 ?? 0)),
      param3: clamp01(Number(entry.param3 ?? 0)),
    }))
    .filter((entry) => entry.id.length > 0 && entry.assetId.length > 0);
  const selectedAtmosphereId =
    typeof source.selectedAtmosphereId === "string" && atmosphereIds.has(source.selectedAtmosphereId)
      ? source.selectedAtmosphereId
      : null;
  const sceneModeValue = clamp01(Number(source.sceneModeValue ?? 0.5));
  const storyText = typeof source.storyText === "string" ? source.storyText : "";
  return { storyObjects, selectedAtmosphereId, sceneModeValue, storyText };
}

function readInitialSavedDemoScene(): DemoScene | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(DEMO_SCENE_STORAGE_KEY);
  if (!raw) return null;
  try {
    return normalizeDemoScene(JSON.parse(raw));
  } catch (error) {
    console.warn("[demo] failed to parse saved demo scene.", error);
    return null;
  }
}

function persistDemoScene(scene: DemoScene | null): void {
  if (typeof window === "undefined") return;
  if (!scene) {
    window.localStorage.removeItem(DEMO_SCENE_STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(DEMO_SCENE_STORAGE_KEY, JSON.stringify(scene));
}

interface AppState {
  state: ExperienceState;
  params: DreamParams;
  scene: SceneModel;
  progress: number;
  lockState: boolean;
  cloudStrength: number;
  sceneModeValue: number;
  mode: AppMode;
  activeTopPanel: TopPanel | null;
  isDeveloperModeOpen: boolean;
  isDemoVisible: boolean;
  savedDemoScene: DemoScene | null;
  themeName: ThemeName;
  selectedAtmosphereId: string | null;
  atmosphereBedLevel: number;
  globalElementFade: number;
  elementsRegistry: ElementsRegistryEntry[];
  storyObjects: StoryObject[];
  archetypes: ArchetypeStateItem[];
  regenerateScene: () => void;

  storyText: string;
  setStoryText: (text: string) => void;

  scriptText: string;
  setScriptText: (text: string) => void;

  dispatch: (event: ExperienceEvent) => void;
  setParams: (partial: Partial<DreamParams>) => void;
  setProgress: (v: number) => void;
  setLockState: (v: boolean) => void;
  setCloudStrength: (v: number) => void;
  setSceneModeValue: (value: number) => void;
  setMode: (mode: AppMode) => void;
  setActiveTopPanel: (panel: TopPanel | null) => void;
  setDeveloperModeOpen: (open: boolean) => void;
  setDemoVisible: (visible: boolean) => void;
  toggleDemoVisible: () => void;
  saveCurrentSceneAsDemo: () => void;
  clearDemoScene: () => void;
  setTheme: (themeName: ThemeName) => void;
  setSelectedAtmosphereId: (id: string | null) => void;
  setAtmosphereBedLevel: (value: number) => void;
  setGlobalElementFade: (value: number) => void;
  updateElementsRegistryEntry: (id: string, patch: Partial<ElementsRegistryEntry>) => void;
  saveElementsRegistry: () => void;
  resetElementsRegistry: () => void;
  rescanElementsRegistryAssets: () => void;
  addStoryObject: (assetId: string) => void;
  toggleStoryObjectEnabled: (id: string) => void;
  toggleStoryObjectExpanded: (id: string) => void;
  removeStoryObject: (id: string) => void;
  reorderStoryObjects: (fromIndex: number, toIndex: number) => void;
  updateStoryObjectParam: (
    id: string,
    patch: Partial<
      Pick<
        StoryObject,
        | "param1"
        | "param2"
        | "param3"
        | "orientationX"
        | "orientationY"
        | "orientationZ"
        | "transitionIn"
        | "stay"
        | "transitionOut"
      >
    >
  ) => void;
  applyRehearsalStep: () => void;

  panic: () => void;
  reset: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  state: "intro",
  params: defaultParams,
  scene: generateSceneFromParams(defaultParams, 1),
  progress: 0,
  lockState: false,
  cloudStrength: 0.35,
  sceneModeValue: 0.5,
  mode: "edit",
  activeTopPanel: null,
  isDeveloperModeOpen: false,
  isDemoVisible: false,
  savedDemoScene: readInitialSavedDemoScene(),
  themeName: readInitialThemeName(),
  selectedAtmosphereId: null,
  atmosphereBedLevel: 0.5,
  globalElementFade: readInitialGlobalElementFade(),
  elementsRegistry: readInitialElementsRegistry(),
  storyObjects: [],
  archetypes: createDefaultArchetypesState(),
  regenerateScene: () =>
    set((s) => ({
      scene: generateSceneFromParams(s.params, s.scene.seed ?? 1),
    })),

  storyText: "",
  setStoryText: (text) => set({ storyText: text, scriptText: text }),

  scriptText: "",
  setScriptText: (text) => set({ scriptText: text, storyText: text }),

  dispatch: (event) =>
    set((s) => {
      const nextText = event.type === "SUBMIT_SCRIPT" ? event.script : s.scriptText;
      return {
        state: nextState(s.state, event),
        scriptText: nextText,
        storyText: nextText,
      };
    }),

  setParams: (partial) =>
    set((s) => {
      const nextParams = normalizeParams({ ...s.params, ...partial });
      return {
        params: nextParams,
        scene: generateSceneFromParams(nextParams, s.scene.seed ?? 1),
      };
    }),
  setProgress: (v) => set({ progress: Math.min(1, Math.max(0, v)) }),
  setLockState: (v) => set({ lockState: Boolean(v) }),
  setCloudStrength: (v) => set({ cloudStrength: Math.min(1, Math.max(0, v)) }),
  setSceneModeValue: (value) => set({ sceneModeValue: clamp01(value) }),
  setMode: (mode) => set({ mode }),
  setActiveTopPanel: (panel) => set({ activeTopPanel: panel }),
  setDeveloperModeOpen: (open) => set({ isDeveloperModeOpen: Boolean(open) }),
  setDemoVisible: (visible) => set({ isDemoVisible: Boolean(visible) }),
  toggleDemoVisible: () =>
    set((s) => {
      if (!s.savedDemoScene) return { isDemoVisible: false };
      return { isDemoVisible: !s.isDemoVisible };
    }),
  saveCurrentSceneAsDemo: () =>
    set((s) => {
      const snapshot: DemoScene = {
        storyObjects: cloneStoryObjects(s.storyObjects),
        selectedAtmosphereId: s.selectedAtmosphereId,
        sceneModeValue: s.sceneModeValue,
        storyText: s.storyText,
      };
      persistDemoScene(snapshot);
      return {
        savedDemoScene: snapshot,
      };
    }),
  clearDemoScene: () =>
    set(() => {
      persistDemoScene(null);
      return {
        savedDemoScene: null,
        isDemoVisible: false,
      };
    }),
  setTheme: (themeName) =>
    set(() => {
      const safeTheme: ThemeName = themeName === "dark" ? "dark" : "light";
      if (typeof window !== "undefined") {
        window.localStorage.setItem(THEME_STORAGE_KEY, safeTheme);
      }
      return { themeName: safeTheme };
    }),
  setSelectedAtmosphereId: (id) =>
    set(() => ({
      selectedAtmosphereId: id && atmosphereIds.has(id) ? id : null,
    })),
  setAtmosphereBedLevel: (value) =>
    set(() => ({
      atmosphereBedLevel: clampVolume(value),
    })),
  setGlobalElementFade: (value) =>
    set((s) => {
      const nextFade = clampStoryTransition(value);
      persistGlobalElementFade(nextFade);
      return {
        globalElementFade: nextFade,
        storyObjects: s.storyObjects.map((storyObject) => ({
          ...storyObject,
          transitionIn: nextFade,
          transitionOut: nextFade,
        })),
      };
    }),
  updateElementsRegistryEntry: (id, patch) =>
    set((s) => {
      const nextRegistry = s.elementsRegistry.map((entry) => {
        if (entry.id !== id) return entry;
        return normalizeRegistryEntry({ ...entry, ...patch }, entry) ?? entry;
      });
      persistElementsRegistry(nextRegistry);
      return { elementsRegistry: nextRegistry };
    }),
  saveElementsRegistry: () =>
    set((s) => {
      persistElementsRegistry(s.elementsRegistry);
      return {};
    }),
  resetElementsRegistry: () =>
    set((s) => {
      const nextDefaults = buildElementsRegistryFromSources();
      persistElementsRegistry(nextDefaults);
      return {
        elementsRegistry: nextDefaults,
        storyObjects: s.storyObjects.map((storyObject) => ({ ...storyObject, expanded: false })),
      };
    }),
  rescanElementsRegistryAssets: () =>
    set((s) => {
      const scanned = buildElementsRegistryFromSources();
      const currentById = registryById(s.elementsRegistry);
      // Keep user-edited registry fields (sound/default params) while refreshing asset/file discovery.
      const merged = scanned.map((entry) => {
        const existing = currentById.get(entry.id);
        if (!existing) return entry;
        return normalizeRegistryEntry(
          {
            ...entry,
            name: existing.name,
            category: existing.category,
            tags: existing.tags,
            soundFile: existing.soundFile,
            soundPlayback: existing.soundPlayback,
            soundIntervalMinMs: existing.soundIntervalMinMs,
            soundIntervalMaxMs: existing.soundIntervalMaxMs,
            defaultSize: existing.defaultSize,
            defaultMode: existing.defaultMode,
            defaultOrientation: existing.defaultOrientation,
            defaultOffsetX: existing.defaultOffsetX,
          },
          entry
        ) ?? entry;
      });
      const validAssetIds = new Set(merged.map((entry) => entry.id));
      const nextStoryObjects = s.storyObjects.filter((storyObject) =>
        validAssetIds.has(storyObject.assetId)
      );
      const assetFileById = new Map(
        merged
          .filter((entry) => entry.type === "glb" && Boolean(entry.glbFile))
          .map((entry) => [entry.id, entry.glbFile ?? ""])
      );
      persistElementsRegistry(merged);
      return {
        elementsRegistry: merged,
        storyObjects: nextStoryObjects,
        archetypes: syncArchetypesFromStoryObjects(
          s.archetypes,
          nextStoryObjects,
          assetFileById
        ),
      };
    }),
  addStoryObject: (assetId) =>
    set((s) => {
      const registryEntry = s.elementsRegistry.find((entry) => entry.id === assetId);
      if (!registryEntry) return { storyObjects: s.storyObjects };
      const assetFileById = new Map(
        s.elementsRegistry
          .filter((entry) => entry.type === "glb" && Boolean(entry.glbFile))
          .map((entry) => [entry.id, entry.glbFile ?? ""])
      );
      const nextStoryObjects: StoryObject[] = [
        ...s.storyObjects,
        {
          id: createStoryObjectId(assetId),
          assetId,
          enabled: true,
          expanded: false,
          orientationX: 0,
          orientationY: registryEntry.defaultOrientation ?? 0,
          orientationZ: 0,
          transitionIn: s.globalElementFade,
          stay: 0.5,
          transitionOut: s.globalElementFade,
          param1: registryEntry.defaultSize ?? 1,
          param2: registryEntry.defaultOffsetX ?? 0,
          param3: registryEntry.defaultMode ?? 0,
        },
      ];
      return {
        storyObjects: nextStoryObjects,
        archetypes: syncArchetypesFromStoryObjects(
          s.archetypes,
          nextStoryObjects,
          assetFileById
        ),
      };
    }),
  toggleStoryObjectEnabled: (id) =>
    set((s) => {
      const assetFileById = new Map(
        s.elementsRegistry
          .filter((entry) => entry.type === "glb" && Boolean(entry.glbFile))
          .map((entry) => [entry.id, entry.glbFile ?? ""])
      );
      const nextStoryObjects = s.storyObjects.map((storyObject) =>
        storyObject.id === id ? { ...storyObject, enabled: !storyObject.enabled } : storyObject
      );
      return {
        storyObjects: nextStoryObjects,
        archetypes: syncArchetypesFromStoryObjects(
          s.archetypes,
          nextStoryObjects,
          assetFileById
        ),
      };
    }),
  toggleStoryObjectExpanded: (id) =>
    set((s) => ({
      storyObjects: s.storyObjects.map((storyObject) =>
        storyObject.id === id ? { ...storyObject, expanded: !storyObject.expanded } : storyObject
      ),
    })),
  removeStoryObject: (id) =>
    set((s) => {
      const assetFileById = new Map(
        s.elementsRegistry
          .filter((entry) => entry.type === "glb" && Boolean(entry.glbFile))
          .map((entry) => [entry.id, entry.glbFile ?? ""])
      );
      const nextStoryObjects = s.storyObjects.filter((storyObject) => storyObject.id !== id);
      return {
        storyObjects: nextStoryObjects,
        archetypes: syncArchetypesFromStoryObjects(
          s.archetypes,
          nextStoryObjects,
          assetFileById
        ),
      };
    }),
  reorderStoryObjects: (fromIndex, toIndex) =>
    set((s) => {
      const assetFileById = new Map(
        s.elementsRegistry
          .filter((entry) => entry.type === "glb" && Boolean(entry.glbFile))
          .map((entry) => [entry.id, entry.glbFile ?? ""])
      );
      const nextStoryObjects = moveItem(s.storyObjects, fromIndex, toIndex);
      return {
        storyObjects: nextStoryObjects,
        archetypes: syncArchetypesFromStoryObjects(
          s.archetypes,
          nextStoryObjects,
          assetFileById
        ),
      };
    }),
  updateStoryObjectParam: (id, patch) =>
    set((s) => ({
      storyObjects: s.storyObjects.map((storyObject) => {
        if (storyObject.id !== id) return storyObject;
        return {
          ...storyObject,
          param1:
            patch.param1 === undefined
              ? storyObject.param1 ?? 1
              : clampStoryScale(patch.param1),
          param2:
            patch.param2 === undefined
              ? storyObject.param2 ?? 0
              : clampStoryOffsetX(patch.param2),
          orientationX:
            patch.orientationX === undefined
              ? storyObject.orientationX ?? 0
              : Math.min(180, Math.max(-180, patch.orientationX)),
          orientationY:
            patch.orientationY === undefined
              ? storyObject.orientationY ?? 0
              : Math.min(180, Math.max(-180, patch.orientationY)),
          orientationZ:
            patch.orientationZ === undefined
              ? storyObject.orientationZ ?? 0
              : Math.min(180, Math.max(-180, patch.orientationZ)),
          transitionIn:
            patch.transitionIn === undefined
              ? storyObject.transitionIn ?? 0.1
              : clampStoryTransition(patch.transitionIn),
          stay:
            patch.stay === undefined
              ? storyObject.stay ?? 0.5
              : clampStoryStay(patch.stay),
          transitionOut:
            patch.transitionOut === undefined
              ? storyObject.transitionOut ?? 0.1
              : clampStoryTransition(patch.transitionOut),
          param3:
            patch.param3 === undefined
              ? storyObject.param3 ?? 0
              : clamp01(patch.param3),
        };
      }),
    })),

  applyRehearsalStep: () => {
    const { params, setParams } = get();
    setParams({
      transformationLevel: params.transformationLevel + 0.2,
      threat: params.threat - 0.25,
      control: params.control + 0.2,
      light: params.light + 0.15,
      space: params.space + 0.15,
    });
  },

  panic: () =>
    set((s) => ({
      state: "coolDown",
      params: normalizeParams({
        ...s.params,
        threat: 0,
        control: Math.max(s.params.control, 0.7),
        light: Math.max(s.params.light, 0.7),
      }),
    })),

  reset: () =>
    set({
      state: "intro",
      params: defaultParams,
      storyText: "",
      scriptText: "",
      progress: 0,
      lockState: false,
      cloudStrength: 0.35,
      sceneModeValue: 0.5,
      mode: "edit",
      activeTopPanel: null,
      isDeveloperModeOpen: false,
      isDemoVisible: false,
      savedDemoScene: readInitialSavedDemoScene(),
      selectedAtmosphereId: null,
      atmosphereBedLevel: 0.5,
      globalElementFade: readInitialGlobalElementFade(),
      elementsRegistry: readInitialElementsRegistry(),
      storyObjects: [],
      archetypes: createDefaultArchetypesState(),
    }),
}));

export function selectRenderableStoryObjects(state: AppState): StoryObject[] {
  if (state.isDemoVisible && state.savedDemoScene) {
    return state.savedDemoScene.storyObjects;
  }
  return state.storyObjects;
}

export function selectRenderableSelectedAtmosphereId(state: AppState): string | null {
  if (state.isDemoVisible && state.savedDemoScene) {
    return state.savedDemoScene.selectedAtmosphereId;
  }
  return state.selectedAtmosphereId;
}
