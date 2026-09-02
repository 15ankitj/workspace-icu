"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { AlertTriangle } from "lucide-react";
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
  DialogTitle,
} from "@/components/ui/dialog";

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
  const [flagged, setFlagged] = useState<FlaggedUpload | null>(null);
  const [reminder, setReminder] = useState(false);
  const [flaggedResolved, setFlaggedResolved] = useState<string | null>(null);
  const countRef = useRef(initialUploadCount);

  const uploadTo = useCallback(async (targetPageId: string, file: File) => {
    const rejection = isAllowedUpload(file.type, file.size);
    if (rejection) throw new Error(rejection);

    if (countRef.current < CHECKBOX_CONFIRMATION_UPLOADS) {
      await new Promise<void>((resolve, reject) =>
        setGate({ resolve, reject }),
      );
    } else {
      setReminder(true);
      setTimeout(() => setReminder(false), 6000);
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

  const dialogs = (
    <>
      <Dialog
        open={gate !== null}
        onOpenChange={(open) => {
          if (!open && gate) {
            gate.reject(new Error("Upload cancelled"));
            setGate(null);
          }
        }}
      >
        <DialogContent>
          <DialogTitle>Before you upload</DialogTitle>
          <DialogDescription>{AUP_STATEMENT}</DialogDescription>
          <p className="text-sm text-muted-foreground">
            Not sure how?{" "}
            <Link
              href="/guidance/anonymisation"
              target="_blank"
              className="underline"
            >
              Read the anonymisation guidance
            </Link>
            .
          </p>
          <label className="flex items-start gap-2 text-sm">
            <input type="checkbox" className="mt-1" required id="aup-confirm" />
            <span>
              I confirm this file contains no patient-identifiable information.
            </span>
          </label>
          <div className="flex justify-end gap-2">
            <Button
              variant="ghost"
              onClick={() => {
                gate?.reject(new Error("Upload cancelled"));
                setGate(null);
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={() => {
                const checkbox = document.getElementById(
                  "aup-confirm",
                ) as HTMLInputElement | null;
                if (!checkbox?.checked) return;
                gate?.resolve();
                setGate(null);
              }}
            >
              Upload
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={flagged !== null}
        onOpenChange={(open) => {
          if (!open) setFlagged(null);
        }}
      >
        <DialogContent>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-destructive" />
            Possible patient information
          </DialogTitle>
          <DialogDescription>
            The advisory scan found patterns in “{flagged?.filename}” that can
            identify a patient. Nothing is blocked — but please check.
          </DialogDescription>
          <ul className="max-h-40 space-y-1 overflow-y-auto text-sm">
            {flagged?.findings.map((finding, i) => (
              <li key={i} className="flex justify-between gap-2">
                <span>{FINDING_LABELS[finding.type]}</span>
                <span className="font-mono text-muted-foreground">
                  {finding.masked}
                </span>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap justify-end gap-2">
            <Button
              variant="destructive"
              onClick={async () => {
                if (!flagged) return;
                await deleteFile(flagged.fileId).catch(() => {});
                setFlaggedResolved(
                  "File removed. Delete its block from the page, anonymise the document and upload it again.",
                );
                setFlagged(null);
              }}
            >
              Remove file
            </Button>
            <Button
              variant="secondary"
              onClick={async () => {
                if (!flagged) return;
                await overridePhiFindings(flagged.fileId).catch(() => {});
                setFlagged(null);
              }}
            >
              I confirm this is anonymised
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {reminder && (
        <p className="fixed bottom-4 right-4 z-50 max-w-xs rounded-md border bg-background p-3 text-xs shadow-md">
          Reminder: no patient-identifiable information.{" "}
          <Link
            href="/guidance/anonymisation"
            target="_blank"
            className="underline"
          >
            Anonymisation guidance
          </Link>
        </p>
      )}
      {flaggedResolved && (
        <p className="fixed bottom-4 right-4 z-50 max-w-xs rounded-md border bg-background p-3 text-xs shadow-md">
          {flaggedResolved}{" "}
          <button
            type="button"
            className="underline"
            onClick={() => setFlaggedResolved(null)}
          >
            Dismiss
          </button>
        </p>
      )}
    </>
  );

  return { uploadFile, uploadTo, dialogs };
}
