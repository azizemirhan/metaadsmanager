import type { Metadata } from "next";
import "./globals.css";
import { Sidebar } from "./components/Sidebar";
import { Providers } from "./components/Providers";

export const metadata: Metadata = {
  title: "Meta Ads Dashboard",
  description: "Meta Ads performans takibi, analizi ve AI önerileri",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="tr">
      <body>
        <Providers>
          <div style={{ display: "flex", minHeight: "100vh" }}>
            <Sidebar />
            <main style={{ flex: 1, padding: "32px", overflowY: "auto" }}>
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
