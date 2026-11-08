import type { Metadata } from "next";
import { BottomNav } from "@/components/layout/BottomNav";
import { GlobalFooter } from "@/components/layout/GlobalFooter";
import { LanguageProvider } from "@/components/site/LanguageProvider";
import { ScrollProgress } from "@/components/site/ScrollProgress";
import { getDictionary } from "@/i18n/getDictionary";
import "./globals.css";

export const metadata: Metadata = {
  title: getDictionary("it").meta.title,
  description: getDictionary("it").meta.description,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="it"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">
        <LanguageProvider>
          <ScrollProgress />
          <div className="pb-16 md:pb-0">
            {children}
          </div>
          <GlobalFooter />
          <BottomNav />
        </LanguageProvider>
      </body>
    </html>
  );
}
