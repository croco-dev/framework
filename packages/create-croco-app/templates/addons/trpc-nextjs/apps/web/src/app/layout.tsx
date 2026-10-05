import type { ReactNode } from "react";
import "./product.css";

export const metadata = {
  title: "Launch Studio — local product example",
  description: "Create a private launch brief from your product idea.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header>
          <a href="/products/launch-brief">Launch Studio</a>
          <span>LOCAL EXAMPLE · SYNTHETIC PRODUCT</span>
        </header>
        {children}
        <footer>
          Node + Next.js SSR · tRPC + TanStack Query · local SQLite
          <br />
          Local only; production authentication and multi-process operation unsupported.
          <br />
          No real payment, warehouse add-on, Croco Flight, or provider certification claimed.
        </footer>
      </body>
    </html>
  );
}
