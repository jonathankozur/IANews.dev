import type { Metadata } from "next";
import { Inter } from "next/font/google";
import Link from "next/link";

import Header from "@/components/Header";
import { Analytics } from "@vercel/analytics/next"
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Neutra - Auditoría Periodística",
  description: "Desenmascarando la manipulación de la información.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="antialiased">
      <head>
        {/* Google AdSense - verificación y monetización */}
        <script
          async
          src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=ca-pub-3506682127236704"
          crossOrigin="anonymous"
        />
      </head>
      <body className={inter.className}>
        <Header />

        <main className="pt-20 min-h-screen">
          {children}
        </main>

        <footer className="bg-slate-950 py-12 text-center text-slate-500 text-sm mt-20 flex flex-col items-center gap-4">
          <p>Potenciado por IA Local. Desenmascarando el sesgo periodístico.</p>
          <div className="flex gap-4">
            <Link href="/about" className="hover:text-slate-300 transition">Acerca</Link>
            <Link href="/privacy" className="hover:text-slate-300 transition">Políticas de Privacidad</Link>
          </div>
        </footer>
        <Analytics />
      </body>
    </html>
  );
}
