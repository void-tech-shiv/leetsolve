import "./globals.css";
import "./additions.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "LeetSolve — Daily AI Solver",
  description: "A multi-user web application that prepares and tracks one coding solution every day.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
