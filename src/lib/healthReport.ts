import {
  type Transaction,
  categories,
  computeBudget,
  computeExpensesByCategory,
  computeMonthlyTotals,
  formatCurrency,
} from '@/lib/finance';

export type HealthLeak = { category: string; amount: number; sharePct: number };

export type HealthReport = {
  score: number;
  verdict: string;
  leaks: HealthLeak[];
  recommendations: string[];
  potentialSavings: number;
};

const SAVINGS_TARGET_PCT = 20;
const NEEDS_TARGET_PCT = 50;
const WANTS_TARGET_PCT = 30;
const LEAK_SHARE_THRESHOLD = 0.2;

export function computeHealthReport(transactions: Transaction[]): HealthReport {
  const { income, expenses, savings, savingsRate } = computeMonthlyTotals(transactions);
  const budget = computeBudget(transactions);
  const byCategory = computeExpensesByCategory(transactions);
  const top = byCategory[0];

  let score = 100;
  if (income === 0) {
    score = 40;
  } else {
    score -= Math.max(0, SAVINGS_TARGET_PCT - savingsRate) * 2;
    score -= Math.max(0, budget.needs.pct - NEEDS_TARGET_PCT);
    score -= Math.max(0, budget.wants.pct - WANTS_TARGET_PCT) * 1.5;
    if (savings < 0) score -= 10;
  }
  const finalScore = Math.max(0, Math.min(100, Math.round(score)));

  const verdict = income === 0
    ? 'No income recorded this month'
    : finalScore >= 80
      ? 'Strong financial health'
      : finalScore >= 60
        ? 'Stable, with room to improve'
        : 'Needs attention';

  const leaks = expenses > 0
    ? byCategory
        .filter((item) => item.value / expenses >= LEAK_SHARE_THRESHOLD)
        .slice(0, 3)
        .map((item) => ({
          category: categories[item.name]?.label ?? item.name,
          amount: item.value,
          sharePct: Math.round((item.value / expenses) * 100),
        }))
    : [];

  const wantsOver = Math.max(0, budget.wants.amount - income * (WANTS_TARGET_PCT / 100));
  const topCut = top ? top.value * 0.2 : 0;
  const potentialSavings = Math.round(Math.max(wantsOver, topCut));

  const candidates: string[] = [];
  if (top) {
    const label = categories[top.name]?.label ?? top.name;
    candidates.push(`Set a monthly cap of ${formatCurrency(Math.round(top.value * 0.8))} on ${label} to save about ${formatCurrency(Math.round(top.value * 0.2))} a month.`);
  }
  if (budget.wants.pct > WANTS_TARGET_PCT) {
    candidates.push(`Wants are ${budget.wants.pct}% of income. Trimming about ${formatCurrency(Math.round(wantsOver))} of discretionary spend reaches the 30% target.`);
  }
  if (income > 0 && savingsRate < SAVINGS_TARGET_PCT) {
    const gap = Math.round(income * (SAVINGS_TARGET_PCT / 100) - savings);
    candidates.push(`Move ${formatCurrency(Math.max(gap, 0))} to savings right after payday to reach your 20% target.`);
  }
  if (income > 0 && savingsRate >= SAVINGS_TARGET_PCT) {
    candidates.push('You are meeting your 20% savings target. Keep automating transfers each month to protect it.');
  }
  const fallbacks = [
    'Review recurring subscriptions each quarter and switch to annual plans where they cost less.',
    'Log every expense as it happens so these numbers stay accurate.',
  ];
  const recommendations = [...candidates, ...fallbacks].slice(0, 3);

  return { score: finalScore, verdict, leaks, recommendations, potentialSavings };
}
