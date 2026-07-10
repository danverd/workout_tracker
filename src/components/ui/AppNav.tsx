const links = [
  ["daily", "Daily", "/daily"],
  ["weekly", "Weekly", "/weekly"],
  ["monthly", "Monthly", "/monthly"],
] as const;

export default function AppNav({
  active,
}: {
  active: (typeof links)[number][0];
}) {
  return (
    <nav className="mb-5 flex gap-2 text-sm" aria-label="Workout views">
      {links.map(([id, label, href]) => (
        <a
          key={id}
          className={
            id === active
              ? "rounded-lg bg-green-500 px-3 py-2 font-bold text-slate-950"
              : "rounded-lg border border-slate-700 px-3 py-2"
          }
          href={href}
        >
          {label}
        </a>
      ))}
    </nav>
  );
}
