import Link from "next/link";
import type { ReactNode } from "react";

import { ChevronLeftIcon } from "@/ui/icons";

export type ScreenHeaderProps = {
  title: string;
  /** Show a back link to this path. */
  backHref?: string;
  /** Accessible name for the back link. Default "Back". */
  backLabel?: string;
  /** Right-aligned control, e.g. a Button or IconButton. */
  action?: ReactNode;
};

export function ScreenHeader({
  title,
  backHref,
  backLabel = "Back",
  action,
}: ScreenHeaderProps) {
  return (
    <header className="border-hairline flex min-h-14 items-center gap-1 border-b pr-4 pl-2">
      {backHref ? (
        <Link
          href={backHref}
          aria-label={backLabel}
          className="text-steel inline-flex size-12 shrink-0 items-center justify-center"
        >
          <ChevronLeftIcon />
        </Link>
      ) : (
        <span className="w-2 shrink-0" aria-hidden="true" />
      )}
      <h1 className="font-display text-heading text-steel min-w-0 flex-1 truncate font-bold">
        {title}
      </h1>
      {action ? <div className="shrink-0">{action}</div> : null}
    </header>
  );
}
