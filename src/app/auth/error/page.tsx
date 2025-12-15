"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { useEffect } from "react";

export default function AuthErrorPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const error = searchParams.get("error") || "unknown_error";

  useEffect(() => {
    // auto-redirect home after a few seconds if you want
    const t = setTimeout(() => router.replace("/"), 5000);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-red-50">
      <div className="bg-white p-6 rounded-lg shadow max-w-md w-full">
        <h1 className="text-xl font-semibold text-red-700 mb-2">
          Authentication Error
        </h1>
        <p className="text-gray-700 mb-4">
          Something went wrong connecting to YNAB.
        </p>
        <p className="text-sm text-gray-500 mb-6">Error code: {error}</p>
        <button
          onClick={() => router.replace("/")}
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm"
        >
          Back to dashboard
        </button>
      </div>
    </div>
  );
}
