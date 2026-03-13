import { useAppStore } from "../core/store";
import { atmospheres } from "../data/atmospheres";
import { getTheme } from "../theme";

export function AtmospherePanel() {
  const themeName = useAppStore((s) => s.themeName);
  const selectedAtmosphereId = useAppStore((s) => s.selectedAtmosphereId);
  const setSelectedAtmosphereId = useAppStore((s) => s.setSelectedAtmosphereId);
  const atmosphereBedLevel = useAppStore((s) => s.atmosphereBedLevel);
  const setAtmosphereBedLevel = useAppStore((s) => s.setAtmosphereBedLevel);
  const theme = getTheme(themeName);
  const hasSelectedAtmosphere = Boolean(selectedAtmosphereId);

  return (
    <div
      style={{
        position: "fixed",
        top: 56,
        left: 12,
        width: "min(440px, calc(100vw - 24px))",
        maxHeight: "74vh",
        zIndex: 50,
        borderRadius: 12,
        border: `1px solid ${theme.uiPanelActiveBorder}`,
        background: theme.uiPanelInactiveBg,
        backdropFilter: "blur(8px)",
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 12,
        boxSizing: "border-box",
        overflow: "hidden",
      }}
    >
      <strong style={{ fontSize: 13 }}>Atmosphere</strong>

      <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <strong style={{ fontSize: 12 }}>Atmosphere</strong>
        {!hasSelectedAtmosphere ? (
          <div style={{ fontSize: 11, opacity: 0.72 }}>Select atmosphere</div>
        ) : null}
        <div style={{ display: "flex", flexDirection: "column", gap: 8, overflowY: "auto", maxHeight: "44vh" }}>
          {atmospheres.map((atmosphere) => {
            const isActive = selectedAtmosphereId === atmosphere.id;
            return (
              <button
                key={atmosphere.id}
                type="button"
                onClick={() =>
                  setSelectedAtmosphereId(selectedAtmosphereId === atmosphere.id ? null : atmosphere.id)
                }
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(0, 1fr) auto",
                  gap: 8,
                  alignItems: "center",
                  borderRadius: 8,
                  border: `1px solid ${isActive ? theme.uiPanelActiveBorder : theme.uiPanelInactiveBorder}`,
                  background: isActive ? theme.uiPanelActiveBg : theme.uiPanelInactiveBg,
                  color: theme.uiTextActive,
                  padding: "8px 9px",
                  cursor: "pointer",
                  textAlign: "left",
                }}
              >
                <span style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                  <span style={{ fontSize: 12, fontWeight: 600 }}>{atmosphere.name}</span>
                  {atmosphere.soundFile ? (
                    <span
                      style={{
                        fontSize: 11,
                        opacity: 0.72,
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      Continuous linked atmosphere sound
                    </span>
                  ) : null}
                </span>
                {!atmosphere.soundFile ? (
                  <span
                    style={{
                      fontSize: 10,
                      borderRadius: 999,
                      border: `1px solid ${theme.uiPanelInactiveBorder}`,
                      background: theme.uiPanelInactiveBg,
                      padding: "2px 6px",
                      opacity: 0.82,
                      whiteSpace: "nowrap",
                    }}
                  >
                    coming later
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <label
          style={{
            display: "grid",
            gridTemplateColumns: "74px minmax(0, 1fr)",
            gap: 8,
            alignItems: "center",
            fontSize: 11,
            opacity: hasSelectedAtmosphere ? 1 : 0.65,
          }}
        >
          <span>Atmosphere Intensity</span>
          <input
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={atmosphereBedLevel}
            onChange={(event) => setAtmosphereBedLevel(Number(event.target.value))}
            disabled={!hasSelectedAtmosphere}
            style={{ width: "100%", minWidth: 0 }}
          />
        </label>
      </section>

      <section style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        <strong style={{ fontSize: 12 }}>Element Sounds</strong>
        <div style={{ fontSize: 11, opacity: 0.76 }}>
          Element sounds are linked to elements and follow fade in, peak and fade out automatically.
        </div>
      </section>
    </div>
  );
}
