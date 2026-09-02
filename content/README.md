# Content packs

Templates are content, not code (brief principle 3). This directory holds
the _initial_ authoring of platform packs so they can be reviewed in a PR
and reproduced; once seeded into the gallery, all further authoring
happens in the app:

1. Start from the template in a workspace.
2. Edit the pages.
3. Gallery → template → **Republish from source page** (adds a version
   with a changelog; existing copies are never changed).

## CESR Journey (brief §11)

`cesr-journey.ts` defines the workspace template and its supporting page
templates using the small DSL in `blocks.ts`. Curriculum-specific wording
(HiLLO descriptors, Key Capabilities) is deliberately left as
«placeholders» for the platform owner to paste from the FICM source —
nothing clinical is paraphrased here, and no patient details appear
anywhere.

### Building and installing

```
npx tsx scripts/build-cesr-pack.ts > content/cesr-journey.snapshots.json
```

The snapshots file is committed and bundled with the app. The platform
owner installs a pack from the gallery ("Platform packs" section, owner
only): that creates the `templates` row (`owner_scope = 'platform'`,
published), version 1 with the snapshot, and the gallery entry, under
the owner's own RLS — no service role, no SQL. Installing is idempotent
by name; to ship a revised pack, edit it in the app and republish, or
rebuild the snapshot and install under a new name.
