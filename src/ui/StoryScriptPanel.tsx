import { useAppStore } from "../core/store";
import { getTheme } from "../theme";

export function StoryScriptPanel() {
  const themeName = useAppStore((s) => s.themeName);
  const storyText = useAppStore((s) => s.storyText);
  const setStoryText = useAppStore((s) => s.setStoryText);
  const theme = getTheme(themeName);

  return (
    <div
      style={{
        position: "fixed",
        top: 56,
        left: 12,
        width: "min(420px, calc(100vw - 24px))",
        maxHeight: "72vh",
        zIndex: 50,
        boxSizing: "border-box",
        overflow: "hidden",
        borderRadius: 12,
        border: `1px solid ${theme.uiPanelActiveBorder}`,
        background: theme.uiPanelInactiveBg,
        backdropFilter: "blur(8px)",
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <strong style={{ fontSize: 13 }}>Story</strong>
      <div style={{ width: "100%", minWidth: 0, boxSizing: "border-box" }}>
        <textarea
          value={storyText}
          onChange={(event) => setStoryText(event.target.value)}
          placeholder="Paste your rewritten story here..."
          rows={12}
          style={{
            width: "100%",
            maxWidth: "100%",
            display: "block",
            minHeight: 260,
            maxHeight: "calc(72vh - 90px)",
            resize: "vertical",
            boxSizing: "border-box",
            borderRadius: 9,
            border: `1px solid ${theme.uiPanelInactiveBorder}`,
            background: theme.uiPanelActiveBg,
            color: theme.uiTextActive,
            padding: 10,
            outline: "none",
            fontSize: 12,
            lineHeight: 1.45,
          }}
        />
      </div>
    </div>
  );
}
