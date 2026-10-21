import { createHash } from "node:crypto";

export * from "./evidence-client";

// Server only: the hash is always computed from the bytes the server itself read back from Storage.
export function sha256Hex(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}
