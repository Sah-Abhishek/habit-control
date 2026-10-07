import type { Metadata } from "next";
import type { ReactNode } from "react";
import { PageHeader } from "@/components/app/page-header";
import { DeleteAccount } from "@/components/settings/delete-account";
import { ExportPanel } from "@/components/settings/export-panel";
import { PasswordForm } from "@/components/settings/password-form";
import { PreferencesForm } from "@/components/settings/preferences-form";
import { ProfileForm } from "@/components/settings/profile-form";
import { RevisionScheduleForm } from "@/components/settings/revision-schedule-form";
import { Card } from "@/components/ui/card";
import { requireUser } from "@/server/auth/session";
import { getSettings } from "@/server/services/settings";

export const metadata: Metadata = { title: "Settings" };

function timezoneList(current: string): string[] {
  let zones: string[] = [];
  try {
    zones = Intl.supportedValuesOf("timeZone");
  } catch {
    zones = [];
  }
  return [...new Set(["UTC", current, ...zones])].sort();
}

function Section({ id, title, description, children, tone }: { id: string; title: string; description?: ReactNode; children: ReactNode; tone?: "danger" }) {
  return (
    <Card id={id} aria-labelledby={`${id}-title`} className={tone === "danger" ? "border border-clay/40" : undefined}>
      <div className="grid gap-5 md:grid-cols-[220px_1fr]">
        <div>
          <h2 id={`${id}-title`} className={`font-serif text-[24px] leading-tight ${tone === "danger" ? "text-clay" : ""}`}>
            {title}
          </h2>
          {description ? <p className="mt-1 text-[13px] leading-5 text-muted">{description}</p> : null}
        </div>
        <div className="min-w-0">{children}</div>
      </div>
    </Card>
  );
}

export default async function SettingsPage() {
  const user = await requireUser();
  const s = await getSettings(user.id);

  return (
    <div className="max-w-4xl">
      <PageHeader title="Settings" />
      <div className="flex flex-col gap-5">
        <Section id="profile" title="Profile">
          <ProfileForm name={user.name} email={user.email} />
        </Section>
        <Section id="preferences" title="Preferences" description="Timezone, appearance and targets.">
          <PreferencesForm
            timezones={timezoneList(s.timezone)}
            initial={{ timezone: s.timezone, theme: s.theme, weekStartsOn: s.weekStartsOn, dailyStudyTargetMin: s.dailyStudyTargetMin, quietMode: s.quietMode }}
          />
        </Section>
        <Section id="revisions" title="Revision schedule" description="When completed topics come back for review.">
          <RevisionScheduleForm initial={s.revisionScheduleDays} />
        </Section>
        <Section id="security" title="Password" description="Changing it signs you out everywhere else.">
          <PasswordForm />
        </Section>
        <Section id="export" title="Export your data" description="Download everything, any time. Files are generated on request and not kept.">
          <ExportPanel />
        </Section>
        <Section id="privacy" title="Privacy" description="What we keep, and why.">
          <ul className="flex list-disc flex-col gap-2 pl-5 text-[13.5px] leading-5 text-muted">
            <li>
              <span className="text-ink">What’s stored:</span> your name, email, a hashed password, and what you log — goals, tasks, study sessions, habits, sleep, mood, energy and notes.
            </li>
            <li>
              <span className="text-ink">Where:</span> in this app’s database, over encrypted connections. Your data is only ever read for your own account.
            </li>
            <li>
              <span className="text-ink">Never:</span> sold, shared with advertisers, or used to train models. There are no third-party trackers.
            </li>
            <li>
              <span className="text-ink">Sensitive habits</span> are left out of exports by default.
            </li>
            <li>
              <span className="text-ink">Your control:</span> export any time, and deleting your account removes everything immediately.
            </li>
          </ul>
        </Section>
        <Section id="danger" title="Delete account" tone="danger" description="Permanent. Export first if you want a copy.">
          <DeleteAccount email={user.email} />
        </Section>
      </div>
    </div>
  );
}
