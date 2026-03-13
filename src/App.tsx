import { useEffect, useMemo, useRef } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import {
  selectRenderableSelectedAtmosphereId,
  selectRenderableStoryObjects,
  useAppStore,
} from "./core/store";
import { getTheme } from "./theme";
import { ElementsPanel } from "./ui/GLBAssetLibrary";
import { StoryScriptPanel } from "./ui/StoryScriptPanel";
import { AtmospherePanel } from "./ui/SoundscapePanel";
import { StoryObjectTray } from "./ui/StoryObjectTray";
import { DeveloperRegistryPanel } from "./ui/DeveloperRegistryPanel";
import {
  computeProgressFromScrollY,
  getMaxScrollPx,
  progressRef,
  setTimelineTotalUnits,
} from "./world/scrollTimeline";
import { buildTimeline } from "./story/timeline";
import { World } from "./world/World";
import { resumeAtmosphereBedEngine, syncAtmosphereBed } from "./audio/atmosphereBedEngine";
import { resumeElementSoundEngine } from "./audio/elementSoundEngine";
import { applySceneModeAudioFilter } from "./audio/sceneModeAudio";

const DEFAULT_CAMERA_POSITION: [number, number, number] = [0, 0.8, 9];
const DEFAULT_CAMERA_TARGET: [number, number, number] = [0, 0, 0];

