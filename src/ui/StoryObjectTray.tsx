import { useMemo, useRef, useState } from "react";
import { useAppStore } from "../core/store";
import { registryToLibrary } from "../data/elementsRegistry";
import { getTheme } from "../theme";

function getFadeValue(transitionIn?: number, transitionOut?: number): number {
  const inValue = Number.isFinite(transitionIn) ? Number(transitionIn) : 0.1;
  const outValue = Number.isFinite(transitionOut) ? Number(transitionOut) : 0.1;
  return Math.min(1, Math.max(0, (inValue + outValue) * 0.5));
}

export function StoryObjectTray() {
  const themeName = useAppStore((s) => s.themeName);
  const storyObjects = useAppStore((s) => s.storyObjects);
  const elementsRegistry = useAppStore((s) => s.elementsRegistry);
  const toggleStoryObjectExpanded = useAppStore((s) => s.toggleStoryObjectExpanded);
  const removeStoryObject = useAppStore((s) => s.removeStoryObject);
  const reorderStoryObjects = useAppStore((s) => s.reorderStoryObjects);
  const updateStoryObjectParam = useAppStore((s) => s.updateStoryObjectParam);
  const theme = getTheme(themeName);
  const assetsById = useMemo(
    () => new Map(registryToLibrary(elementsRegistry).map((asset) => [asset.id, asset])),
    [elementsRegistry]
  );
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const dragIdRef = useRef<string | null>(null);
  const dragMovedRef = useRef(false);

  const handleDrop = (targetId: string) => {
    const dragId = dragIdRef.current;
    if (!dragId || dragId === targetId) return;
    const fromIndex = storyObjects.findIndex((storyObject) => storyObject.id === dragId);
    const toIndex = storyObjects.findIndex((storyObject) => storyObject.id === targetId);
    if (fromIndex < 0 || toIndex < 0) return;
    reorderStoryObjects(fromIndex, toIndex);
    dragMovedRef.current = true;
    window.setTimeout(() => {
      dragMovedRef.current = false;
    }, 120);
  };

  return (
    <div
      style={{
        position: "fixed",
        left: 0,
        right: 0,
        bottom: 12,
        display: "flex",
        gap: 8,
        justifyContent: "flex-start",
        alignItems: "flex-end",
        pointerEvents: "none",
        zIndex: 50,
        paddingLeft: 12,
        paddingRight: 12,
        overflow: "visible",
      }}
    >
      {storyObjects.length === 0 ? (
        <div
          style={{
            pointerEvents: "none",
            borderRadius: 999,
            border: `1px solid ${theme.uiPanelInactiveBorder}`,
            background: theme.uiPanelInactiveBg,
            color: theme.uiTextInactive,
            fontSize: 11,
            padding: "6px 10px",
          }}
        >
          No objects selected yet.
        </div>
      ) : null}
      {storyObjects.map((storyObject) => {
        const asset = assetsById.get(storyObject.assetId);
        const title = asset?.name ?? storyObject.assetId;
        const fade = getFadeValue(storyObject.transitionIn, storyObject.transitionOut);

        return (
          <div
            key={storyObject.id}
            onDragOver={(event) => {
              event.preventDefault();
              if (dragOverId !== storyObject.id) {
                setDragOverId(storyObject.id);
              }
            }}
            onDragLeave={() => {
              if (dragOverId === storyObject.id) {
                setDragOverId(null);
              }
            }}
            onDrop={(event) => {
              event.preventDefault();
              handleDrop(storyObject.id);
              setDragOverId(null);
            }}
            style={{
              position: "relative",
              width: 190,
              minWidth: 190,
              pointerEvents: "auto",
              overflow: "visible",
            }}
          >
            {storyObject.expanded ? (
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  width: "100%",
                  bottom: "calc(100% + 8px)",
                  borderRadius: 8,
                  border: `1px solid ${theme.uiPanelActiveBorder}`,
                  background: theme.uiPanelActiveBg,
                  color: theme.uiTextActive,
                  padding: 8,
                  display: "flex",
                  flexDirection: "column",
                  gap: 6,
                  boxShadow: "0 10px 24px rgba(0,0,0,0.2)",
                  zIndex: 100,
                  pointerEvents: "auto",
                }}
              >
                <label style={{ fontSize: 11 }}>
                  Size
                  <input
                    type="range"
                    min={0.1}
                    max={1.5}
                    step={0.01}
                    value={storyObject.param1 ?? 1}
                    onChange={(event) => {
                      updateStoryObjectParam(storyObject.id, {
                        param1: Number(event.target.value),
                      });
                    }}
                    style={{ width: "100%" }}
                  />
                </label>
                <label style={{ fontSize: 11 }}>
                  Orientation X
                  <input
                    type="range"
                    min={-180}
                    max={180}
                    step={1}
                    value={storyObject.orientationX ?? 0}
                    onChange={(event) => {
                      updateStoryObjectParam(storyObject.id, {
                        orientationX: Number(event.target.value),
                      });
                    }}
                    style={{ width: "100%" }}
                  />
                </label>
                <label style={{ fontSize: 11 }}>
                  Orientation Y
                  <input
                    type="range"
                    min={-180}
                    max={180}
                    step={1}
                    value={storyObject.orientationY ?? 0}
                    onChange={(event) => {
                      updateStoryObjectParam(storyObject.id, {
                        orientationY: Number(event.target.value),
                      });
                    }}
                    style={{ width: "100%" }}
                  />
                </label>
                <label style={{ fontSize: 11 }}>
                  Orientation Z
                  <input
                    type="range"
                    min={-180}
                    max={180}
                    step={1}
                    value={storyObject.orientationZ ?? 0}
                    onChange={(event) => {
                      updateStoryObjectParam(storyObject.id, {
                        orientationZ: Number(event.target.value),
                      });
                    }}
                    style={{ width: "100%" }}
                  />
                </label>
                <label style={{ fontSize: 11 }}>
                  Mode
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={storyObject.param3 ?? 0}
                    onChange={(event) => {
                      updateStoryObjectParam(storyObject.id, {
                        param3: Number(event.target.value),
                      });
                    }}
                    style={{ width: "100%" }}
                  />
                </label>
                <label style={{ fontSize: 11 }}>
                  Fade
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.01}
                    value={fade}
                    onChange={(event) => {
                      const nextFade = Number(event.target.value);
                      updateStoryObjectParam(storyObject.id, {
                        transitionIn: nextFade,
                        transitionOut: nextFade,
                      });
                    }}
                    style={{ width: "100%" }}
                  />
                </label>
                <button
                  type="button"
                  onClick={() => {
                    removeStoryObject(storyObject.id);
                  }}
                  style={{
                    borderRadius: 7,
                    border: `1px solid ${theme.uiPanelInactiveBorder}`,
                    background: theme.uiPanelInactiveBg,
                    color: theme.uiTextActive,
                    padding: "6px 8px",
                    fontSize: 11,
                    cursor: "pointer",
                  }}
                >
                  Remove Object
                </button>
              </div>
            ) : null}

            <button
              type="button"
              draggable
              onDragStart={(event) => {
                dragIdRef.current = storyObject.id;
                dragMovedRef.current = true;
                event.dataTransfer.effectAllowed = "move";
              }}
              onDragEnd={() => {
                dragIdRef.current = null;
                setDragOverId(null);
                window.setTimeout(() => {
                  dragMovedRef.current = false;
                }, 40);
              }}
              onClick={() => {
                if (dragMovedRef.current) return;
                toggleStoryObjectExpanded(storyObject.id);
              }}
              style={{
                width: "100%",
                display: "block",
                borderRadius: 8,
                overflow: "hidden",
                border: `1px solid ${theme.uiPanelActiveBorder}`,
                outline:
                  dragOverId === storyObject.id
                    ? `1px dashed ${theme.uiPanelDragBorder}`
                    : "none",
                background: storyObject.expanded ? theme.uiPanelActiveBg : theme.uiPanelInactiveBg,
                color: theme.uiTextActive,
                userSelect: "none",
                cursor: "grab",
                textAlign: "left",
                fontSize: 12,
                padding: "8px 10px",
              }}
              title="Click for parameters, drag to reorder"
            >
              {title}
            </button>
          </div>
        );
      })}
    </div>
  );
}
