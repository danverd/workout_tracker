import Link from "next/link";
import type { ReactNode } from "react";

import { ChevronRightIcon } from "@/ui/icons";

export type ListRowProps = {
  title: string;
  /** Secondary line, e.g. "3 × 8–12 · last 50 × 10". */
  detail?: string;
  /** Content at the right edge (a value, a status). */
  trailing?: ReactNode;
  /** Render as a link. */
  href?: string;
  /** Render as a button (ignored when href is set). Needs a client parent. */
  onClick?: () => void;
};

const rowClass =
  "flex min-h-14 w-full items-center gap-3 border-b border-hairline py-2 text-left";

export function ListRow({
  title,
  detail,
  trailing,
  href,
  onClick,
}: ListRowProps) {
  const interactive = Boolean(href || onClick);
  const content = (
    <>
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="text-lead text-steel truncate font-medium">
          {title}
        </span>
        {detail ? (
          <span className="text-meta text-rubber truncate">{detail}</span>
        ) : null}
      </span>
      {trailing ? (
        <span className="text-body text-rubber shrink-0">{trailing}</span>
      ) : null}
      {interactive ? (
        <ChevronRightIcon size={20} className="text-rubber shrink-0" />
      ) : null}
    </>
  );

  if (href) {
    return (
      <Link href={href} className={rowClass}>
        {content}
      </Link>
    );
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={rowClass}>
        {content}
      </button>
    );
  }
  return <div className={rowClass}>{content}</div>;
}
