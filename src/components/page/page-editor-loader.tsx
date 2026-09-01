"use client";

import dynamic from "next/dynamic";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * BlockNote touches browser APIs at import time, so the editor is loaded
 * client-side only.
 */
export const PageEditorLoader = dynamic(
  () => import("@/components/page/page-editor").then((m) => m.PageEditor),
  {
    ssr: false,
    loading: () => (
      <div className="space-y-3 py-4">
        <Skeleton className="h-5 w-3/4" />
        <Skeleton className="h-5 w-1/2" />
        <Skeleton className="h-5 w-2/3" />
      </div>
    ),
  },
);
