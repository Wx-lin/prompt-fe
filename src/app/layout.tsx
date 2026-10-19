import type { ReactNode } from "react";
import { getLocale } from "next-intl/server";
import { ThemeProvider } from "@/components/theme-provider/theme-provider";
import { getThemeBootstrapScript } from "@/lib/theme/theme";
import { VisitTracker } from "@/components/visit-tracker/visit-tracker";
import "./globals.css";

/**
 * Only the [locale] segment renders page content, but Next.js requires exactly
 * one <html>/<body> for the whole app, so this shell stays at the true root and
 * reads the active locale (set by proxy.ts) to label the document correctly.
 */
export default async function RootLayout({ children }: Readonly<{ children: ReactNode }>) {
  const locale = await getLocale();

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: getThemeBootstrapScript() }} />
      </head>
      <body>
        <ThemeProvider>{children}<VisitTracker /></ThemeProvider>
      </body>
    </html>
  );
}
