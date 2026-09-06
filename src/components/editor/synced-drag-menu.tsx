"use client";

import { useState } from "react";
import { SideMenuExtension } from "@blocknote/core/extensions";
import {
  BlockColorsItem,
  DragHandleMenu,
  RemoveBlockItem,
  useBlockNoteEditor,
  useComponentsContext,
  useExtensionState,
} from "@blocknote/react";
import { createSyncedBlock } from "@/app/actions/synced";
import { useSyncedHost } from "@/components/editor/synced-host-context";
import { toast } from "@/components/ui/toast";
import type { EditorBlock } from "@/lib/blocks";
import { containsSyncedBlock, syncedClipboardText } from "@/lib/synced";

/**
 * "Turn into synced block" on a block's ⋮⋮ menu (Appendix A §1.3 rule 1):
 * lifts the block and its children into a synced block whose source is
 * this page, replaces them here with a placement, and puts the paste
 * token on the clipboard so the next page gets an embed with one paste.
 */
function TurnIntoSyncedItem() {
  const Components = useComponentsContext()!;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const editor = useBlockNoteEditor<any, any, any>();
  const host = useSyncedHost();
  const [busy, setBusy] = useState(false);
  const block = useExtensionState(SideMenuExtension, {
    editor,
    selector: (state) => state?.block,
  });

  if (block === undefined || !host.editable) return null;

  const run = async () => {
    if (busy) return;
    const target = block as unknown as EditorBlock;
    if (target.type === "syncedBlock") {
      toast({
        title: "Already a synced block",
        description: "Use Copy on its header to place it elsewhere.",
      });
      return;
    }
    if (containsSyncedBlock(target)) {
      toast({
        title: "Can't nest synced blocks",
        description:
          "Move the synced block out of this one first, then try again.",
        variant: "destructive",
      });
      return;
    }
    setBusy(true);
    try {
      const { id, title } = await createSyncedBlock(host.hostPageId, [target]);
      editor.replaceBlocks(
        [block],
        [
          {
            type: "syncedBlock",
            props: { syncedBlockId: id, readOnly: false },
          },
        ],
      );
      let copied = false;
      try {
        await navigator.clipboard.writeText(syncedClipboardText(id));
        copied = true;
      } catch {
        copied = false;
      }
      toast({
        title: `Synced block created: ${title}`,
        description: host.hostIsPrivate
          ? "This page is private, so on other pages only you will see the content. Make the page shared before embedding it for colleagues."
          : copied
            ? "Paste in any page to place it there, or use /synced."
            : "Use /synced on any page to place it there.",
      });
    } catch (error) {
      toast({
        title: "Could not create synced block",
        description: error instanceof Error ? error.message : "Try again.",
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  };

  return (
    <Components.Generic.Menu.Item className="bn-menu-item" onClick={run}>
      {busy ? "Creating synced block…" : "Turn into synced block"}
    </Components.Generic.Menu.Item>
  );
}

export function SyncedDragHandleMenu() {
  return (
    <DragHandleMenu>
      <RemoveBlockItem>Delete</RemoveBlockItem>
      <BlockColorsItem>Colours</BlockColorsItem>
      <TurnIntoSyncedItem />
    </DragHandleMenu>
  );
}
