import { useState } from 'react'
import { useAuth } from './AuthProvider'
import type { UserTeam } from '../../lib/database/teams'

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Member',
  viewer: 'Viewer',
}

const ROLE_COLORS: Record<string, string> = {
  owner: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
  admin: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
  member: 'text-vsc-muted bg-vsc-hover border-vsc-border',
  viewer: 'text-vsc-dim bg-vsc-hover border-vsc-border',
}

interface Props {
  teams: UserTeam[]
}

export function TeamSelectorModal({ teams }: Props) {
  const { selectTeam, user } = useAuth()
  // Pre-select the first (or only) team
  const [selected, setSelected] = useState<string | null>(teams.length === 1 ? teams[0].teamId : null)
  const [entering, setEntering] = useState(false)
  const [dontShowAgain, setDontShowAgain] = useState(false)

  const handleEnter = async () => {
    if (!selected) return
    setEntering(true)
    await selectTeam(selected, dontShowAgain)
    // After selectTeam, teamState becomes 'ready' and the gate renders the app
  }

  return (
    <div className="min-h-screen bg-vsc-bg flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <div className="w-8 h-8 rounded-lg bg-vsc-accent/15 border border-vsc-accent/30 flex items-center justify-center">
            <span className="text-vsc-accent text-xs font-bold leading-none">PW</span>
          </div>
          <span className="text-lg font-semibold text-vsc-text">AutoScriptor</span>
        </div>

        <div className="bg-vsc-panel border border-vsc-border rounded-xl overflow-hidden">
          {/* Header */}
          <div className="px-6 py-5 border-b border-vsc-border">
            <h2 className="text-base font-semibold text-vsc-text">Choose a workspace</h2>
            <p className="text-xs text-vsc-muted mt-1">
              {teams.length === 1
                ? 'Confirm your workspace to continue.'
                : `You belong to ${teams.length} teams. Select one to continue.`}
            </p>
          </div>

          {/* Team list */}
          <div className="p-4 flex flex-col gap-2 max-h-[360px] overflow-y-auto">
            {teams.map((team) => {
              const isSelected = selected === team.teamId
              const roleLabel = ROLE_LABELS[team.role] ?? team.role
              const roleColor = ROLE_COLORS[team.role] ?? ROLE_COLORS.member
              return (
                <button
                  key={team.teamId}
                  onClick={() => setSelected(team.teamId)}
                  className={`w-full text-left px-4 py-3.5 rounded-lg border-2 transition-all duration-150 ${
                    isSelected
                      ? 'border-vsc-accent bg-vsc-accent-light'
                      : 'border-vsc-border bg-vsc-bg hover:border-vsc-accent/30 hover:bg-vsc-hover'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {/* Team icon */}
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                      isSelected ? 'bg-vsc-accent/20' : 'bg-vsc-hover'
                    }`}>
                      <span className={`text-sm font-bold ${isSelected ? 'text-vsc-accent' : 'text-vsc-muted'}`}>
                        {team.teamName.charAt(0).toUpperCase()}
                      </span>
                    </div>

                    {/* Team info */}
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-medium truncate ${isSelected ? 'text-vsc-text' : 'text-vsc-muted'}`}>
                        {team.teamName}
                      </p>
                      <p className="text-[10px] text-vsc-dim mt-0.5">
                        {team.memberCount} member{team.memberCount !== 1 ? 's' : ''}
                      </p>
                    </div>

                    {/* Role badge */}
                    <span className={`text-[9px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full border shrink-0 ${roleColor}`}>
                      {roleLabel}
                    </span>

                    {/* Selection indicator */}
                    <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                      isSelected ? 'border-vsc-accent' : 'border-vsc-border'
                    }`}>
                      {isSelected && <div className="w-2 h-2 rounded-full bg-vsc-accent" />}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-vsc-border flex flex-col gap-3">
            <button
              onClick={handleEnter}
              disabled={!selected || entering}
              className="w-full py-2.5 text-sm font-medium rounded-md bg-vsc-accent text-white hover:bg-vsc-accent-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {entering ? 'Loading workspace…' : 'Enter Workspace'}
            </button>

            {/* Don't show again */}
            <label className="flex items-center gap-2.5 cursor-pointer group self-center">
              <div
                className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
                  dontShowAgain
                    ? 'border-vsc-accent bg-vsc-accent'
                    : 'border-vsc-border group-hover:border-vsc-muted'
                }`}
                onClick={() => setDontShowAgain((v) => !v)}
              >
                {dontShowAgain && (
                  <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                    <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                )}
              </div>
              <span className="text-xs text-vsc-dim group-hover:text-vsc-muted transition-colors">
                Don't show this again
              </span>
            </label>
          </div>
        </div>

        <p className="text-center text-xs text-vsc-dim mt-4">
          Signed in as <span className="text-vsc-muted">{user?.email}</span>
        </p>
      </div>
    </div>
  )
}
