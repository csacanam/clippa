"use client";

import { Eye, Pencil } from "lucide-react";
import { useState } from "react";

import { RichText } from "@/components/rich-text";
import { cn } from "@/lib/utils";

/**
 * Lightweight markdown editor: a textarea with an Edit / Preview toggle.
 * Uses the in-house RichText renderer (supports **bold** + line breaks),
 * which is the same renderer used to display campaign briefs to creators
 * — so what the brand sees in preview is exactly what creators will see.
 */
export function MarkdownField({
  value,
  onChange,
  placeholder,
  rows = 8,
  maxLength,
  id,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  rows?: number;
  maxLength?: number;
  id?: string;
}) {
  const [mode, setMode] = useState<"edit" | "preview">("edit");

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <div className="inline-flex overflow-hidden rounded-md border-2 border-ink">
          <button
            type="button"
            onClick={() => setMode("edit")}
            aria-pressed={mode === "edit"}
            className={cn(
              "inline-flex items-center gap-1.5 px-3 py-1 font-display text-[0.7rem] font-bold uppercase tracking-wider transition-colors",
              mode === "edit" ? "bg-ink text-cream" : "bg-cream text-ink hover:bg-peach/60"
            )}
          >
            <Pencil className="size-3" />
            Edit
          </button>
          <button
            type="button"
            onClick={() => setMode("preview")}
            aria-pressed={mode === "preview"}
            className={cn(
              "inline-flex items-center gap-1.5 border-l-2 border-ink px-3 py-1 font-display text-[0.7rem] font-bold uppercase tracking-wider transition-colors",
              mode === "preview" ? "bg-ink text-cream" : "bg-cream text-ink hover:bg-peach/60"
            )}
          >
            <Eye className="size-3" />
            Preview
          </button>
        </div>
        <p className="font-body text-[0.65rem] text-ink-soft">
          <span className="font-mono font-bold">**bold**</span> · line breaks preserved
          {maxLength ? ` · ${value.length}/${maxLength}` : ""}
        </p>
      </div>

      {mode === "edit" ? (
        <textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          maxLength={maxLength}
          className="w-full resize-y rounded-md border-2 border-ink bg-cream px-3 py-2 font-mono text-sm leading-relaxed text-ink shadow-sticker outline-none focus:ring-4 focus:ring-ring/40"
        />
      ) : (
        <div className="min-h-[8rem] rounded-md border-2 border-ink bg-cream px-3 py-2 text-sm leading-relaxed text-ink shadow-sticker">
          {value.trim() ? (
            <RichText>{value}</RichText>
          ) : (
            <p className="font-body text-sm italic text-ink-soft">
              Nothing to preview yet.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
