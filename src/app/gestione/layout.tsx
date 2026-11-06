import type { Metadata, Viewport } from "next";

// Font: quelli già caricati dal layout radice (D12). Titoli con `font-serif`
// (Cormorant Garamond), testo con `font-sans` (DM Sans).

export const metadata: Metadata = {
  title: "Gestionale workshop",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: { index: false, follow: false },
  },
};

export const viewport: Viewport = {
  themeColor: "#f2ede3",
};

export default function GestioneRootLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-[calc(100dvh-4rem)] bg-[#f2ede3] font-sans text-[#211815] md:min-h-dvh">
      {children}
    </div>
  );
}
