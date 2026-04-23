/**
 * Sync Engine Service
 *
 * Manages file synchronisation between the app's generated code
 * and the local filesystem via the agent. Tracks sync state in
 * Supabase's file_sync_state table.
 */

import { supabase } from '../lib/supabase'
import type { AgentClientService } from './agentClient'

// ── Types ─────────────────────────────────────────────────────────────────────

export type SyncStatus = 'synced' | 'pending' | 'conflict' | 'error'

export interface FileSyncRecord {
  id: string
  projectId: string
  filePath: string
  contentHash: string
  localHash: string | null
  syncStatus: SyncStatus
  lastSyncedAt: string | null
  errorMessage: string | null
  createdAt: string
  updatedAt: string
}

export interface SyncFileResult {
  filePath: string
  status: SyncStatus
  error?: string
}

export interface ConflictInfo {
  filePath: string
  contentHash: string
  localHash: string
}

// ── DB mappers ────────────────────────────────────────────────────────────────

function toFileSyncRecord(row: Record<string, unknown>): FileSyncRecord {
  return {
    id: row.id as string,
    projectId: row.project_id as string,
    filePath: row.file_path as string,
    contentHash: row.content_hash as string,
    localHash: (row.local_hash as string | null) ?? null,
    syncStatus: (row.sync_status as SyncStatus) ?? 'synced',
    lastSyncedAt: (row.last_synced_at as string | null) ?? null,
    errorMessage: (row.error_message as string | null) ?? null,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  }
}

// ── Hash helper ───────────────────────────────────────────────────────────────

