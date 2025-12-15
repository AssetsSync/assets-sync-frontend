"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function YnabSuccessPage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // You *can* read state if you want it (user id from backend)
    const state = searchParams.get("state");
    console.log("YNAB connected, state =", state);

    // Just send user back home
    router.replace("/");
  }, [router, searchParams]);

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="bg-white p-6 rounded-lg shadow">
        <p className="text-gray-700">
          Completing YNAB connection… Redirecting to dashboard.
        </p>
      </div>
    </div>
  );
}
