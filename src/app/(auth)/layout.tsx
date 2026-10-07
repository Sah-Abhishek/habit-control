import { redirect } from "next/navigation";
import { getCurrentUser } from "@/server/auth/session";

export default async function AuthLayout({ children }: LayoutProps<"/">) {
  if (await getCurrentUser()) redirect("/");
  return (
    <main className="grid min-h-dvh place-items-center px-4 py-10">
      <div className="w-full max-w-[420px]">
        <div className="mb-8 flex items-center gap-2.5">
          <span className="grid size-9 place-items-center rounded-[11px] bg-inverse font-serif text-[24px] leading-none text-inverse-ink">a</span>
          <span className="font-serif text-[28px] leading-none">Almanac</span>
        </div>
        {children}
      </div>
    </main>
  );
}
