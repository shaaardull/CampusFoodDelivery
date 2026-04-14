import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] p-6 text-center">
      <h1 className="text-6xl font-bold text-brand-500 mb-2">404</h1>
      <p className="text-gray-600 mb-6">Page not found.</p>
      <Link
        href="/"
        className="px-6 py-3 bg-brand-500 text-white rounded-xl font-medium hover:bg-brand-600 transition"
      >
        Go Home
      </Link>
    </div>
  );
}
