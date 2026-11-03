import { FormEvent, useEffect, useRef, useState } from 'react';
import { Bot, Send, User } from 'lucide-react';
import {
  Transaction,
  categories,
  categoryList,
  computeBudget,
  computeExpensesByCategory,
  computeInsights,
  computeMonthlyTotals,
  formatCurrency,
} from '@/lib/finance';
import { supabase } from '@/lib/supabase';

type ChatMessage = { role: 'user' | 'assistant'; text: string };

const suggestions = ['How much did I spend?', 'What is my biggest category?', 'How is my budget?', 'Give me a tip'];

function answerLocally(question: string, transactions: Transaction[]): string {
  const q = question.toLowerCase();
  if (transactions.length === 0) {
    return 'There are no transactions this month for this account yet, so I have nothing to analyze. Add a few and ask me again.';
  }

  const { income, expenses, savings, savingsRate } = computeMonthlyTotals(transactions);
  const byCategory = computeExpensesByCategory(transactions);

  const mentionedCategory = categoryList.find((key) => {
    const label = categories[key].label.toLowerCase();
    return q.includes(key) || q.includes(label);
  });
  if (mentionedCategory) {
    const amount = byCategory.find((item) => item.name === mentionedCategory)?.value ?? 0;
    return `You have spent ${formatCurrency(amount)} on ${categories[mentionedCategory].label} this month.`;
  }

  if (/income|earn|salary/.test(q)) {
    return `Your income this month is ${formatCurrency(income)}.`;
  }
  if (/sav/.test(q)) {
    return savings >= 0
      ? `You have saved ${formatCurrency(savings)} this month, which is ${savingsRate}% of your income.`
      : `You are ${formatCurrency(Math.abs(savings))} over your income this month, so savings are negative.`;
  }
  if (/budget|50|30|20|need|want/.test(q)) {
    const budget = computeBudget(transactions);
    return `Needs are ${budget.needs.pct}% of income (target 50%), wants are ${budget.wants.pct}% (target 30%), and savings are ${budget.savings.pct}% (target 20%).`;
  }
  if (/biggest|top|most|categor|where/.test(q)) {
    if (byCategory.length === 0) return 'You have no expenses this month yet.';
    const top = byCategory.slice(0, 3)
      .map((item) => `${categories[item.name].label} (${formatCurrency(item.value)})`)
      .join(', ');
    return `Your largest spending categories this month are ${top}.`;
  }
  if (/spen|expense|total|much/.test(q)) {
    return `You have spent ${formatCurrency(expenses)} this month against ${formatCurrency(income)} of income.`;
  }
  if (/tip|advice|help|cut|reduce|improve|suggest|how/.test(q)) {
    return computeInsights(transactions).map((insight) => insight.text).join(' ');
  }

  return 'I can answer questions about your spending, income, savings, budget, and categories this month. Try asking "What is my biggest category?" or "Give me a tip."';
}

function buildContext(transactions: Transaction[]) {
  const totals = computeMonthlyTotals(transactions);
  const budget = computeBudget(transactions);
  return {
    monthLabel: new Intl.DateTimeFormat('en-IN', { month: 'long', year: 'numeric' }).format(new Date()),
    totals,
    budget: { needsPct: budget.needs.pct, wantsPct: budget.wants.pct, savingsPct: budget.savings.pct },
    expensesByCategory: computeExpensesByCategory(transactions).map((item) => ({
      category: categories[item.name].label,
      amount: item.value,
    })),
    transactions: transactions.map((t) => ({
      date: t.transaction_date,
      description: t.description,
      category: categories[t.category]?.label ?? t.category,
      type: t.transaction_type,
      amount: t.amount,
    })),
  };
}

async function answerQuestion(question: string, transactions: Transaction[]): Promise<string> {
  if (transactions.length === 0) return answerLocally(question, transactions);
  const { data, error } = await supabase.functions.invoke<{ answer?: string }>('advisor-chat', {
    body: { question, context: buildContext(transactions) },
  });
  if (error || typeof data?.answer !== 'string') return answerLocally(question, transactions);
  return data.answer;
}

