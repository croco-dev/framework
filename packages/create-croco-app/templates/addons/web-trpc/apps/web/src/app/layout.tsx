import type { Metadata } from "next";
import { Providers } from "../lib/providers";
import "./globals.css";

export const metadata: Metadata = {
  title: "Web App",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
