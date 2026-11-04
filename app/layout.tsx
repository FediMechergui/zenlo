import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Zenlo · Votre agence, en mouvement",
  description: "Le quotidien de votre agence de location automobile : planning, parc, contrats et encaissements. Conçu pour la Tunisie.",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr">
      <body className="antialiased">{children}</body>
    </html>
  );
}
