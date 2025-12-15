"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3000";

interface User {
  id: string;
  email?: string;
  name?: string;
  picture?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  accessToken: string | null;
  login: () => void;
  logout: () => Promise<void>;
  refreshToken: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    initializeAuth();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const initializeAuth = async () => {
    try {
      const url = new URL(window.location.href);
      const tokenFromUrl = url.searchParams.get("token");

      if (tokenFromUrl) {
        // 1. Store token / user
        await handleNewToken(tokenFromUrl);

        // 2. Work out where to go next
        const redirectPath = localStorage.getItem("redirectAfterLogin") || "/";
        localStorage.removeItem("redirectAfterLogin");

        // 3. Redirect away from /auth/success (or wherever we are)
        window.location.replace(redirectPath);
        return; // important: stop further init
      }

      // No token in URL → try existing token from localStorage
      const savedToken = localStorage.getItem("accessToken");
      if (savedToken) {
        await validateToken(savedToken);
      }
    } catch (error) {
      console.error("Auth initialization error:", error);
      clearAuth();
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewToken = async (token: string) => {
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      setAccessToken(token);
      setIsAuthenticated(true);
      setUser({
        id: payload.sub,
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
      });
      localStorage.setItem("accessToken", token);
    } catch (e) {
      console.error("Error decoding token", e);
      clearAuth();
    }
  };

  const validateToken = async (token: string) => {
    try {
      const res = await fetch(`${BACKEND_URL}/auth/ynab/status`, {
        headers: { Authorization: `Bearer ${token}` },
        credentials: "include",
      });

      if (res.ok) {
        await handleNewToken(token);
      } else if (res.status === 401) {
        const refreshed = await refreshToken();
        if (!refreshed) clearAuth();
      } else {
        clearAuth();
      }
    } catch (e) {
      console.error("Token validation error", e);
      clearAuth();
    }
  };

  const login = () => {
    // remember where to go back after login
    if (typeof window !== "undefined") {
      localStorage.setItem(
        "redirectAfterLogin",
        window.location.pathname || "/"
      );
      window.location.href = `${BACKEND_URL}/auth/google`;
    }
  };

  const logout = async () => {
    try {
      await fetch(`${BACKEND_URL}/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch (e) {
      console.error("Logout error", e);
    } finally {
      clearAuth();
      if (typeof window !== "undefined") {
        window.location.href = "/login";
      }
    }
  };

  const refreshToken = async (): Promise<boolean> => {
    try {
      const res = await fetch(`${BACKEND_URL}/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });

      if (!res.ok) return false;

      const data = await res.json();
      if (!data.accessToken) return false;

      await handleNewToken(data.accessToken);
      return true;
    } catch (e) {
      console.error("Refresh error", e);
      clearAuth();
      return false;
    }
  };

  const clearAuth = () => {
    setAccessToken(null);
    setIsAuthenticated(false);
    setUser(null);
    if (typeof window !== "undefined") {
      localStorage.removeItem("accessToken");
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated,
        isLoading,
        accessToken,
        login,
        logout,
        refreshToken,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
