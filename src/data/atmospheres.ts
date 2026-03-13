export type AtmosphereItem = {
  id: string;
  name: string;
  color: string;
  soundFile?: string;
};

const OPEN_AIR_SOUND = new URL("../assets/sounds/atmospheresounds/OpenAir.mp3", import.meta.url)
  .href;
const URBAN_AIR_SOUND = new URL("../assets/sounds/atmospheresounds/UrbanAir.mp3", import.meta.url)
  .href;
const INTERIOR_ROOM_SOUND = new URL(
  "../assets/sounds/atmospheresounds/InteriorRoom.mp3",
  import.meta.url
).href;
const LOW_WIND_SOUND = new URL("../assets/sounds/atmospheresounds/LowWind.mp3", import.meta.url)
  .href;
const DEEP_TONE_SOUND = new URL("../assets/sounds/atmospheresounds/DeepTone.mp3", import.meta.url)
  .href;

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
