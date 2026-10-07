"use client";

import { useRouter } from "next/navigation";
import { useOptimistic, useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { FormError, TextArea } from "@/components/ui/field";
import { Icon, type IconName } from "@/components/ui/icon";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/cn";
import { clearSleepAction, saveCheckInAction, saveSleepAction } from "@/server/actions/days";

export type CheckInValues = {
  mood: number | null;
  energy: number | null;
  stress: number | null;
  note: string | null;
  /** "HH:mm" in the user's timezone */
  bed: string | null;
  wake: string | null;
  sleepQuality: number | null;
  sleepMinutes: number | null;
};

type ScaleKey = "mood" | "energy" | "stress";

/** One-tap 1–10 scale. Tapping the selected value again clears it. */
function Scale({ name, label, icon, tone, value, date, disabled }: { name: ScaleKey; label: string; icon: IconName; tone: string; value: number | null; date?: string; disabled?: boolean }) {
  const toast = useToast();
  const router = useRouter();
  const [optimistic, setOptimistic] = useOptimistic(value);
  const [pending, startTransition] = useTransition();

  function pick(n: number) {
    const next = optimistic === n ? null : n;
    startTransition(async () => {
      setOptimistic(next);
      const res = await saveCheckInAction({ date, [name]: next });
      if (!res.ok) return toast.error(res.error);
      toast.success(next == null ? `${label} cleared` : `${label} ${next}/10 saved`, async () => {
        const undo = await saveCheckInAction({ date, [name]: value });
        if (!undo.ok) toast.error(undo.error);
        router.refresh();
      });
      router.refresh();
    });
  }

  return (
    <fieldset className="flex flex-col gap-2" disabled={disabled || pending}>
      <legend className="mb-2 flex items-center gap-1.5 text-[13px] font-semibold">
        <Icon name={icon} size={14} className={tone} /> {label}
        <span className="font-normal text-faint">{optimistic == null ? "· not yet" : `· ${optimistic}/10`}</span>
      </legend>
      <div className="grid grid-cols-10 gap-1">
        {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={optimistic === n}
            aria-label={`${label} ${n} of 10`}
            onClick={() => pick(n)}
            className={cn(
              "h-8 rounded-lg font-mono text-[11px] transition-colors disabled:opacity-60",
              optimistic === n ? "bg-inverse text-inverse-ink" : "bg-sunken text-muted hover:bg-line/50 hover:text-ink",
            )}
          >
            {n}
          </button>
        ))}
      </div>
    </fieldset>
  );
}

