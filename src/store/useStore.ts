import { create } from "zustand"

interface AppState {
  sidebarExpanded: boolean
  toggleSidebar: () => void
  setSidebarExpanded: (v: boolean) => void
}

export const useStore = create<AppState>((set) => ({
  sidebarExpanded: true,
  toggleSidebar: () => set((s) => ({ sidebarExpanded: !s.sidebarExpanded })),
  setSidebarExpanded: (v) => set({ sidebarExpanded: v }),
}))
