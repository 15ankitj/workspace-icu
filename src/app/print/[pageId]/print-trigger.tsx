"use client";

import { useEffect } from "react";

/** Opens the print dialog once the page (and its images) has loaded. */
export function PrintTrigger() {
  useEffect(() => {
    const timer = setTimeout(() => window.print(), 400);
    return () => clearTimeout(timer);
  }, []);
  return null;
}
