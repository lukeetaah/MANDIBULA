"use client";

import {
  createWorld,
  restoreSnapshot,
  serializeSnapshot,
  stepWorld,
  type PheromoneType,
  type SimCommand,
  type WorldState,
} from "@mandibula/simulation";
import { create } from "zustand";

const SAVE_KEY = "mandibula-patagonia-save-v1";

export interface AccessibilitySettings {
  cameraSensitivity: number;
  invertY: boolean;
  reducedMotion: boolean;
  highContrast: boolean;
  colorBlind: boolean;
  uiScale: number;
  subtitles: boolean;
  sound: boolean;
  intenseSounds: boolean;
}

interface GameStore {
  world: WorldState;
  started: boolean;
  tactical: boolean;
  helpOpen: boolean;
  settingsOpen: boolean;
  signalRadius: number;
  signalType: PheromoneType;
  yaw: number;
  fps: number;
  settings: AccessibilitySettings;
  pending: SimCommand[];
  begin: (resume?: boolean) => void;
  restart: () => void;
  tick: () => void;
  enqueue: (type: SimCommand["type"], payload: SimCommand["payload"]) => void;
  setTactical: (value: boolean) => void;
  setHelpOpen: (value: boolean) => void;
  setSettingsOpen: (value: boolean) => void;
  setSignalRadius: (value: number) => void;
  cycleSignal: () => void;
  setYaw: (updater: (value: number) => number) => void;
  setFps: (value: number) => void;
  setSetting: <K extends keyof AccessibilitySettings>(
    key: K,
    value: AccessibilitySettings[K],
  ) => void;
  togglePause: () => void;
  save: () => void;
}

const defaultSettings: AccessibilitySettings = {
  cameraSensitivity: 0.8,
  invertY: false,
  reducedMotion: false,
  highContrast: false,
  colorBlind: false,
  uiScale: 1,
  subtitles: true,
  sound: true,
  intenseSounds: false,
};

function loadWorld(): WorldState | null {
  try {
    const saved = localStorage.getItem(SAVE_KEY);
    return saved ? restoreSnapshot(saved) : null;
  } catch {
    return null;
  }
}

export const useGameStore = create<GameStore>((set, get) => ({
  world: createWorld(0x1a2b3c4d),
  started: false,
  tactical: false,
  helpOpen: false,
  settingsOpen: false,
  signalRadius: 5,
  signalType: "alarm",
  yaw: 0,
  fps: 60,
  settings: defaultSettings,
  pending: [],
  begin: (resume = false) =>
    set({
      started: true,
      world: resume
        ? (loadWorld() ?? createWorld(0x1a2b3c4d))
        : createWorld(0x1a2b3c4d),
    }),
  restart: () => {
    localStorage.removeItem(SAVE_KEY);
    set({
      world: createWorld(0x1a2b3c4d),
      started: true,
      tactical: false,
      pending: [],
    });
  },
  tick: () => {
    const state = get();
    if (
      !state.started ||
      state.world.paused ||
      state.world.status !== "playing"
    )
      return;
    const world = structuredClone(state.world);
    stepWorld(world, state.pending);
    set({ world, pending: [] });
    if (world.tick % 50 === 0)
      localStorage.setItem(SAVE_KEY, serializeSnapshot(world));
  },
  enqueue: (type, payload) => {
    const { world, pending } = get();
    const sequence = world.playerSequence + pending.length + 1;
    set({
      pending: [
        ...pending,
        {
          protocolVersion: 1,
          matchId: "local-bot",
          playerId: "local-player",
          entityId: world.playerAgentId,
          tick: world.tick,
          sequence,
          type,
          payload,
        },
      ],
    });
  },
  setTactical: (tactical) => set({ tactical }),
  setHelpOpen: (helpOpen) => set({ helpOpen }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setSignalRadius: (value) =>
    set({ signalRadius: Math.max(2, Math.min(14, value)) }),
  cycleSignal: () => {
    const { signalType, world } = get();
    const unlocked: PheromoneType[] =
      world.authorityLevel === 1
        ? ["alarm"]
        : world.authorityLevel === 2
          ? ["alarm", "forage", "home"]
          : ["alarm", "forage", "home", "avoid", "recruit"];
    set({
      signalType:
        unlocked[(unlocked.indexOf(signalType) + 1) % unlocked.length] ??
        "alarm",
    });
  },
  setYaw: (updater) => set((state) => ({ yaw: updater(state.yaw) })),
  setFps: (fps) => set({ fps }),
  setSetting: (key, value) =>
    set((state) => ({ settings: { ...state.settings, [key]: value } })),
  togglePause: () =>
    set((state) => ({
      world: { ...state.world, paused: !state.world.paused },
    })),
  save: () => localStorage.setItem(SAVE_KEY, serializeSnapshot(get().world)),
}));

export function hasLocalSave(): boolean {
  try {
    return Boolean(localStorage.getItem(SAVE_KEY));
  } catch {
    return false;
  }
}
