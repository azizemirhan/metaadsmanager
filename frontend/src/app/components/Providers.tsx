"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { api } from "../lib/api";

type Account = { id: string; name: string };
type AccountContextType = {
  accountId: string | null;
  setAccountId: (id: string | null) => void;
  accounts: Account[];
  refetchAccounts: () => void;
};

const AccountContext = createContext<AccountContextType>({
  accountId: null,
  setAccountId: () => {},
  accounts: [],
  refetchAccounts: () => {},
});

export function useAccount() {
  const ctx = useContext(AccountContext);
  if (!ctx) throw new Error("useAccount must be used within Providers");
  return ctx;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: { staleTime: 5 * 60 * 1000, retry: 1 }
    }
  }));
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountIdState] = useState<string | null>(null);

  const setAccountId = useCallback((id: string | null) => {
    setAccountIdState(id);
    if (typeof window !== "undefined") {
      if (id) localStorage.setItem("meta_ads_account_id", id);
      else localStorage.removeItem("meta_ads_account_id");
    }
  }, []);

  const refetchAccounts = useCallback(async () => {
    try {
      const { data } = await api.getAccounts();
      setAccounts(data || []);
      if ((data?.length ?? 0) > 0) {
        const stored = typeof window !== "undefined" ? localStorage.getItem("meta_ads_account_id") : null;
        const valid = stored && data.some((a: Account) => a.id === stored);
        if (valid && stored) setAccountIdState(stored);
        else setAccountId(data![0].id);
      } else setAccountIdState(null);
    } catch {
      setAccounts([]);
      setAccountIdState(null);
    }
  }, [setAccountId]);

  useEffect(() => {
    refetchAccounts();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <AccountContext.Provider value={{ accountId, setAccountId, accounts, refetchAccounts }}>
        {children}
      </AccountContext.Provider>
    </QueryClientProvider>
  );
}