export function AdvisorChat({ transactions }: { transactions: Transaction[] }) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { role: 'assistant', text: 'Hi Aarav, ask me anything about your spending this month.' },
  ]);
  const [input, setInput] = useState('');
  const [isAnswering, setIsAnswering] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, isAnswering]);

  const send = async (text: string) => {
    const question = text.trim();
    if (!question || isAnswering) return;
    setMessages((prev) => [...prev, { role: 'user', text: question }]);
    setInput('');
    setIsAnswering(true);
    const reply = await answerQuestion(question, transactions);
    setMessages((prev) => [...prev, { role: 'assistant', text: reply }]);
    setIsAnswering(false);
  };

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    void send(input);
  };

  return (
    <section className="mb-7 overflow-hidden rounded-2xl border border-[#e6ebf1] bg-white shadow-[0_4px_20px_rgba(34,58,86,0.03)] dark:border-[#29384d] dark:bg-[#172235]">
      <div className="flex items-center gap-3 border-b border-[#edf0f4] p-5 dark:border-[#2a394d] sm:p-6">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#d8f1ed] text-[#2e9f83]">
          <Bot size={20} />
        </div>
        <div>
          <h3 className="text-[15px] font-bold">Ask your advisor</h3>
          <p className="mt-1 text-xs text-[#73839a] dark:text-[#9aa7ba]">Chat about this month's spending, income and savings</p>
        </div>
      </div>

      <div ref={scrollRef} className="flex h-72 flex-col gap-3 overflow-y-auto p-5 sm:p-6">
        {messages.map((message, index) => (
          <div key={index} className={`flex items-end gap-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {message.role === 'assistant' && (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#d8f1ed] text-[#2e9f83]">
                <Bot size={14} />
              </div>
            )}
            <p
              className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm leading-6 ${
                message.role === 'user'
                  ? 'rounded-br-md bg-[#1c68a4] text-white'
                  : 'rounded-bl-md bg-[#f3f6fa] text-[#38545e] dark:bg-[#203044] dark:text-[#e3ebf5]'
              }`}
            >
              {message.text}
            </p>
            {message.role === 'user' && (
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#edf5fc] text-[#1c68a4] dark:bg-[#203c5e] dark:text-[#a8d5ff]">
                <User size={14} />
              </div>
            )}
          </div>
        ))}
        {isAnswering && (
          <div className="flex items-end gap-2">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#d8f1ed] text-[#2e9f83]">
              <Bot size={14} />
            </div>
            <p className="rounded-2xl rounded-bl-md bg-[#f3f6fa] px-4 py-2.5 text-sm text-[#73839a] dark:bg-[#203044] dark:text-[#9aa7ba]">Thinking...</p>
          </div>
        )}
      </div>

      <div className="border-t border-[#edf0f4] p-4 dark:border-[#2a394d] sm:p-5">
        <div className="mb-3 flex flex-wrap gap-2">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              onClick={() => void send(suggestion)}
              className="rounded-full border border-[#d9e3ee] px-3 py-1.5 text-xs font-semibold text-[#4f6479] transition-colors hover:border-[#1c68a4] hover:text-[#1c68a4] dark:border-[#34465e] dark:text-[#c3d0df] dark:hover:border-[#a8d5ff] dark:hover:text-[#a8d5ff]"
            >
              {suggestion}
            </button>
          ))}
        </div>
        <form onSubmit={handleSubmit} className="flex items-center gap-2">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask about your money..."
            className="h-11 flex-1 rounded-xl border border-[#d9e3ee] bg-white px-4 text-sm text-[#1f2d3d] placeholder:text-[#9aa7ba] focus:border-[#1c68a4] focus:outline-none focus:ring-2 focus:ring-[#1c68a4]/20 dark:border-[#34465e] dark:bg-[#0f1a2b] dark:text-[#e3ebf5]"
          />
          <button
            type="submit"
            disabled={!input.trim() || isAnswering}
            aria-label="Send message"
            className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#1c68a4] text-white transition-colors hover:bg-[#165a8f] disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Send size={16} />
          </button>
        </form>
      </div>
    </section>
  );
}
