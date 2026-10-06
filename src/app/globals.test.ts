import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/**
 * The checked check-list override in globals.css must beat BlockNote's
 * default (which strikes the text through) on the cascade: the editor's
 * stylesheet is loaded by the lazily loaded editor chunk, after
 * globals.css, so the override needs strictly higher specificity, not
 * `!important`.
 */

const globals = readFileSync(new URL("./globals.css", import.meta.url), "utf8");
const blocknote = readFileSync(
  new URL(
    "../../node_modules/@blocknote/shadcn/dist/style.css",
    import.meta.url,
  ),
  "utf8",
);

/** Specificity as (ids, classes+attributes+pseudo-classes, elements). */
function specificity(selector: string): [number, number, number] {
  const s = selector.replace(/\s+/g, " ").trim();
  const ids = (s.match(/#[\w-]+/g) ?? []).length;
  const classes = (s.match(/\.[\w-]+|\[[^\]]*\]|:(?!:)[\w-]+/g) ?? []).length;
  const elements = (s.match(/(^|[\s>+~])[a-z][\w-]*/gi) ?? []).length;
  return [ids, classes, elements];
}

/** The selectors of every rule whose declarations match `declaration`. */
function selectorsDeclaring(css: string, declaration: RegExp): string[] {
  const out: string[] = [];
  const rule = /([^{}]+)\{([^{}]*)\}/g;
  const stripped = css.replace(/\/\*[\s\S]*?\*\//g, "");
  for (const match of stripped.matchAll(rule)) {
    if (declaration.test(match[2])) out.push(match[1].trim());
  }
  return out;
}

describe("checked check-list items", () => {
  const checked = /checkListItem[^{]*data-checked=["']?true/;

  it("are struck through by BlockNote's default stylesheet", () => {
    const theirs = selectorsDeclaring(
      blocknote,
      /text-decoration:\s*line-through/,
    ).filter((s) => checked.test(s));
    expect(theirs.length).toBeGreaterThan(0);
  });

  it("are un-struck and muted by an override in globals.css that wins on specificity", () => {
    const ours = selectorsDeclaring(
      globals,
      /text-decoration:\s*none;[\s\S]*color:\s*var\(--muted-foreground\)/,
    ).filter((s) => checked.test(s));
    expect(ours).toHaveLength(1);
    expect(ours[0]).not.toContain("!important");
    expect(globals.replace(/\/\*[\s\S]*?\*\//g, "")).not.toMatch(
      /data-checked[^}]*!important/,
    );
    const theirs = selectorsDeclaring(
      blocknote,
      /text-decoration:\s*line-through/,
    ).filter((s) => checked.test(s));
    const [oi, oc, oe] = specificity(ours[0]);
    for (const selector of theirs) {
      const [ti, tc, te] = specificity(selector);
      const wins =
        oi > ti || (oi === ti && (oc > tc || (oc === tc && oe > te)));
      expect(wins, `${ours[0]} vs ${selector}`).toBe(true);
    }
  });

  it("leaves the suggestion-mode strike-through rules alone", () => {
    expect(globals).toMatch(
      /del\.wi-suggest-del \{\s*text-decoration: line-through/,
    );
    expect(globals).toMatch(
      /\.wi-suggest-block-del \{[^}]*text-decoration: line-through/,
    );
  });
});
