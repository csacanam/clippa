"use client";

import { ChevronDown, X } from "lucide-react";
import { useState } from "react";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { COUNTRIES, findCountry, type Country } from "@/lib/countries";
import { cn } from "@/lib/utils";

type Props = {
  value: string; // ISO code, e.g. "CO"
  onChange: (code: string) => void;
  placeholder?: string;
};

export function CountryCombobox({
  value,
  onChange,
  placeholder = "Search your country...",
}: Props) {
  const [open, setOpen] = useState(false);
  const selected: Country | undefined = value ? findCountry(value) : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        className={cn(
          "flex h-12 w-full items-center justify-between gap-2",
          "rounded-md border-2 border-ink bg-cream px-4 py-2",
          "text-left font-body text-base outline-none",
          "transition-colors",
          "data-[popup-open]:border-indigo data-[popup-open]:ring-4 data-[popup-open]:ring-indigo/20",
          "hover:bg-cream/80",
          "cursor-pointer"
        )}
      >
        {selected ? (
          <span className="flex items-center gap-2 truncate">
            <span className="text-xl leading-none">{selected.flag}</span>
            <span className="font-medium">{selected.name}</span>
          </span>
        ) : (
          <span className="text-ink-soft/60">{placeholder}</span>
        )}

        <div className="flex items-center gap-1">
          {selected && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onChange("");
              }}
              className="rounded-full p-1 hover:bg-peach/60"
              aria-label="Clear selection"
            >
              <X className="size-4" />
            </button>
          )}
          <ChevronDown
            className={cn(
              "size-5 shrink-0 text-ink-soft transition-transform",
              open && "rotate-180"
            )}
          />
        </div>
      </PopoverTrigger>

      <PopoverContent
        align="start"
        sideOffset={6}
        className={cn(
          "w-[var(--anchor-width)] !rounded-2xl !border-2 !border-ink !bg-cream !p-0",
          "!shadow-sticker !ring-0"
        )}
      >
        <Command
          className="!bg-cream !rounded-2xl"
          // shadcn cmdk filter — searches name + code
          filter={(value, search) => {
            // value is "CO Colombia" (we set it like that on the item)
            if (value.toLowerCase().includes(search.toLowerCase())) return 1;
            return 0;
          }}
        >
          <CommandInput placeholder={placeholder} className="font-body" />
          <CommandList className="max-h-72">
            <CommandEmpty>No country found.</CommandEmpty>

            <CommandGroup>
              {COUNTRIES.map((c) => (
                <CommandItem
                  key={c.code}
                  value={`${c.code} ${c.name}`}
                  data-checked={value === c.code ? true : undefined}
                  onSelect={() => {
                    onChange(c.code);
                    setOpen(false);
                  }}
                  className="rounded-lg data-selected:bg-peach data-selected:text-ink"
                >
                  <span className="text-lg leading-none">{c.flag}</span>
                  <span>{c.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
