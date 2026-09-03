export const CALLOUT_COLOURS = [
  "gray",
  "blue",
  "green",
  "yellow",
  "red",
] as const;

export type CalloutColour = (typeof CALLOUT_COLOURS)[number];

/**
 * Callout surfaces, shared by the editor block and the static renderer so
 * a red "no patient information" callout is red on screen and in print.
 * A left rule carries the colour; the tint alone is too faint to read.
 */
export const calloutClasses: Record<CalloutColour, string> = {
  gray: "border-l-border bg-muted",
  blue: "border-l-blue-500 bg-blue-500/10",
  green: "border-l-green-600 bg-green-500/10",
  yellow: "border-l-yellow-500 bg-yellow-500/10",
  red: "border-l-red-600 bg-red-500/10",
};

export const CALLOUT_LABELS: Record<CalloutColour, string> = {
  gray: "Grey",
  blue: "Blue",
  green: "Green",
  yellow: "Yellow",
  red: "Red",
};

export function calloutClass(colour: unknown): string {
  return calloutClasses[colour as CalloutColour] ?? calloutClasses.gray;
}
