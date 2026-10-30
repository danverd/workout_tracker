"use client";

import { BottomSheet } from "@/ui/BottomSheet";
import { ChipGroup } from "@/ui/ChipGroup";
import type { Catalog } from "./catalog";

export function LocationSheet({
  open,
  catalog,
  locationId,
  onPick,
  onClose,
}: {
  open: boolean;
  catalog: Catalog;
  locationId: string | null;
  onPick: (locationId: string) => void;
  onClose: () => void;
}) {
  return (
    <BottomSheet open={open} onClose={onClose} title="Change location">
      <div className="flex flex-col gap-3">
        <ChipGroup
          label="Location"
          options={catalog.locations.map((l) => ({
            value: l.id,
            label: l.name,
          }))}
          value={locationId ? [locationId] : []}
          onChange={([next]) => {
            if (next) onPick(next);
            onClose();
          }}
        />
        <p className="text-meta text-rubber">
          Applies to new suggestions and swaps. Exercises already in this
          session stay as they are.
        </p>
      </div>
    </BottomSheet>
  );
}
