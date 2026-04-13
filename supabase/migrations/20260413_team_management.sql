-- Expand team_members role enum to include admin and viewer
-- (Supabase uses text columns, so just ensure constraints)

-- Add created_at to teams if missing (safe)
ALTER TABLE teams ADD COLUMN IF NOT EXISTS created_at timestamptz DEFAULT now();

-- Add team_invites table
CREATE TABLE IF NOT EXISTS team_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id uuid NOT NULL REFERENCES teams(id) ON DELETE CASCADE,
  email text NOT NULL,
  role text NOT NULL DEFAULT 'member',
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  invited_by uuid REFERENCES auth.users(id),
  created_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT now() + interval '7 days',
  status text NOT NULL DEFAULT 'pending',
  accepted_by uuid REFERENCES auth.users(id)
);

-- RLS for team_invites
ALTER TABLE team_invites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view invites" ON team_invites
  FOR SELECT TO authenticated
  USING (team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid()));

CREATE POLICY "Admins can manage invites" ON team_invites
  FOR ALL TO authenticated
  USING (team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid() AND role IN ('owner','admin')))
  WITH CHECK (team_id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid() AND role IN ('owner','admin')));

CREATE POLICY "Anyone can read invite by token" ON team_invites
  FOR SELECT TO authenticated
  USING (true);

-- Allow admins to update team name
CREATE POLICY "Admins can update team" ON teams
  FOR UPDATE TO authenticated
  USING (id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid() AND role IN ('owner','admin')))
  WITH CHECK (id IN (SELECT team_id FROM team_members WHERE user_id = auth.uid() AND role IN ('owner','admin')));

-- Allow admins to update/delete team_members
CREATE POLICY "Admins can manage members" ON team_members
  FOR ALL TO authenticated
  USING (team_id IN (SELECT team_id FROM team_members tm2 WHERE tm2.user_id = auth.uid() AND tm2.role IN ('owner','admin')))
  WITH CHECK (team_id IN (SELECT team_id FROM team_members tm2 WHERE tm2.user_id = auth.uid() AND tm2.role IN ('owner','admin')));

-- Allow reading all members of your team
CREATE POLICY "Members can view team members" ON team_members
  FOR SELECT TO authenticated
  USING (team_id IN (SELECT team_id FROM team_members tm2 WHERE tm2.user_id = auth.uid()));

-- Profiles table for user metadata (accessible from client)
CREATE TABLE IF NOT EXISTS profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text,
  full_name text,
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read profiles" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR ALL TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'full_name')
  ON CONFLICT (id) DO UPDATE SET email = new.email;
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
