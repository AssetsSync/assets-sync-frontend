// app/layout.tsx
import "./globals.css";
import { AuthProvider } from "../lib/auth-context";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Assets Sync",
  description: "Google OAuth + YNAB + Monzo",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
