import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Courtside — Your NBA, in focus",
  description: "A personalized NBA companion for the teams and players you follow.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
