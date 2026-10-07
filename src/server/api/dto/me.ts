import "server-only";
import type { Settings } from "@/server/services/settings";

export function settingsDto(s: Settings) {
  return {
    timezone: s.timezone,
    theme: s.theme,
    weekStartsOn: s.weekStartsOn,
    dailyStudyTargetMin: s.dailyStudyTargetMin,
    revisionScheduleDays: s.revisionScheduleDays,
    quietMode: s.quietMode,
    onboarded: s.onboardedAt != null,
  };
}
