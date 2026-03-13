export type AtmosphereBed = {
  id: string;
  name: string;
  file?: string;
  description?: string;
};

const base = import.meta.env.BASE_URL;
const openAirFile = `${base}sounds/atmospheresounds/OpenAir.mp3`;
const urbanAirFile = `${base}sounds/atmospheresounds/UrbanAir.mp3`;
const interiorRoomFile = `${base}sounds/atmospheresounds/InteriorRoom.mp3`;
const lowWindFile = `${base}sounds/atmospheresounds/LowWind.mp3`;
const deepToneFile = `${base}sounds/atmospheresounds/DeepTone.mp3`;

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
