import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { RepoInfo } from '@/types'
import * as api from '@/lib/api'

interface ReposState {
  // --- state ---
  repos: RepoInfo[]
  selectedRepoId: string | null
  isLoading: boolean
  error: string | null

  // --- actions ---
  loadRepos: () => Promise<void>
  selectRepo: (repoId: string | null) => void
  ingestRepo: (githubUrl: string) => Promise<string>
  removeRepo: (repoId: string) => Promise<void>
  getRepoById: (repoId: string) => RepoInfo | undefined
}

export const useReposStore = create<ReposState>()(
  persist(
    (set, get) => ({
      repos: [],
      selectedRepoId: null,
      isLoading: false,
      error: null,

      loadRepos: async () => {
        set({ isLoading: true, error: null })
        try {
          const repos = await api.listRepos()
          set({ repos, isLoading: false })
        } catch (e) {
          set({ error: (e as Error).message, isLoading: false })
        }
      },

      selectRepo: (repoId) => set({ selectedRepoId: repoId }),

      ingestRepo: async (githubUrl) => {
        const res = await api.ingestRepo(githubUrl)
        // Refresh the list so the new repo appears immediately
        await get().loadRepos()
        return res.repo_id
      },

      removeRepo: async (repoId) => {
        await api.deleteRepo(repoId)
        // Deselect before refreshing so we don't hold a reference to a gone repo
        if (get().selectedRepoId === repoId) {
          set({ selectedRepoId: null })
        }
        await get().loadRepos()
      },

      // Computed lookup — avoids re-implementing find() everywhere in the UI
      getRepoById: (repoId) => get().repos.find((r) => r.repo_id === repoId),
    }),
    {
      name: 'coderag-repos-storage',
      storage: createJSONStorage(() => localStorage),
      // Only persist the user's selected repo — not the repos list itself.
      // The backend is the source of truth for what repos exist; always
      // re-fetch on load so stale or deleted repos never appear in the UI.
      partialize: (state) => ({
        selectedRepoId: state.selectedRepoId,
      }),
    }
  )
)
