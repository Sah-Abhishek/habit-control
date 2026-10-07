"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "@/components/ui/icon";

const ITEMS: Array<{ href: string; label: string; icon: IconName }> = [
  { href: "/", label: "Today", icon: "today" },
  { href: "/goals", label: "Goals", icon: "flag" },
  { href: "/study", label: "Study", icon: "book" },
  { href: "/habits", label: "Habits", icon: "habits" },
  { href: "/tasks", label: "Tasks", icon: "check" },
  { href: "/insights", label: "Insights", icon: "insights" },
  { href: "/calendar", label: "Calendar", icon: "calendar" },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <ul className="flex flex-col gap-1">
      {ITEMS.map((item) => {
        const active = isActive(pathname, item.href);
        return (
          <li key={item.href}>
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14.5px] transition-colors",
                active ? "bg-moss-soft font-semibold text-moss" : "font-medium text-muted hover:bg-sunken hover:text-ink",
              )}
            >
              <Icon name={item.icon} size={20} />
              {item.label}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function Brand() {
  return (
    <Link href="/" className="flex items-center gap-2.5 px-2.5">
      <span className="grid size-8 place-items-center rounded-[10px] bg-inverse font-serif text-[22px] leading-none text-inverse-ink">a</span>
      <span className="font-serif text-[26px] leading-none">Almanac</span>
    </Link>
  );
}

function Footer({ email }: { email: string }) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const pathname = usePathname();
  return (
    <div className="flex flex-col gap-1 border-t border-hair pt-3">
      <Link
        href="/settings"
        aria-current={pathname === "/settings" ? "page" : undefined}
        className={cn("flex items-center gap-3 rounded-xl px-3 py-2 text-[14px]", pathname === "/settings" ? "bg-moss-soft font-semibold text-moss" : "font-medium text-muted hover:bg-sunken hover:text-ink")}
      >
        <Icon name="settings" size={18} /> Settings
      </Link>
      <button
        type="button"
        disabled={pending}
        onClick={async () => {
          setPending(true);
          await authClient.signOut();
          router.replace("/sign-in");
          router.refresh();
        }}
        className="flex items-center gap-3 rounded-xl px-3 py-2 text-left text-[14px] font-medium text-muted hover:bg-sunken hover:text-ink disabled:opacity-50"
      >
        <Icon name="logout" size={18} /> {pending ? "Signing out…" : "Sign out"}
      </button>
      <p className="truncate px-3 pt-1 text-[12px] text-faint" title={email}>
        {email}
      </p>
    </div>
  );
}

export function Sidebar({ email }: { email: string }) {
  return (
    <nav aria-label="Main" className="sticky top-0 hidden h-dvh w-[248px] shrink-0 flex-col gap-6 border-r border-hair bg-card px-4 pt-7 pb-5 lg:flex">
      <Brand />
      <div className="flex-1 overflow-y-auto">
        <NavLinks />
      </div>
      <Footer email={email} />
    </nav>
  );
}

/** Top bar + slide-down menu for tablet and phone widths. */
export function MobileNav({ email }: { email: string }) {
  // Links close the menu via onNavigate, so no effect on route change is needed.
  const [open, setOpen] = useState(false);
  return (
    <div className="sticky top-0 z-30 border-b border-hair bg-card/95 backdrop-blur lg:hidden">
      <div className="flex h-14 items-center justify-between px-4">
        <Brand />
        <button type="button" aria-expanded={open} aria-controls="mobile-menu" aria-label={open ? "Close menu" : "Open menu"} onClick={() => setOpen((o) => !o)} className="rounded-xl p-2 hover:bg-sunken">
          <Icon name={open ? "x" : "menu"} size={22} />
        </button>
      </div>
      {open ? (
        <nav id="mobile-menu" aria-label="Main" className="flex flex-col gap-3 px-4 pb-4">
          <NavLinks onNavigate={() => setOpen(false)} />
          <Footer email={email} />
        </nav>
      ) : null}
    </div>
  );
}