async function sha256(content: string): Promise<string> {
  const encoder = new TextEncoder()
  const data = encoder.encode(content)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

// ── SyncEngine ────────────────────────────────────────────────────────────────

export class SyncEngine {
  private agent: AgentClientService
  private projectId: string

  constructor(agent: AgentClientService, projectId: string) {
    this.agent = agent
    this.projectId = projectId
  }

  // ── Single file sync ──────────────────────────────────────────────────────

  async syncFile(filePath: string, content: string): Promise<SyncFileResult> {
    try {
      const contentHash = await sha256(content)

      // Check if file exists locally via agent
      let localHash: string | null = null
      try {
        const stat = await this.agent.statFile(filePath)
        if (stat.exists) {
          localHash = stat.hash
        }
      } catch {
        // File doesn't exist on disk — that's fine, we'll write it
      }

      // Look up existing sync record
      const existing = await this.getSyncRecord(filePath)

      // If file exists locally and its hash doesn't match what we last wrote,
      // someone edited it outside the app — conflict
      if (existing && localHash && localHash !== existing.contentHash) {
        await this.upsertSyncRecord(filePath, contentHash, localHash, 'conflict')
        return { filePath, status: 'conflict' }
      }

      // Write via agent
      const writeResult = await this.agent.writeFile(filePath, content)
      if (!writeResult.success) {
        await this.upsertSyncRecord(filePath, contentHash, localHash, 'error', 'Write failed')
        return { filePath, status: 'error', error: 'Write failed' }
      }

      // Get fresh hash after write
      let newLocalHash = contentHash
      try {
        const freshStat = await this.agent.statFile(filePath)
        if (freshStat.exists) newLocalHash = freshStat.hash
      } catch {
        // Use content hash as fallback
      }

      await this.upsertSyncRecord(filePath, contentHash, newLocalHash, 'synced')
      return { filePath, status: 'synced' }
    } catch (err) {
      const message = (err as Error).message
      await this.upsertSyncRecord(filePath, '', null, 'error', message).catch(() => {})
      return { filePath, status: 'error', error: message }
    }
  }

  // ── Batch sync ────────────────────────────────────────────────────────────

  async syncAllFiles(
    files: { filePath: string; content: string }[]
  ): Promise<SyncFileResult[]> {
    // Check for conflicts first
    const conflicts = await this.checkForConflicts(
      files.map((f) => f.filePath)
    )
    const conflictPaths = new Set(conflicts.map((c) => c.filePath))

    const results: SyncFileResult[] = []

    // Mark conflicts
    for (const conflict of conflicts) {
      results.push({ filePath: conflict.filePath, status: 'conflict' })
    }

    // Sync non-conflicting files
    const toSync = files.filter((f) => !conflictPaths.has(f.filePath))

    // Batch write via agent
    if (toSync.length > 0) {
      try {
        const batchResult = await this.agent.writeBatch(toSync)

        const errorPaths = new Set(
          batchResult.errors.map((e) => e.filePath)
        )

        for (const file of toSync) {
          if (errorPaths.has(file.filePath)) {
            const err = batchResult.errors.find(
              (e) => e.filePath === file.filePath
            )
            const contentHash = await sha256(file.content)
            await this.upsertSyncRecord(
              file.filePath,
              contentHash,
              null,
              'error',
              err?.error
            )
            results.push({
              filePath: file.filePath,
              status: 'error',
              error: err?.error,
            })
          } else {
            const contentHash = await sha256(file.content)
            await this.upsertSyncRecord(
              file.filePath,
              contentHash,
              contentHash,
              'synced'
            )
            results.push({ filePath: file.filePath, status: 'synced' })
          }
        }
      } catch (err) {
        // If batch write fails entirely, sync individually
        for (const file of toSync) {
          const result = await this.syncFile(file.filePath, file.content)
          results.push(result)
        }
      }
    }

    return results
  }

  // ── Conflict detection ────────────────────────────────────────────────────

  async checkForConflicts(filePaths?: string[]): Promise<ConflictInfo[]> {
    // Get tracked files from DB
    const records = filePaths
      ? await this.getSyncRecords(filePaths)
      : await this.getAllSyncRecords()

    const conflicts: ConflictInfo[] = []

    for (const record of records) {
      try {
        const stat = await this.agent.statFile(record.filePath)
        if (stat.exists && stat.hash !== record.contentHash) {
          conflicts.push({
            filePath: record.filePath,
            contentHash: record.contentHash,
            localHash: stat.hash,
          })
          // Update record to conflict status
          await this.upsertSyncRecord(
            record.filePath,
            record.contentHash,
            stat.hash,
            'conflict'
          )
        }
      } catch {
        // File might not exist — not a conflict
      }
    }

    return conflicts
  }

  // ── Conflict resolution ───────────────────────────────────────────────────

  /**
   * Resolve a conflict by choosing which version to keep.
   * 'local' = keep what's on disk, update DB hash to match.
   * 'app'   = overwrite disk with app content.
   */
  async resolveConflict(
    filePath: string,
    resolution: 'local' | 'app',
    appContent?: string
  ): Promise<SyncFileResult> {
    if (resolution === 'local') {
      // Read local file and update DB to match
      try {
        const fileData = await this.agent.readFile(filePath)
        const localHash = await sha256(fileData.content)
        await this.upsertSyncRecord(filePath, localHash, localHash, 'synced')
        return { filePath, status: 'synced' }
      } catch (err) {
        return { filePath, status: 'error', error: (err as Error).message }
      }
    }

    // resolution === 'app' — overwrite local with app content
    if (!appContent) {
      return { filePath, status: 'error', error: 'App content required for app resolution' }
    }

    return this.syncFile(filePath, appContent)
  }

  // ── Status queries ────────────────────────────────────────────────────────

  async getSyncStatus(): Promise<{
    total: number
    synced: number
    pending: number
    conflict: number
    error: number
  }> {
    const { data, error } = await supabase
      .from('file_sync_state')
      .select('sync_status')
      .eq('project_id', this.projectId)

    if (error) {
      console.error('[SyncEngine] getSyncStatus error:', error.message)
      return { total: 0, synced: 0, pending: 0, conflict: 0, error: 0 }
    }

    const rows = (data ?? []) as { sync_status: string }[]
    return {
      total: rows.length,
      synced: rows.filter((r) => r.sync_status === 'synced').length,
      pending: rows.filter((r) => r.sync_status === 'pending').length,
      conflict: rows.filter((r) => r.sync_status === 'conflict').length,
      error: rows.filter((r) => r.sync_status === 'error').length,
    }
  }

  async getPendingFiles(): Promise<FileSyncRecord[]> {
    const { data, error } = await supabase
      .from('file_sync_state')
      .select('*')
      .eq('project_id', this.projectId)
      .in('sync_status', ['pending', 'conflict', 'error'])

    if (error) {
      console.error('[SyncEngine] getPendingFiles error:', error.message)
      return []
    }

    return (data ?? []).map((r: Record<string, unknown>) => toFileSyncRecord(r))
  }

  // ── Internal DB helpers ───────────────────────────────────────────────────

  private async getSyncRecord(filePath: string): Promise<FileSyncRecord | null> {
    const { data, error } = await supabase
      .from('file_sync_state')
      .select('*')
      .eq('project_id', this.projectId)
      .eq('file_path', filePath)
      .maybeSingle()

    if (error) {
      console.error('[SyncEngine] getSyncRecord error:', error.message)
      return null
    }

    return data ? toFileSyncRecord(data as Record<string, unknown>) : null
  }

  private async getSyncRecords(filePaths: string[]): Promise<FileSyncRecord[]> {
    const { data, error } = await supabase
      .from('file_sync_state')
      .select('*')
      .eq('project_id', this.projectId)
      .in('file_path', filePaths)

    if (error) {
      console.error('[SyncEngine] getSyncRecords error:', error.message)
      return []
    }

    return (data ?? []).map((r: Record<string, unknown>) => toFileSyncRecord(r))
  }

  private async getAllSyncRecords(): Promise<FileSyncRecord[]> {
    const { data, error } = await supabase
      .from('file_sync_state')
      .select('*')
      .eq('project_id', this.projectId)

    if (error) {
      console.error('[SyncEngine] getAllSyncRecords error:', error.message)
      return []
    }

    return (data ?? []).map((r: Record<string, unknown>) => toFileSyncRecord(r))
  }

  private async upsertSyncRecord(
    filePath: string,
    contentHash: string,
    localHash: string | null,
    syncStatus: SyncStatus,
    errorMessage?: string
  ): Promise<void> {
    const now = new Date().toISOString()

    const row = {
      project_id: this.projectId,
      file_path: filePath,
      content_hash: contentHash,
      local_hash: localHash ?? null,
      sync_status: syncStatus,
      last_synced_at: syncStatus === 'synced' ? now : null,
      error_message: errorMessage ?? null,
      updated_at: now,
    }

    const { error } = await supabase
      .from('file_sync_state')
      .upsert(row, { onConflict: 'project_id,file_path' })

    if (error) {
      console.error('[SyncEngine] upsertSyncRecord error:', error.message)
    }
  }
}
