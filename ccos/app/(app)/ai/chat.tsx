"use client";
import { useActionState } from "react";
import { askAction, type ChatState } from "./actions";

const EXAMPLES = [
  "Which parks are below 95% collections, and who owns the next step?",
  "Which DD items threaten closing in 30 days?",
  "What changed in the Cedar Park business plan?",
  "What IR follow-ups are due this week?",
];

export function AiChat({ enabled, providers, current }: { enabled: boolean; providers: string[]; current: string }) {
  const [state, action, pending] = useActionState<ChatState, FormData>(askAction, { answer: null });
  const a = state.answer;
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <form action={action} className="card space-y-3 p-4 lg:col-span-1">
        <label htmlFor="question" className="block text-sm font-medium">Question</label>
        <textarea id="question" name="question" rows={4} required minLength={3} className="w-full" disabled={!enabled} defaultValue={state.question ?? ""} />
        {providers.length > 1 ? (
          <div><label htmlFor="provider" className="muted block text-xs">Model provider</label><select id="provider" name="provider" defaultValue={current}>{providers.map((p) => <option key={p}>{p}</option>)}</select></div>
        ) : <input type="hidden" name="provider" value={current} />}
        <button className="btn btn-primary" disabled={pending || !enabled}>{pending ? "Thinking…" : "Ask"}</button>
        <ul className="muted space-y-1 text-xs">{EXAMPLES.map((e) => <li key={e}>{e}</li>)}</ul>
      </form>
      <section className="card p-4 lg:col-span-2" aria-live="polite" data-testid="ai-answer">
        {!a ? <p className="muted text-sm">Ask a question to see a sourced answer.</p> : (
          <>
            <p className="muted text-xs">Provider: {a.provider} · status: {a.status}{a.demo ? " · synthetic demo data" : ""}</p>
            <pre className="mt-2 whitespace-pre-wrap text-sm" style={{ fontFamily: "inherit" }}>{a.text}</pre>
            {a.citations.length > 0 ? (
              <>
                <h3 className="mt-3 text-sm font-semibold">Sources</h3>
                <ol className="mt-1 list-decimal pl-5 text-xs">{a.citations.map((c) => (<li key={c.id}>{c.label} · {c.source}{c.asOf ? ` · as of ${c.asOf.slice(0, 10)}` : ""}{c.url ? <> · <a href={c.url} target="_blank" rel="noopener noreferrer">open</a></> : null}</li>))}</ol>
              </>
            ) : null}
          </>
        )}
      </section>
    </div>
  );
}
