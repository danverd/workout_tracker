export type ButtonVariant = "primary" | "secondary" | "quiet" | "destructive";

const base =
  "inline-flex min-h-12 items-center justify-center gap-2 px-5 font-medium text-lead select-none transition-colors disabled:cursor-not-allowed disabled:opacity-45";

const variants: Record<ButtonVariant, string> = {
  primary: "bg-bumper text-white enabled:active:bg-bumper-deep",
  secondary:
    "border border-steel text-steel enabled:active:bg-sunken bg-transparent",
  quiet: "bg-transparent text-plate-blue enabled:active:bg-sunken",
  destructive:
    "border border-bumper text-bumper bg-transparent enabled:active:bg-bumper enabled:active:text-white",
};

/** Class string for button-looking elements (e.g. a next/link styled as a button). */
export function buttonClass(
  variant: ButtonVariant = "secondary",
  block = false,
): string {
  return `${base} ${variants[variant]}${block ? " w-full" : ""}`;
}
