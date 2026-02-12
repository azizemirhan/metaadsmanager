"use client";
import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { api } from "../lib/api";

export interface AdAccount {
  id: string;
  name: string;
  status: number;
  currency: string;
  timezone: string;
}

interface AccountContextType {
  accounts: AdAccount[];
  selectedAccountId: string | null;
  setSelectedAccountId: (id: string | null) => void;
  loading: boolean;
}

const AccountContext = createContext<AccountContextType>({
  accounts: [],
  selectedAccountId: null,
  setSelectedAccountId: () => {},
  loading: false,
});

export function AccountProvider({ children }: { children: ReactNode }) {
  const [accounts, setAccounts] = useState<AdAccount[]>([]);
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getAccounts()
      .then((res) => {
        setAccounts(res.data || []);
      })
      .catch(() => {
        // Accounts fetch failed - not critical, default account from env is used
        setAccounts([]);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <AccountContext.Provider value={{ accounts, selectedAccountId, setSelectedAccountId, loading }}>
      {children}
    </AccountContext.Provider>
  );
}

export function useAccount() {
  return useContext(AccountContext);
}
