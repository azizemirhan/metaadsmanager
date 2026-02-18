import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "./components/Providers";
import { LayoutGuard } from "./components/LayoutGuard";

export const metadata: Metadata = {
  title: "Meta Ads Dashboard",
  description: "Meta Ads performans takibi, analizi ve AI önerileri",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body className="antialiased">
        <Providers>
          <LayoutGuard>
            {children}
          </LayoutGuard>
        </Providers>
      </body>
    </html>
  );
}
