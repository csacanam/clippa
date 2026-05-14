import { cn } from "@/lib/utils";

export function ClippaLogo({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border-2 border-ink bg-lime px-3 py-1 shadow-sticker-sm",
        className
      )}
    >
      <span className="font-display text-lg font-bold tracking-tight">
        clippa
      </span>
    </div>
  );
}
