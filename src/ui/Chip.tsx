import type { ButtonHTMLAttributes } from "react";

export type ChipProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "className" | "aria-pressed"
> & {
  selected?: boolean;
};

export function Chip({
  selected = false,
  type = "button",
  ...rest
}: ChipProps) {
  return (
    <button
      type={type}
      aria-pressed={selected}
      className={`font-display text-lead inline-flex min-h-11 min-w-11 items-center justify-center border px-3.5 font-semibold tabular-nums select-none ${
        selected
          ? "border-plate-blue bg-plate-blue text-white"
          : "border-hairline bg-paper text-steel enabled:active:bg-sunken"
      }`}
      {...rest}
    />
  );
}
