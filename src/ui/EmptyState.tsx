import type { ReactNode } from "react";

export type EmptyStateProps = {
  /** Say what is missing and what to do next. */
  message: string;
  /** Usually a Button or a link styled with buttonClass(). */
  action?: ReactNode;
};

export function EmptyState({ message, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-start gap-4 py-10">
      <p className="text-lead text-steel max-w-[28ch]">{message}</p>
      {action}
    </div>
  );
}
