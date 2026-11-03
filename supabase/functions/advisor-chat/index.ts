const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const SYSTEM_PROMPT = `You are FinAI, a personal finance advisor for an Indian user.
Answer the user's question using ONLY the financial data provided in the context.
Quote exact amounts in INR (Rs / Indian number format) as given in the data, and do the arithmetic carefully.
If the data does not contain the answer, say so plainly instead of guessing.
Keep answers short (2-5 sentences) and practical. Do not use emojis.`;

type ContextTransaction = {
  date: string;
  description: string;
  category: string;
  type: "income" | "expense";
  amount: number;
};

type AdvisorContext = {
  monthLabel: string;
  totals: { income: number; expenses: number; savings: number; savingsRate: number };
  budget: { needsPct: number; wantsPct: number; savingsPct: number };
  expensesByCategory: { category: string; amount: number }[];
  transactions: ContextTransaction[];
};

function isContext(value: unknown): value is AdvisorContext {
  if (!value || typeof value !== "object") return false;
  const c = value as AdvisorContext;
  return typeof c.monthLabel === "string" && Array.isArray(c.transactions) && Array.isArray(c.expensesByCategory) && !!c.totals && !!c.budget;
}

function formatContext(context: AdvisorContext) {
  const lines = [
    `Month: ${context.monthLabel}`,
    `Income: ${context.totals.income}`,
    `Expenses: ${context.totals.expenses}`,
    `Savings: ${context.totals.savings} (${context.totals.savingsRate}% of income)`,
    `Needs share of income: ${context.budget.needsPct}% (target 50%)`,
    `Wants share of income: ${context.budget.wantsPct}% (target 30%)`,
    `Savings share of income: ${context.budget.savingsPct}% (target 20%)`,
    "Expenses by category:",
    ...context.expensesByCategory.map((item) => `- ${item.category}: ${item.amount}`),
    "Transactions:",
    ...context.transactions.map((t) => `- ${t.date} | ${t.type} | ${t.category} | ${t.description} | ${t.amount}`),
  ];
  return lines.join("\n");
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  try {
    if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) return json({ error: "The AI advisor is not configured yet." }, 503);

    const body = await req.json().catch(() => null);
    const question = typeof body?.question === "string" ? body.question.trim().slice(0, 500) : "";
    if (!question) return json({ error: "A question is required." }, 400);
    if (!isContext(body?.context)) return json({ error: "Invalid financial context." }, 400);

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        temperature: 0.2,
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: `Financial data:\n${formatContext(body.context)}\n\nQuestion: ${question}` },
        ],
      }),
    });

    if (!response.ok) return json({ error: "The AI service could not answer right now." }, 502);

    const data = await response.json();
    const answer = data?.choices?.[0]?.message?.content;
    if (typeof answer !== "string" || !answer.trim()) return json({ error: "The AI service returned an empty answer." }, 502);

    return json({ answer: answer.trim() });
  } catch (error) {
    console.error("advisor-chat failed", error);
    return json({ error: "Something went wrong while answering." }, 500);
  }
});
