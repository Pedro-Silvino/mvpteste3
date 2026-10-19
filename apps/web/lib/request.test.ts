import { describe, expect, it } from "vitest";
import { clientIp, createOrgErrorMessage } from "./request";

describe("clientIp", () => {
  it("takes the first x-forwarded-for entry", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "203.0.113.7, 10.0.0.1" }))).toBe("203.0.113.7");
  });

  it("falls back to x-real-ip and accepts IPv6", () => {
    expect(clientIp(new Headers({ "x-real-ip": "2001:db8::1" }))).toBe("2001:db8::1");
  });

  it("ignores missing or garbage values", () => {
    expect(clientIp(new Headers())).toBeNull();
    expect(clientIp(new Headers({ "x-forwarded-for": "not-an-ip'; --" }))).toBeNull();
  });
});

describe("createOrgErrorMessage", () => {
  it("explains the organization limit", () => {
    expect(createOrgErrorMessage("limit_orgs")).toMatch(/limite/i);
  });

  it("uses a generic message for anything else (no internals leak)", () => {
    const msg = createOrgErrorMessage('new row violates check constraint "organizations_cnpj_check"');
    expect(msg).not.toMatch(/constraint|organizations|cnpj_check/);
    expect(createOrgErrorMessage(undefined)).toBe(msg);
  });
});
