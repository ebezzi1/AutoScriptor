import { supabase } from '../supabase'
import type { Project, EnvProfile, AuthConfig, AuthRole, CiCdConfig } from '../../types'
import { toTestStep, fromTestStep, checkError } from './mapper'

// ── DB → App ─────────────────────────────────────────────────────────────────

export function toProject(
  row: Record<string, unknown>,
  environments: EnvProfile[],
  authRoles: AuthRole[]
): Project {
  const authEnabled = (row.auth_enabled as boolean) ?? false
  const auth: AuthConfig | undefined =
    authEnabled || authRoles.length > 0
      ? { enabled: authEnabled, roles: authRoles }
      : undefined

  return {
    id: row.id as string,
    name: row.name as string,
    description: (row.description as string) ?? '',
    language: (row.language as Project['language']) ?? 'typescript',
    baseUrl: (row.base_url as string) ?? '',
    browser: (row.browser as Project['browser']) ?? 'chromium',
    defaultTimeout: (row.default_timeout as number) ?? 30000,
    selectorStrategy: (row.selector_strategy as Project['selectorStrategy']) ?? 'css',
    retries: (row.retries as number) ?? 0,
    reporter: (row.reporter as Project['reporter']) ?? 'html',
    generatePOM: (row.generate_pom as boolean) ?? false,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
    environments,
    activeEnvironmentId: (row.active_environment_id as string | null) ?? null,
    auth,
    cicd: row.cicd_platforms != null
      ? {
          platforms: ((row.cicd_platforms as string[]) ?? []) as CiCdConfig['platforms'],
          nodeVersion: (row.cicd_node_version as CiCdConfig['nodeVersion']) ?? '20',
          packageManager: (row.cicd_package_manager as CiCdConfig['packageManager']) ?? 'npm',
          pushBranches: (row.cicd_push_branches as string[]) ?? [],
          pullRequests: (row.cicd_pull_requests as boolean) ?? true,
          manualTrigger: (row.cicd_manual_trigger as boolean) ?? true,
          scheduledCron: (row.cicd_scheduled_cron as string) ?? '',
          shardEnabled: (row.cicd_shard_enabled as boolean) ?? false,
          shardWorkers: (row.cicd_shard_workers as number) ?? 4,
        }
      : undefined,
  }
}

function projectFields(project: Project): Record<string, unknown> {
  return {
    name: project.name,
    description: project.description,
    language: project.language,
    base_url: project.baseUrl,
    browser: project.browser,
    default_timeout: project.defaultTimeout,
    selector_strategy: project.selectorStrategy,
    retries: project.retries,
    reporter: project.reporter,
    generate_pom: project.generatePOM,
    updated_at: new Date().toISOString(),
    active_environment_id: project.activeEnvironmentId ?? null,
    auth_enabled: project.auth?.enabled ?? false,
    cicd_platforms: project.cicd?.platforms ?? null,
    cicd_node_version: project.cicd?.nodeVersion ?? null,
    cicd_package_manager: project.cicd?.packageManager ?? null,
    cicd_push_branches: project.cicd?.pushBranches ?? null,
    cicd_pull_requests: project.cicd?.pullRequests ?? null,
    cicd_manual_trigger: project.cicd?.manualTrigger ?? null,
    cicd_scheduled_cron: project.cicd?.scheduledCron ?? null,
    cicd_shard_enabled: project.cicd?.shardEnabled ?? null,
    cicd_shard_workers: project.cicd?.shardWorkers ?? null,
  }
}

// ── Environments ──────────────────────────────────────────────────────────────

export function toEnvProfile(row: Record<string, unknown>): EnvProfile {
  return {
    id: row.id as string,
    name: row.name as string,
    baseUrl: (row.base_url as string) ?? '',
    variableOverrides: (row.variable_overrides as Record<string, string>) ?? {},
    color: (row.color as string | null) ?? undefined,
  }
}

function fromEnvProfile(env: EnvProfile, projectId: string): Record<string, unknown> {
  return {
    id: env.id,
    project_id: projectId,
    name: env.name,
    base_url: env.baseUrl,
    variable_overrides: env.variableOverrides,
    color: env.color ?? null,
  }
}

// ── Auth roles ────────────────────────────────────────────────────────────────

export function toAuthRole(
  row: Record<string, unknown>,
  loginSteps: ReturnType<typeof toTestStep>[]
): AuthRole {
  return {
    id: row.id as string,
    name: row.name as string,
    storageStatePath: (row.storage_state_path as string) ?? '',
    color: (row.color as string) ?? '#6898cc',
    loginSteps,
  }
}

function fromAuthRole(role: AuthRole, projectId: string): Record<string, unknown> {
  return {
    id: role.id,
    project_id: projectId,
    name: role.name,
    storage_state_path: role.storageStatePath,
    color: role.color,
  }
}

// ── CRUD ──────────────────────────────────────────────────────────────────────

export async function createProject(project: Project, teamId: string): Promise<void> {
  checkError(
    await supabase
      .from('projects')
      .insert({ id: project.id, team_id: teamId, ...projectFields(project) })
  )
  await upsertProjectChildren(project)
}

export async function updateProject(project: Project): Promise<void> {
  const { error } = await supabase
    .from('projects')
    .update(projectFields(project))
    .eq('id', project.id)
  checkError({ error })
  await upsertProjectChildren(project)
}

export async function deleteProject(projectId: string): Promise<void> {
  checkError(await supabase.from('projects').delete().eq('id', projectId))
}

async function upsertProjectChildren(project: Project): Promise<void> {
  // Environments: delete all + re-insert
  await supabase.from('environments').delete().eq('project_id', project.id)
  if (project.environments && project.environments.length > 0) {
    checkError(
      await supabase
        .from('environments')
        .insert(project.environments.map((e) => fromEnvProfile(e, project.id)))
    )
  }

  // Auth roles + their login steps
  const existingRoleIds = (
    await supabase.from('auth_roles').select('id').eq('project_id', project.id)
  ).data?.map((r: Record<string, unknown>) => r.id as string) ?? []
  if (existingRoleIds.length > 0) {
    await supabase.from('auth_role_steps').delete().in('auth_role_id', existingRoleIds)
  }
  await supabase.from('auth_roles').delete().eq('project_id', project.id)

  const roles = project.auth?.roles ?? []
  if (roles.length > 0) {
    checkError(
      await supabase
        .from('auth_roles')
        .insert(roles.map((r) => fromAuthRole(r, project.id)))
    )
    const allLoginSteps = roles.flatMap((r) =>
      r.loginSteps.map((s) => fromTestStep(s, 'auth_role_id', r.id))
    )
    if (allLoginSteps.length > 0) {
      checkError(await supabase.from('auth_role_steps').insert(allLoginSteps))
    }
  }
}
