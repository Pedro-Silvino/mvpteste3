import { describe, expect, it } from "vitest";
import { partnerErrorMessage, partnerSchema } from "./partner";

describe("partnerSchema", () => {
  it("accepts a broker with or without SUSEP and trims the name", () => {
    const a = partnerSchema.safeParse({ name: "  Corretora Dois  ", kind: "corretor", susep: "" });
    expect(a.success && a.data).toEqual({ name: "Corretora Dois", kind: "corretor", susep: "" });
    expect(partnerSchema.safeParse({ name: "Seguros ABC", kind: "msp", susep: "1234567890" }).success).toBe(true);
  });
  it("keeps only the digits of the SUSEP number", () => {
    const r = partnerSchema.safeParse({ name: "Seguros ABC", kind: "corretor", susep: "10.2345-6" });
    expect(r.success && r.data.susep).toBe("1023456");
  });
  it("rejects short names, unknown kinds and absurd SUSEP", () => {
    expect(partnerSchema.safeParse({ name: "A", kind: "corretor", susep: "" }).success).toBe(false);
    expect(partnerSchema.safeParse({ name: "Seguros ABC", kind: "banco", susep: "" }).success).toBe(false);
    expect(partnerSchema.safeParse({ name: "Seguros ABC", kind: "corretor", susep: "1".repeat(21) }).success).toBe(false);
  });
});

describe("partnerErrorMessage", () => {
  it("explains the cases the person can fix and keeps the rest generic", () => {
    expect(partnerErrorMessage("already_partner")).toMatch(/já tem/i);
    expect(partnerErrorMessage("account_required")).toMatch(/conta/i);
    expect(partnerErrorMessage("boom: stack trace")).toBe("Não conseguimos concluir o cadastro agora. Tente de novo em alguns minutos.");
  });
});
