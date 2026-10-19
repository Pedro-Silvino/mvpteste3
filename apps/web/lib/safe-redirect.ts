const FALLBACK = "/comecar";

// Only same-site paths: blocks "//host", "/\host" and absolute URLs (open redirect).
export function safeNextPath(value: string | null | undefined): string {
  if (!value || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return FALLBACK;
  }
  return value;
}
