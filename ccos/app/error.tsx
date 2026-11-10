"use client";

export default function ErrorPage({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto max-w-md px-4 py-20 text-center" role="alert">
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="muted mt-2 text-sm">The page could not be loaded. No data was changed. Try again, and tell an administrator if it keeps happening.</p>
      <p className="mt-6"><button className="btn" onClick={() => reset()}>Try again</button></p>
    </main>
  );
}
