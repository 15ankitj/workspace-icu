import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { EVIDENCE_RULES } from "./cesr-evidence-rules";

/** The data file must be a verbatim copy of the source markdown. */
describe("evidence rules data", () => {
  const lines = readFileSync(
    new URL("./source/cesr/evidence-rules.md", import.meta.url),
    "utf8",
  )
    .split("\n")
    .filter(
      (line) =>
        line.trim() && !line.startsWith("<!--") && !line.startsWith("Source:"),
    );

  it("matches content/source/cesr/evidence-rules.md line for line", () => {
    const rendered = [
      "# 📋 Evidence rules that apply everywhere",
      `> ℹ️ ${EVIDENCE_RULES.intro}`,
      ...EVIDENCE_RULES.sections.flatMap((section) => [
        `## ${section.heading}`,
        ...section.blocks.map((block) =>
          block.kind === "todo"
            ? `- [ ] ${block.text}`
            : block.kind === "bullet"
              ? `- ${block.text}`
              : block.text,
        ),
      ]),
    ];
    expect(rendered).toEqual(lines);
  });

  it("has the five sections the pack renders", () => {
    expect(EVIDENCE_RULES.sections.map((s) => s.heading)).toEqual([
      "The application at a glance",
      "Mandatory cross-cutting items",
      "Currency — the seven-year rule",
      "Anonymisation (GMC will return non-compliant evidence)",
      "Organising and cross-referencing",
    ]);
  });
});
