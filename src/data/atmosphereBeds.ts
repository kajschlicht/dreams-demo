export type AtmosphereBed = {
  id: string;
  name: string;
  file?: string;
  description?: string;
};

const openAirFile = new URL("../assets/sounds/AtmosphereSounds/OpenAir.mp3", import.meta.url).href;
const urbanAirFile = new URL("../assets/sounds/AtmosphereSounds/UrbanAir.mp3", import.meta.url).href;
const interiorRoomFile = new URL(
  "../assets/sounds/AtmosphereSounds/InteriorRoom.mp3",
  import.meta.url
).href;
const lowWindFile = new URL("../assets/sounds/AtmosphereSounds/LowWind.mp3", import.meta.url).href;
const deepToneFile = new URL("../assets/sounds/AtmosphereSounds/DeepTone.mp3", import.meta.url).href;

export const atmosphereBeds: AtmosphereBed[] = [
  {
    id: "open-air",
    name: "Open Air",
    file: openAirFile,
    description: "calm outdoor air, spacious atmosphere",
  },
  {
    id: "urban-air",
    name: "Urban Air",
    file: urbanAirFile,
    description: "distant city presence",
  },
  {
    id: "interior-room",
    name: "Interior Room",
    file: interiorRoomFile,
    description: "quiet contained indoor tone",
  },
  {
    id: "low-wind",
    name: "Low Wind",
    file: lowWindFile,
    description: "moving air, slight tension",
  },
  {
    id: "deep-tone",
    name: "Deep Tone",
    file: deepToneFile,
    description: "abstract tonal bed",
  },
];
