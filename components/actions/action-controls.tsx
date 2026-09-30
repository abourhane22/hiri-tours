"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Printer, UserPlus, Loader2 } from "lucide-react";
import { assignTask, markInfosRead, snoozeTask, unsnoozeTask } from "@/app/admin/notification-actions";
import { agencyTime } from "@/lib/tz";
import { useToast } from "@/components/ui/toaster";

export type StaffOption = { id: string; name: string };

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? "")
    .join("");
}

/** Colonne « Assignée à » : avatar + nom, ou bouton « Assigner » → liste du staff. */
export function AssignCell({ taskKey, assignee, staff }: { taskKey: string; assignee: StaffOption | null; staff: StaffOption[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const toast = useToast();

  function onChange(value: string) {
    setError(null);
    startTransition(async () => {
      const res = await assignTask(taskKey, value === "" ? null : value);
      if (!res.ok) {
        setError(res.error);
        toast.error(res.error);
        return;
      }
      toast.success(value === "" ? "Tâche désassignée" : `Tâche assignée à ${staff.find((s) => s.id === value)?.name ?? "l'équipe"}`);
      setEditing(false);
      router.refresh();
    });
  }

  if (editing) {
    return (
      <div className="print:hidden">
        <select
          autoFocus
          defaultValue={assignee?.id ?? ""}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => !isPending && setEditing(false)}
          disabled={isPending}
          aria-label="Assigner la tâche"
          className="h-11 w-full min-w-[160px] rounded-lg border border-[#E0DACF] bg-white px-2 text-[13px] text-[#1A1F2E]"
        >
          <option value="">— Non assignée —</option>
          {staff.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name}
            </option>
          ))}
        </select>
        {error && <p className="mt-1 text-[11.5px] text-[#791F1F]">{error}</p>}
      </div>
    );
  }

  if (assignee) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="inline-flex h-11 items-center gap-2 rounded-lg px-1.5 text-left hover:bg-[#FBF9F5]"
        title="Changer l'assignation"
      >
        <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-[#1A1F2E] text-[10.5px] font-semibold text-white">
          {initials(assignee.name)}
        </span>
        <span className="text-[13px] text-[#1A1F2E]">{assignee.name}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setEditing(true)}
      className="inline-flex h-11 items-center gap-1.5 rounded-lg border border-dashed border-[#C9C4BA] px-3 text-[12.5px] font-medium text-[#58524A] hover:border-[#1A1F2E] hover:text-[#1A1F2E] print:hidden"
    >
      <UserPlus className="size-3.5" /> Assigner
    </button>
  );
}

/** « Plus tard » (report personnel jusqu'à demain 08:00) avec « Annuler ». */
export function SnoozeButton({ taskKey, snoozedUntil }: { taskKey: string; snoozedUntil: string | null }) {
  const router = useRouter();
  const [until, setUntil] = useState<string | null>(snoozedUntil && Date.parse(snoozedUntil) > Date.now() ? snoozedUntil : null);
  const [isPending, startTransition] = useTransition();
  const toast = useToast();

  function snooze() {
    startTransition(async () => {
      const res = await snoozeTask(taskKey);
      if (!res.ok) return void toast.error(res.error);
      setUntil(res.until);
      toast.show({ type: "success", message: `Reportée à demain ${agencyTime(res.until)}`, action: { label: "Annuler", onClick: undo } });
      router.refresh();
    });
  }
  function undo() {
    startTransition(async () => {
      const res = await unsnoozeTask(taskKey);
      if (res.ok) {
        setUntil(null);
        router.refresh();
      }
    });
  }

  if (until) {
    return (
      <span className="inline-flex items-center gap-1 text-[11.5px] text-[#6B6862] print:hidden">
        Reportée à demain {agencyTime(until)}
        <button type="button" onClick={undo} disabled={isPending} className="h-11 px-1.5 font-medium text-[#0C6B8A] hover:underline">
          Annuler
        </button>
      </span>
    );
  }
  return (
    <button
      type="button"
      onClick={snooze}
      disabled={isPending}
      className="inline-flex h-11 items-center rounded-lg px-3 text-[12.5px] font-medium text-[#58524A] hover:bg-[#F1EFE8] disabled:opacity-60 print:hidden"
    >
      {isPending ? <Loader2 className="size-3.5 animate-spin" /> : "Plus tard"}
    </button>
  );
}

export function PrintSheetButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex h-11 items-center gap-1.5 rounded-lg border border-[#E0DACF] bg-white px-3.5 text-[13px] font-medium text-[#1A1F2E] hover:bg-[#FAF5F0]"
    >
      <Printer className="size-4" /> Imprimer la feuille du jour
    </button>
  );
}

export function MarkAllInfosReadButton({ keys }: { keys: string[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={keys.length === 0 || isPending}
      onClick={() =>
        startTransition(async () => {
          await markInfosRead(keys);
          router.refresh();
        })
      }
      className="inline-flex h-11 items-center px-2 text-[13px] font-medium text-[#0C6B8A] hover:underline disabled:text-[#B4AEA3] disabled:no-underline"
    >
      Tout marquer comme lu
    </button>
  );
}
