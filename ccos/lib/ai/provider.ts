// Provider-neutral AI interface. Business logic and authorization never depend on a vendor.
// Providers only ever receive context that was already filtered through the DAL for the asking user.
export type ContextItem = { id: string; label: string; text: string; source: string; url?: string; asOf?: string };
export type AiInput = { system: string; question: string; context: ContextItem[]; demo: boolean };
export type AiOutput = { text: string; citedIds: string[]; promptTokensEst: number; completionTokensEst: number };

export interface AiProvider {
  readonly id: string;
  readonly kind: "mock" | "openai" | "anthropic" | "google";
  configured(): boolean;
  generate(input: AiInput): Promise<AiOutput>;
}

export const est = (s: string) => Math.ceil(s.length / 4);
const PRICE_PER_1K = { mock: 0, openai: 0.005, anthropic: 0.005, google: 0.003 } as const;
export const costEstimate = (kind: AiProvider["kind"], tokens: number) => (tokens / 1000) * PRICE_PER_1K[kind];

// Deterministic mock. It answers only from the supplied context and treats document text as inert data.
export const mockProvider: AiProvider = {
  id: "mock", kind: "mock", configured: () => true,
  async generate({ question, context, demo }) {
    const q = question.toLowerCase();
    const pick = (re: RegExp) => context.filter((c) => re.test(c.label + " " + c.text));
    let chosen: ContextItem[];
    if (/collection|95/.test(q)) chosen = context.filter((c) => c.id.startsWith("kpi:collections"));
    else if (/dd|diligence|closing|deadline|deal/.test(q)) chosen = context.filter((c) => c.id.startsWith("deal:"));
    else if (/ir|investor|follow|commit/.test(q)) chosen = context.filter((c) => c.id.startsWith("investor:") || c.id.startsWith("task:"));
    else if (/renew|insurance/.test(q)) chosen = context.filter((c) => c.id.startsWith("renewal:"));
    else if (/plan|business/.test(q)) chosen = context.filter((c) => c.id.startsWith("plan:"));
    else chosen = pick(new RegExp(q.split(/\W+/).filter((w) => w.length > 3).join("|") || "$^"));
    if (chosen.length === 0) {
      const text = "I could not find anything in the records you are allowed to see that answers this. I will not guess.";
      return { text, citedIds: [], promptTokensEst: est(question) + est(JSON.stringify(context)), completionTokensEst: est(text) };
    }
    const lines = chosen.slice(0, 8).map((c, i) => `[${i + 1}] ${c.label}: ${c.text}${c.asOf ? ` (as of ${c.asOf.slice(0, 10)})` : ""}`);
    const text = `${demo ? "Synthetic demo data. " : ""}From your authorized records:\n${lines.join("\n")}`;
    return { text, citedIds: chosen.slice(0, 8).map((c) => c.id), promptTokensEst: est(question) + est(JSON.stringify(context)), completionTokensEst: est(text) };
  },
};

// Real vendors are registered here behind the same interface. Not wired in v1 (no keys, untested).
const notWired = (id: string, kind: AiProvider["kind"], envKey: string): AiProvider => ({
  id, kind, configured: () => Boolean(process.env[envKey]),
  async generate() { throw new Error(`${id} adapter is not implemented in v1`); },
});
export const PROVIDERS: Record<string, AiProvider> = {
  mock: mockProvider,
  openai: notWired("openai", "openai", "OPENAI_API_KEY"),
  anthropic: notWired("anthropic", "anthropic", "ANTHROPIC_API_KEY"),
  google: notWired("google", "google", "GOOGLE_GENERATIVE_AI_API_KEY"),
};
