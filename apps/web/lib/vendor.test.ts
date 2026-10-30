import { describe, expect, it } from "vitest";
import { isVendorToken, isComplete, vendorAnswersSchema, VENDOR_CONTROLS, workerEvidenceUrl } from "./vendor";

const TOKEN = "vnd_" + "a".repeat(64);

describe("isVendorToken", () => {
  it("accepts only vnd_ + 64 hex", () => {
    expect(isVendorToken(TOKEN)).toBe(true);
    expect(isVendorToken("vnd_" + "a".repeat(63))).toBe(false);
    expect(isVendorToken("snt_" + "a".repeat(64))).toBe(false);
    expect(isVendorToken("vnd_" + "G".repeat(64))).toBe(false);
    expect(isVendorToken(`${TOKEN}/../x`)).toBe(false);
    expect(isVendorToken("")).toBe(false);
  });
});

describe("answers", () => {
  const all = Object.fromEntries(VENDOR_CONTROLS.map((c) => [c.id, "sim"]));
  it("has the 12 controls of Base 12", () => {
    expect(VENDOR_CONTROLS).toHaveLength(12);
    expect(VENDOR_CONTROLS[0].id).toBe("C01");
  });
  it("accepts a full valid set and detects completeness", () => {
    expect(vendorAnswersSchema.safeParse(all).success).toBe(true);
    expect(isComplete(all)).toBe(true);
    expect(isComplete({ ...all, C05: undefined })).toBe(false);
    expect(isComplete({})).toBe(false);
  });
  it("rejects unknown controls and unknown values", () => {
    expect(vendorAnswersSchema.safeParse({ ...all, C99: "sim" }).success).toBe(false);
    expect(vendorAnswersSchema.safeParse({ ...all, C01: "talvez" }).success).toBe(false);
  });
});

describe("workerEvidenceUrl", () => {
  it("builds the upload URL from the worker base and encodes the control", () => {
    expect(workerEvidenceUrl("https://w.example.com/", TOKEN, "C03")).toBe(`https://w.example.com/tprm/vendor/${TOKEN}/evidence?control=C03`);
  });
  it("refuses a non-https base (except localhost) and a bad token or control", () => {
    expect(workerEvidenceUrl("http://w.example.com", TOKEN, "C03")).toBeNull();
    expect(workerEvidenceUrl("http://localhost:8000", TOKEN, "C03")).not.toBeNull();
    expect(workerEvidenceUrl("https://w.example.com", "x", "C03")).toBeNull();
    expect(workerEvidenceUrl("https://w.example.com", TOKEN, "../C03")).toBeNull();
    expect(workerEvidenceUrl(undefined, TOKEN, "C03")).toBeNull();
  });
});
