import { describe, expect, it } from "vitest";
import { canUseVault, sha256Hex, vaultInputSchema, vaultPathOk, VAULT_CATEGORIES } from "./vault";

const ORG = "11111111-1111-1111-1111-111111111111";
const HASH = "a".repeat(64);

describe("sha256Hex", () => {
  it("matches the known SHA-256 vectors", async () => {
    expect(await sha256Hex(new Uint8Array())).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
    expect(await sha256Hex(new TextEncoder().encode("abc"))).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  });
  it("changes when one byte changes", async () => {
    const a = await sha256Hex(new Uint8Array([1, 2, 3]));
    const b = await sha256Hex(new Uint8Array([1, 2, 4]));
    expect(a).not.toBe(b);
  });
});

describe("vaultPathOk", () => {
  it("accepts only a single file inside {org}/vault/", () => {
    expect(vaultPathOk(`${ORG}/vault/ab12cd34-politica.pdf`, ORG)).toBe(true);
    expect(vaultPathOk(`${ORG}/vault/`, ORG)).toBe(false);
    expect(vaultPathOk(`${ORG}/vault/../x.pdf`, ORG)).toBe(false);
    expect(vaultPathOk(`${ORG}/vault/sub/x.pdf`, ORG)).toBe(false);
    expect(vaultPathOk(`22222222-2222-2222-2222-222222222222/vault/x.pdf`, ORG)).toBe(false);
    expect(vaultPathOk(`${ORG}/C01/x.pdf`, ORG)).toBe(false);
  });
});

describe("vaultInputSchema", () => {
  const ok = { path: `${ORG}/vault/ab-x.pdf`, sha256: HASH, title: "Política de backup", category: "backup" };
  it("accepts a valid body and lowercases the hash", () => {
    const r = vaultInputSchema.safeParse({ ...ok, sha256: "A".repeat(64) });
    expect(r.success && r.data.sha256).toBe(HASH);
  });
  it("rejects bad hash, short title, unknown category and extra keys", () => {
    expect(vaultInputSchema.safeParse({ ...ok, sha256: "zz" }).success).toBe(false);
    expect(vaultInputSchema.safeParse({ ...ok, title: "ab" }).success).toBe(false);
    expect(vaultInputSchema.safeParse({ ...ok, category: "xpto" }).success).toBe(false);
    expect(vaultInputSchema.safeParse({ ...ok, organization_id: ORG }).success).toBe(false);
  });
  it("covers the same categories as the database check", () => {
    expect([...VAULT_CATEGORIES].sort()).toEqual(["backup", "continuidade", "contrato", "laudo", "mfa", "outro", "patch", "politica", "treinamento"]);
  });
});

describe("canUseVault", () => {
  it("mirrors org_can_use_vault", () => {
    for (const p of ["pro", "scale", "dossie", "360"]) expect(canUseVault(p)).toBe(true);
    for (const p of ["express", "core", "essencial", "", null, undefined]) expect(canUseVault(p)).toBe(false);
  });
});

describe("vaultErrorStatus", () => {
  it("403 for permission and plan, 400 for the rest", async () => {
    const { vaultErrorStatus } = await import("./vault");
    expect(vaultErrorStatus("forbidden")).toBe(403);
    expect(vaultErrorStatus("plan_required")).toBe(403);
    expect(vaultErrorStatus("new row violates check constraint")).toBe(400);
    expect(vaultErrorStatus(undefined)).toBe(400);
  });
});
