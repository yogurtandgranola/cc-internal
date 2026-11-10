import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-md px-4 py-20 text-center">
      <h1 className="text-2xl font-bold">Not found</h1>
      <p className="muted mt-2 text-sm">This record does not exist, or you do not have access to it.</p>
      <p className="mt-6"><Link href="/" className="btn">Back to home</Link></p>
    </main>
  );
}
