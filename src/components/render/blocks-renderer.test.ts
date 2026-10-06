import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { EditorBlock } from "@/lib/blocks";
import { Blocks, type RenderContext } from "./blocks-renderer";

const ctx: RenderContext = {
  pageHref: (id) => `/p/${id}`,
  pageTitle: () => null,
};

const text = (t: string, styles: Record<string, boolean> = {}) => ({
  type: "text",
  text: t,
  styles,
});

function item(
  id: string,
  checked: boolean,
  content: ReturnType<typeof text>[],
): EditorBlock {
  return {
    id,
    type: "checkListItem",
    props: { checked },
    content,
    children: [],
  };
}

const render = (blocks: EditorBlock[]) =>
  renderToStaticMarkup(createElement(Blocks, { blocks, ctx }));

describe("blocks-renderer check-list items", () => {
  it("renders a ticked item muted, with a checked box and no strike-through", () => {
    const html = render([item("a", true, [text("Planned or done")])]);
    expect(html).toContain('type="checkbox"');
    expect(html).toContain("checked=");
    expect(html).toContain('class="text-muted-foreground"');
    expect(html).not.toContain("line-through");
    expect(html).not.toContain("<s>");
  });

  it("renders an unticked item plain", () => {
    const html = render([item("b", false, [text("Still to do")])]);
    expect(html).not.toContain("checked=");
    expect(html).not.toContain("text-muted-foreground");
    expect(html).not.toContain("<s>");
  });

  it("keeps a manual strike mark struck, ticked or not", () => {
    const struck = [text("Doesn't apply", { strike: true })];
    expect(render([item("c", false, struck)])).toContain(
      "<s>Doesn&#x27;t apply</s>",
    );
    const ticked = render([item("d", true, struck)]);
    expect(ticked).toContain("<s>Doesn&#x27;t apply</s>");
    expect(ticked).toContain('class="text-muted-foreground"');
  });

  it("matches the snapshot for a ticked and a struck item", () => {
    expect(
      render([
        item("e", true, [text("Ticked: planned or done")]),
        item("f", false, [text("Struck: doesn't apply", { strike: true })]),
      ]),
    ).toMatchInlineSnapshot(`"<div class="space-y-2"><div class="flex items-start gap-2"><input type="checkbox" readOnly="" class="mt-1" checked=""/><div class="flex-1"><div class="text-muted-foreground"><span>Ticked: planned or done</span></div></div></div><div class="flex items-start gap-2"><input type="checkbox" readOnly="" class="mt-1"/><div class="flex-1"><div><span><s>Struck: doesn&#x27;t apply</s></span></div></div></div></div>"`);
  });
});
