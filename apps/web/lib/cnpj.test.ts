import { describe, expect, it } from "vitest";
import { formatCnpj, isValidCnpj, onlyDigits } from "./cnpj";

// Synthetic CNPJs (valid check digits, not real companies).
describe("isValidCnpj", () => {
  it("accepts a CNPJ with valid check digits, masked or not", () => {
    expect(isValidCnpj("11.222.333/0001-81")).toBe(true);
    expect(isValidCnpj("11222333000181")).toBe(true);
  });

  it("rejects wrong check digits", () => {
    expect(isValidCnpj("11.222.333/0001-80")).toBe(false);
    expect(isValidCnpj("12.345.678/0001-90")).toBe(false);
  });

  it("rejects repeated digits, wrong length and empty", () => {
    expect(isValidCnpj("00000000000000")).toBe(false);
    expect(isValidCnpj("11111111111111")).toBe(false);
    expect(isValidCnpj("1122233300018")).toBe(false);
    expect(isValidCnpj("")).toBe(false);
  });
});

describe("formatCnpj", () => {
  it("masks progressively while typing", () => {
    expect(formatCnpj("11")).toBe("11");
    expect(formatCnpj("11222")).toBe("11.222");
    expect(formatCnpj("11222333")).toBe("11.222.333");
    expect(formatCnpj("112223330001")).toBe("11.222.333/0001");
    expect(formatCnpj("11222333000181")).toBe("11.222.333/0001-81");
  });

  it("ignores non-digits and extra digits", () => {
    expect(formatCnpj("11.222.333/0001-81999")).toBe("11.222.333/0001-81");
    expect(formatCnpj("ab")).toBe("");
  });
});

describe("onlyDigits", () => {
  it("strips everything but digits", () => {
    expect(onlyDigits("11.222.333/0001-81")).toBe("11222333000181");
  });
});
