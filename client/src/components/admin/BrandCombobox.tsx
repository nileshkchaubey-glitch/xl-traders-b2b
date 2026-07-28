import { useState } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Check, ChevronsUpDown, CircleOff } from "lucide-react";
import { Brand } from "@/lib/supabase";
import { cn } from "@/lib/utils";

interface BrandComboboxProps {
  // Full ADMIN brand list (active + inactive). Only active brands are offered
  // as options, but a product already pointing at an inactive brand (e.g.
  // Paras) must still resolve to its name — otherwise the field would look
  // empty while holding a value.
  brands: Brand[];
  // Selected brand id; "" = no brand (products.brand_id NULL).
  value: string;
  onChange: (brandId: string) => void;
  placeholder?: string;
  className?: string;
  // Same contract as CategoryCombobox: surfaces with a defined Tab-through
  // order (the Workbench) opt out of open-on-focus.
  openOnFocus?: boolean;
}

/**
 * Searchable brand picker (Popover + cmdk Command), cloned from
 * CategoryCombobox so the two pickers behave identically. Adds an explicit
 * "No brand" entry — brand_id is nullable and clearing must be reachable.
 */
export default function BrandCombobox({
  brands,
  value,
  onChange,
  placeholder = "No brand",
  className,
  openOnFocus = true,
}: BrandComboboxProps) {
  const [open, setOpen] = useState(false);
  const selected = brands.find(b => b.id === value);
  const options = brands.filter(b => b.is_active);

  const selectedLabel = selected
    ? selected.is_active
      ? selected.name
      : `${selected.name} (inactive)`
    : null;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          onFocus={openOnFocus ? () => setOpen(true) : undefined}
          className={cn(
            "flex h-9 w-full items-center justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-sm",
            "focus:outline-none focus:ring-1 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
            !selectedLabel && "text-muted-foreground",
            className
          )}
        >
          <span className="truncate">{selectedLabel ?? placeholder}</span>
          <ChevronsUpDown className="ml-1 h-4 w-4 shrink-0 opacity-50" />
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-[260px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Type to search…" className="h-9" />
          <CommandList>
            <CommandEmpty>No brand found</CommandEmpty>
            <CommandGroup>
              <CommandItem
                value="No brand"
                onSelect={() => {
                  onChange("");
                  setOpen(false);
                }}
              >
                <Check
                  className={cn(
                    "mr-2 h-4 w-4",
                    value === "" ? "opacity-100" : "opacity-0"
                  )}
                />
                <CircleOff className="mr-1.5 h-3.5 w-3.5 text-muted-foreground" />
                <span className="text-muted-foreground">No brand</span>
              </CommandItem>
              {options.map(brand => (
                <CommandItem
                  key={brand.id}
                  value={brand.name}
                  onSelect={() => {
                    onChange(brand.id);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      value === brand.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  <span className="truncate">{brand.name}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
