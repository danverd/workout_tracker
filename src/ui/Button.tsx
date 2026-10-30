import type { ButtonHTMLAttributes } from "react";

import { buttonClass, type ButtonVariant } from "@/ui/button-styles";

export type ButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  "className"
> & {
  /** Use `primary` at most once per screen. */
  variant?: ButtonVariant;
  /** Stretch to the full width of the container. */
  block?: boolean;
};

export function Button({
  variant = "secondary",
  block = false,
  type = "button",
  ...rest
}: ButtonProps) {
  return (
    <button type={type} className={buttonClass(variant, block)} {...rest} />
  );
}
