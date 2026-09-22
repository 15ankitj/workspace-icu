/**
 * A post-sign-in destination from a query string must stay on this
 * site: an absolute path, never a protocol-relative "//host" (which the
 * browser treats as another origin) and never a scheme. Anything else
 * lands on the workspace home.
 */
export function safeNextPath(raw: string | null | undefined): string {
  if (!raw) return "/";
  const value = raw.trim();
  if (!value.startsWith("/")) return "/";
  // "//host", "/\host" and "/\t/host" variants all resolve off-site.
  if (/^\/[\/\\]/.test(value) || /^\/\s/.test(value)) return "/";
  if (/[\u0000-\u001f]/.test(value)) return "/";
  return value;
}
