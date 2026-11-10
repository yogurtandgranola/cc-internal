import Link from "next/link";

export default function Forbidden() {
  return (
    <main className="mx-auto max-w-md px-4 py-20 text-center">
      <h1 className="text-2xl font-bold">You do not have access to this page</h1>
      <p className="muted mt-2 text-sm">Your account is signed in, but your role does not include this area. Ask an administrator if you need access.</p>
      <p className="mt-6"><Link href="/" className="btn">Back to home</Link></p>
    </main>
  );
}
