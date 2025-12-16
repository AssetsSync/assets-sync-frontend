// lib/api-client.ts
const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3000";

export interface ApiTokenDto {
  id: number;
  name: string;
  user_id: number;
  scopes: string[];
  created_at: string; // ISO date
  last_used_at: string | null;
  expires_at: string | null;
}

export class APIClient {
  private baseURL = BACKEND_URL;
  private getAccessToken: () => string | null;
  private refreshToken: () => Promise<boolean>;

  constructor(
    getAccessToken: () => string | null,
    refreshToken: () => Promise<boolean>
  ) {
    this.getAccessToken = getAccessToken;
    this.refreshToken = refreshToken;
  }

  // generic request helper (you already have this)
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const token = this.getAccessToken();

    const config: RequestInit = {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(token && { Authorization: `Bearer ${token}` }),
        ...(options.headers || {}),
      },
      credentials: "include",
    };

    let res = await fetch(`${this.baseURL}${endpoint}`, config);

    if (res.status === 401 && token) {
      const refreshed = await this.refreshToken();
      if (!refreshed) throw new Error("Authentication failed, please login");
      const newToken = this.getAccessToken();
      const newHeaders: HeadersInit = {
        ...(config.headers || {}),
        ...(newToken && { Authorization: `Bearer ${newToken}` }),
      };
      res = await fetch(`${this.baseURL}${endpoint}`, {
        ...config,
        headers: newHeaders,
      });
    }

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`HTTP ${res.status}: ${text}`);
    }

    const ct = res.headers.get("content-type");
    if (ct && ct.includes("application/json")) {
      return res.json();
    }
    // @ts-expect-error
    return res.text();
  }

  private get<T>(endpoint: string) {
    return this.makeRequest<T>(endpoint, { method: "GET" });
  }

  private post<T>(endpoint: string, data?: any) {
    return this.makeRequest<T>(endpoint, {
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  private delete<T>(endpoint: string) {
    return this.makeRequest<T>(endpoint, { method: "DELETE" });
  }

  // ---------- YNAB ----------
  getYnabStatus() {
    return this.get<{ isAuthenticated: boolean; ynabUserId?: string }>(
      "/auth/ynab/status"
    );
  }

  getYnabAuthUrl(state?: string) {
    const q = state ? `?state=${encodeURIComponent(state)}` : "";
    return this.get<{ authUrl: string }>(`/auth/ynab/auth-url${q}`);
  }

  disconnectYnab() {
    return this.delete<{ success: boolean }>("/auth/ynab/disconnect");
  }

  // ---------- Monzo ----------
  getMonzoStatus() {
    return this.get<{ connected: boolean; enabled: boolean; user_id: string }>(
      "/auth/monzo/status"
    );
  }

  getMonzoAuthUrl(state?: string) {
    const q = state ? `?state=${encodeURIComponent(state)}` : "";
    return this.get<{ authUrl: string }>(`/auth/monzo/auth-url${q}`);
  }

  revokeMonzo() {
    return this.get<{ message: string }>("/monzo/revoke");
  }

  // ---------- PAT / API Tokens ----------
  async getApiTokens(): Promise<ApiTokenDto[]> {
    return this.get("/auth/api-tokens");
  }

  async createApiToken(
    name: string
  ): Promise<{ id: number; token: string; name: string; createdAt: string }> {
    return this.post("/auth/api-tokens", { name });
  }

  async deleteApiToken(id: number): Promise<{ success: boolean }> {
    return this.delete(`/auth/api-tokens/${id}`);
  }
}
