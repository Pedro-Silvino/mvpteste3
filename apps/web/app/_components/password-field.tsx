"use client";

import { useState } from "react";

export const fieldClass =
  "mt-1 w-full rounded-lg border border-line px-3 py-2 text-ink focus:border-teal focus:outline-none";
export const buttonClass =
  "mt-6 w-full rounded-lg bg-teal px-4 py-3 font-semibold text-white hover:bg-n3 disabled:opacity-60";

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
          className={`${fieldClass} pr-20`}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="absolute inset-y-0 right-0 mt-1 px-3 text-sm text-teal hover:underline"
          aria-label={visible ? "Esconder senha" : "Mostrar senha"}
        >
          {visible ? "Esconder" : "Mostrar"}
        </button>
      </div>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}
