/**
 * Feature flags (brief §13: a step that touches existing users ships
 * behind a flag). Every flag is read from the environment here and nowhere
 * else, so removing one means deleting its line and the props it fed.
 * Server-only values (no NEXT_PUBLIC_ prefix): server components read
 * `flags` and pass what the client needs as props.
 *
 * A flag is on when its variable is "1", "true" or "on" (any case). They
 * are set per environment in Vercel; a variable that is unset is off.
 */
function isOn(value: string | undefined): boolean {
  const v = value?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "on";
}

export const flags = {
  /** Relation properties (Appendix B). `FEATURE_RELATIONS`: on for
   *  Preview (staging), off for Production until the owner has tried it. */
  relations: isOn(process.env.FEATURE_RELATIONS),
} as const;
