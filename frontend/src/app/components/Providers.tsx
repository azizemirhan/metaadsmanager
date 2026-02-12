"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { AccountProvider } from "./AccountContext";

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: { staleTime: 5 * 60 * 1000, retry: 1 }
    }
  }));
  return (
    <QueryClientProvider client={queryClient}>
      <AccountProvider>
        {children}
      </AccountProvider>
    </QueryClientProvider>
  );
}
