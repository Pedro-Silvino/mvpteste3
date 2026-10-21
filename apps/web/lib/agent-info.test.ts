import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { AGENT_SHA256 } from "./agent-info";

const source = resolve(__dirname, "../../../agent/sentinela-agent.ps1");
const published = resolve(__dirname, "../public/downloads/sentinela-agent.ps1");

describe("agent download", () => {
  it("the downloadable copy is identical to agent/sentinela-agent.ps1", () => {
    expect(readFileSync(published).equals(readFileSync(source))).toBe(true);
  });
  it("the hash shown in the dashboard is the real SHA-256 of the file", () => {
    expect(createHash("sha256").update(readFileSync(published)).digest("hex")).toBe(AGENT_SHA256);
  });
});
