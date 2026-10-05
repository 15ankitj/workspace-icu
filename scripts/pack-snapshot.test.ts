import { describe, expect, it } from "vitest";
import { callout, p, pageLink, prop, todo } from "../content/blocks";
import {
  cesrJourney,
  supportingTemplates,
  type PackTemplate,
} from "../content/cesr-journey";
import { planInstantiation } from "../src/lib/templates";
import { packToSnapshot, previousKeysOf } from "./pack-snapshot";

const KC = "11111111-1111-4111-8111-111111111111";
const ITEM = "22222222-2222-4222-8222-222222222222";
const OTHER = "33333333-3333-4333-8333-333333333333";
const OUTSIDE = "44444444-4444-4444-8444-444444444444";

/** Deterministic ids so snapshots can be compared. */
function ids() {
  let n = 0;
  return () =>
    `${(++n).toString(16).padStart(8, "0")}-0000-4000-8000-000000000000`;
}

/** A KC page with an Evidence relation and one evidence page linked from it. */
function pack(overrides: Partial<PackTemplate> = {}): PackTemplate {
  return {
    name: "Test pack",
    purpose: "Tests",
    description: "A two-page pack",
    category: "Training & Portfolio",
    audience: "Tests",
    kind: "tree",
    version: 1,
    changelog: "Initial version",
    pages: [
      {
        id: KC,
        parentId: null,
        title: "KC 1.1 — Test",
        icon: "🎯",
        description: "The verbatim wording.",
        properties: [
          prop.select("status", "Status", "Not started"),
          prop.date("signed_off", "Signed off"),
          prop.people("supervisor", "Supervisor"),
          prop.relation("evidence", "Evidence", "Evidence for"),
        ],
        blocks: [
          callout("💡", "How to"),
          todo("An item"),
          pageLink(ITEM, "Item"),
        ],
      },
      {
        id: ITEM,
        parentId: KC,
        title: "Item",
        icon: "📄",
        properties: [prop.text("consultant", "Supervising consultant")],
        blocks: [p("An evidence page")],
      },
    ],
    relations: [
      { sourcePageId: KC, propertyId: "evidence", targetPageId: ITEM },
    ],
    ...overrides,
  };
}

