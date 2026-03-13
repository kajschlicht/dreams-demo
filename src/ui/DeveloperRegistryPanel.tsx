import type { GLBCategory } from "../data/glbLibrary";
import { useAppStore } from "../core/store";
import { getTheme } from "../theme";

const CATEGORY_OPTIONS: GLBCategory[] = [
  "water",
  "architecture",
  "furniture",
  "transport",
  "nature",
  "people",
  "objects",
  "environment",
  "other",
];

function parseTags(input: string): string[] {
  return input
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);
}

export function DeveloperRegistryPanel() {
  const themeName = useAppStore((s) => s.themeName);
  const elementsRegistry = useAppStore((s) => s.elementsRegistry);
  const globalElementFade = useAppStore((s) => s.globalElementFade);
  const setGlobalElementFade = useAppStore((s) => s.setGlobalElementFade);
  const setDeveloperModeOpen = useAppStore((s) => s.setDeveloperModeOpen);
  const isDemoVisible = useAppStore((s) => s.isDemoVisible);
  const savedDemoScene = useAppStore((s) => s.savedDemoScene);
  const setDemoVisible = useAppStore((s) => s.setDemoVisible);
  const saveCurrentSceneAsDemo = useAppStore((s) => s.saveCurrentSceneAsDemo);
  const updateElementsRegistryEntry = useAppStore((s) => s.updateElementsRegistryEntry);
  const saveElementsRegistry = useAppStore((s) => s.saveElementsRegistry);
  const resetElementsRegistry = useAppStore((s) => s.resetElementsRegistry);
  const rescanElementsRegistryAssets = useAppStore((s) => s.rescanElementsRegistryAssets);
  const theme = getTheme(themeName);

  const knownSoundOptions = Array.from(
    new Set(
      elementsRegistry
        .map((entry) => entry.soundFile)
        .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    )
  );

  const copyJson = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(elementsRegistry, null, 2));
    } catch (error) {
      console.warn("[registry] failed to copy json", error);
    }
  };

  const hasSavedDemo = Boolean(savedDemoScene);

  const showDemo = () => {
    if (!hasSavedDemo) return;
    setDemoVisible(!isDemoVisible);
  };

  return (
    <div
      style={{
        position: "fixed",
        top: 56,
        right: 12,
        width: "min(880px, calc(100vw - 24px))",
        maxHeight: "78vh",
        zIndex: 90,
        borderRadius: 12,
        border: `1px solid ${theme.uiPanelActiveBorder}`,
        background: theme.uiPanelInactiveBg,
        backdropFilter: "blur(8px)",
        boxSizing: "border-box",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 8,
          padding: "10px 12px",
          borderBottom: `1px solid ${theme.uiPanelInactiveBorder}`,
        }}
      >
        <strong style={{ fontSize: 13 }}>Developer Registry</strong>
        <div style={{ display: "flex", gap: 6 }}>
          <button
            type="button"
            onClick={saveCurrentSceneAsDemo}
            style={{
              borderRadius: 7,
              border: `1px solid ${theme.uiPanelInactiveBorder}`,
              background: theme.uiPanelActiveBg,
              color: theme.uiTextActive,
              fontSize: 11,
              padding: "5px 8px",
              cursor: "pointer",
            }}
          >
            Save Demo
          </button>
          <button
            type="button"
            onClick={showDemo}
            disabled={!hasSavedDemo}
            style={{
              borderRadius: 7,
              border: `1px solid ${
                isDemoVisible ? theme.uiPanelActiveBorder : theme.uiPanelInactiveBorder
              }`,
              background: isDemoVisible ? theme.uiPanelActiveBg : theme.uiPanelInactiveBg,
              color: theme.uiTextActive,
              fontSize: 11,
              padding: "5px 8px",
              cursor: hasSavedDemo ? "pointer" : "not-allowed",
              opacity: hasSavedDemo ? 1 : 0.55,
            }}
          >
            Show Demo
          </button>
          <button
            type="button"
            onClick={copyJson}
            style={{
              borderRadius: 7,
              border: `1px solid ${theme.uiPanelInactiveBorder}`,
              background: theme.uiPanelActiveBg,
              color: theme.uiTextActive,
              fontSize: 11,
              padding: "5px 8px",
              cursor: "pointer",
            }}
          >
            Copy JSON
          </button>
          <button
            type="button"
            onClick={saveElementsRegistry}
            style={{
              borderRadius: 7,
              border: `1px solid ${theme.uiPanelInactiveBorder}`,
              background: theme.uiPanelActiveBg,
              color: theme.uiTextActive,
              fontSize: 11,
              padding: "5px 8px",
              cursor: "pointer",
            }}
          >
            Save
          </button>
          <button
            type="button"
            onClick={resetElementsRegistry}
            style={{
              borderRadius: 7,
              border: `1px solid ${theme.uiPanelInactiveBorder}`,
              background: theme.uiPanelActiveBg,
              color: theme.uiTextActive,
              fontSize: 11,
              padding: "5px 8px",
              cursor: "pointer",
            }}
          >
            Reset to Defaults
          </button>
          <button
            type="button"
            onClick={() => setDeveloperModeOpen(false)}
            style={{
              borderRadius: 7,
              border: `1px solid ${theme.uiPanelInactiveBorder}`,
              background: theme.uiPanelInactiveBg,
              color: theme.uiTextActive,
              fontSize: 11,
              padding: "5px 8px",
              cursor: "pointer",
            }}
          >
            Close
          </button>
        </div>
      </div>

      <div
        style={{
          padding: 12,
          borderBottom: `1px solid ${theme.uiPanelInactiveBorder}`,
          display: "flex",
          flexDirection: "column",
          gap: 10,
        }}
      >
        <strong style={{ fontSize: 12 }}>Global Settings</strong>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={rescanElementsRegistryAssets}
            style={{
              borderRadius: 7,
              border: `1px solid ${theme.uiPanelInactiveBorder}`,
              background: theme.uiPanelActiveBg,
              color: theme.uiTextActive,
              fontSize: 11,
              padding: "6px 10px",
              cursor: "pointer",
            }}
          >
            Re-scan Assets
          </button>

          <label
            style={{
              display: "grid",
              gridTemplateColumns: "136px minmax(0, 1fr)",
              gap: 8,
              alignItems: "center",
              fontSize: 11,
              minWidth: 280,
              flex: 1,
            }}
          >
            <span>Fade for all elements</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.01}
              value={globalElementFade}
              onChange={(event) => setGlobalElementFade(Number(event.target.value))}
              style={{ width: "100%" }}
            />
          </label>
        </div>
      </div>

      <div
        style={{
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          padding: 12,
        }}
      >
        <strong style={{ fontSize: 12 }}>Elements</strong>
        {elementsRegistry.map((entry) => (
          <div
            key={entry.id}
            style={{
              border: `1px solid ${theme.uiPanelInactiveBorder}`,
              borderRadius: 10,
              padding: 10,
              background: theme.uiPanelActiveBg,
              display: "grid",
              gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
              gap: 8,
            }}
          >
            <div style={{ fontSize: 11, opacity: 0.72, alignSelf: "end" }}>ID: {entry.id}</div>

            <label style={{ fontSize: 11 }}>
              Name
              <input
                value={entry.name}
                onChange={(event) =>
                  updateElementsRegistryEntry(entry.id, { name: event.target.value })
                }
                style={{ width: "100%" }}
              />
            </label>

            <label style={{ fontSize: 11 }}>
              Category
              <select
                value={entry.category}
                onChange={(event) =>
                  updateElementsRegistryEntry(entry.id, {
                    category: event.target.value as GLBCategory,
                  })
                }
                style={{ width: "100%" }}
              >
                {CATEGORY_OPTIONS.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>

            <label style={{ fontSize: 11 }}>
              Tags
              <input
                value={entry.tags.join(", ")}
                onChange={(event) =>
                  updateElementsRegistryEntry(entry.id, { tags: parseTags(event.target.value) })
                }
                style={{ width: "100%" }}
              />
            </label>

            <label style={{ fontSize: 11 }}>
              Sound
              <input
                value={entry.soundFile ?? ""}
                onChange={(event) =>
                  updateElementsRegistryEntry(entry.id, {
                    soundFile: event.target.value || undefined,
                  })
                }
                list="registry-sound-options"
                style={{ width: "100%" }}
              />
            </label>

            <label style={{ fontSize: 11 }}>
              Sound Playback
              <select
                value={entry.soundPlayback}
                onChange={(event) =>
                  updateElementsRegistryEntry(entry.id, {
                    soundPlayback: event.target.value as "once" | "loop" | "interval",
                  })
                }
                style={{ width: "100%" }}
              >
                <option value="once">once</option>
                <option value="loop">loop</option>
                <option value="interval">interval</option>
              </select>
            </label>

            <label style={{ fontSize: 11 }}>
              Default Size
              <input
                type="number"
                min={0.1}
                max={1.5}
                step={0.01}
                value={entry.defaultSize}
                onChange={(event) =>
                  updateElementsRegistryEntry(entry.id, {
                    defaultSize: Number(event.target.value),
                  })
                }
                style={{ width: "100%" }}
              />
            </label>

            <label style={{ fontSize: 11 }}>
              Default Mode
              <input
                type="number"
                min={0}
                max={1}
                step={0.01}
                value={entry.defaultMode}
                onChange={(event) =>
                  updateElementsRegistryEntry(entry.id, {
                    defaultMode: Number(event.target.value),
                  })
                }
                style={{ width: "100%" }}
              />
            </label>

            <label style={{ fontSize: 11 }}>
              Default Orientation
              <input
                type="number"
                min={-180}
                max={180}
                step={1}
                value={entry.defaultOrientation}
                onChange={(event) =>
                  updateElementsRegistryEntry(entry.id, {
                    defaultOrientation: Number(event.target.value),
                  })
                }
                style={{ width: "100%" }}
              />
            </label>

            <label style={{ fontSize: 11 }}>
              Default Offset X
              <input
                type="number"
                min={-6}
                max={6}
                step={0.1}
                value={entry.defaultOffsetX}
                onChange={(event) =>
                  updateElementsRegistryEntry(entry.id, {
                    defaultOffsetX: Number(event.target.value),
                  })
                }
                style={{ width: "100%" }}
              />
            </label>
          </div>
        ))}
      </div>

      <datalist id="registry-sound-options">
        {knownSoundOptions.map((option) => (
          <option key={option} value={option} />
        ))}
      </datalist>
    </div>
  );
}
