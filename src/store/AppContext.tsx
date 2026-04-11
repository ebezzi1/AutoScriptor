import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useRef,
  useCallback,
  useState,
  type ReactNode,
} from 'react'
import type { AppState, AppAction, AppView } from '../types'
import { useAuth } from '../components/auth/AuthProvider'
import { useToast } from '../components/common/Toast'
import { loadFullState, syncAction } from '../lib/database'

const initialState: AppState = {
  projects: [],
  features: [],
  testCases: [],
  variables: [],
  utils: [],
  fixtures: [],
  currentView: { type: 'projects' },
}

function reducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'HYDRATE':
      return { ...action.state, currentView: state.currentView }

    case 'SET_VIEW':
      return { ...state, currentView: action.view }

    case 'CREATE_PROJECT':
      return { ...state, projects: [...state.projects, action.project] }
    case 'UPDATE_PROJECT':
      return {
        ...state,
        projects: state.projects.map((p) =>
          p.id === action.project.id ? action.project : p
        ),
      }
    case 'SET_ACTIVE_ENV':
      return {
        ...state,
        projects: state.projects.map((p) =>
          p.id === action.projectId ? { ...p, activeEnvironmentId: action.envId } : p
        ),
      }
    case 'DELETE_PROJECT': {
      const featureIds = state.features
        .filter((f) => f.projectId === action.projectId)
        .map((f) => f.id)
      const tcIds = state.testCases
        .filter((tc) => featureIds.includes(tc.featureId))
        .map((tc) => tc.id)
      return {
        ...state,
        projects: state.projects.filter((p) => p.id !== action.projectId),
        features: state.features.filter((f) => f.projectId !== action.projectId),
        testCases: state.testCases.filter((tc) => !tcIds.includes(tc.id)),
        variables: state.variables.filter((v) => v.projectId !== action.projectId),
        utils: state.utils.filter((u) => u.projectId !== action.projectId),
        fixtures: state.fixtures.filter((fx) => fx.projectId !== action.projectId),
        currentView: { type: 'projects' },
      }
    }

    case 'CREATE_FEATURE':
      return { ...state, features: [...state.features, action.feature] }
    case 'UPDATE_FEATURE':
      return {
        ...state,
        features: state.features.map((f) =>
          f.id === action.feature.id ? action.feature : f
        ),
      }
    case 'DELETE_FEATURE': {
      const tcIds = state.testCases
        .filter((tc) => tc.featureId === action.featureId)
        .map((tc) => tc.id)
      return {
        ...state,
        features: state.features.filter((f) => f.id !== action.featureId),
        testCases: state.testCases.filter((tc) => tc.featureId !== action.featureId),
        variables: state.variables.filter(
          (v) => !(v.scope === 'feature' && v.featureId === action.featureId)
        ),
        currentView: state.testCases.some(
          (tc) => tcIds.includes(tc.id) && state.currentView.type === 'test-case'
        )
          ? { type: 'projects' }
          : state.currentView,
      }
    }

    case 'CREATE_TC':
      return { ...state, testCases: [...state.testCases, action.tc] }
    case 'UPDATE_TC':
      return {
        ...state,
        testCases: state.testCases.map((tc) =>
          tc.id === action.tc.id ? action.tc : tc
        ),
      }
    case 'DELETE_TC': {
      const delId = action.tcId
      return {
        ...state,
        testCases: state.testCases
          .filter((tc) => tc.id !== delId)
          .map((tc) =>
            tc.dependencies?.includes(delId)
              ? { ...tc, dependencies: tc.dependencies.filter((d) => d !== delId) }
              : tc
          ),
      }
    }
    case 'BULK_DELETE_TC': {
      const ids = new Set(action.tcIds)
      return {
        ...state,
        testCases: state.testCases
          .filter((tc) => !ids.has(tc.id))
          .map((tc) =>
            tc.dependencies?.some((d) => ids.has(d))
              ? { ...tc, dependencies: tc.dependencies!.filter((d) => !ids.has(d)) }
              : tc
          ),
      }
    }
    case 'BULK_MOVE_TC':
      return {
        ...state,
        testCases: state.testCases.map((tc) =>
          action.tcIds.includes(tc.id) ? { ...tc, featureId: action.targetFeatureId } : tc
        ),
      }
    case 'BULK_COPY_TC':
    case 'BULK_DUPLICATE_TC':
      return { ...state, testCases: [...state.testCases, ...action.copies] }
    case 'DUPLICATE_TC': {
      const original = state.testCases.find((tc) => tc.id === action.tcId)
      if (!original) return state
      const copy = {
        ...original,
        id: action.newTcId ?? crypto.randomUUID(),
        name: `${original.name} (copy)`,
        steps: original.steps.map((s) => ({ ...s, id: crypto.randomUUID() })),
        apiSteps: original.apiSteps?.map((s) => ({ ...s, id: crypto.randomUUID() })),
      }
      return { ...state, testCases: [...state.testCases, copy] }
    }
    case 'DUPLICATE_TC_TO': {
      const original = state.testCases.find((tc) => tc.id === action.tcId)
      if (!original) return state
      const copy = {
        ...original,
        id: action.newTcId,
        featureId: action.targetFeatureId,
        name: `${original.name} (copy)`,
        steps: original.steps.map((s) => ({ ...s, id: crypto.randomUUID() })),
        apiSteps: original.apiSteps?.map((s) => ({ ...s, id: crypto.randomUUID() })),
      }
      return { ...state, testCases: [...state.testCases, copy] }
    }

    case 'CREATE_VAR':
      return { ...state, variables: [...state.variables, action.variable] }
    case 'UPDATE_VAR':
      return {
        ...state,
        variables: state.variables.map((v) =>
          v.id === action.variable.id ? action.variable : v
        ),
      }
    case 'DELETE_VAR':
      return {
        ...state,
        variables: state.variables.filter((v) => v.id !== action.varId),
      }

    case 'CREATE_UTIL':
      return { ...state, utils: [...state.utils, action.util] }
    case 'UPDATE_UTIL':
      return {
        ...state,
        utils: state.utils.map((u) =>
          u.id === action.util.id ? action.util : u
        ),
      }
    case 'DELETE_UTIL':
      return {
        ...state,
        utils: state.utils.filter((u) => u.id !== action.utilId),
      }

    case 'CREATE_FIXTURE':
      return { ...state, fixtures: [...state.fixtures, action.fixture] }
    case 'UPDATE_FIXTURE':
      return {
        ...state,
        fixtures: state.fixtures.map((fx) =>
          fx.id === action.fixture.id ? action.fixture : fx
        ),
      }
    case 'DELETE_FIXTURE':
      return {
        ...state,
        fixtures: state.fixtures.filter((fx) => fx.id !== action.fixtureId),
      }

    default:
      return state
  }
}

