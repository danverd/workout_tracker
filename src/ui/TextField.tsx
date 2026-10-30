import { useId, type ComponentProps } from "react";

export type TextFieldProps = Omit<
  ComponentProps<"input">,
  "className" | "id"
> & {
  label: string;
  /** Keeps the label for screen readers but hides it; for inline rows. */
  hideLabel?: boolean;
  hint?: string;
  /** Shown under the field and announced; also sets aria-invalid. */
  error?: string;
};

export function TextField({
  label,
  hideLabel,
  hint,
  error,
  ...rest
}: TextFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy =
    [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") ||
    undefined;
  return (
    <div
      className={`flex flex-col gap-1.5 ${hideLabel ? "min-w-0 flex-1" : ""}`}
    >
      <label
        htmlFor={id}
        className={`text-body text-steel font-medium ${hideLabel ? "sr-only" : ""}`}
      >
        {label}
      </label>
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className={`rounded-field bg-paper text-lead text-steel placeholder:text-rubber min-h-12 w-full border px-3 ${
          error ? "border-bumper" : "border-rubber"
        }`}
        {...rest}
      />
      {hint ? (
        <p id={hintId} className="text-meta text-rubber">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p
          id={errorId}
          role="alert"
          className="text-meta text-bumper font-medium"
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
