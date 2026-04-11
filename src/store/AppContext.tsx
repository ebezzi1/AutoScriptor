import {
  createContext,
  useContext,
  useReducer,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react'
import type { AppState, AppAction, AppView } from '../types'
import { loadState, saveState } from './storage'

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
  dispatch: React.Dispatch<AppAction>
  navigate: (view: AppView) => void
}

const AppContext = createContext<ContextValue | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const saved = loadState()
  const [state, dispatch] = useReducer(reducer, {
    ...initialState,
    ...(saved ?? {}),
  })

  useEffect(() => {
    saveState(state)
  }, [state])

  const navigate = useCallback(
    (view: AppView) => dispatch({ type: 'SET_VIEW', view }),
    []
  )

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
