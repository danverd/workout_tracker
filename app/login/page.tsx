"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { workoutApi } from "@/lib/workout-api";

export default function LoginPage() {
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState("");
  const router = useRouter();
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    try {
      await workoutApi.login(passcode);
    } catch {
      setError("Invalid passcode");
      return;
    }
    router.push("/daily");
    router.refresh();
  }
  return (
    <main className="flex min-h-screen items-center justify-center p-5">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl border border-slate-700 bg-slate-900 p-6"
      >
        <p className="text-xs font-bold tracking-[.2em] text-green-400">
          WORKOUT TRACKER
        </p>
        <h1 className="mt-2 text-2xl font-bold">Enter passcode</h1>
        <label className="mt-6 block text-sm">
          Passcode
          <input
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            type="password"
            className="mt-2 w-full rounded-lg bg-slate-800 p-3"
            autoFocus
          />
        </label>
        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        <button className="mt-6 w-full rounded-lg bg-green-500 p-3 font-bold text-slate-950">
          Continue
        </button>
      </form>
    </main>
  );
}
