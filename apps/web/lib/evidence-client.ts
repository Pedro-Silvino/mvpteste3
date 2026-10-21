// Browser-safe part (no Node APIs). The SHA-256 lives in evidence.ts, server only.
export const MAX_BYTES = 10 * 1024 * 1024;
export const ALLOWED_MIME = ["application/pdf", "image/png", "image/jpeg"] as const;
export type EvidenceMime = (typeof ALLOWED_MIME)[number];

const startsWith = (b: Uint8Array, sig: number[]) => sig.every((v, i) => b[i] === v);

// The real type comes from the first bytes of the file, never from its name or the browser's claim.
export function detectMime(bytes: Uint8Array): EvidenceMime | null {
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "application/pdf"; // %PDF-
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "image/png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "image/jpeg";
  return null;
}

export function safeFileName(name: string): string {
  const m = name.match(/\.([a-z0-9]{1,5})$/i); // a real extension only: a dot inside a path is not one
  const ext = m ? m[1].toLowerCase() : "";
  const base = (m ? name.slice(0, -m[0].length) : name)
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70);
  return `${base || "arquivo"}${ext ? "." + ext : ""}`;
}

export function buildStoragePath(orgId: string, controlId: string, uid: string, fileName: string): string {
  return `${orgId}/${controlId}/${uid}-${safeFileName(fileName)}`;
}

// The browser uploads straight to Storage, so the server must check that the path it is told about is
// really inside this company's and this control's folder before it registers anything.
export function pathBelongsTo(path: string, orgId: string, controlId: string): boolean {
  const prefix = `${orgId}/${controlId}/`;
  return path.startsWith(prefix) && path.length > prefix.length && !path.includes("..") && !path.slice(prefix.length).includes("/");
}
