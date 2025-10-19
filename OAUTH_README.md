# OAuth Integration Guide

Complete documentation for implementing Google OAuth, YNAB OAuth, and Monzo OAuth authentication flows in the Assets Sync Frontend.

## 📋 Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Google OAuth (Primary Authentication)](#google-oauth-primary-authentication)
- [YNAB OAuth Integration](#ynab-oauth-integration)
- [Monzo OAuth Integration](#monzo-oauth-integration)
- [Frontend Implementation](#frontend-implementation)
- [Authentication Context](#authentication-context)
- [API Client Setup](#api-client-setup)
- [Error Handling](#error-handling)
- [Environment Variables](#environment-variables)

---

## 🔍 Overview

The Assets Sync Frontend implements a multi-provider OAuth system with the following hierarchy:

1. **Google OAuth** - Primary authentication (JWT tokens)
2. **YNAB OAuth** - Budget management integration (requires Google auth)
3. **Monzo OAuth** - Banking integration (requires Google auth)

### Authentication Flow Summary

```
User → Google OAuth → JWT Token → YNAB/Monzo OAuth → Protected API Access
```

**Important**: Google OAuth is **mandatory** and must be implemented first. YNAB and Monzo OAuth require an active JWT token from Google authentication.

---

## 🏗️ Architecture

### Token Management

```typescript
interface AuthState {
  accessToken: string | null; // JWT from Google OAuth
  user: User | null; // User profile data
  isAuthenticated: boolean; // Authentication status
  isLoading: boolean; // Loading state
}

interface User {
  id: string;
  email: string;
  name: string;
  picture?: string;
}
```

### Backend Endpoints Structure

```
# Primary Authentication
/auth/google              - Initiate Google OAuth
/auth/google/callback     - Google OAuth callback
/auth/refresh            - Refresh JWT token
/auth/logout             - Logout user

# YNAB Integration (JWT Protected)
/auth/ynab/auth-url      - Get YNAB OAuth URL
/auth/ynab/status        - Check YNAB connection
/auth/ynab/callback      - YNAB OAuth callback
/ynab/*                  - YNAB API endpoints

# Monzo Integration (JWT Protected)
/auth/monzo/auth-url     - Get Monzo OAuth URL
/auth/monzo/status       - Check Monzo connection
/auth/monzo/callback     - Monzo OAuth callback
/monzo/*                 - Monzo API endpoints
```

---

## 🔐 Google OAuth (Primary Authentication)

Google OAuth is the foundation of the authentication system and provides JWT tokens for all subsequent API calls.

### Implementation Steps

#### 1. Initiate Google OAuth

```typescript
const login = () => {
  const backendUrl =
    process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3000";
  window.location.href = `${backendUrl}/auth/google`;
};
```

#### 2. Handle OAuth Callback

The backend redirects to `/auth/success?token={JWT_TOKEN}` after successful authentication.

```typescript
// In auth context or callback handler
const initializeAuth = async () => {
  const urlParams = new URLSearchParams(window.location.search);
  const tokenFromUrl = urlParams.get("token");

  if (tokenFromUrl) {
    await handleNewToken(tokenFromUrl);
    // Clean up URL
    window.history.replaceState({}, document.title, window.location.pathname);
  }
};

const handleNewToken = async (token: string) => {
  // Store token
  localStorage.setItem("accessToken", token);
  setAccessToken(token);

  // Decode JWT to extract user info
  const payload = JSON.parse(atob(token.split(".")[1]));
  setUser({
    id: payload.sub,
    email: payload.email,
    name: payload.name,
    picture: payload.picture,
  });

  setIsAuthenticated(true);
};
```

#### 3. Token Validation and Refresh

```typescript
const validateToken = async (token: string) => {
  try {
    const response = await fetch(`${backendUrl}/auth/validate`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.ok) {
      const userData = await response.json();
      setUser(userData);
      setIsAuthenticated(true);
    } else {
      // Token invalid, clear auth state
      clearAuthState();
    }
  } catch (error) {
    console.error("Token validation failed:", error);
    clearAuthState();
  }
};

const refreshToken = async (): Promise<boolean> => {
  try {
    const response = await fetch(`${backendUrl}/auth/refresh`, {
      method: "POST",
      credentials: "include",
    });

    if (response.ok) {
      const { accessToken: newToken } = await response.json();
      await handleNewToken(newToken);
      return true;
    }
  } catch (error) {
    console.error("Token refresh failed:", error);
  }
  return false;
};
```

#### 4. Logout Implementation

```typescript
const logout = async () => {
  try {
    await fetch(`${backendUrl}/auth/logout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
      credentials: "include",
    });
  } catch (error) {
    console.error("Logout error:", error);
  } finally {
    clearAuthState();
    window.location.href = "/login";
  }
};

const clearAuthState = () => {
  localStorage.removeItem("accessToken");
  setAccessToken(null);
  setUser(null);
  setIsAuthenticated(false);
};
```

---

## 📊 YNAB OAuth Integration

YNAB OAuth allows users to connect their YNAB budgets. Requires active Google authentication.

### Implementation Steps

#### 1. Check YNAB Status

```typescript
const checkYnabStatus = async () => {
  try {
    const response = await fetch(`${backendUrl}/auth/ynab/status`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const status = await response.json();
    return status; // { enabled: boolean, connected: boolean, user_id?: string }
  } catch (error) {
    console.error("YNAB status check failed:", error);
    throw error;
  }
};
```

#### 2. Initiate YNAB OAuth

```typescript
const connectYnab = async () => {
  try {
    // Get YNAB OAuth URL from backend
    const response = await fetch(`${backendUrl}/auth/ynab/auth-url`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const { authUrl } = await response.json();

    // Redirect to YNAB OAuth
    window.location.href = authUrl;
  } catch (error) {
    console.error("YNAB OAuth initiation failed:", error);
    throw error;
  }
};
```

#### 3. Handle YNAB Callback

Create a callback page at `/auth/ynab/callback/page.tsx`:

```typescript
"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function YnabCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const error = searchParams.get("error");
    const code = searchParams.get("code");
    const state = searchParams.get("state");

    if (error) {
      console.error("YNAB OAuth error:", error);
      // Handle error - redirect to error page or dashboard with error message
      router.push(`/dashboard?ynab_error=${encodeURIComponent(error)}`);
      return;
    }

    if (code) {
      console.log("YNAB OAuth successful");
      // The backend handles the token exchange via callback
      // Redirect to dashboard
      router.push("/dashboard/authenticated");
    } else {
      // No code received, redirect to dashboard
      router.push("/dashboard/authenticated");
    }
  }, [router, searchParams]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">Connecting YNAB...</h2>
        <p className="text-gray-600">
          Please wait while we connect your YNAB account.
        </p>
      </div>
    </div>
  );
}
```

#### 4. YNAB API Usage

```typescript
// Get YNAB budgets
const getYnabBudgets = async () => {
  const response = await fetch(`${backendUrl}/ynab/budgets`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return response.json();
};

// Get YNAB accounts for a budget
const getYnabAccounts = async (budgetId: string) => {
  const response = await fetch(
    `${backendUrl}/ynab/budgets/${budgetId}/accounts`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  return response.json();
};

// Disconnect YNAB
const disconnectYnab = async () => {
  const response = await fetch(`${backendUrl}/auth/ynab/disconnect`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return response.json();
};
```

---

## 🏦 Monzo OAuth Integration

Monzo OAuth provides banking data access. Requires active Google authentication and explicit enablement.

### Key Differences from YNAB

1. **Two-step process**: Enable → Connect
2. **Explicit enablement**: Must enable Monzo integration before OAuth
3. **Revocation support**: Can revoke tokens and disable integration

### Implementation Steps

#### 1. Check Monzo Status

```typescript
const checkMonzoStatus = async () => {
  try {
    const response = await fetch(`${backendUrl}/auth/monzo/status`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const status = await response.json();
    return status; // { enabled: boolean, connected: boolean, user_id?: string }
  } catch (error) {
    console.error("Monzo status check failed:", error);
    throw error;
  }
};
```

#### 2. Enable Monzo Integration

```typescript
const enableMonzo = async () => {
  try {
    const response = await fetch(`${backendUrl}/monzo/enable`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const result = await response.json();
    return result; // { message: string, user: any }
  } catch (error) {
    console.error("Monzo enablement failed:", error);
    throw error;
  }
};
```

#### 3. Initiate Monzo OAuth

```typescript
const connectMonzo = async () => {
  try {
    // Get Monzo OAuth URL from backend
    const response = await fetch(`${backendUrl}/auth/monzo/auth-url`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    const { authUrl } = await response.json();

    // Redirect to Monzo OAuth
    window.location.href = authUrl;
  } catch (error) {
    console.error("Monzo OAuth initiation failed:", error);
    throw error;
  }
};
```

#### 4. Handle Monzo Callback

Create a callback page at `/auth/monzo/callback/page.tsx`:

```typescript
"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function MonzoCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const error = searchParams.get("error");
    const code = searchParams.get("code");
    const state = searchParams.get("state");

    if (error) {
      console.error("Monzo OAuth error:", error);
      // Handle error - redirect to error page or dashboard with error message
      router.push(`/dashboard?monzo_error=${encodeURIComponent(error)}`);
      return;
    }

    if (code) {
      console.log("Monzo OAuth successful");
      // The backend handles the token exchange via callback
      // Redirect to dashboard
      router.push("/dashboard/authenticated");
    } else {
      // No code received, redirect to dashboard
      router.push("/dashboard/authenticated");
    }
  }, [router, searchParams]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="text-center">
        <h2 className="text-xl font-semibold mb-2">Connecting Monzo...</h2>
        <p className="text-gray-600">
          Please wait while we connect your Monzo account.
        </p>
      </div>
    </div>
  );
}
```

#### 5. Monzo API Usage

```typescript
// Get Monzo accounts
const getMonzoAccounts = async () => {
  const response = await fetch(`${backendUrl}/monzo/accounts`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return response.json();
};

// Get account balance
const getMonzoBalance = async (accountId: string) => {
  const response = await fetch(
    `${backendUrl}/monzo/accounts/${accountId}/balance`,
    {
      headers: { Authorization: `Bearer ${accessToken}` },
    }
  );
  return response.json();
};

// Revoke Monzo tokens
const revokeMonzo = async () => {
  const response = await fetch(`${backendUrl}/monzo/revoke`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return response.json();
};

// Disable Monzo integration
const disableMonzo = async () => {
  const response = await fetch(`${backendUrl}/monzo/disable`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  return response.json();
};
```

---

## 💻 Frontend Implementation

### Authentication Context Setup

```typescript
// lib/auth-context.tsx
"use client";

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from "react";

interface User {
  id: string;
  email: string;
  name: string;
  picture?: string;
}

interface AuthContextType {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  accessToken: string | null;
  login: () => void;
  logout: () => void;
  refreshToken: () => Promise<boolean>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [accessToken, setAccessToken] = useState<string | null>(null);

  const backendUrl =
    process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3000";

  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    try {
      // Check for token from OAuth redirect
      const urlParams = new URLSearchParams(window.location.search);
      const tokenFromUrl = urlParams.get("token");

      if (tokenFromUrl) {
        await handleNewToken(tokenFromUrl);
        // Clean up URL
        window.history.replaceState(
          {},
          document.title,
          window.location.pathname
        );
      } else {
        // Check for existing token
        const savedToken = localStorage.getItem("accessToken");
        if (savedToken) {
          await validateToken(savedToken);
        }
      }
    } catch (error) {
      console.error("Auth initialization error:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNewToken = async (token: string) => {
    try {
      // Decode JWT to get user info
      const payload = JSON.parse(atob(token.split(".")[1]));

      localStorage.setItem("accessToken", token);
      setAccessToken(token);
      setUser({
        id: payload.sub,
        email: payload.email,
        name: payload.name,
        picture: payload.picture,
      });
      setIsAuthenticated(true);
    } catch (error) {
      console.error("Token processing error:", error);
      clearAuthState();
    }
  };

  const validateToken = async (token: string) => {
    try {
      const response = await fetch(`${backendUrl}/auth/validate`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (response.ok) {
        const userData = await response.json();
        setAccessToken(token);
        setUser(userData);
        setIsAuthenticated(true);
      } else {
        clearAuthState();
      }
    } catch (error) {
      console.error("Token validation error:", error);
      clearAuthState();
    }
  };

  const refreshToken = async (): Promise<boolean> => {
    try {
      const response = await fetch(`${backendUrl}/auth/refresh`, {
        method: "POST",
        credentials: "include",
      });

      if (response.ok) {
        const { accessToken: newToken } = await response.json();
        await handleNewToken(newToken);
        return true;
      }
    } catch (error) {
      console.error("Token refresh failed:", error);
    }
    return false;
  };

  const login = () => {
    window.location.href = `${backendUrl}/auth/google`;
  };

  const logout = async () => {
    try {
      await fetch(`${backendUrl}/auth/logout`, {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}` },
        credentials: "include",
      });
    } catch (error) {
      console.error("Logout error:", error);
    } finally {
      clearAuthState();
      window.location.href = "/login";
    }
  };

  const clearAuthState = () => {
    localStorage.removeItem("accessToken");
    setAccessToken(null);
    setUser(null);
    setIsAuthenticated(false);
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
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
```

### API Client Implementation

```typescript
// lib/api-client.ts
class APIClient {
  private baseURL: string;
  private getAccessToken: () => string | null;
  private refreshToken: () => Promise<boolean>;

  constructor(
    baseURL: string,
    getAccessToken: () => string | null,
    refreshToken: () => Promise<boolean>
  ) {
    this.baseURL = baseURL;
    this.getAccessToken = getAccessToken;
    this.refreshToken = refreshToken;
  }

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
        ...options.headers,
      },
      credentials: "include",
    };

    let response = await fetch(`${this.baseURL}${endpoint}`, config);

    // Handle automatic token refresh
    if (response.status === 401 && token) {
      const refreshSuccess = await this.refreshToken();
      if (refreshSuccess) {
        const newToken = this.getAccessToken();
        config.headers = {
          ...config.headers,
          Authorization: `Bearer ${newToken}`,
        };
        response = await fetch(`${this.baseURL}${endpoint}`, config);
      } else {
        throw new Error("Authentication failed. Please login again.");
      }
    }

    if (!response.ok) {
      throw new Error(`API Error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  // Generic HTTP methods
  async get<T>(endpoint: string): Promise<T> {
    return this.makeRequest<T>(endpoint, { method: "GET" });
  }

  async post<T>(endpoint: string, data?: any): Promise<T> {
    return this.makeRequest<T>(endpoint, {
      method: "POST",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async put<T>(endpoint: string, data?: any): Promise<T> {
    return this.makeRequest<T>(endpoint, {
      method: "PUT",
      body: data ? JSON.stringify(data) : undefined,
    });
  }

  async delete<T>(endpoint: string): Promise<T> {
    return this.makeRequest<T>(endpoint, { method: "DELETE" });
  }

  // YNAB Methods
  async getYnabStatus() {
    return this.get("/auth/ynab/status");
  }

  async getYnabAuthUrl() {
    return this.get("/auth/ynab/auth-url");
  }

  async connectYnab() {
    const { authUrl } = await this.getYnabAuthUrl();
    window.location.href = authUrl;
  }

  async disconnectYnab() {
    return this.delete("/auth/ynab/disconnect");
  }

  async getYnabBudgets() {
    return this.get("/ynab/budgets");
  }

  async getYnabAccounts(budgetId: string) {
    return this.get(`/ynab/budgets/${budgetId}/accounts`);
  }

  // Monzo Methods
  async getMonzoStatus() {
    return this.get("/auth/monzo/status");
  }

  async enableMonzo() {
    return this.get("/monzo/enable");
  }

  async getMonzoAuthUrl() {
    return this.get("/auth/monzo/auth-url");
  }

  async connectMonzo() {
    const { authUrl } = await this.getMonzoAuthUrl();
    window.location.href = authUrl;
  }

  async revokeMonzo() {
    return this.get("/monzo/revoke");
  }

  async disableMonzo() {
    return this.get("/monzo/disable");
  }

  async getMonzoAccounts() {
    return this.get("/monzo/accounts");
  }

  async getMonzoBalance(accountId: string) {
    return this.get(`/monzo/accounts/${accountId}/balance`);
  }
}

export default APIClient;
```

### Custom Hook for API Client

```typescript
// lib/use-api.ts
import { useMemo } from "react";
import { useAuth } from "./auth-context";
import APIClient from "./api-client";

export function useApi() {
  const { accessToken, refreshToken } = useAuth();

  const api = useMemo(() => {
    const baseURL =
      process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3000";

    return new APIClient(baseURL, () => accessToken, refreshToken);
  }, [accessToken, refreshToken]);

  return api;
}
```

---

## 🚨 Error Handling

### Common Error Scenarios

#### 1. Authentication Errors

```typescript
const handleAuthError = (error: Error) => {
  if (error.message.includes("Authentication failed")) {
    // Clear auth state and redirect to login
    clearAuthState();
    window.location.href = "/login";
  } else if (error.message.includes("401")) {
    // Token expired, attempt refresh
    refreshToken();
  }
};
```

#### 2. OAuth Callback Errors

```typescript
// In OAuth callback pages
const handleOAuthError = (error: string, description?: string) => {
  console.error(`OAuth error: ${error}`, description);

  // Show user-friendly error message
  const errorMessages: Record<string, string> = {
    access_denied: "You denied access to the application",
    invalid_request: "The authorization request was invalid",
    server_error: "An error occurred on the authorization server",
  };

  const message = errorMessages[error] || "An unknown error occurred";

  // Redirect with error message
  router.push(`/dashboard?error=${encodeURIComponent(message)}`);
};
```

#### 3. API Request Errors

```typescript
const handleApiError = async (endpoint: string, error: Error) => {
  console.error(`API Error [${endpoint}]:`, error);

  if (error.message.includes("401")) {
    const refreshSuccess = await refreshToken();
    if (!refreshSuccess) {
      clearAuthState();
      window.location.href = "/login";
    }
  } else if (error.message.includes("403")) {
    // Insufficient permissions
    throw new Error("You don't have permission to access this resource");
  } else if (error.message.includes("500")) {
    // Server error
    throw new Error("Server error occurred. Please try again later.");
  }

  throw error;
};
```

---

## 🔧 Environment Variables

Create a `.env.local` file in your frontend root:

```bash
# Backend API URL
NEXT_PUBLIC_BACKEND_URL=http://localhost:3000

# Optional: Frontend URL for OAuth redirects (usually auto-detected)
NEXT_PUBLIC_FRONTEND_URL=http://localhost:3001
```

### Development vs Production

#### Development

```bash
NEXT_PUBLIC_BACKEND_URL=http://localhost:3000
NEXT_PUBLIC_FRONTEND_URL=http://localhost:3001
```

#### Production

```bash
NEXT_PUBLIC_BACKEND_URL=https://api.assets-sync.com
NEXT_PUBLIC_FRONTEND_URL=https://app.assets-sync.com
```

---

## 🔄 Complete Integration Example

### Dashboard Component Example

```typescript
// components/dashboard.tsx
"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { useApi } from "@/lib/use-api";

export default function Dashboard() {
  const { user, logout } = useAuth();
  const api = useApi();

  const [ynabStatus, setYnabStatus] = useState<any>(null);
  const [monzoStatus, setMonzoStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadIntegrationStatus();
  }, []);

  const loadIntegrationStatus = async () => {
    try {
      const [ynab, monzo] = await Promise.all([
        api.getYnabStatus(),
        api.getMonzoStatus(),
      ]);

      setYnabStatus(ynab);
      setMonzoStatus(monzo);
    } catch (error) {
      console.error("Failed to load integration status:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleYnabConnect = async () => {
    try {
      await api.connectYnab();
    } catch (error) {
      console.error("YNAB connection failed:", error);
    }
  };

  const handleMonzoEnable = async () => {
    try {
      await api.enableMonzo();
      await loadIntegrationStatus(); // Refresh status
    } catch (error) {
      console.error("Monzo enablement failed:", error);
    }
  };

  const handleMonzoConnect = async () => {
    try {
      await api.connectMonzo();
    } catch (error) {
      console.error("Monzo connection failed:", error);
    }
  };

  if (loading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <button
          onClick={logout}
          className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
        >
          Logout
        </button>
      </div>

      {/* User Info */}
      <div className="mb-8 p-4 bg-gray-50 rounded-lg">
        <h2 className="text-xl font-semibold mb-2">Welcome, {user?.name}</h2>
        <p className="text-gray-600">{user?.email}</p>
      </div>

      {/* YNAB Integration */}
      <div className="mb-8 p-4 border rounded-lg">
        <h3 className="text-lg font-semibold mb-4">YNAB Integration</h3>
        {ynabStatus?.connected ? (
          <div className="text-green-600">
            ✅ Connected (User ID: {ynabStatus.user_id})
          </div>
        ) : (
          <button
            onClick={handleYnabConnect}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            Connect YNAB
          </button>
        )}
      </div>

      {/* Monzo Integration */}
      <div className="mb-8 p-4 border rounded-lg">
        <h3 className="text-lg font-semibold mb-4">Monzo Integration</h3>
        {!monzoStatus?.enabled ? (
          <button
            onClick={handleMonzoEnable}
            className="px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600"
          >
            Enable Monzo
          </button>
        ) : monzoStatus?.connected ? (
          <div className="text-green-600">
            ✅ Connected (User ID: {monzoStatus.user_id})
          </div>
        ) : (
          <button
            onClick={handleMonzoConnect}
            className="px-4 py-2 bg-purple-500 text-white rounded hover:bg-purple-600"
          >
            Connect Monzo
          </button>
        )}
      </div>
    </div>
  );
}
```

---

## 🎯 Implementation Checklist

### Google OAuth (Required)

- [ ] Set up AuthProvider context
- [ ] Implement login/logout functions
- [ ] Handle OAuth callback and token extraction
- [ ] Implement token validation and refresh
- [ ] Set up automatic token refresh on API calls

### YNAB OAuth (Optional)

- [ ] Check YNAB connection status
- [ ] Implement YNAB OAuth initiation
- [ ] Create YNAB callback page
- [ ] Add YNAB API methods to client
- [ ] Handle YNAB disconnection

### Monzo OAuth (Optional)

- [ ] Check Monzo connection status
- [ ] Implement Monzo enablement
- [ ] Implement Monzo OAuth initiation
- [ ] Create Monzo callback page
- [ ] Add Monzo API methods to client
- [ ] Handle Monzo revocation and disabling

### Error Handling

- [ ] Implement comprehensive error handling
- [ ] Add user-friendly error messages
- [ ] Handle network failures gracefully
- [ ] Implement retry mechanisms

### Security

- [ ] Validate all JWT tokens
- [ ] Implement secure token storage
- [ ] Add CSRF protection where needed
- [ ] Sanitize all user inputs

---

## 📝 Notes

1. **Token Security**: JWT tokens should be stored in `localStorage` for persistence across sessions, but consider `httpOnly` cookies for production environments.

2. **State Management**: The authentication state should be global and persistent across page refreshes.

3. **Callback Handling**: OAuth callbacks should handle both success and error scenarios gracefully.

4. **API Client**: The API client should automatically handle token refresh and re-authentication.

5. **Environment Configuration**: Ensure proper environment variable configuration for different deployment environments.

6. **Testing**: Test OAuth flows in both success and failure scenarios.

This comprehensive guide provides everything needed to implement the complete OAuth integration system from scratch. Follow the implementation steps in order: Google OAuth first, then YNAB and Monzo as needed.
