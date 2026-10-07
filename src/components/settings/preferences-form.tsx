"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { FormError, Segmented, SelectField, TextField } from "@/components/ui/field";
import { useToast } from "@/components/ui/toast";
import { updateSettingsAction } from "@/server/actions/settings";

type Prefs = { timezone: string; theme: "system" | "light" | "dark"; weekStartsOn: number; dailyStudyTargetMin: number; quietMode: boolean };

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export function PreferencesForm({ initial, timezones }: { initial: Prefs; timezones: string[] }) {
  const router = useRouter();
  const toast = useToast();
  const [v, setV] = useState(initial);
  const [hours, setHours] = useState(String(Math.floor(initial.dailyStudyTargetMin / 60)));
  const [minutes, setMinutes] = useState(String(initial.dailyStudyTargetMin % 60));
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string>();
  const [pending, startTransition] = useTransition();
  const browserTz = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : null;

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    const h = Number(hours || 0);
    const m = Number(minutes || 0);
    if (!Number.isInteger(h) || !Number.isInteger(m) || h < 0 || m < 0 || m > 59 || h > 24) {
      setErrors({ dailyStudyTargetMin: "Use whole hours (0–24) and minutes (0–59)." });
      return;
    }
    const payload = { ...v, dailyStudyTargetMin: h * 60 + m };
    startTransition(async () => {
      const res = await updateSettingsAction(payload);
      if (!res.ok) {
        setErrors(res.fieldErrors ?? {});
        setFormError(res.error);
        return;
      }
      setErrors({});
      setFormError(undefined);
      toast.success("Preferences saved");
      router.refresh();
    });
  }

  return (
    <form noValidate onSubmit={onSubmit} className="flex flex-col gap-5">
      <FormError message={formError} />
      <div className="flex flex-col gap-2">
        <SelectField label="Timezone" value={v.timezone} onChange={(e) => setV({ ...v, timezone: e.target.value })} hint="Decides when your day starts and ends. Past logs keep the day they were made." error={errors.timezone}>
          {timezones.map((tz) => (
            <option key={tz} value={tz}>
              {tz.replaceAll("_", " ")}
            </option>
          ))}
        </SelectField>
        {browserTz && browserTz !== v.timezone && timezones.includes(browserTz) ? (
          <button type="button" className="self-start text-[13px] font-semibold text-moss hover:underline" onClick={() => setV({ ...v, timezone: browserTz })}>
            Use this device’s timezone ({browserTz.replaceAll("_", " ")})
          </button>
        ) : null}
      </div>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-[13px] font-semibold">Appearance</legend>
        <Segmented
          name="theme"
          label="Appearance"
          value={v.theme}
          onChange={(theme) => setV({ ...v, theme })}
          options={[
            { value: "system", label: "Match device" },
            { value: "light", label: "Light" },
            { value: "dark", label: "Dark" },
          ]}
        />
      </fieldset>

      <SelectField label="Week starts on" value={String(v.weekStartsOn)} onChange={(e) => setV({ ...v, weekStartsOn: Number(e.target.value) })} error={errors.weekStartsOn}>
        {WEEKDAYS.map((d, i) => (
          <option key={d} value={i}>
            {d}
          </option>
        ))}
      </SelectField>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-[13px] font-semibold">Daily study target</legend>
        <div className="grid max-w-xs grid-cols-2 gap-3">
          <TextField label="Hours" type="number" inputMode="numeric" min={0} max={24} value={hours} onChange={(e) => setHours(e.target.value)} />
          <TextField label="Minutes" type="number" inputMode="numeric" min={0} max={59} value={minutes} onChange={(e) => setMinutes(e.target.value)} />
        </div>
        {errors.dailyStudyTargetMin ? <p className="text-[12.5px] text-clay">{errors.dailyStudyTargetMin}</p> : <p className="text-[12px] text-faint">Used for Today’s progress and weekly targets. Set 0 to hide targets.</p>}
      </fieldset>

      <label className="flex items-start gap-3 rounded-xl bg-sunken p-3.5">
        <input type="checkbox" className="mt-0.5 size-4 accent-[var(--moss)]" checked={v.quietMode} onChange={(e) => setV({ ...v, quietMode: e.target.checked })} />
        <span className="text-[13.5px]">
          <span className="font-semibold">Quiet mode</span>
          <span className="block text-muted">Reminders are coming soon; quiet mode will apply to them when they arrive.</span>
        </span>
      </label>

      <div>
        <Button type="submit" size="sm" pending={pending}>
          Save preferences
        </Button>
      </div>
    </form>
  );
}
