import type { GLBAsset, GLBCategory } from "../data/glbLibrary";

export function filterGLBLibrary(
  assets: GLBAsset[],
  query: string,
  category?: GLBCategory | "all"
): GLBAsset[] {
  const normalizedQuery = query.trim().toLowerCase();
  const normalizedCategory = category && category !== "all"
    ? category.toLowerCase()
    : "";

  return assets.filter((asset) => {
    if (normalizedCategory && asset.category.toLowerCase() !== normalizedCategory) {
      return false;
    }

    if (!normalizedQuery) return true;

    const haystack = [
      asset.name,
      asset.category,
      asset.tags.join(" "),
      asset.description ?? "",
    ]
      .join(" ")
      .toLowerCase();

    return haystack.includes(normalizedQuery);
  });
}
