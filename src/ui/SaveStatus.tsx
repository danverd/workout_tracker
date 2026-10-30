export type SaveState = "saved" | "saving" | "error";

export type SaveStatusProps = {
  status: SaveState;
};

const copy: Record<SaveState, string> = {
  saved: "Saved",
  saving: "Saving…",
  error: "Not saved — retrying",
};

const dot: Record<SaveState, string> = {
  saved: "bg-plate-blue",
  saving: "bg-rubber",
  error: "bg-plate-yellow",
};

export function SaveStatus({ status }: SaveStatusProps) {
  return (
    <p
      role="status"
      aria-live="polite"
      className={`text-meta flex min-h-8 items-center gap-2 ${
        status === "error"
          ? "bg-plate-yellow-wash text-steel px-2 font-medium"
          : "text-rubber"
      }`}
    >
      <span
        aria-hidden="true"
        className={`size-2 rounded-full ${dot[status]}`}
      />
      {copy[status]}
    </p>
  );
}
