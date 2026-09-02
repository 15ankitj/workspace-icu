import { describe, expect, it } from "vitest";
import { cursorColourFor, pageIdFromRoomId, roomIdForPage } from "@/lib/collab";

const id = "6f1c2e4a-0b3d-4c5e-8f7a-9b8c7d6e5f4a";

describe("room ids", () => {
  it("round-trips a page id", () => {
    expect(pageIdFromRoomId(roomIdForPage(id))).toBe(id);
  });

  it("rejects rooms that are not page rooms or carry a bad id", () => {
    expect(pageIdFromRoomId("workspace:" + id)).toBeNull();
    expect(pageIdFromRoomId("page:not-a-uuid")).toBeNull();
    expect(pageIdFromRoomId("page:" + id + "/../x")).toBeNull();
    expect(pageIdFromRoomId("")).toBeNull();
  });

  it("normalises case", () => {
    expect(pageIdFromRoomId("page:" + id.toUpperCase())).toBe(id);
  });
});

describe("cursorColourFor", () => {
  it("is stable and always a hex colour", () => {
    expect(cursorColourFor(id)).toBe(cursorColourFor(id));
    expect(cursorColourFor(id)).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("spreads users across colours", () => {
    const colours = new Set(
      ["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"].map(cursorColourFor),
    );
    expect(colours.size).toBeGreaterThan(2);
  });
});

describe("base64 helpers", () => {
  it("round-trips binary including values above 0x7f and large inputs", async () => {
    const { base64ToBytes, bytesToBase64 } = await import("@/lib/collab");
    const bytes = new Uint8Array(100_000);
    for (let i = 0; i < bytes.length; i++) bytes[i] = (i * 7919) % 256;
    expect(base64ToBytes(bytesToBase64(bytes))).toEqual(bytes);
    expect(bytesToBase64(new Uint8Array())).toBe("");
  });
});