function fmtMinutes(m: number) {
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, "0")}m`;
}

function SleepForm({ initial, date }: { initial: CheckInValues; date?: string }) {
  const toast = useToast();
  const router = useRouter();
  const [editing, setEditing] = useState(initial.bed == null);
  const [bed, setBed] = useState(initial.bed ?? "23:30");
  const [wake, setWake] = useState(initial.wake ?? "07:00");
  const [quality, setQuality] = useState<string>(initial.sleepQuality?.toString() ?? "");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [pending, startTransition] = useTransition();

  if (!editing && initial.sleepMinutes != null) {
    return (
      <div className="flex items-center gap-3 rounded-xl bg-dusk-soft px-3.5 py-3">
        <Icon name="moon" size={16} className="text-dusk" />
        <p className="flex-1 text-[13.5px]">
          <span className="font-mono font-medium">{fmtMinutes(initial.sleepMinutes)}</span>
          <span className="text-muted">
            {" "}
            · {initial.bed}–{initial.wake}
            {initial.sleepQuality ? ` · quality ${initial.sleepQuality}/10` : ""}
          </span>
        </p>
        <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
          Edit
        </Button>
      </div>
    );
  }

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (pending) return;
    const q = quality.trim() === "" ? null : Number(quality);
    if (q != null && (!Number.isInteger(q) || q < 1 || q > 10)) return setErrors({ quality: "Use a whole number 1–10" });
    startTransition(async () => {
      const res = await saveSleepAction({ date, bed, wake, quality: q });
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        setFormError(res.error);
        return;
      }
      setErrors({});
      setFormError(undefined);
      setEditing(false);
      toast.success("Sleep saved");
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-2.5">
      <p className="flex items-center gap-1.5 text-[13px] font-semibold">
        <Icon name="moon" size={14} className="text-dusk" /> Last night’s sleep
      </p>
      <FormError message={formError} />
      <div className="grid grid-cols-3 gap-2">
        <label className="flex flex-col gap-1 text-[12px] text-muted">
          Bed time
          <input type="time" required value={bed} onChange={(e) => setBed(e.target.value)} aria-invalid={!!errors.bed || undefined} className={cn("rounded-xl border bg-card px-2.5 py-2 font-mono text-[14px] text-ink", errors.bed ? "border-clay" : "border-line")} />
        </label>
        <label className="flex flex-col gap-1 text-[12px] text-muted">
          Woke up
          <input type="time" required value={wake} onChange={(e) => setWake(e.target.value)} aria-invalid={!!errors.wake || undefined} className={cn("rounded-xl border bg-card px-2.5 py-2 font-mono text-[14px] text-ink", errors.wake ? "border-clay" : "border-line")} />
        </label>
        <label className="flex flex-col gap-1 text-[12px] text-muted">
          Quality 1–10
          <input inputMode="numeric" placeholder="—" value={quality} onChange={(e) => setQuality(e.target.value)} aria-invalid={!!errors.quality || undefined} className={cn("rounded-xl border bg-card px-2.5 py-2 font-mono text-[14px] text-ink", errors.quality ? "border-clay" : "border-line")} />
        </label>
      </div>
      {errors.bed || errors.wake || errors.quality ? <p className="text-[12.5px] text-clay">{errors.bed ?? errors.wake ?? errors.quality}</p> : <p className="text-[11.5px] text-faint">A bed time after the wake time means the evening before.</p>}
      <div className="flex gap-2">
        <Button type="submit" size="sm" pending={pending}>
          Save sleep
        </Button>
        {initial.sleepMinutes != null ? (
          <>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() =>
                startTransition(async () => {
                  const res = await clearSleepAction({ date });
                  if (!res.ok) return toast.error(res.error);
                  toast.success("Sleep entry removed");
                  router.refresh();
                })
              }
            >
              Remove
            </Button>
          </>
        ) : null}
      </div>
    </form>
  );
}

function NoteForm({ initial, date }: { initial: string | null; date?: string }) {
  const toast = useToast();
  const router = useRouter();
  const [note, setNote] = useState(initial ?? "");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string>();
  const dirty = note.trim() !== (initial ?? "").trim();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const res = await saveCheckInAction({ date, note: note.trim() || null });
          if (!res.ok) return setError(res.fieldErrors?.note ?? res.error);
          setError(undefined);
          toast.success("Note saved");
          router.refresh();
        });
      }}
      className="flex flex-col gap-2"
    >
      <TextArea label="Note" optional value={note} onChange={(e) => setNote(e.target.value)} maxLength={2000} placeholder="One line about today…" error={error} rows={2} />
      {dirty ? (
        <Button type="submit" size="sm" variant="secondary" pending={pending} className="self-start">
          Save note
        </Button>
      ) : null}
    </form>
  );
}

/** Mood / energy / stress, sleep and note for one day. Everything optional. */
export function CheckInCard({ values, date, title = "Quick check-in" }: { values: CheckInValues; date?: string; title?: string }) {
  return (
    <Card className="flex flex-col gap-4">
      <header className="flex items-center">
        <h2 className="font-serif text-2xl">{title}</h2>
        <span className="ml-auto text-[12px] text-faint">optional</span>
      </header>
      <Scale name="energy" label="Energy" icon="bolt" tone="text-ochre" value={values.energy} date={date} />
      <Scale name="mood" label="Mood" icon="smile" tone="text-dusk" value={values.mood} date={date} />
      <Scale name="stress" label="Stress" icon="alert" tone="text-clay" value={values.stress} date={date} />
      <SleepForm initial={values} date={date} key={`${values.bed}-${values.wake}-${values.sleepQuality}`} />
      <NoteForm initial={values.note} date={date} key={values.note ?? ""} />
    </Card>
  );
}
