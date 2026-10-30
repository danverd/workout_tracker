import Link from "next/link";
import { connection } from "next/server";

import { getDb } from "@/db/client";
import { getSettings, getSetupCounts } from "@/db/queries/setup";
import { AppShell } from "@/ui/AppShell";
import { buttonClass } from "@/ui/button-styles";
import { EmptyState } from "@/ui/EmptyState";
import { ListRow } from "@/ui/ListRow";
import { ScreenHeader } from "@/ui/ScreenHeader";

export default async function SetupPage() {
  await connection();
  const db = await getDb();
  const [counts, settings] = await Promise.all([
    getSetupCounts(db),
    getSettings(db),
  ]);

  const sections = [
    {
      href: "/setup/equipment",
      title: "Equipment",
      detail: "The gear you have",
      count: counts.equipment,
    },
    {
      href: "/setup/locations",
      title: "Locations",
      detail: "Where you train and what's there",
      count: counts.locations,
    },
    {
      href: "/setup/movements",
      title: "Movements",
      detail: "Patterns like Horizontal press or Hinge",
      count: counts.movements,
    },
    {
      href: "/setup/exercises",
      title: "Exercises",
      detail: "Your lifts and how you load them",
      count: counts.exercises,
    },
  ];
  const next = sections.find((section) => section.count === 0);
  const isEmpty = sections.every((section) => section.count === 0);

  return (
    <AppShell header={<ScreenHeader title="Setup" />}>
      {isEmpty ? (
        <EmptyState
          message="Start with the equipment you have. Then add a location, movements and exercises."
          action={
            <Link href="/setup/equipment" className={buttonClass("primary")}>
              Add your equipment
            </Link>
          }
        />
      ) : null}
      {!isEmpty && next ? (
        <p className="text-body text-rubber pb-3">
          Next: add your {next.title.toLowerCase()}.
        </p>
      ) : null}
      <nav aria-label="Setup sections">
        {sections.map((section) => (
          <ListRow
            key={section.href}
            href={section.href}
            title={section.title}
            detail={section.detail}
            trailing={
              <span className="font-display text-title text-steel tabular-nums">
                {section.count}
              </span>
            }
          />
        ))}
        <ListRow
          href="/setup/settings"
          title="Settings"
          detail="Bodyweight"
          trailing={
            settings.bodyweightLb > 0
              ? `${settings.bodyweightLb} lb`
              : "Not set"
          }
        />
      </nav>
    </AppShell>
  );
}
