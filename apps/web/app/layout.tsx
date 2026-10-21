import type { Metadata } from "next";
import { Archivo, Hanken_Grotesk } from "next/font/google";
import "./globals.css";

const archivo = Archivo({ variable: "--font-archivo", subsets: ["latin"] });
const hanken = Hanken_Grotesk({ variable: "--font-hanken", subsets: ["latin"] });

const description = "Diagnóstico de segurança para pequenas e médias empresas: nota de maturidade e checagem pública do site e do e-mail.";

export const metadata: Metadata = {
  title: "Sentinela — DataDops",
  description,
  openGraph: { title: "Sentinela — DataDops", description, locale: "pt_BR", type: "website", siteName: "Sentinela" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR" className={`${archivo.variable} ${hanken.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
