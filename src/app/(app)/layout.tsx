import { MobileNav, Sidebar } from "@/components/app/nav";
import { OfflineBanner } from "@/components/app/offline-banner";
import { ToastProvider } from "@/components/ui/toast";
import { requireUser } from "@/server/auth/session";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const user = await requireUser();
  return (
    <ToastProvider>
      <div className="flex min-h-dvh">
        <Sidebar email={user.email} />
        <div className="flex min-w-0 flex-1 flex-col">
          <MobileNav email={user.email} />
          <OfflineBanner />
          <main id="main" className="mx-auto w-full max-w-[1280px] flex-1 px-4 py-6 sm:px-8 lg:px-10 lg:py-8">
            {children}
          </main>
        </div>
      </div>
    </ToastProvider>
  );
}
