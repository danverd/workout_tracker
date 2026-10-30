import type { ProgramSaveInput } from "@/lib/validation/programs";
import { programSaveSchema } from "@/lib/validation/programs";
import type { ProgramDto } from "@/types/domain";

/** Client-side editable shape. Every slot already has a target. */
export interface DraftSlot {
  id: string;
  movementId: string | null;
  exerciseId: string | null;
  targetSets: number;
  repMin: number | null;
  repMax: number | null;
  amrap: boolean;
  notes: string;
}

export interface DraftDay {
  id: string;
  name: string;
  slots: DraftSlot[];
}

export interface Draft {
  name: string;
  days: DraftDay[];
}

export type RepsMode = "number" | "range" | "amrap";

export function newId(): string {
  return crypto.randomUUID();
}

export function draftFromProgram(program: ProgramDto): Draft {
  return {
    name: program.name,
    days: program.days.map((day) => ({
      id: day.id,
      name: day.name,
      slots: day.slots.map((slot) => ({
        id: slot.id,
        movementId: slot.movementId,
        exerciseId: slot.exerciseId,
        targetSets: slot.sets,
        repMin: slot.repMin,
        repMax: slot.repMax,
        amrap: slot.amrap,
        notes: slot.notes,
      })),
    })),
  };
}

export function toPayload(draft: Draft): ProgramSaveInput {
  return {
    name: draft.name,
    days: draft.days.map((day) => ({
      id: day.id,
      name: day.name,
      slots: day.slots.map((slot) => ({ ...slot })),
    })),
  };
}

/** The first problem that blocks saving, or null when the draft is valid. */
export function draftProblem(draft: Draft): string | null {
  if (draft.name.trim() === "") return "Name the program to save it.";
  if (draft.days.some((day) => day.name.trim() === ""))
    return "Name every day to save.";
  const parsed = programSaveSchema.safeParse(toPayload(draft));
  return parsed.success
    ? null
    : (parsed.error.issues[0]?.message ?? "Fix the highlighted fields.");
}

export function repsMode(slot: DraftSlot): RepsMode {
  if (slot.amrap) return "amrap";
  if (
    slot.repMin !== null &&
    slot.repMax !== null &&
    slot.repMin !== slot.repMax
  )
    return "range";
  return "number";
}

/** Switches how reps are expressed, carrying over what makes sense. */
export function withRepsMode(slot: DraftSlot, mode: RepsMode): DraftSlot {
  if (mode === "amrap")
    return { ...slot, amrap: true, repMin: null, repMax: null };
  if (mode === "number") {
    const reps = slot.repMin ?? slot.repMax ?? 10;
    return { ...slot, amrap: false, repMin: reps, repMax: reps };
  }
  const min = slot.repMin ?? slot.repMax ?? 8;
  const max = slot.repMax !== null && slot.repMax > min ? slot.repMax : min + 4;
  return { ...slot, amrap: false, repMin: min, repMax: max };
}

/** "3 × 8–12", "3 × 10", "3 × AMRAP", or "3 sets" when reps are open. */
export function targetLabel(slot: DraftSlot): string {
  const { targetSets: sets, repMin, repMax } = slot;
  if (slot.amrap) return `${sets} × AMRAP`;
  if (repMin !== null && repMax !== null)
    return repMin === repMax
      ? `${sets} × ${repMin}`
      : `${sets} × ${repMin}–${repMax}`;
  const single = repMin ?? repMax;
  return single === null ? `${sets} sets` : `${sets} × ${single}`;
}

export function moveItem<T>(items: readonly T[], from: number, by: -1 | 1) {
  const to = from + by;
  if (to < 0 || to >= items.length) return [...items];
  const next = [...items];
  [next[from], next[to]] = [next[to], next[from]];
  return next;
}
