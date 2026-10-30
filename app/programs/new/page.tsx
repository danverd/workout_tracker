import { NewProgramForm } from "@/features/programs/NewProgramForm";
import { AppShell } from "@/ui/AppShell";
import { ScreenHeader } from "@/ui/ScreenHeader";

export default function NewProgramPage() {
  return (
    <AppShell
      header={
        <ScreenHeader
          title="New program"
          backHref="/programs"
          backLabel="Back to programs"
        />
      }
    >
      <NewProgramForm />
    </AppShell>
  );
}
