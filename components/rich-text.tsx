import { Fragment } from "react";

import { cn } from "@/lib/utils";

/**
 * Tiny markdown subset for campaign briefs.
 * Renders **bold** and preserves line breaks.
 * If we ever need more (lists, links, code), swap for react-markdown.
 */

function renderInline(line: string): React.ReactNode[] {
  // Split on **...**, keeping the matched chunks
  const parts = line.split(/(\*\*[^*\n]+\*\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**") && p.length > 4) {
      return (
        <strong key={i} className="font-bold">
          {p.slice(2, -2)}
        </strong>
      );
    }
    return <Fragment key={i}>{p}</Fragment>;
  });
}

export function RichText({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  const lines = children.split("\n");
  return (
    <div className={cn("whitespace-pre-wrap font-body", className)}>
      {lines.map((line, i) => (
        <Fragment key={i}>
          {renderInline(line)}
          {i < lines.length - 1 ? "\n" : null}
        </Fragment>
      ))}
    </div>
  );
}
