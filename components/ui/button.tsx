import { Button as ButtonPrimitive } from "@base-ui/react/button";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  [
    "group/button relative inline-flex shrink-0 items-center justify-center gap-2",
    "rounded-button border-2 border-ink",
    "font-display font-bold uppercase tracking-wide",
    "transition-[transform,box-shadow] duration-100 ease-out",
    "outline-none select-none whitespace-nowrap",
    "focus-visible:ring-4 focus-visible:ring-ring/40",
    "disabled:pointer-events-none disabled:opacity-50",
    "[&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
    // sticker press
    "shadow-sticker hover:-translate-y-[2px] hover:shadow-sticker-lg",
    "active:translate-x-[2px] active:translate-y-[2px] active:shadow-sticker-sm",
  ].join(" "),
  {
    variants: {
      variant: {
        // lime — primary CTA
        default: "bg-lime text-ink",
        // magenta — submit / playful confirm
        magenta: "bg-magenta text-cream",
        // indigo — links / info actions
        indigo: "bg-indigo text-cream",
        // peach — soft / secondary
        peach: "bg-peach text-ink",
        // outline — no fill
        outline: "bg-cream text-ink hover:bg-peach",
        // ghost — no border, no shadow
        ghost:
          "border-transparent shadow-none hover:bg-peach/60 hover:shadow-none active:shadow-none active:translate-x-0 active:translate-y-0",
        // destructive
        destructive: "bg-error text-cream",
        // link
        link: "border-transparent shadow-none text-indigo underline-offset-4 hover:underline hover:shadow-none active:shadow-none active:translate-x-0 active:translate-y-0",
      },
      size: {
        sm: "h-9 px-3 text-xs",
        default: "h-11 px-5 text-sm",
        lg: "h-14 px-7 text-base",
        xl: "h-16 px-9 text-lg",
        icon: "size-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
);

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  );
}

export { Button, buttonVariants };
