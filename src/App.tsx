import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowUpRight,
  BarChart3,
  Bell,
  Bot,
  Check,
  ChevronDown,
  CircleDollarSign,
  CreditCard,
  FileUp,
  Filter,
  Lightbulb,
  Menu,
  MoreHorizontal,
  Moon,
  Plus,
  Search,
  Sparkles,
  Sun,
  Target,
  TrendingDown,
  TrendingUp,
  Upload,
  Wallet,
  X,
  Zap,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { supabase } from '@/lib/supabase';
import {
  type Transaction,
  type TransactionType,
  categories,
  categoryList,
  formatCurrency,
  formatDate,
  getInitials,
  computeMonthlyTotals,
  computeExpensesByCategory,
  computeBudget,
  computeTrend,
  computeInsights,
  computeSpendingSignal,
  suggestCategory,
  parseCsv,
  type ParsedCsvRow,
} from '@/lib/finance';
import { AdvisorChat } from '@/components/AdvisorChat';
import { HealthReportPanel } from '@/components/HealthReportPanel';
import { computeHealthReport } from '@/lib/healthReport';

type Modal = 'add' | 'upload' | null;

const initialForm = {
  description: '',
  amount: '',
  category: 'Dining',
  transaction_date: new Date().toISOString().slice(0, 10),
  transaction_type: 'expense' as TransactionType,
};

