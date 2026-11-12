"use client";
import { useActionState } from "react";
import { previewAction, saveAction, type UploadState } from "./actions";

const money = (n: number | null) => (n == null ? "n/a" : n.toLocaleString("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }));

export function UploadForm() {
  const [prev, readFile, reading] = useActionState(previewAction, undefined as UploadState);
  const [saved, save, saving] = useActionState(saveAction, undefined as UploadState);
  return (
    <div className="space-y-4">
      <form action={readFile} className="card space-y-3 p-5">
        <label htmlFor="file" className="block text-sm font-medium">Rent Manager weekly packet (PDF)</label>
        <input id="file" name="file" type="file" accept="application/pdf,.pdf" required className="w-full" />
        {prev?.error ? <p role="alert" className="text-sm" style={{ color: "var(--bad)" }}>{prev.error}</p> : null}
        <button className="btn btn-primary" disabled={reading}>{reading ? "Reading…" : "Read file"}</button>
      </form>

      {prev?.rows ? (
        <form action={save} className="card space-y-3 p-5">
          <h2 className="text-lg font-semibold">Check before saving</h2>
          <div className="overflow-x-auto">
            <table className="t">
              <thead><tr><th>Property</th><th>Month</th><th>Occupied</th><th>Total sites</th><th>Charged</th><th>Paid</th><th>Owed</th><th>Move-ins / outs</th><th>Match</th></tr></thead>
              <tbody>
                {prev.rows.map((r) => (
                  <tr key={r.propertyName}>
                    <td>{r.propertyName}</td><td>{r.month.slice(0, 7)} (to {r.asOf})</td><td>{r.occupied}</td><td>{r.rentable}</td>
                    <td>{money(r.chargesDue)}</td><td>{money(r.paid)}</td><td>{money(r.delinquent)}</td><td>{r.moveIns ?? "n/a"} / {r.moveOuts ?? "n/a"}</td>
                    <td>{r.propertyId ? "Matched" : "Not found, will be skipped"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {prev.rows.flatMap((r) => r.warnings.map((w) => <p key={r.propertyName + w} className="muted text-sm">{r.propertyName}: {w}</p>))}
          {prev.problems?.map((p) => <p key={p} role="alert" className="text-sm">{p}</p>)}
          <p className="muted text-xs">Numbers are saved as &quot;Uploaded Rent Manager weekly packet&quot; with the report date. Charged and paid cover the month so far, not a full month.</p>
          <input type="hidden" name="payload" value={JSON.stringify(prev.rows.map((r) => { const { propertyId, ...rest } = r; void propertyId; return rest; }))} />
          <input type="hidden" name="fileName" value={prev.fileName ?? ""} />
          {saved?.error ? <p role="alert" className="text-sm" style={{ color: "var(--bad)" }}>{saved.error}</p> : null}
          {saved?.ok ? <p role="status" className="text-sm">{saved.ok}</p> : null}
          <button className="btn btn-primary" disabled={saving || Boolean(saved?.ok)}>{saving ? "Saving…" : "Save these numbers"}</button>
        </form>
      ) : null}
    </div>
  );
}
