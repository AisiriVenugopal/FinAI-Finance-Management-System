/*
# Create finance accounts and link transactions to them

1. New Tables
- `finance_accounts`: named money accounts the ledger can be switched between.
  - `id` (uuid, primary key)
  - `name` (text, display name such as "Personal account")
  - `created_at` (timestamptz)

2. Modified Tables
- `finance_transactions`: new nullable column `account_id` referencing `finance_accounts`.
  Existing rows are assigned to a default "Personal account" so no data is lost.

3. Security
- RLS enabled on `finance_accounts`.
- Shared, single-tenant app (no sign-in), so anon and authenticated may read and create accounts.
- No update or delete policies: accounts are never removed through the app.

4. Important Notes
- Every statement is idempotent and safe to re-run.
- Only additive changes: no columns dropped, no types changed.
*/

CREATE TABLE IF NOT EXISTS finance_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE finance_accounts ENABLE ROW LEVEL SECURITY;

GRANT SELECT, INSERT ON finance_accounts TO anon, authenticated;

DROP POLICY IF EXISTS "shared_finance_accounts_select" ON finance_accounts;
CREATE POLICY "shared_finance_accounts_select" ON finance_accounts FOR SELECT
TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "shared_finance_accounts_insert" ON finance_accounts;
CREATE POLICY "shared_finance_accounts_insert" ON finance_accounts FOR INSERT
TO anon, authenticated WITH CHECK (true);

ALTER TABLE finance_transactions ADD COLUMN IF NOT EXISTS account_id uuid REFERENCES finance_accounts(id);

CREATE INDEX IF NOT EXISTS finance_transactions_account_id_idx ON finance_transactions (account_id);

INSERT INTO finance_accounts (name)
SELECT 'Personal account'
WHERE NOT EXISTS (SELECT 1 FROM finance_accounts);

UPDATE finance_transactions
SET account_id = (SELECT id FROM finance_accounts ORDER BY created_at LIMIT 1)
WHERE account_id IS NULL;
