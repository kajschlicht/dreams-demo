export type AtmosphereCategory = "natural" | "urban";

export type AtmosphereSound = {
  id: string;
  name: string;
  file: string;
  category: AtmosphereCategory;
};

const base = import.meta.env.BASE_URL;
const openAirFile = `${base}sounds/atmospheresounds/OpenAir.mp3`;
const urbanAirFile = `${base}sounds/atmospheresounds/UrbanAir.mp3`;
const interiorRoomFile = `${base}sounds/atmospheresounds/InteriorRoom.mp3`;
const lowWindFile = `${base}sounds/atmospheresounds/LowWind.mp3`;
const deepToneFile = `${base}sounds/atmospheresounds/DeepTone.mp3`;

export const atmosphereSounds: AtmosphereSound[] = [
  { id: "open-air", name: "Open Air", file: openAirFile, category: "natural" },
  { id: "low-wind", name: "Low Wind", file: lowWindFile, category: "natural" },
  { id: "deep-tone", name: "Deep Tone", file: deepToneFile, category: "natural" },
  { id: "urban-air", name: "Urban Air", file: urbanAirFile, category: "urban" },
  { id: "interior-room", name: "Interior Room", file: interiorRoomFile, category: "urban" },
];
