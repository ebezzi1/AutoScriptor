-- ============================================================================
-- Phase 11: Project Directory Management & File Sync
-- ============================================================================

-- ── project_directories ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS project_directories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  directory_path text NOT NULL,
  is_scaffolded boolean DEFAULT false,
  scaffold_status text DEFAULT 'pending'
    CHECK (scaffold_status IN ('pending', 'in_progress', 'completed', 'failed')),
  scaffold_error text,
  last_sync_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT project_directories_project_id_unique UNIQUE (project_id)
);

ALTER TABLE project_directories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view project directories" ON project_directories
  FOR SELECT TO authenticated
  USING (
    project_id IN (
      SELECT p.id FROM projects p
      JOIN team_members tm ON tm.team_id = p.team_id
      WHERE tm.user_id = auth.uid()
    )
  );

CREATE POLICY "Team members can insert project directories" ON project_directories
  FOR INSERT TO authenticated
  WITH CHECK (
    project_id IN (
      SELECT p.id FROM projects p
      JOIN team_members tm ON tm.team_id = p.team_id
      WHERE tm.user_id = auth.uid()
    )
  );

CREATE POLICY "Team members can update project directories" ON project_directories
  FOR UPDATE TO authenticated
  USING (
    project_id IN (
      SELECT p.id FROM projects p
      JOIN team_members tm ON tm.team_id = p.team_id
      WHERE tm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    project_id IN (
      SELECT p.id FROM projects p
      JOIN team_members tm ON tm.team_id = p.team_id
      WHERE tm.user_id = auth.uid()
    )
  );

CREATE POLICY "Admins can delete project directories" ON project_directories
  FOR DELETE TO authenticated
  USING (
    project_id IN (
      SELECT p.id FROM projects p
      JOIN team_members tm ON tm.team_id = p.team_id
      WHERE tm.user_id = auth.uid() AND tm.role IN ('owner', 'admin')
    )
  );

-- ── file_sync_state ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS file_sync_state (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  content_hash text NOT NULL,
  local_hash text,
  sync_status text DEFAULT 'synced'
    CHECK (sync_status IN ('synced', 'pending', 'conflict', 'error')),
  last_synced_at timestamptz,
  error_message text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT file_sync_state_project_file_unique UNIQUE (project_id, file_path)
);

CREATE INDEX IF NOT EXISTS idx_file_sync_state_project
  ON file_sync_state(project_id);

CREATE INDEX IF NOT EXISTS idx_file_sync_state_status
  ON file_sync_state(project_id, sync_status);

ALTER TABLE file_sync_state ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Team members can view file sync state" ON file_sync_state
  FOR SELECT TO authenticated
  USING (
    project_id IN (
      SELECT p.id FROM projects p
      JOIN team_members tm ON tm.team_id = p.team_id
      WHERE tm.user_id = auth.uid()
    )
  );

CREATE POLICY "Team members can insert file sync state" ON file_sync_state
  FOR INSERT TO authenticated
  WITH CHECK (
    project_id IN (
      SELECT p.id FROM projects p
      JOIN team_members tm ON tm.team_id = p.team_id
      WHERE tm.user_id = auth.uid()
    )
  );

CREATE POLICY "Team members can update file sync state" ON file_sync_state
  FOR UPDATE TO authenticated
  USING (
    project_id IN (
      SELECT p.id FROM projects p
      JOIN team_members tm ON tm.team_id = p.team_id
      WHERE tm.user_id = auth.uid()
    )
  )
  WITH CHECK (
    project_id IN (
      SELECT p.id FROM projects p
      JOIN team_members tm ON tm.team_id = p.team_id
      WHERE tm.user_id = auth.uid()
    )
  );

CREATE POLICY "Team members can delete file sync state" ON file_sync_state
  FOR DELETE TO authenticated
  USING (
    project_id IN (
      SELECT p.id FROM projects p
      JOIN team_members tm ON tm.team_id = p.team_id
      WHERE tm.user_id = auth.uid()
    )
  );

-- ── updated_at trigger ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_project_directories_updated_at
  BEFORE UPDATE ON project_directories
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER set_file_sync_state_updated_at
  BEFORE UPDATE ON file_sync_state
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
