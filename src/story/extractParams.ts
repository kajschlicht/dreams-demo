import type { DreamParams } from "../core/params";
import { defaultParams, normalizeParams } from "../core/params";

export function extractParamsFromText(text: string): DreamParams {
  const lower = text.toLowerCase();

  const p: DreamParams = { ...defaultParams };

  // Licht
  if (lower.includes("dunkel") || lower.includes("nacht"))
    p.light = 0.2;
  if (lower.includes("hell") || lower.includes("licht"))
    p.light = 0.8;

  // Raumweite
  if (lower.includes("eng") || lower.includes("flur"))
    p.space = 0.2;
  if (lower.includes("weit") || lower.includes("offen"))
    p.space = 0.8;

  // Kontrolle
  if (lower.includes("konnte nicht") || lower.includes("gelähmt"))
    p.control = 0.2;
  if (lower.includes("entscheide") || lower.includes("kontrolle"))
    p.control = 0.8;

  // Bedrohung
  if (lower.includes("verfolgt") || lower.includes("angst"))
    p.threat = 0.7;

  // Präsenz
  if (lower.includes("menschen") || lower.includes("beobachtet"))
    p.presence = 0.6;
  if (lower.includes("allein"))
    p.presence = 0.1;

  return normalizeParams(p);
}