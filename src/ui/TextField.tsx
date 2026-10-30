import { useId, type InputHTMLAttributes } from "react";

export type TextFieldProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "className" | "id"
> & {
  label: string;
  hint?: string;
  /** Shown under the field and announced; also sets aria-invalid. */
  error?: string;
};

export function TextField({ label, hint, error, ...rest }: TextFieldProps) {
  const id = useId();
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy =
    [hint ? hintId : null, error ? errorId : null].filter(Boolean).join(" ") ||
    undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-body text-steel font-medium">
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
