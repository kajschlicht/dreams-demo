import { useEffect, useMemo, useState } from "react";
import type { GLBCategory } from "../data/glbLibrary";
import { useAppStore } from "../core/store";
import { registryToLibrary } from "../data/elementsRegistry";
import { getTheme } from "../theme";
import { filterGLBLibrary } from "../utils/filterGLBLibrary";
import { getAssetSuggestions } from "../utils/getAssetSuggestions";

type LibraryView = "suggestion" | "all" | GLBCategory;

export function ElementsPanel() {
  const themeName = useAppStore((s) => s.themeName);
  const storyText = useAppStore((s) => s.storyText);
  const elementsRegistry = useAppStore((s) => s.elementsRegistry);
  const addStoryObject = useAppStore((s) => s.addStoryObject);
  const theme = getTheme(themeName);
  const hasStoryText = storyText.trim().length > 0;
  const [query, setQuery] = useState("");
  const [view, setView] = useState<LibraryView>(hasStoryText ? "suggestion" : "all");
  const library = useMemo(
    () =>
      registryToLibrary(elementsRegistry).filter(
        (asset) => (asset.type ?? "glb") === "glb" && asset.file.trim().length > 0
      ),
    [elementsRegistry]
  );

  const categories = useMemo(
    () => ["all", ...new Set(library.map((asset) => asset.category))] as ("all" | GLBCategory)[],
    [library]
  );

  const suggestions = useMemo(() => getAssetSuggestions(storyText, library), [storyText, library]);

  useEffect(() => {
    setView((current) => {
      if (!hasStoryText && current === "suggestion") return "all";
      if (hasStoryText && current === "all") return "suggestion";
      return current;
    });
  }, [hasStoryText]);

  const filtered = useMemo(() => {
    if (view === "suggestion") {
      return filterGLBLibrary(suggestions, query, "all");
    }
    if (view === "all") {
      return filterGLBLibrary(library, query, "all");
    }
    return filterGLBLibrary(library, query, view);
  }, [query, suggestions, view, library]);

  return (
    <div
      style={{
        position: "fixed",
        top: 56,
        left: 12,
        width: "min(420px, calc(100vw - 24px))",
        maxHeight: "72vh",
        zIndex: 50,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        padding: 12,
        borderRadius: 12,
        border: `1px solid ${theme.uiPanelActiveBorder}`,
        background: theme.uiPanelInactiveBg,
        backdropFilter: "blur(8px)",
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      <strong style={{ fontSize: 13 }}>Elements</strong>

      <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: 8, alignItems: "center" }}>
        <input
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
          }}
          placeholder="Search name, category, tags..."
          style={{
            fontSize: 12,
            borderRadius: 8,
            border: `1px solid ${theme.uiPanelInactiveBorder}`,
            background: theme.uiPanelActiveBg,
            color: theme.uiTextActive,
            padding: "7px 9px",
            outline: "none",
            width: "100%",
            minWidth: 0,
            boxSizing: "border-box",
          }}
        />
        <select
          value={view}
          onChange={(event) => {
            setView(event.target.value as LibraryView);
          }}
          style={{
            fontSize: 12,
            borderRadius: 8,
            border: `1px solid ${theme.uiPanelInactiveBorder}`,
            background: theme.uiPanelActiveBg,
            color: theme.uiTextActive,
            padding: "7px 9px",
          }}
        >
          <option value="suggestion">Suggestion</option>
          {categories.map((value) => (
            <option key={value} value={value}>
              {value === "all" ? "All" : value}
            </option>
          ))}
        </select>
      </div>

      {view === "suggestion" && storyText.trim().length === 0 ? (
        <div
          style={{
            fontSize: 12,
            opacity: 0.74,
            border: `1px solid ${theme.uiPanelInactiveBorder}`,
            borderRadius: 8,
            padding: "8px 9px",
          }}
        >
          Add a story in the Story tab to get suggestions.
        </div>
      ) : null}

      <div
        style={{
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          gap: 8,
          paddingRight: 2,
        }}
      >
        {filtered.map((asset) => {
          return (
            <div
              key={asset.id}
              style={{
                border: `1px solid ${theme.uiPanelInactiveBorder}`,
                borderRadius: 8,
                padding: 8,
                display: "flex",
                flexDirection: "column",
                gap: 6,
                background: theme.uiPanelActiveBg,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                <strong style={{ fontSize: 12 }}>{asset.name}</strong>
                <span style={{ fontSize: 11, opacity: 0.72 }}>{asset.category}</span>
              </div>
              <div style={{ fontSize: 11, opacity: 0.8 }}>{asset.tags.join(", ")}</div>
              <button
                onClick={() => {
                  addStoryObject(asset.id);
                }}
                style={{
                  alignSelf: "flex-start",
                  borderRadius: 7,
                  border: `1px solid ${theme.uiPanelActiveBorder}`,
                  background: theme.uiPanelActiveBg,
                  color: theme.uiTextActive,
                  padding: "4px 9px",
                  fontSize: 11,
                  cursor: "pointer",
                }}
              >
                Add
              </button>
            </div>
          );
        })}
        {filtered.length === 0 ? (
          <div style={{ fontSize: 12, opacity: 0.7, padding: "4px 1px" }}>
            {view === "suggestion"
              ? "No suggestions found for the current story text."
              : "No assets found."}
          </div>
        ) : null}
      </div>
    </div>
  );
}
