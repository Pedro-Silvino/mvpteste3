"use client";

import { useState } from "react";

// Shared look for the auth forms (same classes as the rest of the portal, see globals.css).
export const fieldClass = "field";
export const buttonClass = "btn-primary mt-6 w-full text-base";

type Props = {
  id: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "current-password" | "new-password";
  label?: string;
  hint?: string;
};

export function PasswordField({ id, value, onChange, autoComplete, label = "Senha", hint }: Props) {
  const [visible, setVisible] = useState(false);
  const hintId = hint ? `${id}-hint` : undefined;
  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium text-n1">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          required
          value={value}
          onChange={(e) => onChange(e.target.value)}
          aria-describedby={hintId}
          className={`${fieldClass} pr-20`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute inset-y-0 right-0 mt-1 px-3 text-sm font-semibold text-teal-strong hover:underline"
          aria-label={visible ? "Esconder senha" : "Mostrar senha"}
        >
          {visible ? "Esconder" : "Mostrar"}
        </button>
      </div>
      {hint && (
        <p id={hintId} className="mt-1 text-xs text-muted">
          {hint}
        </p>
      )}
    </div>
  );
}
