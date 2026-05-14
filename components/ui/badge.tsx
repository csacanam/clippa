import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  [
    "inline-flex items-center justify-center gap-1 whitespace-nowrap",
    "rounded-full border-2 border-ink px-2.5 py-0.5",
    "font-display text-xs font-bold uppercase tracking-wider",
    "transition-colors",
    "[&>svg]:pointer-events-none [&>svg]:size-3",
  ].join(" "),
  {
    variants: {
      variant: {
        default: "bg-cream text-ink",
        lime: "bg-lime text-ink",
        magenta: "bg-magenta text-cream",
        indigo: "bg-indigo text-cream",
        peach: "bg-peach text-ink",
        muted: "bg-muted text-ink-soft border-ink-soft",
        destructive: "bg-error text-cream",
        // status helpers
        live: "bg-lime text-ink",
        review: "bg-magenta text-cream",
        rejected: "bg-muted text-ink-soft border-ink-soft",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      { className: cn(badgeVariants({ variant }), className) },
      props
    ),
    render,
    state: { slot: "badge", variant },
  });
}

export { Badge, badgeVariants };
