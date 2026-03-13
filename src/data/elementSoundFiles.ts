const elementSoundModules = import.meta.glob("../assets/sounds/ElementSounds/*.mp3", {
  eager: true,
  query: "?url",
  import: "default",
}) as Record<string, string>;

function extractBaseName(path: string): string {
  const withoutQuery = path.split("?")[0].split("#")[0];
  const fileName = withoutQuery.split("/").pop() ?? withoutQuery;
  return fileName.replace(/\.[^/.]+$/i, "");
}

export const elementSoundFileByBaseName: Record<string, string> = Object.entries(
  elementSoundModules
).reduce<Record<string, string>>((acc, [path, fileUrl]) => {
  const baseName = extractBaseName(path);
  acc[baseName] = fileUrl;
  return acc;
}, {});

export function getExactElementSoundForGlbFile(glbFile: string | undefined): string | undefined {
  if (!glbFile) return undefined;
  const glbBaseName = extractBaseName(glbFile);
  return elementSoundFileByBaseName[glbBaseName];
}

export function isExactElementSoundForGlbFile(
  glbFile: string | undefined,
  soundFile: string | undefined
): boolean {
  if (!glbFile || !soundFile) return false;
  const expected = getExactElementSoundForGlbFile(glbFile);
  return expected === soundFile;
}
