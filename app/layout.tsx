import "@neondatabase/auth-ui/css";
import "./globals.css";
import "./additions.css";
import type { Metadata } from "next";
import { Providers } from "./providers";

export const metadata: Metadata = {
  title: "LeetSolve — Daily AI Solver",
  description: "A multi-user web application that prepares and tracks one coding solution every day.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body><Providers>{children}</Providers></body>
    </html>
  );
}
