import { useEffect, useRef, useState } from 'react';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { type FinanceAccount, getInitials } from '@/lib/finance';

type AccountSwitcherProps = {
  accounts: FinanceAccount[];
  selectedAccount: FinanceAccount | undefined;
  ownerName: string;
  onSelect: (id: string) => void;
  onCreate: (name: string) => Promise<boolean>;
};

export default function AccountSwitcher({ accounts, selectedAccount, ownerName, onSelect, onCreate }: AccountSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  function closeMenu() {
    setOpen(false);
    setCreating(false);
    setName('');
  }

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) closeMenu();
    }
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [open]);

  async function handleCreate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) return;
    setSaving(true);
    const created = await onCreate(trimmed);
    setSaving(false);
    if (created) closeMenu();
  }

  return (
    <div ref={rootRef} className="relative mt-5 border-t border-[#edf0f4] pt-5 dark:border-[#2a394d]">
      {open && (
        <div className="absolute bottom-full left-0 right-0 z-50 mb-3 rounded-2xl border border-[#e6ebf1] bg-white p-2 shadow-xl dark:border-[#29384d] dark:bg-[#1b2a3e]">
          <p className="px-3 pb-2 pt-1 text-[10px] font-bold uppercase tracking-[0.16em] text-[#9aa7ba]">Switch account</p>
          <ul className="space-y-1">
            {accounts.map((account) => {
              const active = account.id === selectedAccount?.id;
              return (
                <li key={account.id}>
                  <button
                    onClick={() => { onSelect(account.id); closeMenu(); }}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-xs font-bold transition ${active ? 'bg-[#edf5fc] text-[#1c68a4] dark:bg-[#203c5e] dark:text-[#a8d5ff]' : 'text-[#55677f] hover:bg-[#f3f6fa] dark:text-[#c5d2e0] dark:hover:bg-[#203044]'}`}
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#dce9f8] text-[10px] font-bold text-[#27689f]">{getInitials(account.name)}</span>
                    <span className="min-w-0 flex-1 truncate">{account.name}</span>
                    {active && <Check size={14} className="text-[#2e9f83]" />}
                  </button>
                </li>
              );
            })}
            {accounts.length === 0 && <li className="px-3 py-2 text-xs text-[#8291a5]">No accounts yet.</li>}
          </ul>
          <div className="mt-2 border-t border-[#edf0f4] pt-2 dark:border-[#2a394d]">
            {creating ? (
              <form onSubmit={(event) => void handleCreate(event)} className="flex gap-2 px-1 pb-1">
                <input
                  autoFocus
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={60}
                  placeholder="Account name"
                  aria-label="New account name"
                  className="min-w-0 flex-1 rounded-lg border border-[#dfe7ef] bg-transparent px-2.5 py-2 text-xs outline-none focus:border-[#4c9bdd] dark:border-[#35465d]"
                />
                <button type="submit" disabled={saving || !name.trim()} className="rounded-lg bg-[#1e6d9f] px-3 text-xs font-bold text-white transition hover:bg-[#195d8b] disabled:opacity-60">
                  {saving ? 'Adding...' : 'Add'}
                </button>
              </form>
            ) : (
              <button onClick={() => setCreating(true)} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-bold text-[#1c68a4] transition hover:bg-[#edf5fc] dark:text-[#a8d5ff] dark:hover:bg-[#203c5e]">
                <Plus size={14} /> New account
              </button>
            )}
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-label="Switch account"
        className="flex w-full items-center gap-3 rounded-xl p-1.5 text-left transition hover:bg-[#f3f6fa] dark:hover:bg-[#203044]"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#dce9f8] text-xs font-bold text-[#27689f]">{getInitials(ownerName)}</div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-bold">{ownerName}</p>
          <p className="truncate text-[10px] text-[#8a98aa]">{selectedAccount?.name ?? 'No account yet'}</p>
        </div>
        <ChevronsUpDown size={16} className="shrink-0 text-[#9aa7b7]" />
      </button>
    </div>
  );
}
