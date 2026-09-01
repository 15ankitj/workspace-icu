/**
 * Advisory PHI scan (brief §9): pattern checks over extractable text for
 * NHS numbers (modulus-11), date-of-birth patterns, hospital-number
 * formats, and name-like strings near clinical terms. Advisory only —
 * findings inform the uploader, they never block. Matches are masked in
 * findings so the scan output itself never carries an identifier.
 */

export type PhiFindingType =
  | "nhs_number"
  | "date_of_birth"
  | "hospital_number"
  | "name_near_clinical_term";

export interface PhiFinding {
  type: PhiFindingType;
  /** Partially masked match, safe to display and store. */
  masked: string;
  /** Character offset in the scanned text. */
  index: number;
}

/** Modulus-11 check as used by NHS numbers. */
export function isValidNhsNumber(digits: string): boolean {
  if (!/^\d{10}$/.test(digits)) return false;
  const numbers = digits.split("").map(Number);
  const sum = numbers
    .slice(0, 9)
    .reduce((acc, digit, i) => acc + digit * (10 - i), 0);
  let check = 11 - (sum % 11);
  if (check === 11) check = 0;
  if (check === 10) return false;
  return check === numbers[9];
}

function mask(value: string): string {
  const compact = value.replace(/\s+/g, "");
  if (compact.length <= 4) return "****";
  return `${compact.slice(0, 2)}${"*".repeat(compact.length - 4)}${compact.slice(-2)}`;
}

const CLINICAL_TERMS = [
  "patient",
  "diagnosis",
  "diagnosed",
  "admitted",
  "admission",
  "discharged",
  "ward",
  "icu",
  "itu",
  "intubated",
  "ventilated",
  "sedated",
  "prescribed",
  "presented with",
  "next of kin",
  "date of birth",
  "dob",
];

export function scanTextForPhi(text: string): PhiFinding[] {
  const findings: PhiFinding[] = [];
  const sample = text.slice(0, 2_000_000);

  // NHS numbers: 10 digits, optionally spaced 3-3-4, passing modulus-11.
  const nhsPattern = /\b(\d{3}[ -]?\d{3}[ -]?\d{4})\b/g;
  for (const match of sample.matchAll(nhsPattern)) {
    const digits = match[1].replace(/[ -]/g, "");
    if (isValidNhsNumber(digits)) {
      findings.push({
        type: "nhs_number",
        masked: mask(match[1]),
        index: match.index ?? 0,
      });
    }
  }

  // Date-of-birth-shaped dates: dd/mm/yyyy (and - or . separators) with a
  // plausible year, or any date next to a DOB keyword.
  const datePattern = /\b([0-3]?\d)[/.-]([01]?\d)[/.-](19\d\d|20[0-2]\d)\b/g;
  for (const match of sample.matchAll(datePattern)) {
    const day = Number(match[1]);
    const month = Number(match[2]);
    if (day < 1 || day > 31 || month < 1 || month > 12) continue;
    const index = match.index ?? 0;
    const before = sample.slice(Math.max(0, index - 40), index).toLowerCase();
    const isDobLabelled = /\b(dob|date of birth|born)\b/.test(before);
    const year = Number(match[3]);
    // Unlabelled dates only count when old enough to look like a birth
    // date rather than a meeting date.
    if (isDobLabelled || year <= new Date().getFullYear() - 16) {
      findings.push({
        type: "date_of_birth",
        masked: mask(match[0]),
        index,
      });
    }
  }

  // Hospital-number formats: 1-3 letters followed by 6-8 digits.
  const hospitalPattern = /\b([A-Z]{1,3}\d{6,8})\b/g;
  for (const match of sample.matchAll(hospitalPattern)) {
    findings.push({
      type: "hospital_number",
      masked: mask(match[1]),
      index: match.index ?? 0,
    });
  }

  // Name-like strings (Two Capitalised Words) near clinical terms.
  const namePattern = /\b([A-Z][a-z]{1,20}\s+[A-Z][a-z]{1,20})\b/g;
  for (const match of sample.matchAll(namePattern)) {
    const index = match.index ?? 0;
    const context = sample
      .slice(Math.max(0, index - 80), index + match[0].length + 80)
      .toLowerCase();
    if (CLINICAL_TERMS.some((term) => context.includes(term))) {
      const [first, last] = match[1].split(/\s+/);
      findings.push({
        type: "name_near_clinical_term",
        masked: `${first[0]}. ${last[0]}.`,
        index,
      });
    }
  }

  return findings.slice(0, 50);
}

/** MIME types whose content we can scan as text. */
export function isTextScannable(mime: string): boolean {
  return (
    mime.startsWith("text/") ||
    mime === "application/json" ||
    mime === "text/csv" ||
    mime === "text/markdown"
  );
}
