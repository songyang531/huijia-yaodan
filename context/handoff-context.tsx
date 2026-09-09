'use client';
import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createInitialState } from '@/lib/mock-data';
import { transition, type Action } from '@/lib/workflow';
import type { HandoffState } from '@/types/handoff';

interface ContextValue {
  state: HandoffState;
  send: (action: Action) => boolean;
  message: string;
  notify: (message: string) => void;
}
const HandoffContext = createContext<ContextValue | null>(null);
export function HandoffProvider({ children }: { children: ReactNode }) {
  // Intentionally memory-only: personal materials never go into localStorage.
  const [state, setState] = useState(createInitialState);
  const stateRef = useRef(state);
  const [message, notify] = useState('');
  const send = useCallback((action: Action) => {
    try {
      const next = transition(stateRef.current, action);
      stateRef.current = next;
      setState(next);
      return true;
    } catch (error) {
      notify(error instanceof Error ? error.message : '操作未完成，请重试。');
      return false;
    }
  }, []);
  return (
    <HandoffContext.Provider value={{ state, send, message, notify }}>
      {children}
    </HandoffContext.Provider>
  );
}
export function useHandoff() {
  const context = useContext(HandoffContext);
  if (!context) throw new Error('HandoffProvider is required');
  return context;
}
