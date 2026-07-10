"use client";

import CardioActivityEditor from "@/components/daily/CardioActivityEditor";
import ExerciseEditor from "@/components/daily/ExerciseEditor";
import AppNav from "@/components/ui/AppNav";
import { useDailyWorkout } from "@/hooks/useDailyWorkout";
import { templates } from "@/lib/templates";
import { workoutApi } from "@/lib/workout-api";
import type { WorkoutPayload } from "@/types/workout";

export default function DailyClient({ initialDate }: { initialDate: string }) {
  const daily = useDailyWorkout(initialDate);
  const { workout } = daily;

  const updateExercise = (
    index: number,
    exercise: WorkoutPayload["exercises"][number],
  ) => {
    if (!workout) return;
    daily.update({
      ...workout,
      exercises: workout.exercises.map((item, itemIndex) =>
        itemIndex === index ? exercise : item,
      ),
    });
  };

  const removeExercise = (index: number) => {
    if (!workout) return;
    daily.update({
      ...workout,
      exercises: workout.exercises
        .filter((_, itemIndex) => itemIndex !== index)
        .map((exercise, position) => ({ ...exercise, position: position + 1 })),
    });
  };

  return (
    <main className="mx-auto min-h-screen max-w-4xl px-4 py-5 sm:px-8">
      <header className="mb-6 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold tracking-[.2em] text-green-400">
            TRAINING LOG
          </p>
          <h1 className="mt-1 text-3xl font-bold">Daily workout</h1>
        </div>
        <button
          onClick={async () => {
            await workoutApi.logout();
            location.assign("/login");
          }}
          className="rounded-lg border border-slate-600 px-3 py-2 text-sm"
        >
          Log out
        </button>
      </header>
      <AppNav active="daily" />
      <label className="mb-5 block text-sm font-medium">
        Date
        <input
          className="mt-1 block rounded-lg bg-slate-800 p-3"
          type="date"
          value={daily.date}
          onChange={(event) => void daily.changeDate(event.target.value)}
        />
      </label>
      <p aria-live="polite" className="mb-3 text-sm text-slate-400">
        {daily.status}
      </p>
      {daily.isLoading ? (
        <p className="text-slate-400">Loading workout…</p>
      ) : !workout ? (
        <section className="rounded-2xl border border-slate-700 bg-slate-900 p-5">
          <h2 className="text-xl font-bold">Start a workout</h2>
          <label className="mt-4 block text-sm">
            Template
            <select
              className="mt-1 block w-full rounded-lg bg-slate-800 p-3"
              value={daily.selectedTemplate}
              onChange={(event) =>
                daily.setSelectedTemplate(event.target.value)
              }
            >
              {templates.map((template) => (
                <option key={template.slug} value={template.slug}>
                  {template.name}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={() => void daily.create()}
            disabled={daily.isCreating}
            className="mt-4 w-full rounded-lg bg-green-500 p-3 font-bold text-slate-950"
          >
            {daily.isCreating ? "Creating workout…" : "Create workout"}
          </button>
        </section>
      ) : (
        <>
          <section className="mb-4 rounded-xl border border-slate-700 bg-slate-900 p-4">
            <div className="flex justify-between">
              <h2 className="font-bold">{workout.templateName}</h2>
              <span>
                {workout.status === "finished" ? "Finished" : "In progress"}
              </span>
            </div>
          </section>
          {workout.exercises.map((exercise, index) => (
            <ExerciseEditor
              key={`${exercise.exerciseSlug}-${index}`}
              exercise={exercise}
              onChange={(next) => updateExercise(index, next)}
              onRemove={() => removeExercise(index)}
            />
          ))}
          {workout.templateSlug === "cardio-active-recovery" && (
            <CardioActivityEditor
              activities={workout.cardioActivities}
              onChange={(cardioActivities) =>
                daily.update({ ...workout, cardioActivities })
              }
            />
          )}
          <label className="block rounded-xl border border-slate-700 bg-slate-900 p-4 text-sm">
            Add catalog exercise
            <select
              defaultValue=""
              onChange={(event) => {
                const slug = event.target.value;
                event.currentTarget.value = "";
                void daily.addExercise(slug);
              }}
              className="mt-2 block w-full rounded-lg bg-slate-800 p-3"
            >
              <option value="">Choose an exercise</option>
              {daily.availableExercises.map((exercise) => (
                <option value={exercise.slug} key={exercise.slug}>
                  {exercise.name}
                </option>
              ))}
            </select>
          </label>
          <button
            onClick={() => void daily.finish()}
            disabled={daily.isFinishing || workout.status === "finished"}
            className="mt-5 w-full rounded-xl bg-green-500 p-4 font-bold text-slate-950"
          >
            {daily.isFinishing
              ? "Finishing workout…"
              : workout.status === "finished"
                ? "Workout finished"
                : "Finish workout"}
          </button>
        </>
      )}
    </main>
  );
}
