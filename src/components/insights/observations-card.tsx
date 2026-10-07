import { Icon } from "@/components/ui/icon";
import { MIN_PAIRED_DAYS, STRONG_PAIRED_DAYS, type Observation } from "@/domain/insights";

export function ObservationsCard({ items, windowDays }: { items: Observation[]; windowDays: number }) {
  return (
    <section aria-labelledby="obs-title" className="flex flex-col gap-3 rounded-[22px] bg-dusk-soft p-5">
      <h2 id="obs-title" className="flex items-center gap-2 font-mono text-[10.5px] font-medium tracking-[0.08em] text-dusk uppercase">
        <Icon name="spark" size={16} /> Observations · not causes
      </h2>
      {items.length ? (
        <ul className="flex flex-col gap-3">
          {items.map((o) => (
            <li key={o.id}>
              <p className="font-serif text-[18px] leading-[1.3]">{o.text}</p>
              <p className="mt-0.5 text-[11.5px] text-muted">
                Based on {o.n} days · {o.strength === "early" ? "early signal" : "a pattern, not a cause"}
              </p>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[13.5px] leading-5 text-muted">
          Nothing to report yet. Observations appear once there are at least {MIN_PAIRED_DAYS} days in the last {windowDays} with both things logged — for example sleep and session focus, or energy and study time.
        </p>
      )}
      <p className="text-[11.5px] leading-4 text-muted">
        Patterns need {STRONG_PAIRED_DAYS}+ days; fewer are labelled “early signal”. These are correlations in your own logs, not medical advice.
      </p>
    </section>
  );
}
