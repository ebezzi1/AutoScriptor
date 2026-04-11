/**
 * Shared mapping functions between DB snake_case rows and app camelCase types.
 * Used across multiple entity files (test steps appear in test_steps,
 * util_steps, auth_role_steps, and feature_setup_steps tables).
 */
import type { TestStep, SelectorStrategy, ActionType, AssertionType } from '../../types'
import type { ApiStep, KVPair, ApiAuth, ResponseAssertion, CaptureVar } from '../../types/api'

// ── TestStep ─────────────────────────────────────────────────────────────────

export function toTestStep(row: Record<string, unknown>): TestStep {
  return {
    id: row.id as string,
    order: row.sort_order as number,
    selector: (row.selector as string) ?? '',
    selectorStrategy: (row.selector_strategy as SelectorStrategy) ?? 'css',
    action: row.action as ActionType,
    value: (row.value as string) ?? '',
    assertion: (row.assertion as AssertionType) ?? 'none',
    assertionValue: (row.assertion_value as string) ?? '',
    waitBehavior: (row.wait_behavior as TestStep['waitBehavior']) ?? 'auto',
    waitMs: (row.wait_ms as number | null) ?? undefined,
    utilRef: (row.util_ref as string | null) ?? undefined,
    maxDiffThreshold: (row.max_diff_threshold as number | null) ?? undefined,
    maskSelectors: (row.mask_selectors as string | null) ?? undefined,
    disableAnimations: (row.disable_animations as boolean | null) ?? undefined,
  }
}

export function fromTestStep(
  step: TestStep,
  parentKey: string,
  parentId: string,
  extra?: Record<string, unknown>
): Record<string, unknown> {
  return {
    id: step.id,
    [parentKey]: parentId,
    sort_order: step.order,
    selector: step.selector,
    selector_strategy: step.selectorStrategy,
    action: step.action,
    value: step.value,
    assertion: step.assertion,
    assertion_value: step.assertionValue,
    wait_behavior: step.waitBehavior,
    wait_ms: step.waitMs ?? null,
    util_ref: step.utilRef ?? null,
    max_diff_threshold: step.maxDiffThreshold ?? null,
    mask_selectors: step.maskSelectors ?? null,
    disable_animations: step.disableAnimations ?? null,
    ...extra,
  }
}

// ── ApiStep ──────────────────────────────────────────────────────────────────

export function toApiStep(row: Record<string, unknown>): ApiStep {
  return {
    id: row.id as string,
    order: row.sort_order as number,
    name: (row.name as string) ?? '',
    method: row.method as ApiStep['method'],
    url: (row.url as string) ?? '',
    params: (row.params as KVPair[]) ?? [],
    headers: (row.headers as KVPair[]) ?? [],
    bodyType: (row.body_type as ApiStep['bodyType']) ?? 'none',
    bodyJson: (row.body_json as string) ?? '{}',
    bodyFormData: (row.body_form_data as KVPair[]) ?? [],
    auth: {
      type: ((row.auth_type as ApiAuth['type']) ?? 'none'),
      token: (row.auth_token as string) ?? '',
      username: (row.auth_username as string) ?? '',
      password: (row.auth_password as string) ?? '',
      keyName: (row.auth_key_name as string) ?? 'X-API-Key',
      keyValue: (row.auth_key_value as string) ?? '',
      keyIn: ((row.auth_key_in as ApiAuth['keyIn']) ?? 'header'),
    },
    statusAssertion: row.status_assertion as number | null,
    responseAssertions: (row.response_assertions as ResponseAssertion[]) ?? [],
    captureVars: (row.capture_vars as CaptureVar[]) ?? [],
    collapsed: (row.collapsed as boolean) ?? false,
  }
}

export function fromApiStep(
  step: ApiStep,
  testCaseId: string
): Record<string, unknown> {
  return {
    id: step.id,
    test_case_id: testCaseId,
    sort_order: step.order,
    name: step.name,
    method: step.method,
    url: step.url,
    params: step.params,
    headers: step.headers,
    body_type: step.bodyType,
    body_json: step.bodyJson,
    body_form_data: step.bodyFormData,
    auth_type: step.auth.type,
    auth_token: step.auth.token,
    auth_username: step.auth.username,
    auth_password: step.auth.password,
    auth_key_name: step.auth.keyName,
    auth_key_value: step.auth.keyValue,
    auth_key_in: step.auth.keyIn,
    status_assertion: step.statusAssertion,
    response_assertions: step.responseAssertions,
    capture_vars: step.captureVars,
    collapsed: step.collapsed,
  }
}

// ── Error helper ─────────────────────────────────────────────────────────────

export function checkError(result: { error: { message: string } | null }): void {
  if (result.error) throw new Error(result.error.message)
}
