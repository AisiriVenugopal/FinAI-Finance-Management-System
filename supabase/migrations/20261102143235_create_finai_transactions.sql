/*
# Create FinAI transactions table and starter data

1. New Tables
- `finance_transactions` stores the shared FinAI transaction ledger used by the dashboard.
- `id` (uuid, primary key)
- `transaction_date` (date, transaction date)
- `description` (text, merchant or income source)
- `category` (text, spending or income category)
- `amount` (numeric, positive transaction amount)
- `transaction_type` (text, either income or expense)
- `ai_tagged` (boolean, whether AI categorization has processed the row)
- `created_at` (timestamptz, creation timestamp)

2. Security
- RLS is enabled.
- This app intentionally has no sign-in screen, so the shared single-tenant ledger is readable and writable by anon and authenticated roles.
- Separate CRUD policies and least-privilege table grants are included.

3. Important Notes
- Starter rows are inserted only when the table is empty, keeping the migration safe to re-run.
- Amounts are stored as positive values; transaction_type determines whether they add to income or expenses.
*/

CREATE TABLE IF NOT EXISTS finance_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_date date NOT NULL,
  description text NOT NULL,
  category text NOT NULL,
  amount numeric(12, 2) NOT NULL CHECK (amount >= 0),
  transaction_type text NOT NULL CHECK (transaction_type IN ('income', 'expense')),
  ai_tagged boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE finance_transactions ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT, UPDATE, DELETE ON finance_transactions TO anon, authenticated;

DROP POLICY IF EXISTS "shared_finance_transactions_select" ON finance_transactions;
CREATE POLICY "shared_finance_transactions_select" ON finance_transactions FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "shared_finance_transactions_insert" ON finance_transactions;
CREATE POLICY "shared_finance_transactions_insert" ON finance_transactions FOR INSERT
TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "shared_finance_transactions_update" ON finance_transactions;
CREATE POLICY "shared_finance_transactions_update" ON finance_transactions FOR UPDATE
TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "shared_finance_transactions_delete" ON finance_transactions;
CREATE POLICY "shared_finance_transactions_delete" ON finance_transactions FOR DELETE
TO anon, authenticated USING (true);

INSERT INTO finance_transactions (transaction_date, description, category, amount, transaction_type, ai_tagged)
SELECT * FROM (VALUES
  ('2026-11-01'::date, 'Monthly salary', 'Salary', 185000.00::numeric, 'income', true),
  ('2026-10-30'::date, 'Swiggy order', 'Dining', 842.50::numeric, 'expense', true),
  ('2026-10-29'::date, 'Shell Petrol', 'Transport', 3200.00::numeric, 'expense', true),
  ('2026-10-27'::date, 'Netflix Premium', 'Subscriptions', 649.00::numeric, 'expense', true),
  ('2026-10-26'::date, 'BigBasket Supermarket', 'Groceries', 4860.75::numeric, 'expense', true),
  ('2026-10-24'::date, 'Electricity bill', 'Utilities', 2340.00::numeric, 'expense', true),
  ('2026-10-22'::date, 'Zara purchase', 'Shopping', 5999.00::numeric, 'expense', true),
  ('2026-10-20'::date, 'Uber rides', 'Transport', 1180.00::numeric, 'expense', true),
  ('2026-10-18'::date, 'Spotify subscription', 'Subscriptions', 119.00::numeric, 'expense', true),
  ('2026-10-15'::date, 'The Bombay Canteen', 'Dining', 2750.00::numeric, 'expense', true),
  ('2026-10-12'::date, 'Whole Foods Market', 'Groceries', 7320.40::numeric, 'expense', true),
  ('2026-10-10'::date, 'Flight refund', 'Other income', 8420.00::numeric, 'income', false),
  ('2026-10-08'::date, 'Amazon purchase', 'Shopping', 1899.00::numeric, 'expense', true),
  ('2026-10-05'::date, 'Electricity bill', 'Utilities', 2210.00::numeric, 'expense', true),
  ('2026-10-03'::date, 'PVR Cinemas', 'Entertainment', 1560.00::numeric, 'expense', true),
  ('2026-09-28'::date, 'Monthly salary', 'Salary', 185000.00::numeric, 'income', true),
  ('2026-09-20'::date, 'Swiggy order', 'Dining', 1240.00::numeric, 'expense', true),
  ('2026-09-16'::date, 'Decathlon', 'Shopping', 3499.00::numeric, 'expense', false)
) AS starter(transaction_date, description, category, amount, transaction_type, ai_tagged)
WHERE NOT EXISTS (SELECT 1 FROM finance_transactions);
