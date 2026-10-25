'use client'

import { useCallback, useEffect, useState } from 'react'
import {
  AssessmentState,
  MitigationAction,
  PrivacyScore,
  QuestionId,
  STORAGE_KEYS,
} from '@/types/audit'
import { calculatePrivacyScore, buildMitigationChecklist } from '@/lib/scoring'
import { getAllQuestions } from '@/lib/questions'

const TOTAL_QUESTIONS = getAllQuestions().length

function load<T>(key: string): T | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(key)
    return raw ? (JSON.parse(raw) as T) : null
  } catch {
    return null
  }
}

function save(key: string, value: unknown): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // storage full or blocked — assessment still works in memory
  }
}

function defaultState(): AssessmentState {
  return {
    currentStep: 0,
    answers: {},
    startedAt: Date.now(),
    version: 1,
  }
}

export function useAssessment() {
  const [state, setState] = useState<AssessmentState | null>(null)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const stored = load<AssessmentState>(STORAGE_KEYS.ASSESSMENT)
    setState(stored ?? defaultState())
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (hydrated && state) save(STORAGE_KEYS.ASSESSMENT, state)
  }, [state, hydrated])

  const setAnswer = useCallback(
    (questionId: QuestionId, value: boolean) => {
      setState(prev => {
        if (!prev) return prev
        return {
          ...prev,
          answers: { ...prev.answers, [questionId]: value },
        }
      })
    },
    []
  )

  const goNext = useCallback(() => {
    setState(prev => (prev ? { ...prev, currentStep: prev.currentStep + 1 } : prev))
  }, [])

  const goPrev = useCallback(() => {
    setState(prev =>
      prev && prev.currentStep > 0
        ? { ...prev, currentStep: prev.currentStep - 1 }
        : prev
    )
  }, [])

  const goToStep = useCallback((step: number) => {
    setState(prev => (prev ? { ...prev, currentStep: step } : prev))
  }, [])

  const complete = useCallback(() => {
    setState(prev => (prev ? { ...prev, completedAt: Date.now() } : prev))
  }, [])

  const reset = useCallback(() => {
    setState(defaultState())
    if (typeof window !== 'undefined') {
      window.localStorage.removeItem(STORAGE_KEYS.ASSESSMENT)
      window.localStorage.removeItem(STORAGE_KEYS.MITIGATIONS)
    }
  }, [])

  const score: PrivacyScore | null = state
    ? calculatePrivacyScore(state.answers)
    : null

  const answeredCount = state
    ? Object.keys(state.answers).filter(
        k => state.answers[k as QuestionId] !== undefined
      ).length
    : 0

  return {
    state,
    score,
    hydrated,
    answeredCount,
    totalQuestions: TOTAL_QUESTIONS,
    setAnswer,
    goNext,
    goPrev,
    goToStep,
    complete,
    reset,
  }
}

export function useMitigations() {
  const [items, setItems] = useState<MitigationAction[]>([])
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    const stored = load<MitigationAction[]>(STORAGE_KEYS.MITIGATIONS)
    if (stored) setItems(stored)
    setHydrated(true)
  }, [])

  useEffect(() => {
    if (hydrated) save(STORAGE_KEYS.MITIGATIONS, items)
  }, [items, hydrated])

  const regenerate = useCallback(
    (answers: Partial<Record<QuestionId, boolean>>) => {
      const fresh = buildMitigationChecklist(answers)
      // preserve completion state for actions that still exist
      setItems(prev =>
        fresh.map(f => {
          const old = prev.find(p => p.id === f.id)
          return old ? { ...f, completed: old.completed } : f
        })
      )
    },
    []
  )

  const toggle = useCallback((id: string) => {
    setItems(prev =>
      prev.map(i => (i.id === id ? { ...i, completed: !i.completed } : i))
    )
  }, [])

  const clearAll = useCallback(() => setItems([]), [])

  const completedCount = items.filter(i => i.completed).length

  return { items, hydrated, regenerate, toggle, clearAll, completedCount }
}
