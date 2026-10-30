"use client";

import { useRouter } from "next/navigation";
import { apiDelete } from "@/lib/api";
import { ConfirmButton } from "@/ui/ConfirmButton";

export function DeleteCardioButton({ id }: { id: string }) {
  const router = useRouter();
  return (
    <ConfirmButton
      label="Delete"
      block={false}
      errorFallback="Couldn't delete this entry. Try again."
      onConfirm={async () => {
        await apiDelete(`/api/cardio/${id}`);
        router.replace("/history");
        router.refresh();
      }}
    />
  );
}