interface ContextValue {
  state: AppState
  dispatch: (action: AppAction) => void
  navigate: (view: AppView) => void
}

const AppContext = createContext<ContextValue | null>(null)

function LoadingScreen() {
  return (
    <div className="h-screen bg-vsc-bg flex flex-col items-center justify-center gap-3">
      <svg
        className="animate-spin h-6 w-6 text-vsc-accent"
        viewBox="0 0 24 24"
        fill="none"
        aria-label="Loading workspace"
      >
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
      </svg>
      <p className="text-vsc-muted text-sm font-mono">Loading workspace…</p>
    </div>
  )
}

export function AppProvider({ children }: { children: ReactNode }) {
  const { user, teamId } = useAuth()
  const { toast: showToast } = useToast()
  const [state, dispatchRaw] = useReducer(reducer, initialState)
  const [dbLoading, setDbLoading] = useState(true)

  // Ref so the dispatch closure can read current state synchronously
  const stateRef = useRef(state)
  stateRef.current = state

  // Load initial workspace data from Supabase once teamId is resolved
  useEffect(() => {
    if (!user || !teamId) { setDbLoading(false); return }
    setDbLoading(true)
    console.log('[AppProvider] Loading workspace for team:', teamId)
    loadFullState(teamId)
      .then((loaded) => dispatchRaw({ type: 'HYDRATE', state: loaded }))
      .catch((err: Error) => {
        console.error('[AppProvider] Failed to load workspace:', err)
        showToast('Failed to load workspace — please refresh', 'error')
      })
      .finally(() => setDbLoading(false))
  }, [user?.id, teamId]) // eslint-disable-line react-hooks/exhaustive-deps

  const dispatch = useCallback(
    (action: AppAction) => {
      const prevState = stateRef.current

      // Optimistic update
      dispatchRaw(action)

      // Skip DB sync for pure UI actions
      if (action.type === 'SET_VIEW' || action.type === 'HYDRATE') return

      // Compute next state (same pure function)
      const nextState = reducer(prevState, action)

      // Sync to Supabase asynchronously
      syncAction(action, teamId!, prevState, nextState).catch((err: Error) => {
        console.error('[AppProvider] DB sync failed:', err)
        showToast(`Save failed: ${err.message}`, 'error')
        // Revert by reloading authoritative state from DB
        loadFullState(teamId!)
          .then((fresh) => dispatchRaw({ type: 'HYDRATE', state: fresh }))
          .catch(console.error)
      })
    },
    [teamId] // eslint-disable-line react-hooks/exhaustive-deps
  )

  const navigate = useCallback(
    (view: AppView) => dispatch({ type: 'SET_VIEW', view }),
    [dispatch]
  )

  if (dbLoading) return <LoadingScreen />

  return (
    <AppContext.Provider value={{ state, dispatch, navigate }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be inside AppProvider')
  return ctx
}
