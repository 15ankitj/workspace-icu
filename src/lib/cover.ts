/**
 * Page cover values: either a preset gradient token ("gradient:N") or an
 * https image URL. Kept pure for unit testing; the server action enforces
 * the same rule.
 */

export const COVER_GRADIENTS = [
  "linear-gradient(135deg, #667eea 0%, #764ba2 100%)",
  "linear-gradient(135deg, #2af598 0%, #009efd 100%)",
  "linear-gradient(135deg, #f6d365 0%, #fda085 100%)",
  "linear-gradient(135deg, #a18cd1 0%, #fbc2eb 100%)",
  "linear-gradient(135deg, #84fab0 0%, #8fd3f4 100%)",
  "linear-gradient(135deg, #fa709a 0%, #fee140 100%)",
  "linear-gradient(135deg, #30cfd0 0%, #330867 100%)",
  "linear-gradient(135deg, #434343 0%, #7f8c8d 100%)",
] as const;

export function isValidCover(value: string): boolean {
  const gradientMatch = value.match(/^gradient:(\d+)$/);
  if (gradientMatch) {
    const index = Number(gradientMatch[1]);
    return index >= 0 && index < COVER_GRADIENTS.length;
  }
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

/** CSS background for a cover value, or null when it is an image URL. */
export function coverGradient(value: string): string | null {
  const match = value.match(/^gradient:(\d+)$/);
  if (!match) return null;
  return COVER_GRADIENTS[Number(match[1])] ?? COVER_GRADIENTS[0];
}
