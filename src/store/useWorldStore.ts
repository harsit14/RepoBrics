"use client";

import { create } from "zustand";
import type { Selection, ViewMode } from "@/types/world";

type WorldStore = {
  selection: Selection;
  viewMode: ViewMode;
  pressedKeys: Record<string, boolean>;
  showDependencies: boolean;
  colorByLanguage: boolean;
  highlightComplexity: boolean;
  helpOpen: boolean;
  resetNonce: number;
  setSelection: (selection: Selection) => void;
  setViewMode: (value: ViewMode) => void;
  setPressedKey: (key: string, pressed: boolean) => void;
  clearPressedKeys: () => void;
  setShowDependencies: (value: boolean) => void;
  setColorByLanguage: (value: boolean) => void;
  setHighlightComplexity: (value: boolean) => void;
  setHelpOpen: (value: boolean) => void;
  resetView: () => void;
};

export const useWorldStore = create<WorldStore>((set) => ({
  selection: null,
  viewMode: "overview",
  pressedKeys: {},
  showDependencies: true,
  colorByLanguage: true,
  highlightComplexity: false,
  helpOpen: false,
  resetNonce: 0,
  setSelection: (selection) => set({ selection }),
  setViewMode: (value) => set({ viewMode: value }),
  setPressedKey: (key, pressed) =>
    set((state) => ({
      pressedKeys: {
        ...state.pressedKeys,
        [key]: pressed
      }
    })),
  clearPressedKeys: () => set({ pressedKeys: {} }),
  setShowDependencies: (value) => set({ showDependencies: value }),
  setColorByLanguage: (value) => set({ colorByLanguage: value }),
  setHighlightComplexity: (value) => set({ highlightComplexity: value }),
  setHelpOpen: (value) => set({ helpOpen: value }),
  resetView: () => set((state) => ({ selection: null, viewMode: "overview", resetNonce: state.resetNonce + 1 }))
}));
