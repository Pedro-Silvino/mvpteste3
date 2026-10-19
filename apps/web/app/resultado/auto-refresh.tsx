"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

// While the worker is building the report, re-read the page every few seconds.
export function AutoRefresh({ everyMs = 3000 }: { everyMs?: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), everyMs);
    return () => clearInterval(t);
  }, [router, everyMs]);
  return null;
}
