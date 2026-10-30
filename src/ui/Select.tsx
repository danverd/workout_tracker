import { useId, type SelectHTMLAttributes } from "react";

import { ChevronDownIcon } from "@/ui/icons";

export type SelectOption = { value: string; label: string };

export type SelectProps = Omit<
  SelectHTMLAttributes<HTMLSelectElement>,
  "className" | "id" | "children"
> & {
  label: string;
  options: readonly SelectOption[];
};

export function Select({ label, options, ...rest }: SelectProps) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-body text-steel font-medium">
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          className="rounded-field border-rubber bg-paper text-lead text-steel min-h-12 w-full appearance-none border pr-10 pl-3"
          {...rest}
        >
          {options.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        <ChevronDownIcon
          size={20}
          className="text-rubber pointer-events-none absolute top-1/2 right-3 -translate-y-1/2"
        />
      </div>
    </div>
  );
}
