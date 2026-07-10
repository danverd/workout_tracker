"use client";

import type { CardioActivityInput } from "@/types/workout";

export default function CardioActivityEditor({
  activities,
  onChange,
}: {
  activities: CardioActivityInput[];
  onChange: (activities: CardioActivityInput[]) => void;
}) {
  const update = (index: number, next: Partial<CardioActivityInput>) =>
    onChange(
      activities.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...next } : item,
      ),
    );

  return (
    <section className="mb-4 rounded-2xl border border-slate-700 bg-slate-900 p-4">
      <h2 className="font-bold">Activities</h2>
      {activities.map((item, index) => (
        <div className="mt-3 grid gap-2" key={item.position}>
          <select
            value={item.kind}
            onChange={(event) =>
              update(index, {
                kind: event.target.value as CardioActivityInput["kind"],
              })
            }
            className="rounded-lg bg-slate-800 p-2"
          >
            <option value="treadmill">Treadmill</option>
            <option value="rowing">Rowing machine</option>
            <option value="stairmaster">StairMaster</option>
          </select>
          {item.kind === "treadmill" && (
            <NumberField
              label="Incline percent"
              placeholder="Incline %"
              value={item.incline}
              onChange={(incline) => update(index, { incline })}
            />
          )}
          {item.kind !== "rowing" && (
            <NumberField
              label="Speed mph"
              placeholder="Speed mph"
              value={item.speed}
              onChange={(speed) => update(index, { speed })}
            />
          )}
          <TextField
            label="Duration"
            placeholder="hh:mm:ss"
            value={item.duration}
            onChange={(duration) => update(index, { duration })}
          />
          {item.kind === "rowing" && (
            <TextField
              label="Rowing pace"
              placeholder="mm:ss"
              value={item.pace}
              onChange={(pace) => update(index, { pace })}
            />
          )}
        </div>
      ))}
      <button
        className="mt-3 rounded-lg border border-slate-600 px-3 py-2 text-sm"
        onClick={() =>
          onChange([
            ...activities,
            {
              position: activities.length + 1,
              kind: "treadmill",
              incline: 0,
              speed: 0,
              duration: "00:00:00",
              pace: null,
            },
          ])
        }
      >
        Add activity
      </button>
    </section>
  );
}

function NumberField({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: number | null;
  onChange: (value: number | null) => void;
}) {
  return (
    <input
      aria-label={label}
      type="number"
      placeholder={placeholder}
      className="rounded-lg bg-slate-800 p-2"
      value={value ?? ""}
      onChange={(event) =>
        onChange(event.target.value === "" ? null : Number(event.target.value))
      }
    />
  );
}

function TextField({
  label,
  placeholder,
  value,
  onChange,
}: {
  label: string;
  placeholder: string;
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  return (
    <input
      aria-label={label}
      placeholder={placeholder}
      className="rounded-lg bg-slate-800 p-2"
      value={value ?? ""}
      onChange={(event) => onChange(event.target.value || null)}
    />
  );
}
