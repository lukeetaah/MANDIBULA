"use client";

import {
  createWorld,
  restoreSnapshot,
  serializeSnapshot,
  stepWorld,
  type PheromoneType,
  type ColonyPriority,
  type NestChamberType,
  type SimCommand,
  type Vec2,
  type WorldState,
} from "@mandibula/simulation";
import { create } from "zustand";

const SAVE_KEY = "mandibula-patagonia-rts-v2";

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

export interface SelectionBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface OrderMarker {
  position: Vec2;
  kind: "move" | "gather" | "signal";
  serial: number;
}

interface GameStore {
  world: WorldState;
  started: boolean;
  tactical: boolean;
  helpOpen: boolean;
  settingsOpen: boolean;
  selectedIds: number[];
  selectionBox: SelectionBox | null;
  orderMarker: OrderMarker | null;
  focusRequest: number;
  signalRadius: number;
  signalType: PheromoneType;
  timeScale: 1 | 2 | 3 | 6;
  underground: boolean;
  observed: { kind: "agent" | "spider"; id: number } | null;
  fps: number;
  settings: AccessibilitySettings;
  pending: SimCommand[];
  begin: (resume?: boolean) => void;
  restart: () => void;
  tick: () => void;
  selectUnits: (ids: number[], additive?: boolean) => void;
  clearSelection: () => void;
  setSelectionBox: (box: SelectionBox | null) => void;
  issueMove: (position: Vec2) => void;
  issueGather: (targetId: number, position: Vec2) => void;
  returnSelected: () => void;
  emitSignal: (position?: Vec2) => void;
  requestFocus: () => void;
  setTactical: (value: boolean) => void;
  setHelpOpen: (value: boolean) => void;
  setSettingsOpen: (value: boolean) => void;
  setSignalRadius: (value: number) => void;
  cycleSignal: () => void;
  setTimeScale: (value: 1 | 2 | 3 | 6) => void;
  setUnderground: (value: boolean) => void;
  inspect: (kind: "agent" | "spider", id: number) => void;
  clearInspection: () => void;
  attackObserved: () => void;
  retreatSelected: () => void;
  expandNest: (chamber: NestChamberType) => void;
  setColonyPriority: (priority: ColonyPriority) => void;
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

function commandsFor(
  state: Pick<GameStore, "world" | "pending">,
  entityIds: number[],
  type: SimCommand["type"],
  payload: SimCommand["payload"],
): SimCommand[] {
  return entityIds.map((entityId, index) => ({
    protocolVersion: 1,
    matchId: "local-bot",
    playerId: "local-player",
    entityId,
    tick: state.world.tick,
    sequence: state.world.playerSequence + state.pending.length + index + 1,
    type,
    payload,
  }));
}

function commandableIds(state: GameStore): number[] {
  const valid = new Set(
    state.world.agents
      .filter(
        (agent) =>
          agent.alive && agent.kind === "ant" && agent.faction === "acromyrmex",
      )
      .map((agent) => agent.id),
  );
  return state.selectedIds.filter((id) => valid.has(id));
}

export const useGameStore = create<GameStore>((set, get) => ({
  world: createWorld(0x1a2b3c4d),
  started: false,
  tactical: false,
  helpOpen: false,
  settingsOpen: false,
  selectedIds: [],
  selectionBox: null,
  orderMarker: null,
  focusRequest: 0,
  signalRadius: 5,
  signalType: "forage",
  timeScale: 1,
  underground: false,
  observed: null,
  fps: 60,
  settings: defaultSettings,
  pending: [],
  begin: (resume = false) =>
    set({
      started: true,
      helpOpen: !resume,
      selectedIds: [],
      selectionBox: null,
      world: resume
        ? (loadWorld() ?? createWorld(0x1a2b3c4d))
        : createWorld(0x1a2b3c4d),
    }),
  restart: () => {
    localStorage.removeItem(SAVE_KEY);
    set({
      world: createWorld(0x1a2b3c4d),
      started: true,
      helpOpen: true,
      tactical: false,
      underground: false,
      observed: null,
      selectedIds: [],
      selectionBox: null,
      orderMarker: null,
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
    for (let index = 0; index < state.timeScale; index += 1)
      stepWorld(world, index === 0 ? state.pending : []);
    const alive = new Set(
      world.agents.filter((agent) => agent.alive).map((agent) => agent.id),
    );
    set({
      world,
      pending: [],
      selectedIds: state.selectedIds.filter((id) => alive.has(id)),
    });
    if (world.tick % 50 === 0)
      localStorage.setItem(SAVE_KEY, serializeSnapshot(world));
  },
  selectUnits: (ids, additive = false) => {
    const state = get();
    const allowed = new Set(
      state.world.agents
        .filter(
          (agent) =>
            agent.alive &&
            agent.kind === "ant" &&
            agent.faction === "acromyrmex",
        )
        .map((agent) => agent.id),
    );
    const next = ids.filter((id) => allowed.has(id));
    const selectedIds = additive
      ? [...new Set([...state.selectedIds, ...next])]
      : next;
    const world =
      selectedIds.length > 0 && state.world.tutorialStep === 0
        ? { ...state.world, tutorialStep: 1 }
        : state.world;
    set({ selectedIds, world });
  },
  clearSelection: () => set({ selectedIds: [] }),
  setSelectionBox: (selectionBox) => set({ selectionBox }),
  issueMove: (position) => {
    const state = get();
    const ids = commandableIds(state);
    if (!ids.length) return;
    set({
      pending: [
        ...state.pending,
        ...commandsFor(state, ids, "ASSIGN_PRIORITY", { position }),
      ],
      orderMarker: {
        position,
        kind: "move",
        serial: (state.orderMarker?.serial ?? 0) + 1,
      },
    });
  },
  issueGather: (targetId, position) => {
    const state = get();
    const ids = commandableIds(state);
    if (!ids.length) return;
    set({
      pending: [
        ...state.pending,
        ...commandsFor(state, ids, "HARVEST", { targetId }),
      ],
      orderMarker: {
        position,
        kind: "gather",
        serial: (state.orderMarker?.serial ?? 0) + 1,
      },
    });
  },
  returnSelected: () => {
    const state = get();
    const ids = commandableIds(state);
    if (!ids.length) return;
    set({
      pending: [
        ...state.pending,
        ...commandsFor(state, ids, "RETURN_TO_NEST", {}),
      ],
      orderMarker: {
        position: { x: 0, z: 0 },
        kind: "move",
        serial: (state.orderMarker?.serial ?? 0) + 1,
      },
    });
  },
  emitSignal: (position) => {
    const state = get();
    const ids = commandableIds(state);
    const entityId = ids[0] ?? state.world.playerAgentId;
    const agent = state.world.agents.find(
      (candidate) => candidate.id === entityId,
    );
    if (!agent) return;
    const target = position ?? agent.position;
    set({
      pending: [
        ...state.pending,
        ...commandsFor(state, [entityId], "EMIT_PHEROMONE", {
          position: target,
          radius: state.signalRadius,
          intensity: 0.76,
          pheromone: state.signalType,
        }),
      ],
      tactical: true,
      orderMarker: {
        position: target,
        kind: "signal",
        serial: (state.orderMarker?.serial ?? 0) + 1,
      },
    });
  },
  requestFocus: () =>
    set((state) => ({ focusRequest: state.focusRequest + 1 })),
  setTactical: (tactical) => set({ tactical }),
  setHelpOpen: (helpOpen) => set({ helpOpen }),
  setSettingsOpen: (settingsOpen) => set({ settingsOpen }),
  setSignalRadius: (value) =>
    set({ signalRadius: Math.max(2, Math.min(14, value)) }),
  cycleSignal: () => {
    const { signalType, world } = get();
    const unlocked: PheromoneType[] =
      world.authorityLevel === 1
        ? ["forage", "alarm"]
        : world.authorityLevel === 2
          ? ["forage", "alarm", "home"]
          : ["forage", "alarm", "home", "avoid", "recruit"];
    set({
      signalType:
        unlocked[(unlocked.indexOf(signalType) + 1) % unlocked.length] ??
        "forage",
    });
  },
  setTimeScale: (timeScale) =>
    set((state) => ({
      timeScale,
      world:
        timeScale > 1 && state.world.tutorialStep === 5
          ? { ...state.world, tutorialStep: 6 }
          : state.world,
    })),
  setUnderground: (underground) =>
    set((state) => ({
      underground,
      world:
        underground && state.world.tutorialStep === 6
          ? { ...state.world, tutorialStep: 7 }
          : state.world,
    })),
  inspect: (kind, id) =>
    set((state) => ({
      observed: { kind, id },
      world:
        state.world.tutorialStep === 8
          ? { ...state.world, tutorialStep: 9 }
          : state.world,
    })),
  clearInspection: () => set({ observed: null }),
  attackObserved: () => {
    const state = get();
    if (!state.observed) return;
    const ids = commandableIds(state);
    if (!ids.length) return;
    set({
      pending: [
        ...state.pending,
        ...commandsFor(state, ids, "ATTACK", { targetId: state.observed.id }),
      ],
    });
  },
  retreatSelected: () => {
    const state = get();
    const ids = commandableIds(state);
    if (!ids.length) return;
    set({
      pending: [...state.pending, ...commandsFor(state, ids, "RETREAT", {})],
    });
  },
  expandNest: (chamber) => {
    const state = get();
    const entityId = state.world.playerAgentId;
    set({
      pending: [
        ...state.pending,
        ...commandsFor(state, [entityId], "EXPAND_NEST", { chamber }),
      ],
    });
  },
  setColonyPriority: (priority) => {
    const state = get();
    const entityId = state.world.playerAgentId;
    set({
      pending: [
        ...state.pending,
        ...commandsFor(state, [entityId], "SET_COLONY_PRIORITY", {
          priority,
        }),
      ],
    });
  },
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
