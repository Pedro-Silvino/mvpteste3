import { describe, expect, it } from "vitest";
import { authErrorMessage, loginSchema, signupSchema } from "./auth";

describe("signupSchema", () => {
  it("normalizes the e-mail and accepts a good password", () => {
    const r = signupSchema.safeParse({ email: "  Dono@Empresa.COM.br ", password: "uma-senha-ok-123" });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.email).toBe("dono@empresa.com.br");
  });

  it("rejects short passwords and invalid e-mails", () => {
    expect(signupSchema.safeParse({ email: "a@b.com", password: "1234567" }).success).toBe(false);
    expect(signupSchema.safeParse({ email: "sem-arroba", password: "uma-senha-ok-123" }).success).toBe(false);
  });

  it("rejects passwords over 72 bytes (bcrypt limit), counting multibyte characters", () => {
    expect(signupSchema.safeParse({ email: "a@b.com", password: "a".repeat(72) }).success).toBe(true);
    expect(signupSchema.safeParse({ email: "a@b.com", password: "a".repeat(73) }).success).toBe(false);
    expect(signupSchema.safeParse({ email: "a@b.com", password: "ç".repeat(37) }).success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("only requires a non-empty password (older accounts may have shorter ones)", () => {
    expect(loginSchema.safeParse({ email: "a@b.com", password: "x" }).success).toBe(true);
    expect(loginSchema.safeParse({ email: "a@b.com", password: "" }).success).toBe(false);
  });
});

describe("authErrorMessage", () => {
  it("maps known codes to friendly messages", () => {
    expect(authErrorMessage("invalid_credentials")).toMatch(/e-mail ou senha/i);
    expect(authErrorMessage("email_exists")).toMatch(/já tem conta/i);
    expect(authErrorMessage("weak_password")).toMatch(/senha/i);
    expect(authErrorMessage("over_request_rate_limit")).toMatch(/tentativas/i);
    expect(authErrorMessage(undefined, 429)).toMatch(/tentativas/i);
  });

  it("falls back to a generic message without leaking internals", () => {
    const msg = authErrorMessage("anonymous_provider_disabled");
    expect(msg).not.toMatch(/anonymous|provider|disabled/i);
    expect(authErrorMessage("something_new")).toBe(msg);
    expect(authErrorMessage(undefined)).toBe(msg);
  });
});
