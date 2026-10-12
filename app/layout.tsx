import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "LeetSolve — Daily AI Solver",
  description: "A web application that automatically prepares, verifies, and stores one coding solution every day.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
