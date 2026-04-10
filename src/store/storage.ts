import type { AppState } from '../types'

const KEY = 'pw-test-gen-v2'

type PersistedState = Omit<AppState, 'currentView'>

export function loadState(): PersistedState | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    return JSON.parse(raw) as PersistedState
  } catch {
    return null
  }
}

export function saveState(state: AppState): void {
  try {
    const { currentView: _cv, ...rest } = state
    localStorage.setItem(KEY, JSON.stringify(rest))
  } catch {
    // quota exceeded — ignore
  }
}
