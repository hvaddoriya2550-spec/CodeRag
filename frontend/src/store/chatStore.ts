import { create } from 'zustand'
import type { ChatMessage, ChunkSource } from '@/types'

interface ChatState {
  // --- state ---
  // Keyed by repo_id so conversations survive repo switches
  messagesByRepo: Record<string, ChatMessage[]>
  isStreaming: boolean
  // Sources land as one SSE event before any tokens arrive.
  // We park them here until the message is finalised.
  currentSources: ChunkSource[]

  // --- actions ---
  getMessages: (repoId: string) => ChatMessage[]
  addUserMessage: (repoId: string, content: string) => void
  startAssistantMessage: (repoId: string) => void
  appendToken: (repoId: string, token: string) => void
  setSources: (sources: ChunkSource[]) => void
  finalizeAssistantMessage: (repoId: string) => void
  setStreaming: (streaming: boolean) => void
  clearChat: (repoId: string) => void
}

export const useChatStore = create<ChatState>((set, get) => ({
  messagesByRepo: {},
  isStreaming: false,
  currentSources: [],

  getMessages: (repoId) => get().messagesByRepo[repoId] ?? [],

  addUserMessage: (repoId, content) => {
    set((state) => ({
      messagesByRepo: {
        ...state.messagesByRepo,
        [repoId]: [
          ...(state.messagesByRepo[repoId] ?? []),
          { role: 'user', content },
        ],
      },
    }))
  },

  // Adds a blank assistant message so appendToken has somewhere to write
  startAssistantMessage: (repoId) => {
    set((state) => ({
      messagesByRepo: {
        ...state.messagesByRepo,
        [repoId]: [
          ...(state.messagesByRepo[repoId] ?? []),
          { role: 'assistant', content: '' },
        ],
      },
    }))
  },

  // Mutates the last message's content in-place (creates new objects for React)
  appendToken: (repoId, token) => {
    set((state) => {
      const messages = state.messagesByRepo[repoId] ?? []
      if (messages.length === 0) return state

      const lastIndex = messages.length - 1
      const updated = messages.map((msg, i) =>
        i === lastIndex ? { ...msg, content: msg.content + token } : msg
      )
      return {
        messagesByRepo: { ...state.messagesByRepo, [repoId]: updated },
      }
    })
  },

  setSources: (sources) => set({ currentSources: sources }),

  // Called once streaming is complete: attaches the parked sources to the
  // last message and resets transient streaming state
  finalizeAssistantMessage: (repoId) => {
    set((state) => {
      const messages = state.messagesByRepo[repoId] ?? []
      if (messages.length === 0) return state

      const lastIndex = messages.length - 1
      const updated = messages.map((msg, i) =>
        i === lastIndex ? { ...msg, sources: state.currentSources } : msg
      )
      return {
        messagesByRepo: { ...state.messagesByRepo, [repoId]: updated },
        currentSources: [],
        isStreaming: false,
      }
    })
  },

  setStreaming: (streaming) => set({ isStreaming: streaming }),

  clearChat: (repoId) => {
    set((state) => ({
      messagesByRepo: { ...state.messagesByRepo, [repoId]: [] },
    }))
  },
}))
