"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/**
 * A destructive button that always asks first. Inside a `<form action>` it
 * submits the form once confirmed (running the form's own validation);
 * otherwise it calls `onConfirm`. The rule is simple: if it cannot be
 * undone, it goes through here.
 */
export function ConfirmButton({
  title,
  description,
  confirmLabel,
  onConfirm,
  variant = "destructive",
  children,
  ...props
}: Omit<React.ComponentProps<typeof Button>, "onClick" | "type"> & {
  title: React.ReactNode;
  description?: React.ReactNode;
  confirmLabel?: React.ReactNode;
  onConfirm?: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  const triggerRef = React.useRef<HTMLButtonElement>(null);

  return (
    <>
      <Button
        ref={triggerRef}
        type="button"
        variant={variant}
        onClick={() => {
          const form = triggerRef.current?.form;
          // Let the form's own validation (required, pattern) speak first.
          if (form && !form.reportValidity()) return;
          setOpen(true);
        }}
        {...props}
      >
        {children}
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && (
            <AlertDialogDescription>{description}</AlertDialogDescription>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (onConfirm) onConfirm();
                else triggerRef.current?.form?.requestSubmit();
              }}
            >
              {confirmLabel ?? children}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
