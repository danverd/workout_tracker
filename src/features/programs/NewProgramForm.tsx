"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { ApiError, apiPost } from "@/lib/api";
import type { ProgramDto } from "@/types/domain";
import { Button } from "@/ui/Button";
import { TextField } from "@/ui/TextField";

export function NewProgramForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  async function create() {
    setBusy(true);
    setError(undefined);
    try {
      const program = await apiPost<ProgramDto>("/api/programs", {
        name,
        days: [],
      });
      router.replace(`/programs/${program.id}`);
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : "Could not create it.",
      );
      setBusy(false);
    }
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (name.trim()) void create();
      }}
    >
      <TextField
        label="Program name"
        value={name}
        maxLength={80}
        autoFocus
        placeholder="Push, pull, legs"
        hint="You will add days and slots next."
        error={error}
        onChange={(e) => setName(e.target.value)}
      />
      <Button
        type="submit"
        variant="primary"
        block
        disabled={busy || !name.trim()}
      >
        {busy ? "Creating…" : "Create program"}
      </Button>
    </form>
  );
}
