export type TransactionType = 'income' | 'expense';

export type Transaction = {
  id: string;
  transaction_date: string;
  description: string;
  category: string;
  amount: number;
  transaction_type: TransactionType;
  ai_tagged: boolean;
  account_id: string | null;
};

export type FinanceAccount = {
  id: string;
  name: string;
  created_at: string;
};

export type CategoryConfig = { label: string; color: string; soft: string };

export const categories: Record<string, CategoryConfig> = {
  Dining: { label: 'Dining', color: '#ef8f70', soft: 'bg-[#fff0eb] text-[#c65a3c]' },
  Groceries: { label: 'Groceries', color: '#53b88c', soft: 'bg-[#e8f7ef] text-[#27805a]' },
  Utilities: { label: 'Utilities', color: '#f0b95c', soft: 'bg-[#fff6df] text-[#ae7413]' },
  Transport: { label: 'Transport', color: '#6da8eb', soft: 'bg-[#eaf3ff] text-[#3778ba]' },
  Entertainment: { label: 'Entertainment', color: '#a988e6', soft: 'bg-[#f2edff] text-[#7351ae]' },
  Shopping: { label: 'Shopping', color: '#ec78aa', soft: 'bg-[#ffedf5] text-[#bf4b7d]' },
  Subscriptions: { label: 'Subscriptions', color: '#7cc7c9', soft: 'bg-[#e7f8f7] text-[#318284]' },
  Salary: { label: 'Salary', color: '#4db38b', soft: 'bg-[#e8f7ef] text-[#27805a]' },
  'Other income': { label: 'Other income', color: '#4db38b', soft: 'bg-[#e8f7ef] text-[#27805a]' },
};

export const categoryList = Object.keys(categories).slice(0, 7);

const needCategories = new Set(['Groceries', 'Utilities', 'Transport', 'Subscriptions']);
const wantCategories = new Set(['Dining', 'Entertainment', 'Shopping']);

export const SAVINGS_TARGET_RATE = 0.2;

export function formatCurrency(value: number, compact = false) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: compact ? 0 : 2, notation: compact ? 'compact' : 'standard' }).format(value);
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }).format(new Date(`${value}T00:00:00`));
}

export function getInitials(name: string) {
  return name.split(' ').map((part) => part[0]).join('').slice(0, 2);
}

