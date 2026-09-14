/*
# Create habits and habit_checkins tables (single-tenant, no auth)

1. New Tables
- `habits`: stores each habit definition
  - id (uuid, primary key)
  - name (text, not null)
  - description (text, default 'Make a little progress every day')
  - icon (text, default 'spark') — visual identifier
  - color (text, default 'green') — color theme
  - streak (integer, default 0) — current consecutive days
  - best_streak (integer, default 0) — longest streak ever
  - created_at (timestamptz, default now())
- `habit_checkins`: stores one row per habit per day completed
  - id (uuid, primary key)
  - habit_id (uuid, foreign key to habits.id, cascade delete)
  - checkin_date (date, not null) — the day the habit was completed
  - created_at (timestamptz, default now())
  - unique constraint on (habit_id, checkin_date) — one check-in per day per habit

2. Security
- Enable RLS on both tables.
- Allow anon + authenticated full CRUD because this is a single-tenant app
  with no sign-in — the anon-key frontend must be able to read and write.
- `USING (true)` is intentional: all data is shared/public within this app.

3. Indexes
- Index on habit_checkins(habit_id) for fast lookups
- Index on habit_checkins(checkin_date) for date-range queries
*/

CREATE TABLE IF NOT EXISTS habits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text NOT NULL DEFAULT 'Make a little progress every day',
  icon text NOT NULL DEFAULT 'spark',
  color text NOT NULL DEFAULT 'green',
  streak integer NOT NULL DEFAULT 0,
  best_streak integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE habits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_habits" ON habits;
CREATE POLICY "anon_select_habits" ON habits FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_habits" ON habits;
CREATE POLICY "anon_insert_habits" ON habits FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_habits" ON habits;
CREATE POLICY "anon_update_habits" ON habits FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_habits" ON habits;
CREATE POLICY "anon_delete_habits" ON habits FOR DELETE
  TO anon, authenticated USING (true);

CREATE TABLE IF NOT EXISTS habit_checkins (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id uuid NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  checkin_date date NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(habit_id, checkin_date)
);

ALTER TABLE habit_checkins ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anon_select_checkins" ON habit_checkins;
CREATE POLICY "anon_select_checkins" ON habit_checkins FOR SELECT
  TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "anon_insert_checkins" ON habit_checkins;
CREATE POLICY "anon_insert_checkins" ON habit_checkins FOR INSERT
  TO anon, authenticated WITH CHECK (true);

DROP POLICY IF EXISTS "anon_update_checkins" ON habit_checkins;
CREATE POLICY "anon_update_checkins" ON habit_checkins FOR UPDATE
  TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "anon_delete_checkins" ON habit_checkins;
CREATE POLICY "anon_delete_checkins" ON habit_checkins FOR DELETE
  TO anon, authenticated USING (true);

CREATE INDEX IF NOT EXISTS idx_checkins_habit_id ON habit_checkins(habit_id);
CREATE INDEX IF NOT EXISTS idx_checkins_date ON habit_checkins(checkin_date);
