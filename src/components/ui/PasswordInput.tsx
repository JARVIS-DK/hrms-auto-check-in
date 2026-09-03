"use client";

import { useState } from "react";

import { EyeIcon, EyeOffIcon } from "@/components/ui/icons";

interface PasswordInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  minLength?: number;
  /** Forwarded to the real input so a <label htmlFor> actually resolves. */
  id?: string;
  /** Lets password managers tell a new password from a login one. */
  autoComplete?: string;
}

export default function PasswordInput({
  value,
  onChange,
  placeholder,
  required,
  minLength,
  id,
  autoComplete,
}: PasswordInputProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="relative">
      <input
        id={id}
        type={visible ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full px-3.5 py-2.5 pr-10 border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary transition-colors"
        placeholder={placeholder}
        required={required}
        minLength={minLength}
        autoComplete={autoComplete}
      />
      <button
        type="button"
        onClick={() => setVisible(!visible)}
        aria-label={visible ? "Hide password" : "Show password"}
        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted hover:text-foreground transition-colors"
      >
        {visible ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
      </button>
    </div>
  );
}