export function toDateInputValue(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function currentMonthKey(date: Date) {
  return toDateInputValue(date).slice(0, 7);
}

export function computeMonthlyTotals(transactions: Transaction[]) {
  const income = transactions.filter((t) => t.transaction_type === 'income').reduce((s, t) => s + t.amount, 0);
  const expenses = transactions.filter((t) => t.transaction_type === 'expense').reduce((s, t) => s + t.amount, 0);
  const savings = income - expenses;
  const savingsRate = income > 0 ? Math.round((savings / income) * 100) : 0;
  return { income, expenses, savings, savingsRate };
}

export function computeExpensesByCategory(transactions: Transaction[]) {
  return categoryList
    .map((category) => ({
      name: category,
      value: transactions.filter((t) => t.transaction_type === 'expense' && t.category === category).reduce((s, t) => s + t.amount, 0),
    }))
    .filter((item) => item.value > 0)
    .sort((a, b) => b.value - a.value);
}

function sumExpenses(transactions: Transaction[], categorySet: Set<string>) {
  return transactions
    .filter((t) => t.transaction_type === 'expense' && categorySet.has(t.category))
    .reduce((s, t) => s + t.amount, 0);
}

export function computeBudget(transactions: Transaction[]) {
  const { income, savings } = computeMonthlyTotals(transactions);
  const needs = sumExpenses(transactions, needCategories);
  const wants = sumExpenses(transactions, wantCategories);
  const shareOfIncome = (amount: number) => (income > 0 ? Math.round((amount / income) * 100) : 0);
  return {
    needs: { amount: needs, pct: shareOfIncome(needs) },
    wants: { amount: wants, pct: shareOfIncome(wants) },
    savings: { amount: savings, pct: Math.max(shareOfIncome(savings), 0) },
  };
}

export function computePotentialSavings(transactions: Transaction[]) {
  return Math.round(sumExpenses(transactions, wantCategories) * 0.2);
}

export function computeTrend(transactions: Transaction[]) {
  const now = new Date();
  const months: { key: string; label: string; income: number; expenses: number }[] = [];
  for (let i = 5; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = currentMonthKey(d);
    months.push({ key, label: new Intl.DateTimeFormat('en-IN', { month: 'short' }).format(d), income: 0, expenses: 0 });
  }
  const index = new Map(months.map((m) => [m.key, m]));
  for (const t of transactions) {
    const entry = index.get(t.transaction_date.slice(0, 7));
    if (!entry) continue;
    if (t.transaction_type === 'income') entry.income += t.amount;
    else entry.expenses += t.amount;
  }
  return months.map(({ label, income, expenses }) => ({ month: label, income, expenses }));
}

export type InsightIcon = 'TrendingDown' | 'Lightbulb' | 'Target';
export type Insight = { icon: InsightIcon; title: string; text: string };

export function computeInsights(transactions: Transaction[]): Insight[] {
  const insights: Insight[] = [];
  const { savings, savingsRate } = computeMonthlyTotals(transactions);
  const dining = sumExpenses(transactions, new Set(['Dining']));
  const subs = sumExpenses(transactions, new Set(['Subscriptions']));
  const shopping = sumExpenses(transactions, new Set(['Shopping']));

  if (dining > 2000) insights.push({ icon: 'Lightbulb', title: 'Dine smarter', text: `Dining is ${formatCurrency(dining)} this month. Try a weekly cap of ₹2,000.` });
  if (subs > 500) insights.push({ icon: 'TrendingDown', title: 'Trim subscriptions', text: `You spend ${formatCurrency(subs)} on subscriptions. Pause one to save more.` });
  if (shopping > 3000) insights.push({ icon: 'TrendingDown', title: 'Watch shopping', text: `Shopping is at ${formatCurrency(shopping)}. Consider a 7-day cool-down on new purchases.` });
  if (savings > 0 && savingsRate < 20) insights.push({ icon: 'Target', title: 'Automate savings', text: `You are saving ${savingsRate}% of income. Move a fixed amount to goals right after payday.` });
  if (savingsRate >= 20) insights.push({ icon: 'Target', title: 'Keep it up', text: `You are saving ${savingsRate}% of income. Stay consistent to hit your goal.` });

  const fallbacks: Insight[] = [
    { icon: 'Target', title: 'Automate savings', text: 'Move a fixed amount to your savings goal right after payday.' },
    { icon: 'Lightbulb', title: 'Review categories', text: 'Use auto-categorize so every transaction lands in the right bucket.' },
    { icon: 'TrendingDown', title: 'Log every expense', text: 'Adding transactions as they happen keeps your insights accurate.' },
  ];
  for (const fallback of fallbacks) {
    if (insights.length >= 3) break;
    insights.push(fallback);
  }
  return insights.slice(0, 3);
}

export function computeSpendingSignal(transactions: Transaction[], reportGenerated: boolean) {
  if (transactions.length === 0) return 'Add transactions to unlock personalized spending insights.';
  const { savingsRate } = computeMonthlyTotals(transactions);
  if (reportGenerated) {
    const potential = computePotentialSavings(transactions);
    return `Your savings rate is ${savingsRate}% of income. Trimming dining, shopping and entertainment by 20% could add ${formatCurrency(potential)} to savings this month.`;
  }
  const dining = sumExpenses(transactions, new Set(['Dining']));
  if (dining > 2000) return `Dining out reached ${formatCurrency(dining)} this month. Keeping it in check will protect your savings.`;
  return `You are saving ${savingsRate}% of income this month.`;
}

const keywordMap: Record<string, string> = {
  swiggy: 'Dining', zomato: 'Dining', restaurant: 'Dining', canteen: 'Dining', cafe: 'Dining', coffee: 'Dining',
  shell: 'Transport', uber: 'Transport', petrol: 'Transport', ola: 'Transport', fuel: 'Transport', metro: 'Transport',
  netflix: 'Subscriptions', spotify: 'Subscriptions', prime: 'Subscriptions', hotstar: 'Subscriptions', disney: 'Subscriptions',
  electricity: 'Utilities', water: 'Utilities', gas: 'Utilities', broadband: 'Utilities', internet: 'Utilities',
  amazon: 'Shopping', zara: 'Shopping', decathlon: 'Shopping', flipkart: 'Shopping', myntra: 'Shopping',
  supermarket: 'Groceries', grocery: 'Groceries', whole: 'Groceries', bigbasket: 'Groceries', dmart: 'Groceries',
  pvr: 'Entertainment', cinema: 'Entertainment', movie: 'Entertainment', concert: 'Entertainment',
  salary: 'Salary', refund: 'Other income', interest: 'Other income', dividend: 'Other income',
};

export function suggestCategory(description: string, current: string) {
  const lower = description.toLowerCase();
  const match = Object.entries(keywordMap).find(([keyword]) => lower.includes(keyword));
  return match?.[1] ?? current;
}

export type ParsedCsvRow = {
  transaction_date: string;
  description: string;
  category: string;
  amount: number;
  transaction_type: TransactionType;
};

export function parseCsv(text: string): ParsedCsvRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = lines[0].split(',').map((h) => h.trim().toLowerCase());
  const dateIdx = headers.findIndex((h) => h.includes('date'));
  const descIdx = headers.findIndex((h) => h.includes('desc') || h.includes('narrat') || h.includes('detail') || h.includes('particular'));
  const amountIdx = headers.findIndex((h) => h.includes('amount') || h.includes('value'));
  const typeIdx = headers.findIndex((h) => h.includes('type') || h.includes('debit') || h.includes('credit'));

  const rows: ParsedCsvRow[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cols = lines[i].split(',').map((c) => c.trim().replace(/^"|"$/g, ''));
    const dateStr = dateIdx >= 0 ? cols[dateIdx] : '';
    const desc = descIdx >= 0 ? cols[descIdx] : cols[1] ?? '';
    const rawAmount = amountIdx >= 0 ? cols[amountIdx] : cols[2] ?? '';
    const amount = Math.abs(Number(rawAmount.replace(/[^0-9.-]/g, '')) || 0);
    if (!desc || amount <= 0) continue;

    let date = dateStr;
    if (/^\d{2}[-/]\d{2}[-/]\d{4}$/.test(date)) date = `${date.slice(6, 10)}-${date.slice(3, 5)}-${date.slice(0, 2)}`;
    else if (/^\d{4}[-/]\d{2}[-/]\d{2}$/.test(date)) date = date.replace(/\//g, '-');
    else date = toDateInputValue(new Date());

    const isNegative = rawAmount.includes('-') || (typeIdx >= 0 && cols[typeIdx].toLowerCase().includes('debit'));
    rows.push({
      transaction_date: date,
      description: desc,
      category: suggestCategory(desc, 'Dining'),
      amount,
      transaction_type: isNegative ? 'expense' : 'income',
    });
  }
  return rows;
}
