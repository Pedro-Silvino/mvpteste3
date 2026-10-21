"use client";

import type { ReactNode } from "react";

// Submit button that asks first. For actions that are hard to undo (revoking a token, approving a document).
export function ConfirmButton({ message, className, children }: { message: string; className?: string; children: ReactNode }) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
