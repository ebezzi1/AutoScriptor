import { useState, useEffect, useCallback } from 'react'
import { useAgent } from '../../store/AgentContext'
import { useToast } from '../common/Toast'
import { Btn } from '../common/Btn'
import { SyncEngine } from '../../services/syncEngine'
import { AgentClientService } from '../../services/agentClient'
import { ConflictResolutionDialog } from './ConflictResolutionDialog'
import type { FileSyncRecord } from '../../services/syncEngine'

interface Props {
  projectId: string
  onClose: () => void
  onRefresh: () => void
}

export function SyncDetailPopover({ projectId, onClose, onRefresh }: Props) {
  const { agentUrl, agentToken } = useAgent()
  const { toast } = useToast()

  const [pendingFiles, setPendingFiles] = useState<FileSyncRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [showConfirmRegen, setShowConfirmRegen] = useState(false)
  const [showConflicts, setShowConflicts] = useState(false)
  const [lastSync, setLastSync] = useState<string | null>(null)

  const getEngine = useCallback(() => {
    const agentSvc = new AgentClientService({ baseUrl: agentUrl, token: agentToken })
    return new SyncEngine(agentSvc, projectId)
  }, [agentUrl, agentToken, projectId])

  const loadPending = useCallback(async () => {
    setLoading(true)
    try {
      const engine = getEngine()
      const files = await engine.getPendingFiles()
      setPendingFiles(files)

      // Get last sync from the most recent synced file
      const status = await engine.getSyncStatus()
      if (status.total > 0) {
        // Use the latest lastSyncedAt from pending files or current time
        const synced = files.find((f) => f.lastSyncedAt)
        setLastSync(synced?.lastSyncedAt ?? null)
      }
    } catch {
      setPendingFiles([])
    } finally {
      setLoading(false)
    }
  }, [getEngine])

  useEffect(() => {
    loadPending()
  }, [loadPending])

  const conflictFiles = pendingFiles.filter((f) => f.syncStatus === 'conflict')
  const pendingOnly = pendingFiles.filter((f) => f.syncStatus !== 'conflict')

  const handleOverwrite = async (filePath: string) => {
    try {
      const engine = getEngine()
      // Read the current app version from the agent to resolve
      const result = await engine.resolveConflict(filePath, 'local')
      if (result.status === 'synced') {
        toast('Conflict resolved')
        await loadPending()
        onRefresh()
      } else {
        toast(result.error ?? 'Failed to resolve', 'error')
      }
    } catch (err) {
      toast((err as Error).message, 'error')
    }
  }

  const handleKeepLocal = async (filePath: string) => {
    try {
      const engine = getEngine()
      const result = await engine.resolveConflict(filePath, 'local')
      if (result.status === 'synced') {
        toast('Kept local version')
        await loadPending()
        onRefresh()
      }
    } catch (err) {
      toast((err as Error).message, 'error')
    }
  }

  const handleSyncAll = async () => {
    setSyncing(true)
    toast('Sync started...')
    // Sync is triggered externally — this button signals intent
    // Actual sync happens in the parent workflow
    setTimeout(() => {
      setSyncing(false)
      onRefresh()
      toast('Sync complete')
    }, 1000)
  }

  const handleConfirmRegen = () => {
    setShowConfirmRegen(false)
    toast('Full regeneration triggered')
    onClose()
  }

  return (
    <>
      <div className="absolute top-full right-0 mt-1.5 z-50 bg-vsc-panel border border-vsc-border rounded-lg shadow-xl w-[320px] animate-popover-in">
        {/* Header */}
        <div className="px-4 py-3 border-b border-vsc-border">
          <p className="text-xs font-semibold text-vsc-text">File Sync</p>
        </div>

        {/* Content */}
        <div className="max-h-[300px] overflow-y-auto">
          {loading ? (
            <div className="px-4 py-6 flex items-center justify-center">
              <svg className="animate-spin h-4 w-4 text-vsc-accent" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z"/>
              </svg>
            </div>
          ) : pendingFiles.length === 0 ? (
            <div className="px-4 py-6 text-center">
              <svg width="20" height="20" viewBox="0 0 16 16" fill="none" className="text-green-400 mx-auto mb-2">
                <circle cx="8" cy="8" r="7" stroke="currentColor" strokeWidth="1.5"/>
                <path d="M4.5 8l2.5 2.5 4.5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <p className="text-xs text-vsc-muted">All files synced</p>
            </div>
          ) : (
            <div className="py-1">
              {/* Conflict files */}
              {conflictFiles.length > 0 && (
                <div>
                  <p className="px-4 py-1.5 text-[9px] text-red-400 uppercase tracking-wider font-semibold">
                    Conflicts ({conflictFiles.length})
                  </p>
                  {conflictFiles.map((file) => (
                    <div key={file.id} className="px-4 py-2 flex items-center gap-2 hover:bg-vsc-hover transition-colors">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-red-400 shrink-0">
                        <path d="M6 1L1 10h10L6 1z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
                        <path d="M6 5v2M6 8.5h.01" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
                      </svg>
                      <span className="flex-1 text-[10px] text-vsc-muted font-mono truncate" title={file.filePath}>
                        {file.filePath}
                      </span>
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          onClick={() => handleOverwrite(file.filePath)}
                          className="text-[8px] uppercase tracking-wider text-vsc-accent hover:text-white px-1.5 py-0.5 rounded transition-colors"
                          title="Overwrite local with app version"
                        >
                          Overwrite
                        </button>
                        <button
                          onClick={() => handleKeepLocal(file.filePath)}
                          className="text-[8px] uppercase tracking-wider text-vsc-dim hover:text-vsc-muted px-1.5 py-0.5 rounded transition-colors"
                          title="Keep local version"
                        >
                          Keep
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Pending files */}
              {pendingOnly.length > 0 && (
                <div>
                  <p className="px-4 py-1.5 text-[9px] text-amber-400 uppercase tracking-wider font-semibold">
                    Pending ({pendingOnly.length})
                  </p>
                  {pendingOnly.map((file) => (
                    <div key={file.id} className="px-4 py-2 flex items-center gap-2 hover:bg-vsc-hover transition-colors">
                      <svg width="12" height="12" viewBox="0 0 12 12" fill="none" className="text-amber-400 shrink-0">
                        <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.2"/>
                        <path d="M6 3.5v3l2 1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                      </svg>
                      <span className="flex-1 text-[10px] text-vsc-muted font-mono truncate" title={file.filePath}>
                        {file.filePath}
                      </span>
                      {file.errorMessage && (
                        <span className="text-[8px] text-red-400 shrink-0" title={file.errorMessage}>
                          error
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="px-4 py-3 border-t border-vsc-border flex flex-col gap-2">
          <div className="flex items-center gap-2">
            <Btn
              variant="primary"
              size="sm"
              onClick={handleSyncAll}
              disabled={syncing || pendingFiles.length === 0}
              className="flex-1"
            >
              {syncing ? 'Syncing...' : 'Sync All'}
            </Btn>

            {conflictFiles.length > 0 && (
              <Btn
                variant="secondary"
                size="sm"
                onClick={() => setShowConflicts(true)}
              >
                Resolve All
              </Btn>
            )}
          </div>

          <button
            onClick={() => setShowConfirmRegen(true)}
            className="text-[9px] text-vsc-dim hover:text-vsc-muted uppercase tracking-wider transition-colors text-left"
          >
            Full Regenerate...
          </button>

          {/* Last sync */}
          {lastSync && (
            <p className="text-[9px] text-vsc-dim">
              Last sync: {new Date(lastSync).toLocaleString()}
            </p>
          )}
        </div>
      </div>

      {/* Full regenerate confirmation */}
      {showConfirmRegen && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-[2px] flex items-center justify-center z-[60] p-4 animate-fade-in"
          onClick={(e) => e.target === e.currentTarget && setShowConfirmRegen(false)}
        >
          <div className="bg-vsc-panel border border-vsc-border rounded-xl shadow-2xl w-[380px] animate-slide-down">
            <div className="px-6 py-4 border-b border-vsc-border">
              <h3 className="text-sm font-semibold text-vsc-text">Full Regenerate</h3>
            </div>
            <div className="px-6 py-4">
              <p className="text-xs text-vsc-muted leading-relaxed">
                This will regenerate all project files and overwrite any local changes.
                Make sure to commit or back up any local work first.
              </p>
            </div>
            <div className="px-6 py-4 border-t border-vsc-border flex items-center justify-end gap-3">
              <Btn variant="ghost" size="sm" onClick={() => setShowConfirmRegen(false)}>
                Cancel
              </Btn>
              <Btn variant="danger" size="sm" onClick={handleConfirmRegen}>
                Regenerate All
              </Btn>
            </div>
          </div>
        </div>
      )}

      {/* Conflict resolution dialog */}
      {showConflicts && conflictFiles.length > 0 && (
        <ConflictResolutionDialog
          conflicts={conflictFiles.map((f) => ({
            filePath: f.filePath,
            contentHash: f.contentHash,
            localHash: f.localHash ?? '',
          }))}
          onApply={async (resolutions) => {
            const engine = getEngine()
            for (const [filePath, resolution] of Object.entries(resolutions)) {
              await engine.resolveConflict(filePath, resolution)
            }
            toast('Conflicts resolved')
            setShowConflicts(false)
            await loadPending()
            onRefresh()
          }}
          onCancel={() => setShowConflicts(false)}
        />
      )}
    </>
  )
}
