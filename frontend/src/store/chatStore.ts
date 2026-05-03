import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { ChatMessage, ChatRequest, ChunkSource, SSEEvent } from '@/types'
import * as api from '@/lib/api'

const EMPTY_MESSAGES: ChatMessage[] = []

interface ChatState {
  // --- state ---
  // Keyed by repo_id so conversations survive repo switches
  messagesByRepo: Record<string, ChatMessage[]>
  isStreaming: boolean
  // Sources land as one SSE event before any tokens arrive.
  // We park them here until the message is finalised.
  currentSources: ChunkSource[]
  // Held so the stream can be cancelled if the user navigates away mid-reply.
  abortController: AbortController | null

  // --- actions ---
  getMessages: (repoId: string) => ChatMessage[]
  addUserMessage: (repoId: string, content: string) => void
  startAssistantMessage: (repoId: string) => void
  appendToken: (repoId: string, token: string) => void
  setSources: (sources: ChunkSource[]) => void
  finalizeAssistantMessage: (repoId: string) => void
  setStreaming: (streaming: boolean) => void
  clearChat: (repoId: string) => void
  sendMessage: (repoId: string, question: string) => Promise<void>
  cancelStream: () => void
}

export const useChatStore = create<ChatState>()(
  persist(
    (set, get) => ({
      messagesByRepo: {},
      isStreaming: false,
      currentSources: [],
      abortController: null,

      getMessages: (repoId) => get().messagesByRepo[repoId] ?? EMPTY_MESSAGES,

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

      // Capture history BEFORE adding the new user message so the backend receives
      // only prior turns — not the question it's about to answer.
      sendMessage: async (repoId, question) => {
        const history = get().getMessages(repoId)

        get().addUserMessage(repoId, question)

        // The blank assistant message must exist before the first token arrives;
        // otherwise appendToken would have no target to write into.
        get().startAssistantMessage(repoId)

        const controller = new AbortController()
        set({ isStreaming: true, currentSources: [], abortController: controller })

        const request: ChatRequest = {
          question,
          repo_id: repoId,
          conversation_history: history,
        }

        await api.streamChat(
          request,
          (event: SSEEvent) => {
            if (event.type === 'sources') {
              // The sources event carries all retrieved chunks in one shot,
              // before any text tokens. We park them and attach them to the
              // message when finalizeAssistantMessage is called.
              get().setSources((event.data as { chunks: ChunkSource[] }).chunks)
            } else if (event.type === 'token') {
              // Each token event appends one streamed text fragment to the
              // in-progress assistant message.
              get().appendToken(repoId, (event.data as { text: string }).text)
            } else if (event.type === 'done') {
              // The backend signals the stream is complete. Attach sources and
              // clear streaming state so the UI unlocks the input.
              get().finalizeAssistantMessage(repoId)
              set({ isStreaming: false, abortController: null })
            } else if (event.type === 'error') {
              // A server-side error mid-stream: surface it inline rather than
              // losing the partial reply the user already read.
              get().appendToken(repoId, `\n\n⚠️ Error: ${(event.data as { message: string }).message}`)
              get().finalizeAssistantMessage(repoId)
              set({ isStreaming: false, abortController: null })
            }
          },
          (err: Error) => {
            // Network failure or other client-side error. Same strategy: append
            // inline rather than silently losing the partial message.
            get().appendToken(repoId, `\n\n⚠️ Connection error: ${err.message}`)
            get().finalizeAssistantMessage(repoId)
            set({ isStreaming: false, abortController: null })
          },
          controller.signal,
        )
      },

      cancelStream: () => {
        const ctrl = get().abortController
        if (ctrl) ctrl.abort()
        set({ isStreaming: false, abortController: null })
      },
    }),
    {
      name: 'coderag-chat-storage',
      storage: createJSONStorage(() => localStorage),
      // Only persist conversation history — not live stream state.
      // isStreaming / currentSources / abortController are tied to a specific
      // network connection that no longer exists after a page reload.
      partialize: (state) => ({
        messagesByRepo: state.messagesByRepo,
      }),
    }
  )
)

// On every app load, clear any transient streaming state left over from a
// previous session that ended mid-stream.
useChatStore.setState({
  isStreaming: false,
  abortController: null,
  currentSources: [],
})

// Drop any half-streamed assistant message at the tail of each repo's history.
// If the last message is an assistant turn with fewer than 5 characters, the
// stream was cut off before any meaningful content arrived — remove it so the
// user isn't shown a dangling empty bubble.
const { messagesByRepo } = useChatStore.getState()
const cleaned: Record<string, ChatMessage[]> = {}
let needsUpdate = false

for (const [repoId, messages] of Object.entries(messagesByRepo)) {
  const last = messages[messages.length - 1]
  if (last && last.role === 'assistant' && last.content.length < 5) {
    cleaned[repoId] = messages.slice(0, -1)
    needsUpdate = true
  } else {
    cleaned[repoId] = messages
  }
}

if (needsUpdate) {
  useChatStore.setState({ messagesByRepo: cleaned })
}
