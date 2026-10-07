import type { Metadata, Viewport } from "next";
import { Instrument_Sans, Instrument_Serif, JetBrains_Mono } from "next/font/google";
import { getCurrentUser } from "@/server/auth/session";
import { getSettings } from "@/server/services/settings";
import "./globals.css";

const serif = Instrument_Serif({ variable: "--font-instrument-serif", subsets: ["latin"], weight: "400", style: ["normal", "italic"] });
const sans = Instrument_Sans({ variable: "--font-instrument-sans", subsets: ["latin"] });
const mono = JetBrains_Mono({ variable: "--font-jetbrains-mono", subsets: ["latin"], weight: ["400", "500"] });

export const metadata: Metadata = {
  title: { default: "Almanac", template: "%s · Almanac" },
  description: "A calm place to plan goals, track study and habits, and see what’s working.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3f0e8" },
    { media: "(prefers-color-scheme: dark)", color: "#121311" },
  ],
};

async function resolveTheme(): Promise<"system" | "light" | "dark"> {
  const user = await getCurrentUser();
  if (!user) return "system";
  return (await getSettings(user.id)).theme;
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // Resolved on the server so the saved theme paints on first frame (no flash).
  const theme = await resolveTheme();
  return (
    <html lang="en" data-theme={theme} className={`${serif.variable} ${sans.variable} ${mono.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
