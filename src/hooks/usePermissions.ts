import { useAuth } from '../components/auth/AuthProvider'
import type { TeamRole } from '../lib/database/teamManagement'

export interface Permissions {
  role: TeamRole | null
  canManageTeam: boolean       // owner only
  canManageMembers: boolean    // owner + admin
  canEditContent: boolean      // owner + admin + member
  canDeleteContent: boolean    // owner + admin + member
  canApprove: boolean          // owner + admin
  isReadOnly: boolean          // viewer only
}

export function usePermissions(): Permissions {
  const { role } = useAuth()
  return {
    role: role ?? null,
    canManageTeam: role === 'owner',
    canManageMembers: role === 'owner' || role === 'admin',
    canEditContent: role === 'owner' || role === 'admin' || role === 'member',
    canDeleteContent: role === 'owner' || role === 'admin' || role === 'member',
    canApprove: role === 'owner' || role === 'admin',
    isReadOnly: role === 'viewer',
  }
}
