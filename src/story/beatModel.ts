import type { SceneModel } from "./sceneModel";

export type BeatType = "calm" | "tension" | "rehearsal" | "release";

export interface Beat {
  id: string;
  type: BeatType;
  length: number;
  sceneTarget: Partial<SceneModel>;
  copy?: string;
}

export interface BeatTimeline {
  beats: Beat[];
  totalLength: number;
}

export function buildTimelineFromScene(scene: SceneModel): BeatTimeline {
  const beats: Beat[] = [
    {
      id: "calm-1",
      type: "calm",
      length: 8,
      sceneTarget: { threat: 0.1, fog: 0.2, contrast: 0.2 },
    },
    {
      id: "tension-1",
      type: "tension",
      length: 8 + scene.threat * 10,
      sceneTarget: {
        threat: scene.threat,
        fog: scene.fog,
        contrast: scene.contrast,
      },
    },
    {
      id: "rehearsal-1",
      type: "rehearsal",
      length: 10,
      sceneTarget: {
        transformationLevel: 1,
        threat: 0.1,
        fog: 0.15,
        contrast: 0.2,
        anchor: "open",
      },
    },
    {
      id: "release-1",
      type: "release",
      length: 8,
      sceneTarget: {
        light: Math.max(scene.light, 0.7),
        horizon: Math.max(scene.horizon, 0.7),
      },
    },
  ];

  const totalLength = beats.reduce((sum, beat) => sum + beat.length, 0);
  return { beats, totalLength };
}
