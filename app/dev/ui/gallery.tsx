"use client";

import Link from "next/link";
import { useState } from "react";

import { AppShell } from "@/ui/AppShell";
import { Button } from "@/ui/Button";
import { BottomSheet } from "@/ui/BottomSheet";
import { buttonClass } from "@/ui/button-styles";
import { ChipGroup } from "@/ui/ChipGroup";
import { EmptyState } from "@/ui/EmptyState";
import { PlusIcon } from "@/ui/icons";
import { IconButton } from "@/ui/IconButton";
import { ListRow } from "@/ui/ListRow";
import { NumberField } from "@/ui/NumberField";
import { SaveStatus, type SaveState } from "@/ui/SaveStatus";
import { ScreenHeader } from "@/ui/ScreenHeader";
import { Select } from "@/ui/Select";
import { SetRow } from "@/ui/SetRow";
import { Stepper } from "@/ui/Stepper";
import { TextField } from "@/ui/TextField";

const DUMBBELLS = Array.from({ length: 16 }, (_, i) => 5 + i * 5);
const SAVE_STATES: SaveState[] = ["saved", "saving", "error"];

type SetState = { weight: number | null; reps: number | null; done: boolean };
type Editing = { index: number; field: "weight" | "reps" } | null;

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-hairline flex flex-col gap-3 border-b pb-6">
      <h2 className="font-display text-title font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export function Gallery() {
  const [sets, setSets] = useState<SetState[]>([
    { weight: 50, reps: 10, done: true },
    { weight: 50, reps: null, done: false },
    { weight: 55, reps: null, done: false },
  ]);
  const [editing, setEditing] = useState<Editing>(null);
  const [chips, setChips] = useState<string[]>(["Gym"]);
  const [multi, setMulti] = useState<string[]>(["Chest", "Triceps"]);
  const [name, setName] = useState("");
  const [bodyweight, setBodyweight] = useState<number | null>(182.5);
  const [day, setDay] = useState("push");
  const [status, setStatus] = useState<SaveState>("saved");

  function updateSet(index: number, patch: Partial<SetState>) {
    setSets((prev) =>
      prev.map((s, i) => (i === index ? { ...s, ...patch } : s)),
    );
  }

  const editedSet = editing ? sets[editing.index] : null;

  return (
    <AppShell
      header={
        <ScreenHeader
          title="Push · Home"
          backHref="/"
          action={<Button variant="primary">Finish session</Button>}
        />
      }
      footer={<SaveStatus status={status} />}
    >
      <div className="flex flex-col gap-6">
        <Section title="Incline dumbbell press">
          <p className="text-meta text-rubber">3 × 8–12 · last time 50 × 10</p>
          <div className="border-hairline border-t">
            {sets.map((set, i) => (
              <SetRow
                key={i}
                index={i + 1}
                weight={set.weight}
                reps={set.reps}
                repsHint={10}
                done={set.done}
                onToggleDone={() =>
                  updateSet(i, {
                    done: !set.done,
                    reps: set.done ? set.reps : (set.reps ?? 10),
                  })
                }
                onEditWeight={() => setEditing({ index: i, field: "weight" })}
                onEditReps={() => setEditing({ index: i, field: "reps" })}
              />
            ))}
          </div>
          <div className="flex gap-2">
            <Button
              variant="quiet"
              onClick={() =>
                setSets((prev) => [
                  ...prev,
                  {
                    weight: prev.at(-1)?.weight ?? null,
                    reps: null,
                    done: false,
                  },
                ])
              }
            >
              <PlusIcon size={20} /> Add set
            </Button>
            <Button variant="quiet">Swap</Button>
          </div>
        </Section>

        <Section title="Buttons">
          <Button variant="secondary" block>
            Start lifting
          </Button>
          <Button variant="secondary" block>
            Log cardio
          </Button>
          <Button variant="quiet">Add exercise</Button>
          <Button variant="destructive">Delete program</Button>
          <Button variant="secondary" disabled>
            Disabled
          </Button>
          <Link href="/programs" className={buttonClass("secondary")}>
            Link styled as button
          </Link>
          <div>
            <IconButton label="Add set" icon={<PlusIcon />} />
          </div>
        </Section>

        <Section title="Fields">
          <TextField
            label="Program name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Push, pull, legs"
            hint="You can rename it later."
          />
          <TextField
            label="Exercise name"
            defaultValue=""
            error="Enter a name to save this exercise."
          />
          <NumberField
            label="Bodyweight"
            unit="lb"
            value={bodyweight}
            onChange={setBodyweight}
          />
          <Select
            label="Day"
            value={day}
            onChange={(e) => setDay(e.target.value)}
            options={[
              { value: "push", label: "Push" },
              { value: "pull", label: "Pull" },
              { value: "legs", label: "Legs" },
            ]}
          />
        </Section>

        <Section title="Chips">
          <ChipGroup
            label="Location"
            options={[{ value: "Home" }, { value: "Gym" }, { value: "Hotel" }]}
            value={chips}
            onChange={setChips}
          />
          <ChipGroup
            label="Muscles"
            multiple
            options={["Chest", "Back", "Triceps", "Biceps", "Legs"].map(
              (value) => ({ value }),
            )}
            value={multi}
            onChange={setMulti}
          />
        </Section>

        <Section title="Save status">
          <div className="flex gap-2">
            {SAVE_STATES.map((s) => (
              <Button key={s} variant="quiet" onClick={() => setStatus(s)}>
                {s}
              </Button>
            ))}
          </div>
          {SAVE_STATES.map((s) => (
            <SaveStatus key={s} status={s} />
          ))}
        </Section>

        <Section title="List rows">
          <div className="border-hairline border-t">
            <ListRow
              href="/history"
              title="Push day"
              detail="Oct 28 · 6 exercises"
              trailing="12,450 lb"
            />
            <ListRow
              title="Seated dumbbell press"
              detail="3 × 8–12 · last time 40 × 10"
              onClick={() => {}}
            />
            <ListRow title="Bodyweight" trailing="182.5 lb" />
          </div>
        </Section>

        <Section title="Empty state">
          <EmptyState
            message="No programs yet. Build one to pick your exercises and sets."
            action={<Button variant="secondary">Create program</Button>}
          />
        </Section>
      </div>

      <BottomSheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing ? `Set ${editing.index + 1} ${editing.field}` : "Edit"}
      >
        {editing && editedSet ? (
          editing.field === "weight" ? (
            <Stepper
              label="Weight"
              unit="lb"
              value={editedSet.weight}
              increment={5}
              options={DUMBBELLS}
              onChange={(weight) => updateSet(editing.index, { weight })}
            />
          ) : (
            <Stepper
              label="Reps"
              value={editedSet.reps}
              increment={1}
              min={1}
              onChange={(reps) => updateSet(editing.index, { reps })}
            />
          )
        ) : null}
        <div className="pt-5">
          <Button variant="secondary" block onClick={() => setEditing(null)}>
            Done
          </Button>
        </div>
      </BottomSheet>
    </AppShell>
  );
}
