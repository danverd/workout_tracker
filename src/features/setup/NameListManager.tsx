"use client";

import { useRef, useState } from "react";

import { ConfirmButton } from "@/ui/ConfirmButton";
import { apiDelete, apiPost, apiPut, errorMessage } from "@/lib/api";
import { useAsyncAction } from "@/lib/use-async-action";
import { BottomSheet } from "@/ui/BottomSheet";
import { Button } from "@/ui/Button";
import { Chip } from "@/ui/Chip";
import { EmptyState } from "@/ui/EmptyState";
import { PlusIcon } from "@/ui/icons";
import { TextField } from "@/ui/TextField";

export interface NameRow {
  id: string;
  name: string;
  hasWeights?: boolean;
  usage: string | null;
}

type Kind = "equipment" | "movements";

const copy: Record<
  Kind,
  { addLabel: string; placeholder: string; empty: string; noun: string }
> = {
  equipment: {
    addLabel: "Add equipment",
    placeholder: "Dumbbells, Barbell, Cable stack…",
    empty: "Add the gear you have. Then create a location that uses it.",
    noun: "equipment",
  },
  movements: {
    addLabel: "Add movement",
    placeholder: "Horizontal press, Hinge, Squat…",
    empty: "Add the movement patterns you train, like Horizontal press.",
    noun: "movement",
  },
};

const sortRows = (rows: NameRow[]) =>
  [...rows].sort((a, b) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: "base" }),
  );

/** Quick-add list shared by equipment and movements. */
export function NameListManager({
  kind,
  initialRows,
}: {
  kind: Kind;
  initialRows: NameRow[];
}) {
  const text = copy[kind];
  const [rows, setRows] = useState(() => sortRows(initialRows));
  const [draft, setDraft] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [editing, setEditing] = useState<NameRow | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const baseUrl = `/api/${kind}`;
  const isEquipment = kind === "equipment";

  function upsert(row: NameRow) {
    setRows((current) =>
      sortRows([...current.filter((item) => item.id !== row.id), row]),
    );
  }

  async function add(event: React.SyntheticEvent) {
    event.preventDefault();
    const name = draft.trim();
    if (!name) return;
    // Clear right away so the next name can be typed without waiting.
    setDraft("");
    setAddError(null);
    inputRef.current?.focus();
    try {
      const row = await apiPost<NameRow>(baseUrl, { name });
      upsert(row);
    } catch (error) {
      setAddError(errorMessage(error));
      setDraft((current) => (current === "" ? name : current));
    }
  }

  async function toggleWeights(row: NameRow) {
    const next = !row.hasWeights;
    upsert({ ...row, hasWeights: next });
    try {
      upsert(
        await apiPut<NameRow>(`${baseUrl}/${row.id}`, {
          name: row.name,
          hasWeights: next,
        }),
      );
    } catch (error) {
      upsert(row);
      setAddError(errorMessage(error));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={add} className="flex items-stretch gap-2">
        <TextField
          ref={inputRef}
          label={text.addLabel}
          hideLabel
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder={text.placeholder}
          autoComplete="off"
          autoCapitalize="sentences"
          enterKeyHint="done"
        />
        <Button type="submit" variant="primary" disabled={!draft.trim()}>
          <PlusIcon size={20} />
          Add
        </Button>
      </form>
      {addError ? (
        <p role="alert" className="text-meta text-bumper -mt-2 font-medium">
          {addError}
        </p>
      ) : null}

      {rows.length === 0 ? (
        <EmptyState message={text.empty} />
      ) : (
        <ul>
          {rows.map((row) => (
            <li
              key={row.id}
              className="border-hairline flex min-h-14 items-center gap-2 border-b"
            >
              <button
                type="button"
                onClick={() => setEditing(row)}
                className="text-lead text-steel min-h-14 min-w-0 flex-1 truncate text-left font-medium"
                aria-label={`Edit ${row.name}`}
              >
                {row.name}
              </button>
              {isEquipment ? (
                <Chip
                  selected={Boolean(row.hasWeights)}
                  onClick={() => toggleWeights(row)}
                  aria-label={`${row.name} has weights`}
                >
                  Has weights
                </Chip>
              ) : null}
            </li>
          ))}
        </ul>
      )}

      <BottomSheet
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={editing ? `Edit ${editing.name}` : "Edit"}
      >
        {editing ? (
          <EditForm
            key={editing.id}
            row={editing}
            kind={kind}
            onSaved={(row) => {
              upsert(row);
              setEditing(null);
            }}
            onDeleted={(id) => {
              setRows((current) => current.filter((item) => item.id !== id));
              setEditing(null);
            }}
          />
        ) : null}
      </BottomSheet>
    </div>
  );
}

function EditForm({
  row,
  kind,
  onSaved,
  onDeleted,
}: {
  row: NameRow;
  kind: Kind;
  onSaved: (row: NameRow) => void;
  onDeleted: (id: string) => void;
}) {
  const [name, setName] = useState(row.name);
  const { busy, error, run } = useAsyncAction();
  const url = `/api/${kind}/${row.id}`;

  async function save(event: React.SyntheticEvent) {
    event.preventDefault();
    await run(
      async () =>
        onSaved(
          await apiPut<NameRow>(url, {
            name,
            ...(kind === "equipment" ? { hasWeights: row.hasWeights } : {}),
          }),
        ),
      { keepBusy: true },
    );
  }

  async function remove() {
    // ConfirmButton shows a failure under the button.
    await apiDelete(url);
    onDeleted(row.id);
  }

  return (
    <form onSubmit={save} className="flex flex-col gap-4 pb-2">
      <TextField
        label="Name"
        value={name}
        onChange={(event) => setName(event.target.value)}
        error={error ?? undefined}
        autoComplete="off"
      />
      <Button
        type="submit"
        variant="primary"
        block
        disabled={busy || !name.trim()}
      >
        Save
      </Button>
      {row.usage ? (
        <p className="text-meta text-rubber">
          Used by {row.usage}, so it can&apos;t be deleted yet.
        </p>
      ) : (
        <ConfirmButton label="Delete" disabled={busy} onConfirm={remove} />
      )}
    </form>
  );
}
