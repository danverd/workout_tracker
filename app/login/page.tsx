"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { apiPost } from "@/lib/api";
import { getBrowserQueue } from "@/lib/save-queue/browser";
import { Button } from "@/ui/Button";
import { TextField } from "@/ui/TextField";

export default function LoginPage() {
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await apiPost("/api/session", { passcode });
    } catch {
      setSubmitting(false);
      setError("Invalid passcode");
      return;
    }
    setSubmitting(false);
    // Send changes that were held while signed out, without waiting on backoff.
    getBrowserQueue().retryNow();
    router.push("/");
    router.refresh();
  }

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col justify-center px-4 py-10">
      <form onSubmit={submit} className="flex flex-col gap-6">
        <h1 className="font-display text-heading text-steel font-bold">
          Workout Tracker
        </h1>
        <TextField
          label="Passcode"
          type="password"
          value={passcode}
          onChange={(event) => {
            setPasscode(event.target.value);
            setError("");
          }}
          error={error || undefined}
          autoComplete="current-password"
          autoFocus
        />
        <Button type="submit" variant="primary" block disabled={submitting}>
          {submitting ? "Checking…" : "Continue"}
        </Button>
      </form>
    </main>
  );
}