describe("packToSnapshot", () => {
  it("builds a format-4 snapshot carrying properties, description and the relation", () => {
    const built = packToSnapshot(pack(), new Map(), ids());
    const { snapshot } = built;
    expect(built.name).toBe("Test pack");
    expect(built.version).toBe(1);
    expect(snapshot.format).toBe(4);
    expect(snapshot.pages.map((page) => page.title)).toEqual([
      "KC 1.1 — Test",
      "Item",
    ]);

    const [kc, item] = snapshot.pages;
    expect(kc.description).toBe("The verbatim wording.");
    // Select values travel; date and people are cleared; the relation row
    // keeps both labels.
    expect(kc.properties).toEqual({
      hidden: [],
      rows: [
        { id: "status", type: "select", label: "Status", value: "Not started" },
        { id: "signed_off", type: "date", label: "Signed off", value: null },
        { id: "supervisor", type: "people", label: "Supervisor", value: [] },
        {
          id: "evidence",
          type: "relation",
          label: "Evidence",
          reverse_label: "Evidence for",
        },
      ],
    });
    expect(item.properties?.rows).toEqual([
      {
        id: "consultant",
        type: "text",
        label: "Supervising consultant",
        value: "",
      },
    ]);
    expect(item.parent_key).toBe(kc.key);

    expect(snapshot.relations).toEqual([
      {
        source_key: kc.key,
        property_id: "evidence",
        target_key: item.key,
        position: "a0",
      },
    ]);
    expect(snapshot.notes).toEqual([]);
    // The page link in content was rewritten to the item's key.
    expect(JSON.stringify(kc.blocks)).toContain(`"pageId":"key:${item.key}"`);
  });

  it("instantiates the copies linked to each other", () => {
    const { snapshot } = packToSnapshot(pack(), new Map(), ids());
    let n = 0;
    const plan = planInstantiation({
      snapshot,
      templateId: "t",
      version: 1,
      workspaceId: "ws",
      parentPageId: null,
      lastSiblingPosition: null,
      newId: () => `new-${++n}`,
    });
    const kc = plan.pages.find((page) => page.title === "KC 1.1 — Test")!;
    const item = plan.pages.find((page) => page.title === "Item")!;
    expect(plan.relations).toEqual([
      {
        workspace_id: "ws",
        source_page_id: kc.id,
        source_property_id: "evidence",
        target_page_id: item.id,
        position: "a0",
      },
    ]);
    expect(kc.properties.rows.map((row) => row.id)).toEqual([
      "status",
      "signed_off",
      "supervisor",
      "evidence",
    ]);
  });

  it("positions links per source page and property in declaration order", () => {
    const template = pack({
      pages: [
        ...pack().pages,
        {
          id: OTHER,
          parentId: KC,
          title: "Other item",
          icon: "📄",
          blocks: [],
        },
      ],
      relations: [
        { sourcePageId: KC, propertyId: "evidence", targetPageId: ITEM },
        { sourcePageId: KC, propertyId: "evidence", targetPageId: OTHER },
      ],
    });
    const { snapshot } = packToSnapshot(template, new Map(), ids());
    const positions = snapshot.relations!.map((link) => link.position);
    expect(positions).toHaveLength(2);
    expect(positions[0] < positions[1]).toBe(true);
  });

  it("keeps page keys from a previous build matched by template, parent and title", () => {
    const first = packToSnapshot(pack(), new Map(), ids());
    const keys = previousKeysOf([first]);
    expect(keys.get("Test pack /  / KC 1.1 — Test")).toBe(
      first.snapshot.pages[0].key,
    );
    const second = packToSnapshot(pack(), keys, ids());
    expect(second.snapshot.pages.map((page) => page.key)).toEqual(
      first.snapshot.pages.map((page) => page.key),
    );
    // The relation follows the kept keys.
    expect(second.snapshot.relations).toEqual(first.snapshot.relations);
  });

  it("refuses a relation to a page outside the template", () => {
    const template = pack({
      relations: [
        { sourcePageId: KC, propertyId: "evidence", targetPageId: OUTSIDE },
      ],
    });
    expect(() => packToSnapshot(template, new Map(), ids())).toThrow(
      /points at a page outside the template/,
    );
  });

  it("refuses a relation whose property is not a relation row on the source page", () => {
    const missing = pack({
      relations: [
        { sourcePageId: KC, propertyId: "links", targetPageId: ITEM },
      ],
    });
    expect(() => packToSnapshot(missing, new Map(), ids())).toThrow(
      /no relation property “links”/,
    );
    const wrongType = pack({
      relations: [
        { sourcePageId: KC, propertyId: "status", targetPageId: ITEM },
      ],
    });
    expect(() => packToSnapshot(wrongType, new Map(), ids())).toThrow(
      /no relation property “status”/,
    );
    const self = pack({
      relations: [
        { sourcePageId: KC, propertyId: "evidence", targetPageId: KC },
      ],
    });
    expect(() => packToSnapshot(self, new Map(), ids())).toThrow(
      /cannot relate to itself/,
    );
  });

  it("refuses property rows the app would drop", () => {
    const badId = pack({
      pages: pack().pages.map((page) =>
        page.id === ITEM
          ? { ...page, properties: [prop.text("bad id!", "Label")] }
          : page,
      ),
      relations: [],
    });
    expect(() => packToSnapshot(badId, new Map(), ids())).toThrow(
      /rows the app would drop.*bad id!/,
    );
    const duplicate = pack({
      pages: pack().pages.map((page) =>
        page.id === ITEM
          ? {
              ...page,
              properties: [prop.text("x", "One"), prop.text("x", "Two")],
            }
          : page,
      ),
      relations: [],
    });
    expect(() => packToSnapshot(duplicate, new Map(), ids())).toThrow(
      /rows the app would drop.*x/,
    );
  });

  it("refuses a description over the database limit", () => {
    const template = pack({
      pages: pack().pages.map((page) =>
        page.id === ITEM ? { ...page, description: "x".repeat(501) } : page,
      ),
    });
    expect(() => packToSnapshot(template, new Map(), ids())).toThrow(
      /description of 501 characters/,
    );
  });

  it("still builds the current CESR Journey pack", () => {
    const built = [cesrJourney(), ...supportingTemplates()].map((template) =>
      packToSnapshot(template),
    );
    const journey = built[0];
    expect(journey.name).toBe("CESR Journey");
    expect(journey.snapshot.format).toBe(4);
    expect(journey.snapshot.pages).toHaveLength(119);
    expect(journey.snapshot.synced).toHaveLength(14);
    expect(journey.snapshot.relations).toEqual([]);
    for (const template of built) {
      expect(template.snapshot.notes).toEqual([]);
    }
  });
});
