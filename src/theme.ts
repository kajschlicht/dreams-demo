export type ThemeName = "dark" | "light";

export const DEFAULT_THEME_NAME: ThemeName = "light";

export type AppTheme = {
  name: ThemeName;
  sceneBackground: string;
  sceneFog: string;
  fogNear: number;
  fogFarMultiplier: number;
  fogFarOffset: number;
  groundColor: string;
  floorVisible: boolean;
  backdropEnabled: boolean;
  backdropTopColor: string;
  backdropBottomColor: string;
  ambientIntensity: number;
  keyLightIntensity: number;
  rimLightIntensity: number;
  particleColor: string;
  particleBaseOpacity: number;
  uiPanelActiveBg: string;
  uiPanelInactiveBg: string;
  uiPanelActiveBorder: string;
  uiPanelInactiveBorder: string;
  uiPanelDragBorder: string;
  uiTextActive: string;
  uiTextInactive: string;
};

export const THEMES: Record<ThemeName, AppTheme> = {
  dark: {
    name: "dark",
    sceneBackground: "#000000",
    sceneFog: "#000000",
    fogNear: 4,
    fogFarMultiplier: 1,
    fogFarOffset: 0,
    groundColor: "#040404",
    floorVisible: true,
    backdropEnabled: false,
    backdropTopColor: "#050608",
    backdropBottomColor: "#000000",
    ambientIntensity: 0.25,
    keyLightIntensity: 2,
    rimLightIntensity: 0.8,
    particleColor: "#ffffff",
    particleBaseOpacity: 0.65,
    uiPanelActiveBg: "rgba(100,170,255,0.22)",
    uiPanelInactiveBg: "rgba(0,0,0,0.6)",
    uiPanelActiveBorder: "rgba(140,210,255,0.9)",
    uiPanelInactiveBorder: "rgba(255,255,255,0.2)",
    uiPanelDragBorder: "rgba(255,255,255,0.95)",
    uiTextActive: "#e8f6ff",
    uiTextInactive: "#f0f0f0",
  },
  light: {
    name: "light",
    sceneBackground: "#eef2f6",
    sceneFog: "#dde4eb",
    fogNear: 9,
    fogFarMultiplier: 1.45,
    fogFarOffset: 12,
    groundColor: "#d7dee5",
    floorVisible: false,
    backdropEnabled: true,
    backdropTopColor: "#f6f9fc",
    backdropBottomColor: "#d9e1ea",
    ambientIntensity: 0.4,
    keyLightIntensity: 1.2,
    rimLightIntensity: 0.35,
    particleColor: "#1f2937",
    particleBaseOpacity: 0.6,
    uiPanelActiveBg: "rgba(214,228,244,0.92)",
    uiPanelInactiveBg: "rgba(255,255,255,0.88)",
    uiPanelActiveBorder: "rgba(44,62,80,0.65)",
    uiPanelInactiveBorder: "rgba(44,62,80,0.25)",
    uiPanelDragBorder: "rgba(44,62,80,0.9)",
    uiTextActive: "#182433",
    uiTextInactive: "#233549",
  },
};

export function getTheme(themeName: ThemeName): AppTheme {
  return THEMES[themeName] ?? THEMES[DEFAULT_THEME_NAME];
}
