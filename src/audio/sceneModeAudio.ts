import { Howler } from "howler";
import { resolveSceneModeAudioSettings } from "../core/sceneMode";

let lowpassFilter: BiquadFilterNode | null = null;
let filterPatched = false;

function ensureLowpassFilter(): { filter: BiquadFilterNode; context: AudioContext } | null {
  const howlerCtx = (Howler as unknown as { ctx?: AudioContext }).ctx;
  const masterGain = (Howler as unknown as { masterGain?: GainNode }).masterGain;
  if (!howlerCtx || !masterGain) return null;

  if (!lowpassFilter) {
    lowpassFilter = howlerCtx.createBiquadFilter();
    lowpassFilter.type = "lowpass";
    lowpassFilter.Q.value = 0.0001;
  }

  if (!filterPatched) {
    try {
      masterGain.disconnect();
    } catch {
      // ignore
    }
    masterGain.connect(lowpassFilter);
    lowpassFilter.connect(howlerCtx.destination);
    filterPatched = true;
  }

  return { filter: lowpassFilter, context: howlerCtx };
}

export function applySceneModeAudioFilter(sceneModeValue: number): void {
  if (typeof window === "undefined") return;
  const nodes = ensureLowpassFilter();
  if (!nodes) return;
  const { lowpassFrequency } = resolveSceneModeAudioSettings(sceneModeValue);
  nodes.filter.frequency.setTargetAtTime(lowpassFrequency, nodes.context.currentTime, 0.06);
}
