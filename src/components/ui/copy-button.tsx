"use client";

import * as React from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

/** Copies `value` to the clipboard; keeps its width when the label changes. */
export function CopyButton({
  value,
  label = "Copy link",
  ...props
}: Omit<React.ComponentProps<typeof Button>, "onClick" | "children"> & {
  value: string;
  label?: string;
}) {
  const [copied, setCopied] = React.useState(false);

  return (
    <Button
      type="button"
      variant="secondary"
      aria-live="polite"
      className="min-w-28"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          toast({
            variant: "destructive",
            title: "Couldn't copy",
            description: "Select the link and copy it yourself.",
          });
        }
      }}
      {...props}
    >
      {copied ? <Check aria-hidden /> : <Copy aria-hidden />}
      {copied ? "Copied" : label}
    </Button>
  );
}
