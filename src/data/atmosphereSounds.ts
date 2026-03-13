export type AtmosphereCategory = "natural" | "urban";

export type AtmosphereSound = {
  id: string;
  name: string;
  file: string;
  category: AtmosphereCategory;
};

const openAirFile = new URL("../assets/sounds/AtmosphereSounds/OpenAir.mp3", import.meta.url).href;
const urbanAirFile = new URL("../assets/sounds/AtmosphereSounds/UrbanAir.mp3", import.meta.url).href;
const interiorRoomFile = new URL(
  "../assets/sounds/AtmosphereSounds/InteriorRoom.mp3",
  import.meta.url
).href;
const lowWindFile = new URL("../assets/sounds/AtmosphereSounds/LowWind.mp3", import.meta.url).href;
const deepToneFile = new URL("../assets/sounds/AtmosphereSounds/DeepTone.mp3", import.meta.url).href;

export const atmosphereSounds: AtmosphereSound[] = [
  { id: "open-air", name: "Open Air", file: openAirFile, category: "natural" },
  { id: "low-wind", name: "Low Wind", file: lowWindFile, category: "natural" },
  { id: "deep-tone", name: "Deep Tone", file: deepToneFile, category: "natural" },
  { id: "urban-air", name: "Urban Air", file: urbanAirFile, category: "urban" },
  { id: "interior-room", name: "Interior Room", file: interiorRoomFile, category: "urban" },
];
