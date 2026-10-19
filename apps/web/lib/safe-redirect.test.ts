import { describe, expect, it } from "vitest";
import { safeNextPath } from "./safe-redirect";

describe("safeNextPath", () => {
  it("keeps internal paths", () => {
    expect(safeNextPath("/comecar")).toBe("/comecar");
    expect(safeNextPath("/diagnostico?x=1")).toBe("/diagnostico?x=1");
  });

  it("falls back to /comecar for anything that could leave the site", () => {
    expect(safeNextPath(null)).toBe("/comecar");
    expect(safeNextPath("")).toBe("/comecar");
    expect(safeNextPath("https://evil.com")).toBe("/comecar");
    expect(safeNextPath("//evil.com")).toBe("/comecar");
    expect(safeNextPath("/\\evil.com")).toBe("/comecar");
    expect(safeNextPath("javascript:alert(1)")).toBe("/comecar");
    expect(safeNextPath("comecar")).toBe("/comecar");
  });
});
