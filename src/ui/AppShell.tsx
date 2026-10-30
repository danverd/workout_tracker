import type { ReactNode } from "react";

import { TabBar } from "@/ui/TabBar";

export type AppShellProps = {
  /** Usually a <ScreenHeader />. */
  header?: ReactNode;
  children: ReactNode;
  /** Pinned above the bottom edge, e.g. <SaveStatus /> in the logger. */
  footer?: ReactNode;
  /** Hide the tab bar on focused screens such as the logger. */
  hideTabBar?: boolean;
};

export function AppShell({
  header,
  children,
  footer,
  hideTabBar = false,
}: AppShellProps) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[480px] flex-col">
      {header}
      <main
        className={`flex-1 px-4 pt-4 ${
          hideTabBar ? "pb-16" : "pb-[calc(5rem+env(safe-area-inset-bottom))]"
        }`}
      >
        {children}
      </main>
      {footer ? (
        <div
          className={`border-hairline bg-chalk fixed inset-x-0 z-30 border-t ${
            hideTabBar
              ? "bottom-0"
              : "bottom-[calc(3.5rem+env(safe-area-inset-bottom))]"
          }`}
        >
          <div className="mx-auto max-w-[480px] px-4">{footer}</div>
        </div>
      ) : null}
      {hideTabBar ? null : <TabBar />}
    </div>
  );
}
