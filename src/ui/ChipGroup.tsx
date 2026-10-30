"use client";

import { Chip } from "@/ui/Chip";

export type ChipOption = { value: string; label?: string };

export type ChipGroupProps = {
  /** Accessible name for the group, e.g. "Available dumbbells". */
  label: string;
  options: readonly ChipOption[];
  /** Selected option values. Single-select groups hold zero or one. */
  value: readonly string[];
  onChange: (value: string[]) => void;
  /** Allow several chips at once. Default is single-select. */
  multiple?: boolean;
  /** Single-select only: tapping the selected chip clears it. */
  allowClear?: boolean;
};

export function ChipGroup({
  label,
  options,
  value,
  onChange,
  multiple = false,
  allowClear = false,
}: ChipGroupProps) {
  function toggle(optionValue: string) {
    const isSelected = value.includes(optionValue);
    if (multiple) {
      onChange(
        isSelected
          ? value.filter((v) => v !== optionValue)
          : [...value, optionValue],
      );
      return;
    }
    if (isSelected) {
      if (allowClear) onChange([]);
      return;
    }
    onChange([optionValue]);
  }

  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((option) => (
        <Chip
          key={option.value}
          selected={value.includes(option.value)}
          onClick={() => toggle(option.value)}
        >
          {option.label ?? option.value}
        </Chip>
      ))}
    </div>
  );
}
