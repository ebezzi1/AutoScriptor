-- Add entity_type and entity_id to snapshots for per-entity version history
ALTER TABLE snapshots ADD COLUMN IF NOT EXISTS entity_type text;
ALTER TABLE snapshots ADD COLUMN IF NOT EXISTS entity_id uuid;

-- Composite index for entity-scoped history queries
CREATE INDEX IF NOT EXISTS idx_snapshots_entity
  ON snapshots(project_id, entity_type, entity_id, created_at DESC)
  WHERE entity_type IS NOT NULL;

-- Rows created by the old snapshots.ts code have no entity_type (NULL)
-- and are intentionally excluded from version history queries.
