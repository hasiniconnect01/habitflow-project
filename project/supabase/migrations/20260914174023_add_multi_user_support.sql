/*
# Add multi-user support to habits and habit_checkins (revised)

1. Changes to existing tables
- `habits`: add `user_id` (uuid, nullable initially, references auth.users)
- `habit_checkins`: add `user_id` (uuid, nullable initially, references auth.users)

2. Backfill
- If auth.users has at least one row, assign all existing habits and
  checkins to the first user. Otherwise, delete the seeded demo data
  since it has no owner and would be invisible to authenticated users.

3. Enforce NOT NULL with DEFAULT auth.uid()
- After backfill/cleanup, set NOT NULL and default.

4. Security changes
- Drop all old `TO anon, authenticated` policies.
- Create `TO authenticated` owner-scoped policies using auth.uid() = user_id.
- Revoke anon privileges.

5. Indexes
- idx_habits_user_id, idx_checkins_user_id
*/

-- Step 1: Add user_id columns (nullable for backfill)
ALTER TABLE habits ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;
ALTER TABLE habit_checkins ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

-- Step 2: Backfill or clean up
DO $$
DECLARE
  first_user uuid;
BEGIN
  SELECT id INTO first_user FROM auth.users ORDER BY created_at LIMIT 1;
  IF first_user IS NOT NULL THEN
    UPDATE habits SET user_id = first_user WHERE user_id IS NULL;
    UPDATE habit_checkins SET user_id = first_user WHERE user_id IS NULL;
  ELSE
    -- No users yet: remove orphaned demo data that would be invisible under authed RLS
    DELETE FROM habit_checkins WHERE user_id IS NULL;
    DELETE FROM habits WHERE user_id IS NULL;
  END IF;
END $$;

-- Step 3: Set NOT NULL with DEFAULT auth.uid()
ALTER TABLE habits ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE habits ALTER COLUMN user_id SET NOT NULL;

ALTER TABLE habit_checkins ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE habit_checkins ALTER COLUMN user_id SET NOT NULL;

-- Step 4: Drop old policies
DROP POLICY IF EXISTS "anon_select_habits" ON habits;
DROP POLICY IF EXISTS "anon_insert_habits" ON habits;
DROP POLICY IF EXISTS "anon_update_habits" ON habits;
DROP POLICY IF EXISTS "anon_delete_habits" ON habits;

DROP POLICY IF EXISTS "anon_select_checkins" ON habit_checkins;
DROP POLICY IF EXISTS "anon_insert_checkins" ON habit_checkins;
DROP POLICY IF EXISTS "anon_update_checkins" ON habit_checkins;
DROP POLICY IF EXISTS "anon_delete_checkins" ON habit_checkins;

-- Step 5: Authenticated owner-scoped policies on habits
CREATE POLICY "select_own_habits" ON habits FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "insert_own_habits" ON habits FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "update_own_habits" ON habits FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "delete_own_habits" ON habits FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Step 6: Authenticated owner-scoped policies on habit_checkins
CREATE POLICY "select_own_checkins" ON habit_checkins FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "insert_own_checkins" ON habit_checkins FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "update_own_checkins" ON habit_checkins FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "delete_own_checkins" ON habit_checkins FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

-- Step 7: Indexes
CREATE INDEX IF NOT EXISTS idx_habits_user_id ON habits(user_id);
CREATE INDEX IF NOT EXISTS idx_checkins_user_id ON habit_checkins(user_id);

-- Step 8: Revoke anon privileges
REVOKE ALL ON habits FROM anon;
REVOKE ALL ON habit_checkins FROM anon;
