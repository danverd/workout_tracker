"use client";

import { LOAD_TYPE_OPTIONS } from "@/features/setup/load-types";
import type { LoadType } from "@/types/domain";

export function LoadTypePicker({
  value,
  onChange,
}: {
  value: LoadType;
  onChange: (value: LoadType) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Load type"
      className="flex flex-col gap-2"
    >
      {LOAD_TYPE_OPTIONS.map((option) => {
        const selected = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={`rounded-field flex min-h-16 flex-col items-start justify-center border px-4 py-2 text-left ${
              selected
                ? "border-plate-blue bg-plate-blue-wash border-2"
                : "border-hairline bg-paper"
            }`}
          >
            <span className="text-lead text-steel font-semibold">
              {option.title}
            </span>
            <span className="text-meta text-rubber">{option.example}</span>
          </button>
        );
      })}
    </div>
  );
}
