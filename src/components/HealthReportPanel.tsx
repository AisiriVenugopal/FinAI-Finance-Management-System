import { CheckCircle2, ShieldAlert, Target } from 'lucide-react';
import { type HealthReport, type HealthLeak } from '@/lib/healthReport';
import { formatCurrency } from '@/lib/finance';

function scoreTone(score: number) {
  if (score >= 80) return { ring: '#2e9f83', text: 'text-[#2e9f83]' };
  if (score >= 60) return { ring: '#e0a13a', text: 'text-[#b7791f] dark:text-[#f0c26b]' };
  return { ring: '#d46755', text: 'text-[#d46755] dark:text-[#f08b7a]' };
}

export function HealthReportPanel({ report }: { report: HealthReport }) {
  const tone = scoreTone(report.score);
  const circumference = 2 * Math.PI * 40;
  const offset = circumference * (1 - report.score / 100);

  return (
    <section className="mb-7 grid gap-5 rounded-2xl border border-[#e6ebf1] bg-white p-5 shadow-[0_4px_20px_rgba(34,58,86,0.03)] dark:border-[#29384d] dark:bg-[#172235] sm:p-6 lg:grid-cols-[0.8fr_1.2fr]">
      <div className="flex flex-col items-center justify-center gap-3 text-center">
        <div className="relative h-28 w-28">
          <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
            <circle cx="50" cy="50" r="40" fill="none" stroke="currentColor" strokeWidth="8" className="text-[#edf1f5] dark:text-[#2a394d]" />
            <circle cx="50" cy="50" r="40" fill="none" stroke={tone.ring} strokeWidth="8" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} className="transition-all duration-700" />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-2xl font-bold ${tone.text}`}>{report.score}</span>
            <span className="text-[10px] font-semibold text-[#8291a5]">/ 100</span>
          </div>
        </div>
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[#8291a5]">Financial health score</p>
          <p className={`mt-1 text-sm font-bold ${tone.text}`}>{report.verdict}</p>
        </div>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <div>
          <h4 className="mb-3 flex items-center gap-2 text-xs font-bold"><ShieldAlert size={15} className="text-[#d46755] dark:text-[#f08b7a]" /> Spending leaks</h4>
          {report.leaks.length === 0 ? (
            <p className="text-xs leading-5 text-[#73839a] dark:text-[#9aa7ba]">No single category dominates your spending this month.</p>
          ) : (
            <ul className="space-y-2.5">
              {report.leaks.map((leak: HealthLeak) => (
                <li key={leak.category} className="rounded-xl bg-[#fff6f3] p-3 text-xs leading-5 text-[#7a4a40] dark:bg-[#2e2326] dark:text-[#f0c9c0]">
                  {leak.category} accounts for {leak.sharePct}% of your expenses ({formatCurrency(leak.amount)}).
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <h4 className="mb-3 flex items-center gap-2 text-xs font-bold"><Target size={15} className="text-[#2e9f83]" /> Recommendations</h4>
          <ol className="space-y-2.5">
            {report.recommendations.map((recommendation, index) => (
              <li key={index} className="flex gap-2.5 text-xs leading-5 text-[#38545e] dark:text-[#d7e3ef]">
                <CheckCircle2 size={15} className="mt-0.5 shrink-0 text-[#2e9f83]" />
                <span>{recommendation}</span>
              </li>
            ))}
          </ol>
          <div className="mt-4 flex items-center justify-between rounded-xl bg-[#e8f7ef] px-4 py-3 dark:bg-[#1d3a35]">
            <span className="text-xs font-bold text-[#27805a] dark:text-[#9fe0c4]">Estimated monthly savings</span>
            <span className="text-sm font-bold text-[#1e625f] dark:text-[#b8e1dc]">{formatCurrency(report.potentialSavings)}</span>
          </div>
        </div>
      </div>
    </section>
  );
}
