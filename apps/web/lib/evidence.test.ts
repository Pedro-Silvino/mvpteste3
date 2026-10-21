import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { buildStoragePath, detectMime, MAX_BYTES, pathBelongsTo, safeFileName, sha256Hex } from "./evidence";

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0x10, 0x4a, 0x46]);
const PDF = new TextEncoder().encode("%PDF-1.7\n...");
const EXE = new TextEncoder().encode("MZ\x90\x00\x03");

describe("detectMime (looks at the bytes, not the file name)", () => {
  it("recognises PNG, JPEG and PDF", () => {
    expect(detectMime(PNG)).toBe("image/png");
    expect(detectMime(JPG)).toBe("image/jpeg");
    expect(detectMime(PDF)).toBe("application/pdf");
  });
  it("refuses anything else, even if it is called .png", () => {
    expect(detectMime(EXE)).toBeNull();
    expect(detectMime(new TextEncoder().encode("<script>alert(1)</script>"))).toBeNull();
    expect(detectMime(new Uint8Array([]))).toBeNull();
  });
});

describe("safeFileName", () => {
  it("keeps a readable name and the extension", () => {
    expect(safeFileName("Print do Backup (março).PNG")).toBe("print-do-backup-marco.png");
  });
  it("removes path tricks and weird characters", () => {
    expect(safeFileName("../../etc/passwd")).toBe("etc-passwd");
    expect(safeFileName("a b\\c:d*e?.pdf")).toBe("a-b-c-d-e.pdf");
  });
  it("never returns an empty name and caps the length", () => {
    expect(safeFileName("???")).toBe("arquivo");
    expect(safeFileName("x".repeat(300) + ".pdf").length).toBeLessThanOrEqual(80);
    expect(safeFileName("x".repeat(300) + ".pdf").endsWith(".pdf")).toBe(true);
  });
});

describe("storage path", () => {
  const org = "11111111-1111-4111-8111-111111111111";
  const other = "22222222-2222-4222-8222-222222222222";
  it("lives under the company and control folders", () => {
    const p = buildStoragePath(org, "C06", "abc", "Backup.png");
    expect(p).toBe(`${org}/C06/abc-backup.png`);
    expect(pathBelongsTo(p, org, "C06")).toBe(true);
  });
  it("rejects paths from another company, another control or with traversal", () => {
    expect(pathBelongsTo(`${other}/C06/x.png`, org, "C06")).toBe(false);
    expect(pathBelongsTo(`${org}/C07/x.png`, org, "C06")).toBe(false);
    expect(pathBelongsTo(`${org}/C06/../C07/x.png`, org, "C06")).toBe(false);
    expect(pathBelongsTo(`${org}/C06/`, org, "C06")).toBe(false);
  });
});

describe("limits and hash", () => {
  it("allows up to 10 MB", () => {
    expect(MAX_BYTES).toBe(10 * 1024 * 1024);
  });
  it("sha256Hex matches node crypto", () => {
    expect(sha256Hex(PDF)).toBe(createHash("sha256").update(PDF).digest("hex"));
    expect(sha256Hex(PDF)).toMatch(/^[a-f0-9]{64}$/);
  });
});
