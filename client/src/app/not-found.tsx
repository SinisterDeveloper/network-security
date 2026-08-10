import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-950 text-white px-6 py-10 flex items-center justify-center">
      <div className="text-center space-y-3">
        <h1 className="text-3xl font-bold">404</h1>
        <p className="text-slate-400">Page not found</p>
        <Link href="/" className="text-sm underline text-slate-300">Back to registry</Link>
      </div>
    </div>
  );
}
