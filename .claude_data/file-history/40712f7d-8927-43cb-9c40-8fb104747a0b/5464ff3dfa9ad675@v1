import { CoachLayout } from "@/components/coach-layout";
import { EmptyState } from "@/components/empty-state";
import { Users } from "lucide-react";

export default function CoachStudents() {
  return (
    <CoachLayout title="Mokiniai">
      <div className="px-4 md:px-6 py-6 space-y-6 max-w-4xl">
        <header className="flex flex-col gap-1">
          <h1 className="text-2xl font-semibold tracking-tight">Mokiniai</h1>
          <p className="text-sm text-muted-foreground">
            Visi su jumis dirbantys mokiniai matomi vienoje vietoje.
          </p>
        </header>

        <EmptyState
          icon={<Users className="h-10 w-10" />}
          title="Dar nėra mokinių"
          description="Kai mokiniai užregistruoja pamokas su jumis, jie atsiras šiame sąraše."
        />
      </div>
    </CoachLayout>
  );
}