export default function App() {
  const themeName = useAppStore((s) => s.themeName);
  const activeTopPanel = useAppStore((s) => s.activeTopPanel);
  const setActiveTopPanel = useAppStore((s) => s.setActiveTopPanel);
  const isDeveloperModeOpen = useAppStore((s) => s.isDeveloperModeOpen);
  const setDeveloperModeOpen = useAppStore((s) => s.setDeveloperModeOpen);
  const sceneModeValue = useAppStore((s) => s.sceneModeValue);
  const setSceneModeValue = useAppStore((s) => s.setSceneModeValue);
  const storyObjects = useAppStore(selectRenderableStoryObjects);
  const selectedAtmosphereId = useAppStore(selectRenderableSelectedAtmosphereId);
  const atmosphereBedLevel = useAppStore((s) => s.atmosphereBedLevel);
  const orbitControlsRef = useRef<OrbitControlsImpl | null>(null);

  const theme = getTheme(themeName);
  const enabledStoryObjects = storyObjects.filter((storyObject) => storyObject.enabled);
  const timeline = useMemo(
    () =>
      buildTimeline(
        enabledStoryObjects.map((storyObject) => ({
          id: storyObject.id,
          assetId: storyObject.assetId,
          enabled: storyObject.enabled,
          transitionIn: storyObject.transitionIn ?? 0.1,
          stay: storyObject.stay ?? 0.5,
          transitionOut: storyObject.transitionOut ?? 0.1,
        }))
      ),
    [enabledStoryObjects]
  );
  const totalTimelineUnits = timeline.totalLength;
  const maxScrollPx = getMaxScrollPx(totalTimelineUnits);

  useEffect(() => {
    document.body.style.background = theme.sceneBackground;
    document.body.style.color = theme.uiTextActive;
    document.documentElement.style.colorScheme = themeName === "dark" ? "dark" : "light";
  }, [theme.sceneBackground, theme.uiTextActive, themeName]);

  useEffect(() => {
    setTimelineTotalUnits(totalTimelineUnits);
    const onScroll = () => {
      const y = window.scrollY;
      progressRef.current = computeProgressFromScrollY(y, totalTimelineUnits);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
    };
  }, [totalTimelineUnits]);

  useEffect(() => {
    syncAtmosphereBed(selectedAtmosphereId, atmosphereBedLevel);
  }, [selectedAtmosphereId, atmosphereBedLevel]);

  useEffect(() => {
    applySceneModeAudioFilter(sceneModeValue);
  }, [sceneModeValue]);

  useEffect(() => {
    const unlock = () => {
      resumeAtmosphereBedEngine();
      resumeElementSoundEngine();
    };
    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  const scrollSpacerHeight = maxScrollPx + (typeof window === "undefined" ? 1000 : window.innerHeight);

  const toggleTopPanel = (panel: "story" | "elements" | "atmosphere") => {
    setActiveTopPanel(activeTopPanel === panel ? null : panel);
  };

  const resetCameraView = () => {
    const controls = orbitControlsRef.current;
    if (!controls) return;
    controls.object.position.set(...DEFAULT_CAMERA_POSITION);
    controls.object.zoom = 1;
    controls.object.updateProjectionMatrix();
    controls.target.set(...DEFAULT_CAMERA_TARGET);
    controls.update();
  };

  return (
    <div style={{ width: "100vw" }}>
      <div style={{ position: "fixed", inset: 0 }} onDoubleClick={resetCameraView}>
        <Canvas shadows camera={{ position: DEFAULT_CAMERA_POSITION, fov: 60, near: 0.1, far: 120 }}>
          <OrbitControls
            ref={orbitControlsRef}
            enableDamping
            dampingFactor={0.08}
            enablePan={false}
            enableZoom={false}
            minAzimuthAngle={-Math.PI / 4}
            maxAzimuthAngle={Math.PI / 4}
            minPolarAngle={Math.PI / 4}
            maxPolarAngle={(3 * Math.PI) / 4}
          />
          <World />
        </Canvas>
      </div>

      <div
        style={{
          position: "fixed",
          top: 12,
          left: 12,
          zIndex: 55,
          display: "flex",
          gap: 8,
          pointerEvents: "none",
        }}
      >
        <button
          type="button"
          onClick={() => toggleTopPanel("story")}
          style={{
            pointerEvents: "auto",
            borderRadius: 8,
            border: `1px solid ${
              activeTopPanel === "story" ? theme.uiPanelActiveBorder : theme.uiPanelInactiveBorder
            }`,
            background: activeTopPanel === "story" ? theme.uiPanelActiveBg : theme.uiPanelInactiveBg,
            padding: "6px 10px",
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          Story
        </button>
        <button
          type="button"
          onClick={() => toggleTopPanel("elements")}
          style={{
            pointerEvents: "auto",
            borderRadius: 8,
            border: `1px solid ${
              activeTopPanel === "elements" ? theme.uiPanelActiveBorder : theme.uiPanelInactiveBorder
            }`,
            background:
              activeTopPanel === "elements" ? theme.uiPanelActiveBg : theme.uiPanelInactiveBg,
            padding: "6px 10px",
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          Elements
        </button>
        <button
          type="button"
          onClick={() => toggleTopPanel("atmosphere")}
          style={{
            pointerEvents: "auto",
            borderRadius: 8,
            border: `1px solid ${
              activeTopPanel === "atmosphere" ? theme.uiPanelActiveBorder : theme.uiPanelInactiveBorder
            }`,
            background:
              activeTopPanel === "atmosphere" ? theme.uiPanelActiveBg : theme.uiPanelInactiveBg,
            padding: "6px 10px",
            fontSize: 12,
            cursor: "pointer",
          }}
        >
          Atmosphere
        </button>
      </div>

      {activeTopPanel === "story" ? <StoryScriptPanel /> : null}
      {activeTopPanel === "elements" ? <ElementsPanel /> : null}
      {activeTopPanel === "atmosphere" ? <AtmospherePanel /> : null}
      {activeTopPanel === "elements" ? <StoryObjectTray /> : null}

      <input
        type="range"
        min={0}
        max={1}
        step={0.01}
        value={sceneModeValue}
        onChange={(event) => setSceneModeValue(Number(event.target.value))}
        style={{
          position: "fixed",
          left: "50%",
          bottom: 12,
          transform: "translateX(-50%)",
          zIndex: 72,
          width: "min(420px, calc(100vw - 24px))",
          minWidth: 0,
          pointerEvents: "auto",
          margin: 0,
        }}
      />

      <button
        type="button"
        onClick={() => setDeveloperModeOpen(!isDeveloperModeOpen)}
        style={{
          position: "fixed",
          right: 16,
          bottom: 16,
          zIndex: 80,
          borderRadius: 8,
          border: `1px solid ${theme.uiPanelInactiveBorder}`,
          background: isDeveloperModeOpen ? theme.uiPanelActiveBg : theme.uiPanelInactiveBg,
          color: theme.uiTextActive,
          fontSize: 11,
          padding: "6px 10px",
          cursor: "pointer",
        }}
      >
        Developer
      </button>

      {isDeveloperModeOpen ? <DeveloperRegistryPanel /> : null}

      <div style={{ height: scrollSpacerHeight }} />
    </div>
  );
}
