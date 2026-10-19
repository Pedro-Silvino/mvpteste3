import { describe, expect, it } from "vitest";
import { normalizePartnerCode } from "./partner";

describe("normalizePartnerCode", () => {
  it("lowercases and trims a valid code", () => {
    expect(normalizePartnerCode(" SINCOR-BH ")).toBe("sincor-bh");
    expect(normalizePartnerCode("corretor42")).toBe("corretor42");
  });

  it("returns null for missing or malformed codes", () => {
    expect(normalizePartnerCode(null)).toBeNull();
    expect(normalizePartnerCode(undefined)).toBeNull();
    expect(normalizePartnerCode("")).toBeNull();
    expect(normalizePartnerCode("a")).toBeNull();
    expect(normalizePartnerCode("x".repeat(41))).toBeNull();
    expect(normalizePartnerCode("abc'; drop table")).toBeNull();
    expect(normalizePartnerCode("<script>")).toBeNull();
  });
});
