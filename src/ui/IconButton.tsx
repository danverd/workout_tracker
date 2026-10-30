import type { ButtonHTMLAttributes, ReactNode } from "react";

export type IconButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "className" | "children" | "aria-label"
> & {
  /** Required: icon-only buttons need an accessible name. */
  label: string;
  icon: ReactNode;
};

export function IconButton({
  label,
  icon,
  type = "button",
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      className="text-steel enabled:active:bg-sunken inline-flex size-12 shrink-0 items-center justify-center select-none disabled:cursor-not-allowed disabled:opacity-45"
      {...rest}
    >
      {icon}
    </button>
  );
}
