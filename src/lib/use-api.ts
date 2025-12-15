"use client";

import { useMemo } from "react";
import { useAuth } from "./auth-context";
import { APIClient } from "./api-client";

export function useAPI() {
  const { accessToken, refreshToken } = useAuth();
  return useMemo(
    () => new APIClient(() => accessToken, refreshToken),
    [accessToken, refreshToken]
  );
}
