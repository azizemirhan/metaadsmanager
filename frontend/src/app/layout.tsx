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
      <body className="antialiased">
        <Providers>
          <div className="flex min-h-screen bg-slate-50">
            <Sidebar />
            <main className="flex-1 p-8 overflow-y-auto">
              {children}
            </main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