function App() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('finai-theme') === 'dark');
  const [formError, setFormError] = useState('');
  const [modal, setModal] = useState<Modal>(null);
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);
  const [toast, setToast] = useState('');
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('All categories');
  const [form, setForm] = useState(initialForm);
  const [isCategorizing, setIsCategorizing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [reportGenerated, setReportGenerated] = useState(false);
  const [csvPreview, setCsvPreview] = useState<ParsedCsvRow[]>([]);
  const [uploading, setUploading] = useState(false);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    let active = true;
    async function loadTransactions() {
      const { data, error } = await supabase.from('finance_transactions').select('*').order('transaction_date', { ascending: false });
      if (!active) return;
      if (error) setToast('Could not load transactions. Showing a fresh workspace.');
      setTransactions((data ?? []) as Transaction[]);
      setLoading(false);
    }
    void loadTransactions();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('finance_transactions_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'finance_transactions' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setTransactions((current) => {
            if (current.some((t) => t.id === (payload.new as Transaction).id)) return current;
            return [payload.new as Transaction, ...current];
          });
        } else if (payload.eventType === 'UPDATE') {
          setTransactions((current) => current.map((t) => (t.id === (payload.new as Transaction).id ? (payload.new as Transaction) : t)));
        } else if (payload.eventType === 'DELETE') {
          setTransactions((current) => current.filter((t) => t.id !== (payload.old as Transaction).id));
        }
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, []);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    localStorage.setItem('finai-theme', darkMode ? 'dark' : 'light');
  }, [darkMode]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(''), 3500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const todaysTransactions = useMemo(() => {
    const thisMonth = now.toISOString().slice(0, 7);
    return transactions.filter((t) => t.transaction_date.slice(0, 7) === thisMonth);
  }, [transactions, now]);

  const filteredTransactions = useMemo(() => transactions.filter((transaction) => {
    const matchesSearch = transaction.description.toLowerCase().includes(search.toLowerCase()) || transaction.category.toLowerCase().includes(search.toLowerCase());
    return matchesSearch && (categoryFilter === 'All categories' || transaction.category === categoryFilter);
  }), [transactions, search, categoryFilter]);

  const { income: monthlyIncome, expenses: monthlyExpenses, savings, savingsRate } = computeMonthlyTotals(todaysTransactions);
  const expensesByCategory = computeExpensesByCategory(todaysTransactions);
  const trend = computeTrend(transactions);
  const budget = computeBudget(todaysTransactions);
  const insights = useMemo(() => computeInsights(todaysTransactions), [todaysTransactions]);
  const visibleInsight = computeSpendingSignal(todaysTransactions, reportGenerated);
  const uncategorizedCount = transactions.filter((t) => !t.ai_tagged).length;
  const healthReport = useMemo(() => computeHealthReport(todaysTransactions), [todaysTransactions]);

  const greeting = useMemo(() => {
    const h = now.getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  }, [now]);

  const dateLabel = useMemo(() => {
    return new Intl.DateTimeFormat('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(now);
  }, [now]);

  const sidebarGoalsPct = Math.min(Math.round((savings / Math.max(monthlyIncome, 1)) * 100 * 1.3), 100);
  const sidebarGoalRemaining = Math.max(Math.round(monthlyIncome * 0.2) - savings, 0);

  function showToast(message: string) { setToast(message); }

  async function addTransaction(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const amount = Number(form.amount);
    if (!form.description.trim()) { setFormError('Please enter a description.'); return; }
    if (!Number.isFinite(amount) || amount <= 0) { setFormError('Amount must be greater than 0.'); return; }
    setFormError('');
    const { data, error } = await supabase.from('finance_transactions').insert({ ...form, description: form.description.trim(), amount, ai_tagged: false }).select().maybeSingle();
    if (error || !data) { showToast('We could not save that transaction. Try again.'); return; }
    setForm(initialForm);
    setModal(null);
    showToast('Transaction added to your ledger.');
  }

  async function autoCategorize() {
    setIsCategorizing(true);
    const uncategorized = transactions.filter((item) => !item.ai_tagged);
    if (uncategorized.length === 0) {
      setIsCategorizing(false);
      showToast('All transactions are already reviewed.');
      return;
    }
    const updates = uncategorized.map((item) => {
      const newCategory = suggestCategory(item.description, item.category);
      return { ...item, category: newCategory, ai_tagged: true };
    });
    for (const item of updates) {
      await supabase.from('finance_transactions').update({ category: item.category, ai_tagged: true }).eq('id', item.id);
    }
    setTransactions((current) => current.map((item) => updates.find((update) => update.id === item.id) ?? item));
    setIsCategorizing(false);
    showToast(`${updates.length} transactions reviewed by finAI.`);
  }

  async function generateReport() {
    setIsGenerating(true);
    await new Promise((resolve) => window.setTimeout(resolve, 850));
    setIsGenerating(false);
    setReportGenerated(true);
    showToast('Your personalized health report is ready.');
  }

  async function deleteTransaction(id: string) {
    const { error } = await supabase.from('finance_transactions').delete().eq('id', id);
    if (error) { showToast('Could not remove this transaction.'); return; }
    showToast('Transaction removed.');
  }

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const text = await file.text();
      const rows = parseCsv(text);
      if (rows.length === 0) {
        showToast('Could not read any rows from that file. Use columns: date, description, amount.');
        setUploading(false);
        return;
      }
      setCsvPreview(rows);
    } catch {
      showToast('Could not read that file. Please try a different CSV.');
    }
    setUploading(false);
    event.target.value = '';
  }

  async function importCsvRows() {
    if (csvPreview.length === 0) return;
    setUploading(true);
    const rows = csvPreview.map((r) => ({ ...r, ai_tagged: true }));
    const { error } = await supabase.from('finance_transactions').insert(rows);
    setUploading(false);
    if (error) { showToast('Could not import those transactions.'); return; }
    showToast(`${rows.length} transactions imported from your statement.`);
    setCsvPreview([]);
    setModal(null);
  }

  const insightIcons = { TrendingDown: TrendingDown, Lightbulb: Lightbulb, Target: Target };

  return (
    <div className={darkMode ? 'dark' : ''}>
      <div className="min-h-screen bg-[#f7f9fc] text-[#172b4d] transition-colors dark:bg-[#111a29] dark:text-[#e7edf7]">
        <aside className={`fixed inset-y-0 left-0 z-40 flex w-[248px] flex-col border-r border-[#e8edf4] bg-white px-5 py-7 transition-transform dark:border-[#273449] dark:bg-[#172235] ${showMobileNav ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}`}>
          <div className="mb-12 flex items-center gap-3 px-2"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#153c68] text-white shadow-lg shadow-[#153c68]/20"><CircleDollarSign size={23} /></div><div><div className="text-[17px] font-bold tracking-tight">finAI</div><div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#97a5b8]">Your money, smarter</div></div></div>
          <nav className="space-y-2 text-sm font-semibold"><p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[0.16em] text-[#9aa7ba]">Workspace</p><a className="flex items-center gap-3 rounded-xl bg-[#edf5fc] px-3.5 py-3 text-[#1c68a4] dark:bg-[#203c5e] dark:text-[#a8d5ff]" href="#overview"><BarChart3 size={18} /> Overview</a><a className="flex items-center gap-3 rounded-xl px-3.5 py-3 text-[#73839a] transition-colors hover:bg-[#f3f6fa] hover:text-[#1c68a4] dark:hover:bg-[#203044]" href="#transactions"><CreditCard size={18} /> Transactions</a><a className="flex items-center gap-3 rounded-xl px-3.5 py-3 text-[#73839a] transition-colors hover:bg-[#f3f6fa] hover:text-[#1c68a4] dark:hover:bg-[#203044]" href="#advisor"><Bot size={18} /> AI Advisor <span className="ml-auto rounded-md bg-[#e8f7ef] px-1.5 py-0.5 text-[9px] text-[#27805a]">NEW</span></a><a className="flex items-center gap-3 rounded-xl px-3.5 py-3 text-[#73839a] transition-colors hover:bg-[#f3f6fa] hover:text-[#1c68a4] dark:hover:bg-[#203044]" href="#budget"><Target size={18} /> Budgets</a></nav>
          <div className="mt-auto rounded-2xl bg-[#f3f8fc] p-4 dark:bg-[#203044]"><div className="mb-3 flex items-center justify-between"><span className="text-xs font-bold">Savings goal</span><Target size={16} className="text-[#2e9f83]" /></div><div className="mb-2 flex items-end justify-between"><span className="text-2xl font-bold">{sidebarGoalsPct}%</span><span className="text-[10px] text-[#8291a5]">{sidebarGoalsPct >= 100 ? 'reached' : 'on track'}</span></div><div className="h-1.5 overflow-hidden rounded-full bg-[#dbe7f0]"><div className="h-full rounded-full bg-[#2e9f83] transition-all duration-700" style={{ width: `${sidebarGoalsPct}%` }} /></div><p className="mt-3 text-[11px] leading-4 text-[#8291a5]">{sidebarGoalRemaining > 0 ? `You're ${formatCurrency(sidebarGoalRemaining)} away from your monthly savings goal.` : 'You have hit your monthly savings goal.'}</p></div>
          <div className="mt-5 flex items-center gap-3 border-t border-[#edf0f4] pt-5 dark:border-[#2a394d]"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#dce9f8] text-xs font-bold text-[#27689f]">AK</div><div className="min-w-0 flex-1"><p className="truncate text-xs font-bold">Aarav Kapoor</p><p className="text-[10px] text-[#8a98aa]">Personal account</p></div><MoreHorizontal size={17} className="text-[#9aa7b7]" /></div>
        </aside>
        {showMobileNav && <button aria-label="Close menu" className="fixed inset-0 z-30 bg-[#10243d]/30 lg:hidden" onClick={() => setShowMobileNav(false)} />}
        <main className="lg:ml-[248px]">
          <header className="sticky top-0 z-20 flex h-[74px] items-center justify-between border-b border-[#e8edf4]/80 bg-[#f7f9fc]/90 px-5 backdrop-blur-xl dark:border-[#273449] dark:bg-[#111a29]/90 sm:px-8 lg:px-10"><div className="flex items-center gap-3"><button className="rounded-lg p-2 text-[#708099] lg:hidden" onClick={() => setShowMobileNav(true)}><Menu size={20} /></button><div><p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#93a1b3]">{dateLabel}</p><h1 className="mt-0.5 text-xl font-bold tracking-tight">{greeting}, Aarav<span className="text-[#2e9f83]">.</span></h1></div></div><div className="flex items-center gap-2 sm:gap-4"><label className="flex h-9 items-center gap-2 rounded-lg border border-[#e2e8ef] bg-white px-3 shadow-sm focus-within:border-[#4c9bdd] dark:border-[#304158] dark:bg-[#1a293e]"><Search size={15} className="shrink-0 text-[#a1adbc]" /><input aria-label="Search transactions" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search transactions" className="w-28 bg-transparent text-xs outline-none placeholder:text-[#a1adbc] sm:w-44 lg:w-56" /></label><button aria-label="Toggle theme" onClick={() => setDarkMode((value) => !value)} className="rounded-lg p-2 text-[#748399] transition hover:bg-white dark:hover:bg-[#1c2b40]">{darkMode ? <Sun size={18} /> : <Moon size={18} />}</button><div className="relative"><button aria-label="Notifications" className="relative rounded-lg p-2 text-[#748399] transition hover:bg-white dark:hover:bg-[#1c2b40]" onClick={() => setShowNotifications((v) => !v)}><Bell size={18} />{uncategorizedCount > 0 && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-[#e97962]" />}</button>{showNotifications && <div className="absolute right-0 top-12 z-30 w-64 rounded-xl border border-[#e6ebf1] bg-white p-4 shadow-xl dark:border-[#29384d] dark:bg-[#172235]"><p className="mb-2 text-xs font-bold">Notifications</p>{uncategorizedCount > 0 ? <p className="text-[11px] leading-4 text-[#73839a]">You have {uncategorizedCount} transaction{uncategorizedCount > 1 ? 's' : ''} ready for auto-categorization.</p> : <p className="text-[11px] leading-4 text-[#73839a]">You are all caught up.</p>}</div>}</div><div className="hidden h-8 w-px bg-[#e2e8ef] dark:bg-[#304158] sm:block" /><div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#dce9f8] text-xs font-bold text-[#27689f]">{getInitials('Aarav Kapoor')}</div></div></header>
          <div className="mx-auto max-w-[1500px] px-5 py-7 sm:px-8 lg:px-10">
            <div id="overview" className="mb-7 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><div className="mb-2 flex items-center gap-2 text-xs font-semibold text-[#73839a]"><span>Overview</span><span className="text-[#c1cbd7]">/</span><span>{new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(now)}</span></div><h2 className="text-2xl font-bold tracking-tight sm:text-[28px]">Your financial snapshot</h2><p className="mt-1 text-sm text-[#8291a5]">A clear view of where your money is going this month.</p></div><div className="flex gap-2"><button onClick={() => setModal('upload')} className="flex items-center gap-2 rounded-xl border border-[#dfe7ef] bg-white px-3.5 py-2.5 text-xs font-bold text-[#55677f] shadow-sm transition hover:-translate-y-0.5 hover:border-[#c5d5e5] dark:border-[#304158] dark:bg-[#1a293e] dark:text-[#b9c9dc]"><Upload size={15} /> Upload statement</button><button onClick={() => setModal('add')} className="flex items-center gap-2 rounded-xl bg-[#1e6d9f] px-3.5 py-2.5 text-xs font-bold text-white shadow-lg shadow-[#1e6d9f]/20 transition hover:-translate-y-0.5 hover:bg-[#195d8b]"><Plus size={16} /> Add transaction</button></div></div>
            <section className="mb-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4"><MetricCard title="Total monthly income" value={formatCurrency(monthlyIncome, true)} change={`${savingsRate >= 0 ? '+' : ''}${savingsRate}%`} positive={savingsRate >= 0} icon={<ArrowDownLeft size={18} />} accent="blue" caption="this month" /><MetricCard title="Total expenses" value={formatCurrency(monthlyExpenses, true)} change={monthlyExpenses > 0 ? `${Math.round((monthlyExpenses / Math.max(monthlyIncome, 1)) * 100)}%` : '0%'} positive={false} icon={<ArrowUpRight size={18} />} accent="orange" caption="of income" /><MetricCard title="Net savings" value={formatCurrency(savings, true)} change={savings >= 0 ? 'Positive' : 'Negative'} positive={savings >= 0} icon={<Wallet size={18} />} accent="green" caption="this month" /><MetricCard title="Savings rate" value={`${savingsRate}%`} change={savingsRate >= 20 ? 'On track' : 'Below target'} positive={savingsRate >= 20} icon={<TrendingUp size={18} />} accent="violet" caption="target: 20%" /></section>
            <section className="mb-7 grid gap-5 xl:grid-cols-[1.35fr_0.85fr]"><div className="rounded-2xl border border-[#e6ebf1] bg-white p-5 shadow-[0_4px_20px_rgba(34,58,86,0.03)] dark:border-[#29384d] dark:bg-[#172235] sm:p-6"><div className="mb-6 flex items-start justify-between"><div><h3 className="text-[15px] font-bold">Cash flow overview</h3><p className="mt-1 text-xs text-[#8492a5]">Income and expenses over the last 6 months</p></div><span className="flex items-center gap-1 rounded-lg border border-[#e5ebf2] px-2.5 py-1.5 text-[11px] font-bold text-[#75849a] dark:border-[#304158]">Last 6 months <ChevronDown size={13} /></span></div><div className="h-[245px]">{trend.every((m) => m.income === 0 && m.expenses === 0) ? <div className="flex h-full items-center justify-center text-sm text-[#8291a5]">Add transactions to see your cash flow.</div> : <ResponsiveContainer width="100%" height="100%"><AreaChart data={trend} margin={{ top: 8, right: 4, left: -20, bottom: 0 }}><defs><linearGradient id="incomeFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#4c9bdd" stopOpacity={0.22} /><stop offset="100%" stopColor="#4c9bdd" stopOpacity={0} /></linearGradient><linearGradient id="expenseFill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#ef8f70" stopOpacity={0.2} /><stop offset="100%" stopColor="#ef8f70" stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} stroke="#e9eef4" strokeDasharray="3 3" /><XAxis dataKey="month" tick={{ fontSize: 11, fill: '#8a98aa' }} axisLine={false} tickLine={false} /><YAxis tick={{ fontSize: 10, fill: '#a0abba' }} axisLine={false} tickLine={false} tickFormatter={(value: number) => `₹${Math.round(value / 1000)}k`} /><Tooltip formatter={(value: unknown) => formatCurrency(Number(value ?? 0))} contentStyle={{ borderRadius: 10, border: '1px solid #e5ebf2', fontSize: 12 }} /><Area type="monotone" dataKey="income" name="Income" stroke="#4c9bdd" strokeWidth={2.5} fill="url(#incomeFill)" /><Area type="monotone" dataKey="expenses" name="Expenses" stroke="#ef8f70" strokeWidth={2.5} fill="url(#expenseFill)" /></AreaChart></ResponsiveContainer>}</div><div className="mt-3 flex gap-5 text-xs font-semibold text-[#718198]"><span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#4c9bdd]" /> Income</span><span className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-[#ef8f70]" /> Expenses</span><span className={`ml-auto ${savings >= 0 ? 'text-[#2e9f83]' : 'text-[#d46755]'}`}>{savings >= 0 ? 'Net positive' : 'Net negative'} {savings >= 0 ? <TrendingUp className="ml-1 inline" size={13} /> : <TrendingDown className="ml-1 inline" size={13} />}</span></div></div><div className="rounded-2xl border border-[#e6ebf1] bg-white p-5 shadow-[0_4px_20px_rgba(34,58,86,0.03)] dark:border-[#29384d] dark:bg-[#172235] sm:p-6"><div className="mb-5"><h3 className="text-[15px] font-bold">Expense breakdown</h3><p className="mt-1 text-xs text-[#8492a5]">Where your money went this month</p></div><div className="flex items-center gap-4">{expensesByCategory.length === 0 ? <div className="flex h-[190px] w-full items-center justify-center text-sm text-[#8291a5]">Your breakdown will appear here.</div> : <><div className="h-[190px] w-[52%]"><ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={expensesByCategory} dataKey="value" nameKey="name" innerRadius={54} outerRadius={78} paddingAngle={3} stroke="none">{expensesByCategory.map((entry) => <Cell key={entry.name} fill={categories[entry.name]?.color ?? '#9aa7b7'} />)}</Pie><Tooltip formatter={(value: unknown) => formatCurrency(Number(value ?? 0))} contentStyle={{ borderRadius: 10, border: '1px solid #e5ebf2', fontSize: 12 }} /></PieChart></ResponsiveContainer></div><div className="flex-1 space-y-2.5">{expensesByCategory.slice(0, 5).map((entry) => <div key={entry.name} className="flex items-center justify-between gap-2 text-[11px]"><span className="flex items-center gap-2 text-[#75849a]"><span className="h-2 w-2 rounded-full" style={{ backgroundColor: categories[entry.name]?.color }} />{entry.name}</span><span className="font-bold">{Math.round((entry.value / Math.max(monthlyExpenses, 1)) * 100)}%</span></div>)}</div></>}</div><div className="mt-1 flex items-center justify-between border-t border-[#edf0f4] pt-4 text-xs dark:border-[#2a394d]"><span className="text-[#8291a5]">Total expenses</span><span className="font-bold">{formatCurrency(monthlyExpenses)}</span></div></div></section>
            <section id="budget" className="mb-7 rounded-2xl border border-[#e6ebf1] bg-white p-5 shadow-[0_4px_20px_rgba(34,58,86,0.03)] dark:border-[#29384d] dark:bg-[#172235] sm:p-6"><div className="mb-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-center"><div><h3 className="text-[15px] font-bold">50 / 30 / 20 budget rule</h3><p className="mt-1 text-xs text-[#8492a5]">Your spending compared with a healthy monthly allocation</p></div><span className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold ${savingsRate >= 20 ? 'bg-[#e8f7ef] text-[#27805a]' : 'bg-[#fff0eb] text-[#c65a3c]'}`}><Check size={12} /> {savingsRate >= 20 ? 'Healthy balance' : 'Needs attention'}</span></div><div className="grid gap-5 md:grid-cols-3"><BudgetBar label="Needs" target="50%" used={Math.min(budget.needs.pct, 100)} value={formatCurrency(budget.needs.amount, true)} color="#4c9bdd" detail="of recommended 50%" /><BudgetBar label="Wants" target="30%" used={Math.min(budget.wants.pct, 100)} value={formatCurrency(budget.wants.amount, true)} color="#ef8f70" detail="of recommended 30%" /><BudgetBar label="Savings" target="20%" used={Math.min(budget.savings.pct, 100)} value={formatCurrency(budget.savings.amount, true)} color="#2e9f83" detail="of recommended 20%" /></div></section>
            <section id="advisor" className="mb-7 overflow-hidden rounded-2xl border border-[#cfe3e5] bg-[#f0faf9] dark:border-[#28525a] dark:bg-[#162d35]"><div className="grid gap-0 lg:grid-cols-[1.25fr_0.75fr]"><div className="p-5 sm:p-7"><div className="mb-6 flex items-start justify-between"><div className="flex items-start gap-3"><div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#d8f1ed] text-[#2e9f83]"><Sparkles size={20} /></div><div><h3 className="text-[16px] font-bold">AI Financial Advisor</h3><p className="mt-1 text-xs text-[#6f8b91]">Personalized guidance based on your spending patterns</p></div></div><span className="rounded-full bg-white/70 px-2 py-1 text-[10px] font-bold text-[#4e8c8a] dark:bg-white/10">FINAI INSIGHT</span></div><div className="mb-5 rounded-xl border border-[#d9eeeb] bg-white/70 p-4 dark:border-[#2d5359] dark:bg-white/5"><div className="mb-2 flex items-center gap-2 text-xs font-bold text-[#3a7779]"><Zap size={14} /> Spending signal</div><p className="text-sm font-semibold leading-6 text-[#38545e] dark:text-[#d7e8e8]">{visibleInsight}</p></div><div className="grid gap-3 sm:grid-cols-3">{insights.map((insight, i) => { const Icon = insightIcons[insight.icon]; return <Insight key={i} icon={<Icon size={15} />} title={insight.title} text={insight.text} />; })}</div></div><div className="flex flex-col justify-between border-t border-[#d7ecea] bg-[#e6f6f3]/70 p-5 dark:border-[#28525a] dark:bg-[#19343b] sm:p-7 lg:border-l lg:border-t-0"><div><p className="mb-2 text-xs font-bold uppercase tracking-[0.12em] text-[#5c8d8c]">Estimated potential savings</p><p className="text-4xl font-bold tracking-tight text-[#1e625f] dark:text-[#b8e1dc]">{formatCurrency(healthReport.potentialSavings)}<span className="ml-1 text-lg font-medium">/mo</span></p><p className="mt-2 text-xs leading-5 text-[#6c8d91]">If you follow your tailored recommendations</p></div><button disabled={isGenerating} onClick={() => void generateReport()} className="mt-8 flex w-full items-center justify-center gap-2 rounded-xl bg-[#247f7a] px-4 py-3 text-xs font-bold text-white shadow-lg shadow-[#247f7a]/20 transition hover:-translate-y-0.5 hover:bg-[#1d6d69] disabled:opacity-70">{isGenerating ? <span className="animate-pulse">Analyzing your habits...</span> : <><Bot size={16} /> {reportGenerated ? 'Report refreshed' : 'Generate health report'}</>}</button></div></div></section>
            <AdvisorChat transactions={todaysTransactions} />{reportGenerated && <HealthReportPanel report={healthReport} />}<section id="transactions" className="rounded-2xl border border-[#e6ebf1] bg-white shadow-[0_4px_20px_rgba(34,58,86,0.03)] dark:border-[#29384d] dark:bg-[#172235]"><div className="flex flex-col justify-between gap-4 border-b border-[#edf0f4] p-5 dark:border-[#2a394d] sm:flex-row sm:items-center sm:p-6"><div><h3 className="text-[15px] font-bold">Recent transactions</h3><p className="mt-1 text-xs text-[#8492a5]">{transactions.length} entries synced to your ledger</p></div><div className="flex flex-wrap gap-2"><div className="flex items-center gap-2 rounded-lg border border-[#e3e9f0] px-3 py-2 dark:border-[#304158]"><Search size={14} className="text-[#a1adbc]" /><input aria-label="Search transactions" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search" className="w-24 bg-transparent text-xs outline-none placeholder:text-[#a1adbc] sm:w-32" /></div><select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="rounded-lg border border-[#e3e9f0] bg-transparent px-2.5 py-2 text-xs font-semibold text-[#718198] outline-none dark:border-[#304158]"><option>All categories</option>{categoryList.map((category) => <option key={category}>{category}</option>)}</select><button onClick={() => void autoCategorize()} disabled={isCategorizing} className="flex items-center gap-1.5 rounded-lg bg-[#edf5fc] px-3 py-2 text-[11px] font-bold text-[#1c68a4] transition hover:bg-[#e0effb] disabled:opacity-60 dark:bg-[#203c5e] dark:text-[#a8d5ff]"><Sparkles size={14} /> {isCategorizing ? 'Tagging...' : 'Auto-categorize'}</button></div></div><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left"><thead className="border-b border-[#edf0f4] bg-[#fbfcfd] text-[10px] font-bold uppercase tracking-[0.08em] text-[#99a6b6] dark:border-[#2a394d] dark:bg-[#1a293e]"><tr><th className="px-6 py-3.5">Date</th><th className="px-4 py-3.5">Description</th><th className="px-4 py-3.5">Category</th><th className="px-4 py-3.5 text-right">Amount</th><th className="px-4 py-3.5">Type</th><th className="px-6 py-3.5 text-right">Action</th></tr></thead><tbody className="divide-y divide-[#eff2f5] dark:divide-[#2a394d]">{loading ? <tr><td colSpan={6} className="px-6 py-12 text-center text-sm text-[#8291a5]">Loading your ledger...</td></tr> : filteredTransactions.length === 0 ? <tr><td colSpan={6} className="px-6 py-12 text-center text-sm text-[#8291a5]">No transactions match your filters.</td></tr> : filteredTransactions.map((transaction) => <tr key={transaction.id} className="group transition hover:bg-[#fbfdff] dark:hover:bg-[#1b2b40]"><td className="whitespace-nowrap px-6 py-4 text-xs font-medium text-[#7f8da0]">{formatDate(transaction.transaction_date)}</td><td className="px-4 py-4"><div className="flex items-center gap-3"><div className={`flex h-8 w-8 items-center justify-center rounded-lg ${transaction.transaction_type === 'income' ? 'bg-[#e8f7ef] text-[#2e9f83]' : 'bg-[#f2f5f8] text-[#718198]'} `}>{transaction.transaction_type === 'income' ? <ArrowDownLeft size={15} /> : <CreditCard size={15} />}</div><div><p className="text-xs font-bold">{transaction.description}</p>{transaction.ai_tagged && <span className="mt-0.5 inline-flex items-center gap-1 text-[9px] font-semibold text-[#2e9f83]"><Sparkles size={9} /> AI tagged</span>}</div></div></td><td className="px-4 py-4"><span className={`rounded-md px-2 py-1 text-[10px] font-bold ${categories[transaction.category]?.soft ?? 'bg-[#f2f5f8] text-[#718198]'}`}>{transaction.category}</span></td><td className={`px-4 py-4 text-right text-xs font-bold ${transaction.transaction_type === 'income' ? 'text-[#2e9f83]' : 'text-[#263d5a] dark:text-[#c5d2e0]'}`}>{transaction.transaction_type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}</td><td className="px-4 py-4"><span className={`text-[10px] font-bold ${transaction.transaction_type === 'income' ? 'text-[#2e9f83]' : 'text-[#8492a5]'}`}>{transaction.transaction_type === 'income' ? 'Income' : 'Expense'}</span></td><td className="px-6 py-4 text-right"><button aria-label={`Delete ${transaction.description}`} onClick={() => void deleteTransaction(transaction.id)} className="rounded-lg p-2 text-[#b1bbc8] transition hover:bg-[#fff0ed] hover:text-[#d46755] dark:text-[#9fb0c4] dark:hover:bg-[#3a2422] dark:hover:text-[#f08b7a]"><X size={15} /></button></td></tr>)}</tbody></table></div><div className="flex items-center justify-between border-t border-[#edf0f4] px-6 py-4 text-xs dark:border-[#2a394d]"><span className="text-[#8291a5]">Showing {filteredTransactions.length} of {transactions.length} transactions</span><button className="flex items-center gap-1 font-bold text-[#2672a8]" onClick={() => { setSearch(''); setCategoryFilter('All categories'); }}>Clear filters <Filter size={13} /></button></div></section>
          </div>
        </main>
        {toast && <div className="fixed bottom-5 right-5 z-50 flex max-w-[calc(100vw-40px)] items-center gap-3 rounded-xl bg-[#183452] px-4 py-3 text-xs font-semibold text-white shadow-xl"><div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#2e9f83]"><Check size={14} /></div>{toast}<button aria-label="Dismiss notification" onClick={() => setToast('')}><X size={14} className="ml-2 text-white/60" /></button></div>}
        {modal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#12253c]/35 p-4 backdrop-blur-sm" onClick={(e) => { if (e.target === e.currentTarget) { setModal(null); setCsvPreview([]); } }}><div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl dark:bg-[#1b2a3e]"><div className="mb-6 flex items-start justify-between"><div><h3 className="text-lg font-bold">{modal === 'add' ? 'Add a transaction' : 'Upload statement'}</h3><p className="mt-1 text-xs text-[#8492a5]">{modal === 'add' ? 'Keep your ledger accurate with a quick entry.' : 'Import a CSV statement and let finAI organize it.'}</p></div><button onClick={() => { setModal(null); setCsvPreview([]); }} className="rounded-lg p-1 text-[#8b99aa] hover:bg-[#f3f6f9]"><X size={18} /></button></div>{modal === 'add' ? <form onSubmit={(event) => void addTransaction(event)} className="space-y-4"><label className="block text-xs font-bold text-[#62738a]">Description<input required value={form.description} onChange={(event) => setForm({ ...form, description: event.target.value })} placeholder="e.g. Coffee at Blue Tokai" className="mt-1.5 w-full rounded-lg border border-[#dfe7ef] bg-transparent px-3 py-2.5 text-sm outline-none focus:border-[#4c9bdd] dark:border-[#35465d]" /></label><div className="grid grid-cols-2 gap-3"><label className="block text-xs font-bold text-[#62738a]">Amount<input required type="number" min="0" step="0.01" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} placeholder="0.00" className="mt-1.5 w-full rounded-lg border border-[#dfe7ef] bg-transparent px-3 py-2.5 text-sm outline-none focus:border-[#4c9bdd] dark:border-[#35465d]" /></label><label className="block text-xs font-bold text-[#62738a]">Date<input required type="date" value={form.transaction_date} onChange={(event) => setForm({ ...form, transaction_date: event.target.value })} className="mt-1.5 w-full rounded-lg border border-[#dfe7ef] bg-transparent px-3 py-2.5 text-sm outline-none focus:border-[#4c9bdd] dark:border-[#35465d]" /></label></div><div className="grid grid-cols-2 gap-3"><label className="block text-xs font-bold text-[#62738a]">Category<select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })} className="mt-1.5 w-full rounded-lg border border-[#dfe7ef] bg-transparent px-3 py-2.5 text-sm outline-none dark:border-[#35465d]">{Object.keys(categories).map((category) => <option key={category}>{category}</option>)}</select></label><label className="block text-xs font-bold text-[#62738a]">Type<select value={form.transaction_type} onChange={(event) => setForm({ ...form, transaction_type: event.target.value as TransactionType })} className="mt-1.5 w-full rounded-lg border border-[#dfe7ef] bg-transparent px-3 py-2.5 text-sm outline-none dark:border-[#35465d]"><option value="expense">Expense</option><option value="income">Income</option></select></label></div>{formError && <p role="alert" className="text-xs font-semibold text-[#d46755] dark:text-[#f08b7a]">{formError}</p>}<button type="submit" className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#1e6d9f] py-3 text-sm font-bold text-white transition hover:bg-[#195d8b]"><Plus size={16} /> Save transaction</button></form> : csvPreview.length > 0 ? <div className="space-y-3"><div className="max-h-52 overflow-y-auto rounded-lg border border-[#e3e9f0] dark:border-[#304158]"><table className="w-full text-left text-xs"><thead className="sticky top-0 bg-[#fbfcfd] text-[10px] font-bold uppercase text-[#99a6b6] dark:bg-[#1a293e]"><tr><th className="px-3 py-2">Date</th><th className="px-3 py-2">Description</th><th className="px-3 py-2">Category</th><th className="px-3 py-2 text-right">Amount</th></tr></thead><tbody className="divide-y divide-[#eff2f5] dark:divide-[#2a394d]">{csvPreview.map((row, i) => <tr key={i}><td className="px-3 py-2 text-[#7f8da0]">{row.transaction_date}</td><td className="px-3 py-2 font-semibold">{row.description}</td><td className="px-3 py-2"><span className={`rounded px-1.5 py-0.5 text-[10px] font-bold ${categories[row.category]?.soft ?? ''}`}>{row.category}</span></td><td className="px-3 py-2 text-right font-bold">{row.transaction_type === 'income' ? '+' : '-'}{formatCurrency(row.amount)}</td></tr>)}</tbody></table></div><p className="text-xs text-[#8492a5]">{csvPreview.length} transactions will be imported and auto-categorized.</p><div className="flex gap-2"><button onClick={() => setCsvPreview([])} className="flex-1 rounded-xl border border-[#dfe7ef] py-2.5 text-xs font-bold text-[#55677f] dark:border-[#35465d]">Back</button><button disabled={uploading} onClick={() => void importCsvRows()} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[#1e6d9f] py-2.5 text-xs font-bold text-white disabled:opacity-60">{uploading ? 'Importing...' : <><Upload size={14} /> Import {csvPreview.length} rows</>}</button></div></div> : <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-[#cddce9] bg-[#f7fbfe] px-6 py-12 text-center transition hover:border-[#72afd7] dark:border-[#38506b] dark:bg-[#1b3148]"><div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#e6f2fb] text-[#347fb4]"><FileUp size={23} /></div><p className="text-sm font-bold">Drop your statement here</p><p className="mt-1 text-xs text-[#8797a9]">CSV files up to 10MB — columns: date, description, amount</p><span className="mt-5 rounded-lg bg-white px-3 py-2 text-xs font-bold text-[#3377a8] shadow-sm dark:bg-[#263d56]">{uploading ? 'Reading...' : 'Choose file'}</span><input type="file" accept=".csv,text/csv" className="hidden" onChange={handleUpload} /></label>}</div></div>}
      </div>
    </div>
  );
}

function MetricCard({ title, value, change, positive, icon, accent, caption }: { title: string; value: string; change: string; positive: boolean; icon: React.ReactNode; accent: string; caption: string }) {
  const accentClasses: Record<string, string> = { blue: 'bg-[#e7f2fc] text-[#3c8bc8]', orange: 'bg-[#fff0eb] text-[#d26b4f]', green: 'bg-[#e8f7ef] text-[#2e9f83]', violet: 'bg-[#f0ecff] text-[#8465cc]' };
  return <div className="rounded-2xl border border-[#e6ebf1] bg-white p-5 shadow-[0_4px_20px_rgba(34,58,86,0.03)] transition duration-300 hover:-translate-y-1 hover:shadow-lg dark:border-[#29384d] dark:bg-[#172235]"><div className="mb-4 flex items-start justify-between"><div className={`flex h-9 w-9 items-center justify-center rounded-xl ${accentClasses[accent]}`}>{icon}</div><span className={`flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold ${positive ? 'bg-[#e8f7ef] text-[#27805a]' : 'bg-[#fff0eb] text-[#c65a3c]'}`}>{positive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}{change}</span></div><p className="text-xs font-semibold text-[#8291a5]">{title}</p><p className="mt-1.5 text-[25px] font-bold tracking-tight">{value}</p><p className="mt-1 text-[10px] text-[#9aa7b7]">{caption}</p></div>;
}
function BudgetBar({ label, target, used, value, color, detail }: { label: string; target: string; used: number; value: string; color: string; detail: string }) {
  return <div><div className="mb-2 flex items-end justify-between"><div><p className="text-xs font-bold">{label} <span className="ml-1 font-medium text-[#97a5b5]">{target}</span></p><p className="mt-1 text-[11px] text-[#8492a5]">{value} <span className="text-[#a4afbc]">{detail}</span></p></div><span className="text-xs font-bold" style={{ color }}>{used}%</span></div><div className="h-2 overflow-hidden rounded-full bg-[#edf1f5]"><div className="h-full rounded-full transition-all duration-700" style={{ width: `${used}%`, backgroundColor: color }} /></div></div>;
}
function Insight({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <div className="rounded-xl border border-[#d9eeeb] bg-white/60 p-3 dark:border-[#2d5359] dark:bg-white/5"><div className="mb-2 flex items-center gap-1.5 text-[11px] font-bold text-[#367c7e]">{icon}{title}</div><p className="text-[11px] leading-4 text-[#6c858b] dark:text-[#a9c0c2]">{text}</p></div>;
}

export default App;
