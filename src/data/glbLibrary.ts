export type GLBCategory =
  | "water"
  | "architecture"
  | "furniture"
  | "transport"
  | "nature"
  | "people"
  | "objects"
  | "environment"
  | "other";

export type ElementAssetType = "glb" | "effect";
export type ElementEffectType = "smoke" | "dust" | "rain" | "wind";

export type GLBAsset = {
  id: string;
  name: string;
  file: string;
  type?: ElementAssetType;
  effectType?: ElementEffectType;
  category: GLBCategory;
  tags: string[];
  description?: string;
};

const glbModules = import.meta.glob("../assets/glb/*.glb", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

const CATEGORY_KEYWORDS: Record<Exclude<GLBCategory, "other">, string[]> = {
  water: ["water", "wave", "ocean", "sea", "river", "lake", "boat", "ship", "sail"],
  architecture: [
    "house",
    "room",
    "building",
    "apartment",
    "hospital",
    "classroom",
    "door",
    "window",
    "road",
    "street",
    "stair",
    "stairs",
    "staircase",
    "bridge",
    "tower",
    "skyscraper",
  ],
  furniture: ["desk", "chair", "table", "bench", "lamp", "laptop", "sofa", "bed"],
  transport: [
    "bus",
    "tram",
    "train",
    "car",
    "truck",
    "ship",
    "boat",
    "balloon",
    "container",
  ],
  nature: [
    "forest",
    "tree",
    "trees",
    "beagle",
    "dog",
    "sun",
    "mountain",
    "camp",
    "fire",
    "garden",
  ],
  people: ["man", "woman", "person", "people", "head", "hand", "hands", "body", "face"],
  objects: [
    "flashlight",
    "extinguisher",
    "phone",
    "bag",
    "box",
    "tool",
    "bottle",
    "cup",
    "bathroom",
  ],
  environment: ["environment", "city", "village"],
};

const TAG_EXPANSIONS: Record<string, string[]> = {
  house: ["building", "architecture"],
  room: ["interior"],
  door: ["entry"],
  window: ["opening"],
  road: ["street"],
  bus: ["movement", "urban"],
  tram: ["movement", "urban"],
  ship: ["water", "movement"],
  boat: ["water", "movement"],
  wave: ["water", "liquid"],
  forest: ["nature", "outdoor"],
  tree: ["nature", "outdoor"],
  beagle: ["dog", "animal"],
};

function normalizeId(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function toWordTokens(value: string): string[] {
  const expanded = value
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!expanded) return [];
  return expanded
    .split(" ")
    .map((token) => token.toLowerCase().trim())
    .filter(Boolean);
}

function toDisplayName(fileStem: string): string {
  const words = toWordTokens(fileStem);
  if (words.length === 0) return fileStem;
  return words.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(" ");
}

function inferCategory(words: string[]): GLBCategory {
  if (words.length === 0) return "other";

  const scoreByCategory = new Map<GLBCategory, number>();

  (Object.keys(CATEGORY_KEYWORDS) as Array<Exclude<GLBCategory, "other">>).forEach((category) => {
    const keywords = CATEGORY_KEYWORDS[category];
    let score = 0;
    for (const word of words) {
      if (keywords.includes(word)) score += 1;
    }
    if (score > 0) {
      scoreByCategory.set(category, score);
    }
  });

  if (scoreByCategory.size === 0) {
    return "objects";
  }

  let bestCategory: GLBCategory = "objects";
  let bestScore = -1;
  for (const [category, score] of scoreByCategory.entries()) {
    if (score > bestScore) {
      bestCategory = category;
      bestScore = score;
    }
  }

  return bestCategory;
}

function inferTags(words: string[], category: GLBCategory): string[] {
  const tags = new Set<string>();

  for (const word of words) {
    tags.add(word);
    const expansion = TAG_EXPANSIONS[word];
    if (!expansion) continue;
    for (const value of expansion) {
      tags.add(value);
    }
  }

  tags.add(category);

  return Array.from(tags);
}

function filePathToAsset(path: string): GLBAsset {
  const fileName = path.split("/").pop() ?? path;
  const fileStem = fileName.replace(/\.glb$/i, "");
  const words = toWordTokens(fileStem);
  const category = inferCategory(words);

  return {
    id: normalizeId(fileStem),
    name: toDisplayName(fileStem),
    file: `/assets/glb/${fileName}`,
    category,
    tags: inferTags(words.length > 0 ? words : [normalizeId(fileStem)], category),
  };
}

export const glbLibrary: GLBAsset[] = Object.keys(glbModules)
  .map(filePathToAsset)
  .sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
