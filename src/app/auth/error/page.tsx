// app/auth/error/page.tsx
import Link from "next/link";

type AuthErrorPageProps = {
  searchParams?: { error?: string };
};

export default function AuthErrorPage({ searchParams }: AuthErrorPageProps) {
  const error = searchParams?.error ?? "unknown_error";

  return (
    <div className="flex items-center justify-center min-h-screen bg-red-50">
      <div className="bg-white p-6 rounded-lg shadow max-w-md w-full">
        <h1 className="text-xl font-semibold text-red-700 mb-2">
          Authentication Error
        </h1>
        <p className="text-gray-700 mb-4">Something went wrong.</p>
        <p className="text-sm text-gray-500 mb-6">Error code: {error}</p>

        {/* Server-safe, no hooks */}
        <Link
          href="/"
          className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded text-sm inline-block text-center"
        >
          Back Home
        </Link>
      </div>
    </div>
  );
}
