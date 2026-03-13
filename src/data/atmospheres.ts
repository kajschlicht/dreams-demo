export type AtmosphereItem = {
  id: string;
  name: string;
  color: string;
  soundFile?: string;
};

const base = import.meta.env.BASE_URL;
const OPEN_AIR_SOUND = `${base}sounds/atmospheresounds/OpenAir.mp3`;
const URBAN_AIR_SOUND = `${base}sounds/atmospheresounds/UrbanAir.mp3`;
const INTERIOR_ROOM_SOUND = `${base}sounds/atmospheresounds/InteriorRoom.mp3`;
const LOW_WIND_SOUND = `${base}sounds/atmospheresounds/LowWind.mp3`;
const DEEP_TONE_SOUND = `${base}sounds/atmospheresounds/DeepTone.mp3`;

export const atmospheres: AtmosphereItem[] = [
  {
    id: "open-air",
    name: "Open Air",
    color: "#4f7f5f",
    soundFile: OPEN_AIR_SOUND,
  },
  {
    id: "urban-air",
    name: "Urban Air",
    color: "#606870",
    soundFile: URBAN_AIR_SOUND,
  },
  {
    id: "interior-room",
    name: "Interior Room",
    color: "#77695c",
    soundFile: INTERIOR_ROOM_SOUND,
  },
  {
    id: "low-wind",
    name: "Low Wind",
    color: "#7f8578",
    soundFile: LOW_WIND_SOUND,
  },
  {
    id: "deep-tone",
    name: "Deep Tone",
    color: "#5b4f6e",
    soundFile: DEEP_TONE_SOUND,
  },
];
