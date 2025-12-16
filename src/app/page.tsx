// app/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../lib/auth-context";
import { useAPI } from "../lib/use-api";
import type { ApiTokenDto } from "../lib/api-client"; // adjust import path

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

  // PAT state
  const [patTokens, setPatTokens] = useState<ApiTokenDto[]>([]);
  const [loadingTokens, setLoadingTokens] = useState(false);
  const [creatingToken, setCreatingToken] = useState(false);
  const [newTokenName, setNewTokenName] = useState("");
  const [newTokenPlain, setNewTokenPlain] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
        api.getYnabStatus(),
        api.getMonzoStatus(),
      ]);
      setYnabStatus(ynab);
      setMonzoStatus({ isAuthenticated: monzo.connected });
    } catch (e) {
      console.error("Failed to load statuses", e);
    } finally {
      setLoading(false);
    }
  };

  const loadTokens = async () => {
    if (!isAuthenticated) return;
    try {
      setLoadingTokens(true);
      setError(null);
      const tokens = await api.getApiTokens();
      setPatTokens(tokens);
    } catch (e) {
      console.error("Failed to load API tokens", e);
      setError("Failed to load API tokens");
    } finally {
      setLoadingTokens(false);
    }
  };

  useEffect(() => {
    if (isAuthenticated) {
      void loadStatuses();
      void loadTokens();
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

  const handleCreateToken = async () => {
    if (!newTokenName.trim()) return;
    try {
      setCreatingToken(true);
      setNewTokenPlain(null);
      setError(null);

      const result = await api.createApiToken(newTokenName.trim());
      // result: { id, token, name, createdAt }
      setNewTokenPlain(result.token);
      setNewTokenName("");
      await loadTokens();
    } catch (e) {
      console.error("Failed to create API token", e);
      setError("Failed to create API token");
    } finally {
      setCreatingToken(false);
    }
  };

  const handleDeleteToken = async (id: number) => {
    try {
      await api.deleteApiToken(id);
      await loadTokens();
    } catch (e) {
      console.error("Failed to delete API token", e);
      setError("Failed to delete API token");
    }
  };

  const formatDate = (value: string | null) => {
    if (!value) return "—";
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleString();
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
      <main className="max-w-4xl mx-auto py-8 px-4 space-y-8">
        <section>
          <h1 className="text-2xl font-bold mb-6">Integrations</h1>

          {loading && (
            <div className="mb-6 text-gray-600">
              Loading integration status…
            </div>
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
        </section>

        {/* PAT Section */}
        <section>
          <h2 className="text-2xl font-bold mb-4">API Tokens</h2>
          <p className="text-sm text-gray-600 mb-4">
            Create personal access tokens (PATs) to call this API from scripts
            or CI without Google login.
          </p>

          {error && (
            <div className="mb-4 rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-800">
              {error}
            </div>
          )}

          {/* Create token */}
          <div className="bg-white rounded-lg shadow p-4 mb-6">
            <h3 className="text-lg font-semibold mb-3">Create new token</h3>
            <div className="flex flex-col md:flex-row gap-3 items-center">
              <input
                type="text"
                className="flex-1 border rounded px-3 py-2 text-sm"
                placeholder="Token name (e.g. GitHub Actions)"
                value={newTokenName}
                onChange={(e) => setNewTokenName(e.target.value)}
              />
              <button
                onClick={handleCreateToken}
                disabled={creatingToken || !newTokenName.trim()}
                className="bg-blue-600 disabled:bg-blue-300 text-white px-4 py-2 rounded text-sm"
              >
                {creatingToken ? "Creating…" : "Create token"}
              </button>
            </div>

            {newTokenPlain && (
              <div className="mt-4 border rounded-md bg-gray-50 p-3">
                <p className="text-xs text-gray-600 mb-1">
                  This is your new token. You will{" "}
                  <span className="font-semibold">not</span> be able to see it
                  again, so copy it now:
                </p>
                <div className="flex items-center gap-2">
                  <code className="text-xs break-all bg-white border rounded px-2 py-1 flex-1">
                    {newTokenPlain}
                  </code>
                  <button
                    type="button"
                    className="text-xs px-2 py-1 border rounded bg-white hover:bg-gray-100"
                    onClick={() =>
                      void navigator.clipboard.writeText(newTokenPlain)
                    }
                  >
                    Copy
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Token list */}
          <div className="bg-white rounded-lg shadow p-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="text-lg font-semibold">Existing tokens</h3>
              {loadingTokens && (
                <span className="text-xs text-gray-500">Refreshing…</span>
              )}
            </div>

            {patTokens.length === 0 ? (
              <p className="text-sm text-gray-500">
                You haven&apos;t created any tokens yet.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left border-b text-gray-500">
                      <th className="py-2 pr-4">Name</th>
                      <th className="py-2 pr-4">Created</th>
                      <th className="py-2 pr-4">Last used</th>
                      <th className="py-2 pr-4">Scopes</th>
                      <th className="py-2 pr-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {patTokens.map((t) => (
                      <tr key={t.id} className="border-b last:border-0">
                        <td className="py-2 pr-4">{t.name}</td>
                        <td className="py-2 pr-4">
                          {formatDate(t.created_at)}
                        </td>
                        <td className="py-2 pr-4">
                          {formatDate(t.last_used_at)}
                        </td>
                        <td className="py-2 pr-4">
                          {t.scopes && t.scopes.length > 0
                            ? t.scopes.join(", ")
                            : "—"}
                        </td>
                        <td className="py-2 pr-0 text-right">
                          <button
                            onClick={() => void handleDeleteToken(t.id)}
                            className="text-xs text-red-600 hover:text-red-800"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
