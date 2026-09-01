import { describe, expect, it } from "vitest";
import { isValidNhsNumber, isTextScannable, scanTextForPhi } from "@/lib/phi";

/**
 * Builds a synthetic, modulus-11-valid 10-digit number from a 9-digit
 * seed. Fixtures are generated, never real identifiers.
 */
function syntheticNhsNumber(seed: string): string {
  const digits = seed.split("").map(Number);
  const sum = digits.reduce((acc, digit, i) => acc + digit * (10 - i), 0);
  let check = 11 - (sum % 11);
  if (check === 11) check = 0;
  if (check === 10) return syntheticNhsNumber(incrementSeed(seed));
  return seed + String(check);
}

function incrementSeed(seed: string): string {
  return String(Number(seed) + 1).padStart(9, "0");
}

describe("isValidNhsNumber", () => {
  it("accepts a synthetic modulus-11-valid number", () => {
    expect(isValidNhsNumber(syntheticNhsNumber("123456789"))).toBe(true);
  });

  it("rejects a wrong check digit and wrong lengths", () => {
    const valid = syntheticNhsNumber("123456789");
    const wrong = valid.slice(0, 9) + String((Number(valid[9]) + 1) % 10);
    expect(isValidNhsNumber(wrong)).toBe(false);
    expect(isValidNhsNumber("12345")).toBe(false);
    expect(isValidNhsNumber("12345678901")).toBe(false);
  });
});

describe("scanTextForPhi", () => {
  it("flags a spaced NHS number and masks it", () => {
    const n = syntheticNhsNumber("400123456");
    const spaced = `${n.slice(0, 3)} ${n.slice(3, 6)} ${n.slice(6)}`;
    const findings = scanTextForPhi(`NHS number: ${spaced}`);
    const nhs = findings.filter((f) => f.type === "nhs_number");
    expect(nhs).toHaveLength(1);
    expect(nhs[0].masked).not.toContain(n.slice(2, 8));
  });

  it("ignores 10-digit numbers that fail modulus-11", () => {
    const valid = syntheticNhsNumber("400123456");
    const invalid = valid.slice(0, 9) + String((Number(valid[9]) + 1) % 10);
    const findings = scanTextForPhi(`ref ${invalid}`);
    expect(findings.filter((f) => f.type === "nhs_number")).toHaveLength(0);
  });

  it("flags labelled dates of birth and old unlabelled dates", () => {
    expect(
      scanTextForPhi("DOB: 12/03/1954").filter(
        (f) => f.type === "date_of_birth",
      ),
    ).toHaveLength(1);
    expect(
      scanTextForPhi("first seen 03.04.1987 in clinic").filter(
        (f) => f.type === "date_of_birth",
      ),
    ).toHaveLength(1);
  });

  it("ignores recent unlabelled dates (meeting dates)", () => {
    const findings = scanTextForPhi("Supervision meeting on 12/03/2026");
    expect(findings.filter((f) => f.type === "date_of_birth")).toHaveLength(0);
  });

  it("flags hospital-number formats", () => {
    const findings = scanTextForPhi("case RXH0074321 reviewed");
    expect(findings.filter((f) => f.type === "hospital_number")).toHaveLength(
      1,
    );
  });

  it("flags name-like strings only near clinical terms", () => {
    const near = scanTextForPhi(
      "The patient John Placeholder was admitted overnight.",
    );
    expect(
      near.filter((f) => f.type === "name_near_clinical_term").length,
    ).toBeGreaterThan(0);
    // Initials only in the finding, never the name.
    for (const f of near) {
      expect(f.masked).not.toContain("Placeholder");
    }

    const far = scanTextForPhi(
      "John Placeholder wrote a great book about mountains.",
    );
    expect(
      far.filter((f) => f.type === "name_near_clinical_term"),
    ).toHaveLength(0);
  });

  it("returns nothing for clean text", () => {
    expect(
      scanTextForPhi("Reflection on airway teaching session, June 2026."),
    ).toEqual([]);
  });
});

describe("isTextScannable", () => {
  it("scans text-like types only", () => {
    expect(isTextScannable("text/plain")).toBe(true);
    expect(isTextScannable("text/csv")).toBe(true);
    expect(isTextScannable("application/pdf")).toBe(false);
    expect(isTextScannable("image/png")).toBe(false);
  });
});
