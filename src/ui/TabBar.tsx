"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { HistoryIcon, ProgramsIcon, SetupIcon, TodayIcon } from "@/ui/icons";

const TABS: readonly { href: string; label: string; icon: ReactNode }[] = [
  { href: "/", label: "Today", icon: <TodayIcon /> },
  { href: "/programs", label: "Programs", icon: <ProgramsIcon /> },
  { href: "/history", label: "History", icon: <HistoryIcon /> },
  { href: "/setup", label: "Setup", icon: <SetupIcon /> },
];

function isActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function TabBar() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="border-hairline bg-chalk fixed inset-x-0 bottom-0 z-40 border-t pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex max-w-[480px]">
        {TABS.map((tab) => {
          const active = isActive(pathname, tab.href);
          return (
            <li key={tab.href} className="flex-1">
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={`text-meta relative flex min-h-14 flex-col items-center justify-center gap-0.5 ${
                  active ? "text-steel font-medium" : "text-rubber"
                }`}
              >
                <span
                  aria-hidden="true"
                  className={`absolute inset-x-3 top-0 h-[3px] ${
                    active ? "bg-plate-blue" : "bg-transparent"
                  }`}
                />
                {tab.icon}
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
