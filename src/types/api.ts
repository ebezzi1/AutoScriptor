// ── API Test types ────────────────────────────────────────────────────────────

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
export type AuthType = 'none' | 'bearer' | 'basic' | 'apikey'
export type BodyType = 'none' | 'json' | 'formdata'
export type AssertOperator = 'equals' | 'contains' | 'exists' | 'notEmpty' | 'isArray' | 'hasLength'
export type CaptureScope = 'test' | 'environment'
export type ApiTab = 'params' | 'headers' | 'body' | 'auth'

export interface KVPair {
  id: string
  key: string
  value: string
  enabled: boolean
}

export interface ApiAuth {
  type: AuthType
  // bearer
  token: string
  // basic
  username: string
  password: string
  // apikey
  keyName: string
  keyValue: string
  keyIn: 'header' | 'query'
}

export interface ResponseAssertion {
  id: string
  jsonPath: string
  operator: AssertOperator
  expected: string
}

export interface CaptureVar {
  id: string
  name: string
  jsonPath: string
  scope: CaptureScope
}

export interface ApiStep {
  id: string
  order: number
  name: string
  method: HttpMethod
  url: string
  params: KVPair[]
  headers: KVPair[]
  bodyType: BodyType
  bodyJson: string
  bodyFormData: KVPair[]
  auth: ApiAuth
  statusAssertion: number | null
  responseAssertions: ResponseAssertion[]
  captureVars: CaptureVar[]
  collapsed: boolean
}

// ── Constants ─────────────────────────────────────────────────────────────────

export const HTTP_METHODS: HttpMethod[] = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE']

/** Hex color values for each HTTP method — used in inline styles to avoid Tailwind purging */
export const METHOD_STYLE: Record<HttpMethod, { border: string; bg: string; text: string }> = {
  GET:    { border: '#5db87c', bg: 'rgba(93,184,124,0.12)',   text: '#5db87c' },
  POST:   { border: '#c89820', bg: 'rgba(200,152,32,0.12)',   text: '#d4a92a' },
  PUT:    { border: '#6898cc', bg: 'rgba(104,152,204,0.12)',  text: '#6898cc' },
  PATCH:  { border: '#e0943a', bg: 'rgba(224,148,58,0.12)',   text: '#e0943a' },
  DELETE: { border: '#e05252', bg: 'rgba(224,82,82,0.12)',    text: '#e05252' },
}

export const ASSERT_OPERATOR_LABELS: Record<AssertOperator, string> = {
  equals:    'equals',
  contains:  'contains',
  exists:    'exists',
  notEmpty:  'not empty',
  isArray:   'is array',
  hasLength: 'has length',
}

export const COMMON_HEADERS = [
  'Content-Type',
  'Authorization',
  'Accept',
  'Accept-Language',
  'Cache-Control',
  'X-API-Key',
  'X-Auth-Token',
  'X-Request-ID',
  'X-Correlation-ID',
  'Idempotency-Key',
  'User-Agent',
]

export const COMMON_CONTENT_TYPES = [
  'application/json',
  'application/x-www-form-urlencoded',
  'multipart/form-data',
  'text/plain',
  'application/xml',
]

// ── Factory functions ─────────────────────────────────────────────────────────

export function makeKVPair(): KVPair {
  return { id: crypto.randomUUID(), key: '', value: '', enabled: true }
}

export function makeApiAuth(): ApiAuth {
  return {
    type: 'none',
    token: '',
    username: '',
    password: '',
    keyName: 'X-API-Key',
    keyValue: '',
    keyIn: 'header',
  }
}

export function makeResponseAssertion(): ResponseAssertion {
  return { id: crypto.randomUUID(), jsonPath: '', operator: 'equals', expected: '' }
}

export function makeCaptureVar(): CaptureVar {
  return { id: crypto.randomUUID(), name: '', jsonPath: '', scope: 'test' }
}

export function makeApiStep(order: number): ApiStep {
  return {
    id: crypto.randomUUID(),
    order,
    name: `Request ${order + 1}`,
    method: 'GET',
    url: '',
    params: [],
    headers: [],
    bodyType: 'none',
    bodyJson: '{\n  \n}',
    bodyFormData: [],
    auth: makeApiAuth(),
    statusAssertion: 200,
    responseAssertions: [],
    captureVars: [],
    collapsed: false,
  }
}
