"use client";

import {
  createWorld,
  configureDifficulty,
  restoreSnapshot,
  serializeSnapshot,
  stepWorld,
  type FactionId,
  type PheromoneType,
  type ColonyPriority,
  type Difficulty,
  type NestChamberType,
  type SimCommand,
  type SimEvent,
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
  guidedPauses: boolean;
}

export interface CoachCard {
  event: SimEvent;
  title: string;
  body: string;
  response: string;
  tone: "warning" | "danger" | "growth";
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
  difficulty: Difficulty;
  playerFaction: FactionId;
  underground: boolean;
  coach: CoachCard | null;
  coachedEvents: SimEvent["type"][];
  observed: { kind: "agent" | "spider"; id: number } | null;
  fps: number;
  settings: AccessibilitySettings;
  pending: SimCommand[];
  begin: (resume?: boolean) => void;
  restart: () => void;
  nextEra: () => void;
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
  setDifficulty: (value: Difficulty) => void;
  setSpecies: (faction: FactionId) => void;
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
  dismissCoach: () => void;
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
  guidedPauses: true,
};

const coachCopy: Partial<Record<SimEvent["type"], Omit<CoachCard, "event">>> = {
  "predator-sign": {
    title: "El paisaje acaba de avisarte",
    body: "La caída del tránsito y las vibraciones anticipan un depredador. Todavía no es un ataque: es tiempo de reagrupar.",
    response: "Elegí una patrulla, marcá ALARMA con Q o volvé al nido con R.",
    tone: "warning",
  },
  "spider-attack": {
    title: "Una araña eligió una presa",
    body: "No está atacando a toda la colonia. Sigue vibraciones de una obrera o de una ruta concreta.",
    response: "Retirá la patrulla aislada o rodeala con al menos diez obreras.",
    tone: "danger",
  },
  "fauna-attack": {
    title: "Un cazador entró en la ruta",
    body: "Vespula y los escarabajos prefieren obreras expuestas. La colonia no necesita pelear todas las veces.",
    response:
      "Seleccioná una patrulla y usá AHUYENTAR, o cambiá el corredor de cosecha.",
    tone: "danger",
  },
  "waste-contaminated": {
    title: "Los residuos están atrayendo moscas",
    body: "La higiene dejó de ser un número: el bolsón saturado permite que la contaminación alcance el jardín.",
    response: "Entrá al SUBSUELO con B y mejorá el bolsón de residuos.",
    tone: "warning",
  },
  "agent-died": {
    title: "La colonia perdió una obrera",
    body: "Una baja no termina la partida. Revisá si la ruta quedó expuesta antes de mandar reemplazos.",
    response: "Pausá la cosecha peligrosa, reagrupá y observá el depredador.",
    tone: "danger",
  },
  "phase-changed": {
    title: "La colonia cambió de necesidad",
    body: "Superaste una etapa. A partir de ahora importa tanto la arquitectura como la cantidad cosechada.",
    response:
      "Abrí el subsuelo y elegí una prioridad antes de acelerar el tiempo.",
    tone: "growth",
  },
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
  const pf = state.playerFaction;
  const valid = new Set(
    state.world.agents
      .filter((agent) => agent.alive && agent.faction === pf)
      .map((agent) => agent.id),
  );
  return state.selectedIds.filter((id) => valid.has(id));
}

