import type { GLBAsset } from "../data/glbLibrary";

const KEYWORD_EXPANSIONS: Record<string, string[]> = {
  haus: ["house", "home", "room", "building"],
  wohnung: ["house", "home", "room", "apartment"],
  brennend: ["fire", "flame", "campfire"],
  brennende: ["fire", "flame", "campfire"],
  brennendes: ["fire", "flame", "campfire"],
  feuer: ["fire", "flame", "campfire"],
  fenster: ["window"],
  tur: ["door"],
  tuer: ["door"],
  zimmer: ["room", "bedroom", "bathroom", "classroom", "living"],
  schiff: ["ship", "boat", "sailboat"],
  wasser: ["water", "lake", "pond", "wave"],
  wald: ["forest", "trees", "tree"],
  hund: ["dog", "husky", "beagle"],
  katze: ["cat", "kitten"],
  smoke: ["smoke", "mist", "fog"],
  fog: ["smoke", "mist", "fog"],
  mist: ["mist", "smoke", "fog"],
  dust: ["dust", "sand", "particles"],
  sand: ["sand", "dust"],
  rain: ["rain", "storm", "water"],
  storm: ["rain", "storm", "wind"],
  wind: ["wind", "air", "movement"],
  air: ["air", "wind", "movement"],
  nebel: ["smoke", "mist", "fog"],
  staub: ["dust", "sand", "particles"],
  regen: ["rain", "storm", "water"],
  sturm: ["storm", "wind", "rain"],
  luft: ["air", "wind", "movement"],
};

function normalize(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function collectTokens(storyText: string): string[] {
  const normalized = normalize(storyText);
  if (!normalized) return [];
  const base = normalized.split(" ").filter((token) => token.length >= 2);
  const expanded = new Set(base);
  for (const token of base) {
    const additions = KEYWORD_EXPANSIONS[token];
    if (!additions) continue;
    for (const next of additions) {
      expanded.add(next);
    }
  }
  return Array.from(expanded);
}

export function getAssetSuggestions(storyText: string, library: GLBAsset[]): GLBAsset[] {
  const normalizedText = normalize(storyText);
  const tokens = collectTokens(storyText);
  if (!normalizedText || tokens.length === 0) return [];

  const scored = library
    .filter((asset) => (asset.type ?? "glb") === "glb" && asset.file.trim().length > 0)
    .map((asset) => {
      const name = normalize(asset.name);
      const category = normalize(asset.category);
      const tags = asset.tags.map((tag) => normalize(tag));
      const description = normalize(asset.description ?? "");

      let score = 0;

      if (name && normalizedText.includes(name)) {
        score += 8;
      }

      for (const token of tokens) {
        if (name.includes(token)) score += 6;
        if (category.includes(token)) score += 1;
        if (description.includes(token)) score += 2;
        for (const tag of tags) {
          if (tag.includes(token)) {
            score += 4;
            break;
          }
        }
      }

      return { asset, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.asset.name.localeCompare(b.asset.name));

  return scored.slice(0, 5).map((entry) => entry.asset);
}
