// app/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../lib/auth-context";
import { useAPI } from "../lib/use-api";

interface YnabStatus {
  isAuthenticated: boolean;
  ynabUserId?: string;
}

interface MonzoStatus {
  isAuthenticated: boolean;
}

export default function HomePage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, logout } = useAuth();
  const api = useAPI();

  const [ynabStatus, setYnabStatus] = useState<YnabStatus | null>(null);
  const [monzoStatus, setMonzoStatus] = useState<MonzoStatus | null>(null);
  const [loading, setLoading] = useState(true);

  // Redirect unauthenticated → /login
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isAuthenticated, isLoading, router]);

  const loadStatuses = async () => {
    if (!isAuthenticated) return;
    try {
      setLoading(true);
      const [ynab, monzo] = await Promise.all([
        await api.getYnabStatus(),
        await api.getMonzoStatus(),
      ]);
      console.log(monzo, ynab);
      setYnabStatus(ynab);
      setMonzoStatus({ isAuthenticated: monzo.connected });
    } catch (e) {
      console.error("Failed to load statuses", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      void loadStatuses();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  // ✅ Your guide: pass user.id as state to /auth/ynab/auth-url
  const connectYnab = async () => {
    try {
      if (!user) {
        console.error("No user in auth context; cannot start YNAB OAuth");
        return;
      }

      // Backend expects state to be the numeric user ID
      const { authUrl } = await api.getYnabAuthUrl(String(user.id));
      window.location.href = authUrl;
    } catch (e) {
      console.error("Failed to get YNAB auth URL", e);
    }
  };

  const disconnectYnab = async () => {
    try {
      await api.disconnectYnab();
      await loadStatuses();
    } catch (e) {
      console.error("Failed to disconnect YNAB", e);
    }
  };

  const connectMonzo = async () => {
    try {
      const { authUrl } = await api.getMonzoAuthUrl();
      window.location.href = authUrl;
    } catch (e) {
      console.error("Failed to get Monzo auth URL", e);
    }
  };

  const disconnectMonzo = async () => {
    try {
      await api.revokeMonzo();
      await loadStatuses();
    } catch (e) {
      console.error("Failed to revoke Monzo access", e);
    }
  };

  if (isLoading || !isAuthenticated) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Nav */}
      <nav className="bg-white shadow-md border-b">
        <div className="max-w-4xl mx-auto px-4 flex justify-between items-center h-16">
          <span className="font-semibold text-gray-900">Assets Sync</span>
          <div className="flex items-center gap-3">
            {user && (
              <div className="flex items-center gap-2">
                {user.picture && (
                  <img
                    src={user.picture}
                    alt="avatar"
                    className="w-8 h-8 rounded-full"
                  />
                )}
                <span className="text-sm text-gray-700">
                  {user.name || user.email}
                </span>
              </div>
            )}
            <button
              onClick={logout}
              className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm"
            >
              Logout
            </button>
          </div>
        </div>
      </nav>

      {/* Main */}
      <main className="max-w-4xl mx-auto py-8 px-4">
        <h1 className="text-2xl font-bold mb-6">Integrations</h1>

        {loading && (
          <div className="mb-6 text-gray-600">Loading integration status…</div>
        )}

        <div className="grid gap-6 md:grid-cols-2">
          {/* YNAB card */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-2">YNAB</h2>
            <p className="text-sm text-gray-600 mb-4">
              Connect your YNAB account to sync budgets and accounts.
            </p>
            <div className="mb-4">
              <span className="text-sm font-medium">Status: </span>
              <span
                className={
                  ynabStatus?.isAuthenticated
                    ? "text-green-600"
                    : "text-red-600"
                }
              >
                {ynabStatus?.isAuthenticated ? "Connected" : "Not connected"}
              </span>
              {ynabStatus?.ynabUserId && (
                <p className="text-xs text-gray-500 mt-1">
                  YNAB User ID: {ynabStatus.ynabUserId}
                </p>
              )}
            </div>

            {!ynabStatus?.isAuthenticated ? (
              <button
                onClick={connectYnab}
                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm"
              >
                Connect YNAB
              </button>
            ) : (
              <button
                onClick={disconnectYnab}
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded text-sm"
              >
                Disconnect YNAB
              </button>
            )}
          </div>

          {/* Monzo card */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-semibold mb-2">Monzo</h2>
            <p className="text-sm text-gray-600 mb-4">
              Connect your Monzo account to sync balances and transactions.
            </p>
            <div className="mb-4">
              <span className="text-sm font-medium">Status: </span>
              <span
                className={
                  monzoStatus?.isAuthenticated
                    ? "text-green-600"
                    : "text-red-600"
                }
              >
                {monzoStatus?.isAuthenticated ? "Connected" : "Not connected"}
              </span>
            </div>

            {!monzoStatus?.isAuthenticated ? (
              <button
                onClick={connectMonzo}
                className="bg-orange-500 hover:bg-orange-600 text-white px-4 py-2 rounded text-sm"
              >
                Connect Monzo
              </button>
            ) : (
              <button
                onClick={disconnectMonzo}
                className="bg-gray-200 hover:bg-gray-300 text-gray-800 px-4 py-2 rounded text-sm"
              >
                Disconnect Monzo
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
