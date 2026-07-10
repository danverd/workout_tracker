"use client";

import type { WorkoutExerciseInput } from "@/types/workout";

const inputLabels = {
  stack: "Stack weight",
  one_side_plates: "Plates per side",
  per_dumbbell: "Per dumbbell",
  per_hand: "Per hand",
  per_arm: "Per arm",
  machine_assistance: "Machine assistance",
  bodyweight: "Bodyweight",
  kettlebell: "Kettlebell weight",
};

export default function ExerciseEditor({
  exercise,
  onChange,
  onRemove,
}: {
  exercise: WorkoutExerciseInput;
  onChange: (next: WorkoutExerciseInput) => void;
  onRemove: () => void;
}) {
  return (
    <section className="mb-4 rounded-2xl border border-slate-700 bg-slate-900 p-4">
      <div className="mb-3 flex justify-between gap-3">
        <h2 className="font-bold">{exercise.name}</h2>
        <button className="text-sm text-red-300" onClick={onRemove}>
          Remove
        </button>
      </div>
      <p className="mb-2 text-xs text-slate-400">
        {inputLabels[exercise.inputMode]}
      </p>
      {exercise.sets.map((set, index) => (
        <div
          key={set.position}
          className="mb-2 grid grid-cols-[auto_1fr_1fr] gap-2"
        >
          <span className="pt-3 text-sm">
            {set.target.kind === "amrap" ? "AMRAP" : set.target.reps}
          </span>
          <input
            aria-label={`${exercise.name} set ${index + 1} reps`}
            className="min-w-0 rounded-lg bg-slate-800 p-2"
            type="number"
            min="0"
            value={set.actualReps ?? ""}
            onChange={(event) =>
              onChange({
                ...exercise,
                sets: exercise.sets.map((item, itemIndex) =>
                  itemIndex === index
                    ? {
                        ...item,
                        actualReps:
                          event.target.value === ""
                            ? null
                            : Number(event.target.value),
                      }
                    : item,
                ),
              })
            }
          />
          <input
            aria-label={`${exercise.name} set ${index + 1} weight`}
            className="min-w-0 rounded-lg bg-slate-800 p-2"
            type="number"
            min="0"
            value={set.inputWeight}
            onChange={(event) =>
              onChange({
                ...exercise,
                sets: exercise.sets.map((item, itemIndex) =>
                  itemIndex === index
                    ? { ...item, inputWeight: Number(event.target.value) }
                    : item,
                ),
              })
            }
          />
        </div>
      ))}
    </section>
  );
}
