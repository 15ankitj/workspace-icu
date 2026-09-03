"use client";

import { useCallback, useId, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import {
  deleteFile,
  finalizeUpload,
  overridePhiFindings,
  registerUpload,
} from "@/app/actions/files";
import { CHECKBOX_CONFIRMATION_UPLOADS, isAllowedUpload } from "@/lib/files";
import { AUP_STATEMENT } from "@/lib/aup";
import type { PhiFinding, PhiFindingType } from "@/lib/phi";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Notice } from "@/components/ui/notice";
import { toast } from "@/components/ui/toast";

const FINDING_LABELS: Record<PhiFindingType, string> = {
  nhs_number: "Possible NHS number",
  date_of_birth: "Possible date of birth",
  hospital_number: "Possible hospital number",
  name_near_clinical_term: "Name near a clinical term",
};

interface GateRequest {
  resolve: () => void;
  reject: (reason: Error) => void;
}

interface FlaggedUpload {
  fileId: string;
  filename: string;
  findings: PhiFinding[];
}

function GuidanceLink() {
  return (
    <Link
      href="/guidance/anonymisation"
      target="_blank"
      className="underline underline-offset-4"
    >
      anonymisation guidance
    </Link>
  );
}

/**
 * Upload pipeline with the layered IG nudges (brief §9): checkbox
 * confirmation for a user's first five uploads then an inline reminder,
 * direct-to-storage upload, and the advisory PHI scan dialog afterwards.
 */
export function useFileUpload({
  pageId,
  initialUploadCount,
}: {
  pageId: string;
  initialUploadCount: number;
}) {
  const [gate, setGate] = useState<GateRequest | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [flagged, setFlagged] = useState<FlaggedUpload | null>(null);
  const [resolving, setResolving] = useState<"remove" | "keep" | null>(null);
  const countRef = useRef(initialUploadCount);
  const checkboxId = useId();

  const uploadTo = useCallback(async (targetPageId: string, file: File) => {
    const rejection = isAllowedUpload(file.type, file.size);
    if (rejection) throw new Error(rejection);

    if (countRef.current < CHECKBOX_CONFIRMATION_UPLOADS) {
      setConfirmed(false);
      await new Promise<void>((resolve, reject) =>
        setGate({ resolve, reject }),
      );
    } else {
      toast({
        title: "Reminder: no patient-identifiable information",
        description: (
          <>
            Check the file before it goes in. See the <GuidanceLink />.
          </>
        ),
      });
    }

    const { fileId, storagePath } = await registerUpload(targetPageId, {
      filename: file.name,
      mime: file.type,
      sizeBytes: file.size,
    });

    const supabase = createClient();
    const { error } = await supabase.storage
      .from("files")
      .upload(storagePath, file, { contentType: file.type });
    if (error) {
      await deleteFile(fileId).catch(() => {});
      throw new Error(`Upload failed: ${error.message}`);
    }

    countRef.current += 1;
    const result = await finalizeUpload(fileId);
    if (result.status === "flagged") {
      setFlagged({ fileId, filename: file.name, findings: result.findings });
    }
    return `/api/files/${fileId}`;
  }, []);

  // BlockNote calls uploadFile(file, blockId); the page is fixed per editor.
  const uploadFile = useCallback(
    (file: File) => uploadTo(pageId, file),
    [uploadTo, pageId],
  );

  function cancelGate() {
    gate?.reject(new Error("Upload cancelled"));
    setGate(null);
  }

  async function resolveFlagged(mode: "remove" | "keep") {
    if (!flagged) return;
    setResolving(mode);
    try {
      if (mode === "remove") {
        await deleteFile(flagged.fileId);
        toast({
          title: "File removed",
          description:
            "Delete its block from the page, anonymise the document and upload it again.",
          duration: 10000,
        });
      } else {
        await overridePhiFindings(flagged.fileId);
        toast({
          title: "Kept as anonymised",
          description: `Your confirmation for “${flagged.filename}” has been recorded.`,
        });
      }
      setFlagged(null);
    } catch (error) {
      toast({
        variant: "destructive",
        title:
          mode === "remove"
            ? "Couldn't remove the file"
            : "Couldn't record your confirmation",
        description:
          error instanceof Error ? error.message : "Please try again.",
      });
    } finally {
      setResolving(null);
    }
  }

  const dialogs = (
    <>
      <Dialog
        open={gate !== null}
        onOpenChange={(open) => {
          if (!open && gate) cancelGate();
        }}
      >
        <DialogContent>
          <DialogTitle>Before you upload</DialogTitle>
          <DialogDescription>
            This applies to every file, image or document you add.
          </DialogDescription>
          <Notice variant="warning" title="Acceptable use">
            <p>{AUP_STATEMENT}</p>
            <p>
              Not sure how? Read the <GuidanceLink />.
            </p>
          </Notice>
          <label
            htmlFor={checkboxId}
            className="flex items-start gap-2 text-sm"
          >
            <input
              id={checkboxId}
              type="checkbox"
              className="mt-0.5 size-4 accent-primary"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            <span>
              I confirm this file contains no patient-identifiable information.
            </span>
          </label>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={cancelGate}>
              Cancel
            </Button>
            <Button
              type="button"
              disabled={!confirmed}
              onClick={() => {
                gate?.resolve();
                setGate(null);
              }}
            >
              Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={flagged !== null}
        onOpenChange={(open) => {
          if (!open && !resolving) setFlagged(null);
        }}
      >
        <DialogContent>
          <DialogTitle>Possible patient information</DialogTitle>
          <DialogDescription>
            The advisory scan found patterns in “{flagged?.filename}” that can
            identify a patient. Nothing is blocked — but please check.
          </DialogDescription>
          <Notice variant="destructive" title="What the scan found">
            <ul className="max-h-40 space-y-1 overflow-y-auto">
              {flagged?.findings.map((finding, i) => (
                <li key={i} className="flex justify-between gap-2">
                  <span>{FINDING_LABELS[finding.type]}</span>
                  <span className="font-mono text-xs text-muted-foreground">
                    {finding.masked}
                  </span>
                </li>
              ))}
            </ul>
          </Notice>
          <p className="text-sm text-muted-foreground">
            The safe choice is to remove the file, anonymise it (see the{" "}
            <GuidanceLink />) and upload it again. Only keep it if you are sure
            these are false positives; your confirmation is recorded.
          </p>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={resolving !== null}
              onClick={() => resolveFlagged("keep")}
            >
              {resolving === "keep"
                ? "Recording…"
                : "Keep it — I confirm it is anonymised"}
            </Button>
            <Button
              type="button"
              disabled={resolving !== null}
              onClick={() => resolveFlagged("remove")}
            >
              {resolving === "remove" ? "Removing…" : "Remove file"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );

  return { uploadFile, uploadTo, dialogs };
}
