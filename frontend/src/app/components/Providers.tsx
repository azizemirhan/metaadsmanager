"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createContext, useContext, useState, useEffect, useCallback } from "react";
import { api } from "../lib/api";
import { setStoredToken, getStoredToken } from "../lib/api";
import type { AuthUser } from "../lib/api";
import { ThemeProvider } from "./ThemeProvider";

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

type AuthContextType = {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string, role?: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => {},
  register: async () => {},
  logout: () => {},
});

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within Providers");
  return ctx;
}

function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const login = useCallback(async (email: string, password: string) => {
    const res = await api.authLogin(email, password);
    setStoredToken(res.access_token);
    setUser(res.user);
  }, []);

  const register = useCallback(async (email: string, username: string, password: string, role?: string) => {
    const res = await api.authRegister(email, username, password, role);
    setStoredToken(res.access_token);
    setUser(res.user);
  }, []);

  const logout = useCallback(() => {
    setStoredToken(null);
    setUser(null);
    if (typeof window !== "undefined") window.location.href = "/login";
  }, []);

  useEffect(() => {
    const token = getStoredToken();
    if (!token) {
      setLoading(false);
      return;
    }
    api
      .authMe()
      .then((u) => setUser(u))
      .catch(() => {
        setStoredToken(null);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

function AccountProviderInner({ children }: { children: React.ReactNode }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [accountId, setAccountIdState] = useState<string | null>(null);
  const { user } = useAuth();

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
    if (user) refetchAccounts();
    else {
      setAccounts([]);
      setAccountIdState(null);
    }
  }, [user, refetchAccounts]);

  return (
    <AccountContext.Provider value={{ accountId, setAccountId, accounts, refetchAccounts }}>
      {children}
    </AccountContext.Provider>
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient({
    defaultOptions: {
      queries: { staleTime: 5 * 60 * 1000, retry: 1 }
    }
  }));

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <AuthProvider>
          <AccountProviderInner>
            {children}
          </AccountProviderInner>
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
