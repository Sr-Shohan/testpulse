import type { Metadata } from "next";
import { Outfit } from "next/font/google";
import Link from "next/link";
import { BookOpen } from "lucide-react";
import Navigation from "@/components/Navigation";
import ThemeToggle from "@/components/ThemeToggle";
import { ThemeProvider } from "@/components/ThemeProvider";
import "./globals.css";

const outfit = Outfit({ subsets: ["latin"], weight: ["300", "400", "500", "600", "700", "800"] });

export const metadata: Metadata = {
  title: "TestPulse | CI Test Intelligence",
  description: "Advanced QA monitoring and flaky test detection platform.",
  icons: {
    icon: "/icon.png",
    shortcut: "/favicon.ico",
  },
};

// Inline script that runs synchronously BEFORE the body is painted.
// Reads the stored theme (or system preference) and applies `.dark`
// to <html> so there's no flash of the wrong theme on first paint.
const themeInitScript = `
(function() {
  try {
    var stored = localStorage.getItem('testpulse-theme');
    var prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
    var theme = stored === 'light' || stored === 'dark'
      ? stored
      : (prefersDark ? 'dark' : 'dark'); // default to dark to match prior UX
    var root = document.documentElement;
    if (theme === 'dark') root.classList.add('dark');
    else root.classList.remove('dark');
    root.dataset.theme = theme;
    root.style.colorScheme = theme;
  } catch (e) {}
})();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body
        className={`${outfit.className} min-h-screen bg-slate-950 text-slate-50 transition-colors duration-200`}
      >
        <ThemeProvider>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            {/* Header */}
            <header className="mb-8 space-y-5">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-500 via-indigo-500 to-violet-500 dark:from-blue-400 dark:via-indigo-400 dark:to-violet-400">
                    TestPulse
                  </h1>
                  <p className="text-slate-500 mt-0.5 text-sm">
                    CI Build Monitoring • Flaky Test Detection
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <Link
                    href="/api-docs"
                    className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700/60 bg-slate-800/60 px-2.5 py-1 text-xs font-medium text-slate-300 transition-colors hover:border-slate-600 hover:bg-slate-800 hover:text-slate-50"
                  >
                    <BookOpen className="h-3.5 w-3.5" />
                    API Docs
                  </Link>
                  <div
                    className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]"
                    aria-hidden
                  />
                  <span className="text-xs text-slate-600">
                    demo · master
                  </span>
                  <ThemeToggle />
                </div>
              </div>
              <Navigation />
            </header>
            <main>{children}</main>
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