export const useGameStore = create<GameStore>((set, get) => ({
  world: createWorld(0x1a2b3c4d, "gentle"),
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
  difficulty: "gentle",
  playerFaction: "acromyrmex",
  underground: false,
  coach: null,
  coachedEvents: [],
  observed: null,
  fps: 60,
  settings: defaultSettings,
  pending: [],
  setSpecies: (faction: FactionId) => set({ playerFaction: faction }),
  begin: (resume = false) => {
    const chosenDifficulty = get().difficulty;
    const faction = get().playerFaction;
    const loaded = resume ? loadWorld() : null;
    const world = loaded ?? createWorld(0x1a2b3c4d, chosenDifficulty, faction);
    set({
      started: true,
      helpOpen: false,
      selectedIds: [],
      selectionBox: null,
      difficulty: world.difficulty,
      playerFaction: world.playerFaction || faction,
      coach: null,
      coachedEvents: [],
      world,
    });
  },
  restart: () => {
    localStorage.removeItem(SAVE_KEY);
    const difficulty = get().difficulty;
    const faction = get().playerFaction;
    set({
      world: createWorld(0x1a2b3c4d, difficulty, faction),
      started: true,
      helpOpen: true,
      tactical: false,
      underground: false,
      observed: null,
      selectedIds: [],
      selectionBox: null,
      orderMarker: null,
      coach: null,
      coachedEvents: [],
      pending: [],
    });
  },
  nextEra: () => {
    const current = get().world;
    const nextLevel = (current.colonyLevel || 1) + 1;
    const nextEra = (current.era || 1) + 1;
    const world = structuredClone(current);
    world.status = "playing";
    world.statusReason = "";
    world.tick = 0;
    world.colonyLevel = nextLevel;
    world.era = nextEra;
    world.seasonPhase = 1;
    world.metrics.totalBiomassHarvested = 0;
    world.metrics.visitedUnderground = false;
    world.metrics.priorityChanged = false;
    world.metrics.minorThreatResolved = false;
    world.metrics.routesEstablished = false;
    const bonusCount = 10;
    for (let i = 0; i < bonusCount; i += 1) {
      world.agents.push({
        id: world.nextId++,
        kind: "ant",
        faction: "acromyrmex",
        position: {
          x: (Math.random() - 0.5) * 4,
          z: (Math.random() - 0.5) * 4,
        },
        velocity: { x: 0, z: 0 },
        energy: 1,
        integrity: 1,
        carrying: 0,
        task: "idle",
        targetId: null,
        order: "autonomous",
        destination: null,
        age: 0,
        alive: true,
        controlled: false,
        poisonedTicks: 0,
      });
    }
    world.resources = [
      {
        id: world.nextId++,
        kind: "leaf",
        position: { x: 10, z: 8 },
        amount: 65,
      },
      {
        id: world.nextId++,
        kind: "leaf",
        position: { x: -10, z: -8 },
        amount: 55,
      },
      {
        id: world.nextId++,
        kind: "leaf",
        position: { x: 18, z: 14 },
        amount: 60,
      },
      {
        id: world.nextId++,
        kind: "seed",
        position: { x: -20, z: 15 },
        amount: 45,
      },
      {
        id: world.nextId++,
        kind: "nectar",
        position: { x: 22, z: 24 },
        amount: 50,
      },
      {
        id: world.nextId++,
        kind: "deadwood",
        position: { x: -30, z: -22 },
        amount: 75,
      },
    ];
    set({
      world,
      started: true,
      tactical: false,
      underground: false,
      observed: null,
      selectedIds: [],
      selectionBox: null,
      orderMarker: null,
      coach: null,
      coachedEvents: [],
      pending: [],
    });
    localStorage.setItem(SAVE_KEY, serializeSnapshot(world));
  },
  tick: () => {
    const state = get();
    if (
      !state.started ||
      state.world.paused ||
      state.world.status !== "playing"
    )
      return;
    const world = { ...state.world };
    for (let index = 0; index < state.timeScale; index += 1)
      stepWorld(world, index === 0 ? state.pending : []);
    // A fast speed chosen earlier still satisfies the tutorial requirement.
    if (state.timeScale > 1 && world.tutorialStep === 5)
      world.tutorialStep = 6;
    const alive = new Set(
      world.agents.filter((agent) => agent.alive).map((agent) => agent.id),
    );
    const guidedEvent = world.eventLog.find(
      (item) =>
        item.tick >= state.world.tick &&
        coachCopy[item.type] &&
        !state.coachedEvents.includes(item.type),
    );
    const copy = guidedEvent ? coachCopy[guidedEvent.type] : undefined;
    if (guidedEvent && copy && state.settings.guidedPauses) world.paused = true;
    set({
      world,
      pending: [],
      selectedIds: state.selectedIds.filter((id) => alive.has(id)),
      ...(guidedEvent && copy && state.settings.guidedPauses
        ? {
            coach: { event: guidedEvent, ...copy },
            coachedEvents: [...state.coachedEvents, guidedEvent.type],
          }
        : {}),
    });
    if (world.tick % 50 === 0)
      localStorage.setItem(SAVE_KEY, serializeSnapshot(world));
  },
  selectUnits: (ids, additive = false) => {
    const state = get();
    const pf = state.playerFaction;
    const allowed = new Set(
      state.world.agents
        .filter((agent) => agent.alive && agent.faction === pf)
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
  setDifficulty: (difficulty) =>
    set((state) => {
      const world = structuredClone(state.world);
      configureDifficulty(world, difficulty);
      return { difficulty, world };
    }),
  setUnderground: (underground) =>
    set((state) => {
      let world = state.world;
      if (!underground) {
        world = structuredClone(state.world);
        for (const agent of world.agents) {
          agent.velocity = { x: 0, z: 0 };
        }
      } else if (state.world.tutorialStep === 6) {
        world = { ...state.world, tutorialStep: 7 };
      }
      return { underground, world };
    }),
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
      coach: null,
      world: { ...state.world, paused: !state.world.paused },
    })),
  dismissCoach: () =>
    set((state) => ({
      coach: null,
      world: { ...state.world, paused: false },
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
