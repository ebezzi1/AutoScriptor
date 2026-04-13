-- Version history: per-TC and per-project snapshots
CREATE TABLE IF NOT EXISTS version_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  test_case_id uuid REFERENCES test_cases(id) ON DELETE CASCADE,
  created_by uuid REFERENCES auth.users(id),
  snapshot_type text NOT NULL DEFAULT 'auto',
  label text NOT NULL,
  change_description text,
  data jsonb NOT NULL DEFAULT '{}',
  is_pinned boolean NOT NULL DEFAULT false,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_version_history_project ON version_history(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_version_history_tc ON version_history(test_case_id, created_at DESC) WHERE test_case_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_version_history_project_null_tc ON version_history(project_id, created_at DESC) WHERE test_case_id IS NULL;

ALTER TABLE version_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can read version history" ON version_history
  FOR SELECT TO authenticated
  USING (project_id IN (
    SELECT p.id FROM projects p
    JOIN team_members tm ON tm.team_id = p.team_id
    WHERE tm.user_id = auth.uid()
  ));

CREATE POLICY "Team members can insert version history" ON version_history
  FOR INSERT TO authenticated
  WITH CHECK (project_id IN (
    SELECT p.id FROM projects p
    JOIN team_members tm ON tm.team_id = p.team_id
    WHERE tm.user_id = auth.uid()
  ));

CREATE POLICY "Users can update own snapshots" ON version_history
  FOR UPDATE TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

CREATE POLICY "Admins and owners can delete any snapshot" ON version_history
  FOR DELETE TO authenticated
  USING (
    created_by = auth.uid()
    OR project_id IN (
      SELECT p.id FROM projects p
      JOIN team_members tm ON tm.team_id = p.team_id
      WHERE tm.user_id = auth.uid() AND tm.role IN ('owner', 'admin')
    )
  );
