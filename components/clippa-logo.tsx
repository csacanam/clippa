import Image from "next/image";

import { cn } from "@/lib/utils";

export function ClippaLogo({ className }: { className?: string }) {
  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      <Image
        src="/clippa-logo.png"
        alt="Clippa"
        width={32}
        height={32}
        priority
        className="size-8"
      />
      <span className="font-display text-lg font-bold tracking-tight text-ink">
        clippa
      </span>
    </div>
  );
}
