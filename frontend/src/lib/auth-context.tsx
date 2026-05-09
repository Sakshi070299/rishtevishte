'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import Cookies from 'js-cookie';
import type { User } from '@/types';

const TOKEN_KEY = 'rishtenate_token';
const REFRESH_KEY = 'rishtenate_refresh';
const USER_KEY = 'rishtenate_user';
const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1';

const isSecure = typeof window !== 'undefined' && window.location.protocol === 'https:';
const cookieOpts = { secure: isSecure, sameSite: 'strict' as const };

// Refresh 1 minute before 15-min token expiry
const REFRESH_INTERVAL_MS = 14 * 60 * 1000;

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  login: (token: string, refreshToken: string, user: User) => void;
  logout: () => void;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  token: null,
  isLoading: true,
  login: () => {},
  logout: () => {},
  isAuthenticated: false,
});

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const refreshTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Use refs to break stale closure cycle
  const refreshFnRef = useRef<() => Promise<void>>();

  const clearAll = useCallback(() => {
    Cookies.remove(TOKEN_KEY);
    Cookies.remove(REFRESH_KEY);
    localStorage.removeItem(USER_KEY);
    setToken(null);
    setUser(null);
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
  }, []);

  const scheduleRefresh = useCallback(() => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => {
      refreshFnRef.current?.();
    }, REFRESH_INTERVAL_MS);
  }, []);

  // ─── AUTO-REFRESH TOKEN ───────────────────────────
  const refreshAccessToken = useCallback(async () => {
    const refreshToken = Cookies.get(REFRESH_KEY);
    if (!refreshToken) {
      clearAll();
      return;
    }

    try {
      const response = await fetch(`${API_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!response.ok) {
        clearAll();
        return;
      }

      const data = await response.json();
      Cookies.set(TOKEN_KEY, data.accessToken, { ...cookieOpts, expires: 1 });
      Cookies.set(REFRESH_KEY, data.refreshToken, { ...cookieOpts, expires: 30 });
      setToken(data.accessToken);
      scheduleRefresh();
    } catch {
      clearAll();
    }
  }, [clearAll, scheduleRefresh]);

  // Keep ref in sync so scheduleRefresh's setTimeout always calls the latest version
  useEffect(() => {
    refreshFnRef.current = refreshAccessToken;
  }, [refreshAccessToken]);

  // ─── LOAD FROM STORAGE ON MOUNT ───────────────────
  useEffect(() => {
    const storedToken = Cookies.get(TOKEN_KEY);
    const storedUser = typeof window !== 'undefined' ? localStorage.getItem(USER_KEY) : null;

    if (storedToken && storedUser) {
      setToken(storedToken);
      setUser(JSON.parse(storedUser));
      scheduleRefresh();
    }
    setIsLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── LOGIN ────────────────────────────────────────
  const login = useCallback((accessToken: string, refreshToken: string, userData: User) => {
    Cookies.set(TOKEN_KEY, accessToken, { ...cookieOpts, expires: 1 });
    Cookies.set(REFRESH_KEY, refreshToken, { ...cookieOpts, expires: 30 });
    localStorage.setItem(USER_KEY, JSON.stringify(userData));
    setToken(accessToken);
    setUser(userData);
    scheduleRefresh();
  }, [scheduleRefresh]);

  // ─── LOGOUT ───────────────────────────────────────
  const logout = useCallback(async () => {
    // Revoke server session
    try {
      const t = Cookies.get(TOKEN_KEY);
      if (t) {
        await fetch(`${API_URL}/auth/logout`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${t}` },
        });
      }
    } catch {
      // ignore — still clear local state
    }
    clearAll();
  }, [clearAll]);

  return (
    <AuthContext.Provider value={{
      user,
      token,
      isLoading,
      login,
      logout,
      isAuthenticated: !!token && !!user,
    }}>
      {children}
    </AuthContext.Provider>
  );
}
