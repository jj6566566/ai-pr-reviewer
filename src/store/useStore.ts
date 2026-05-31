import { create } from "zustand"

interface AppState {
  sidebarExpanded: boolean
  mobileMenuOpen: boolean
  toggleSidebar: () => void
  setSidebarExpanded: (v: boolean) => void
  toggleMobileMenu: () => void
  setMobileMenuOpen: (v: boolean) => void
}

export const useStore = create<AppState>((set) => ({
  sidebarExpanded: true,
  mobileMenuOpen: false,
  toggleSidebar: () => set((s) => ({ sidebarExpanded: !s.sidebarExpanded })),
  setSidebarExpanded: (v) => set({ sidebarExpanded: v }),
  toggleMobileMenu: () => set((s) => ({ mobileMenuOpen: !s.mobileMenuOpen })),
  setMobileMenuOpen: (v) => set({ mobileMenuOpen: v }),
}))
