import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RepoBricks",
  description: "Turn a public GitHub repository into an explorable brick architecture map."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
