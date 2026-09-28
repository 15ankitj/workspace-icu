/**
 * Build the CESR Journey content pack into template snapshots.
 *
 * Usage: npx tsx scripts/build-cesr-pack.ts > /tmp/pack.json \
 *        && mv /tmp/pack.json content/cesr-journey.snapshots.json \
 *        && npx prettier --write content/cesr-journey.snapshots.json
 *
 * Write to a temporary file first: a shell redirect straight onto the
 * snapshots file truncates it before this script reads the previous
 * keys, and every page would get a fresh key.
 *
 * The conversion itself is `packToSnapshot` in pack-snapshot.ts (see
 * there for keys, synced blocks, properties and relations); this file
 * only reads the previous keys and prints the JSON that
 * src/app/actions/packs.ts installs (see content/README.md).
 */
import { readFileSync } from "node:fs";
import { cesrJourney, supportingTemplates } from "../content/cesr-journey";
import {
  packToSnapshot,
  previousKeysOf,
  type BuiltTemplate,
} from "./pack-snapshot";

/** Page keys of the committed build, or none when the file is unreadable. */
function previousKeys(): Map<string, string> {
  try {
    const previous = JSON.parse(
      readFileSync(
        new URL("../content/cesr-journey.snapshots.json", import.meta.url),
        "utf8",
      ),
    ) as BuiltTemplate[];
    return previousKeysOf(previous);
  } catch {
    return new Map();
  }
}

const keys = previousKeys();
const output = [cesrJourney(), ...supportingTemplates()].map((template) =>
  packToSnapshot(template, keys),
);
process.stdout.write(JSON.stringify(output));
