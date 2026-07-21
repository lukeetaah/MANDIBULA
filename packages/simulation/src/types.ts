export const TICK_RATE = 10;
export const PROTOCOL_VERSION = 1;

export type Vec2 = { x: number; z: number };
export type FactionId =
  "acromyrmex" | "vespula" | "bombus" | "porotermes" | "rival" | "npc";
export type AgentKind =
  "ant" | "wasp" | "bumblebee" | "termite" | "fly" | "beetle";
export type AgentTask =
  | "idle"
  | "move"
  | "forage"
  | "return"
  | "flee"
  | "defend"
  | "attack"
  | "sealed";
export type AgentOrder = "autonomous" | "move" | "gather" | "return" | "attack";
export type PheromoneType = "forage" | "alarm" | "home" | "avoid" | "recruit";
export type SpiderGuild = "ground-runner" | "orb-weaver";
export type SpiderState =
  | "shelter"
  | "explore"
  | "detect"
  | "stalk"
  | "attack"
  | "immobilize"
  | "consume"
  | "sated"
  | "retreat"
  | "relocate";
export type MatchStatus = "playing" | "victory" | "defeat";
export type Difficulty = "gentle" | "balanced" | "wild";
export type NestChamberType = "fungus" | "nursery" | "ventilation" | "waste";
export type ColonyPriority = "forage" | "brood" | "excavate" | "defend";

export interface NestState {
  chambers: Record<NestChamberType, number>;
  moisture: number;
  hygiene: number;
  ventilation: number;
  wasteLoad: number;
  thatchIntegrity: number;
}

export interface Agent {
  id: number;
  kind: AgentKind;
  faction: FactionId;
  position: Vec2;
  velocity: Vec2;
  energy: number;
  integrity: number;
  carrying: number;
  task: AgentTask;
  targetId: number | null;
  order: AgentOrder;
  destination: Vec2 | null;
  age: number;
  alive: boolean;
  controlled: boolean;
  poisonedTicks: number;
}

export interface ResourcePatch {
  id: number;
  kind: "leaf" | "seed" | "nectar" | "deadwood";
  position: Vec2;
  amount: number;
}

export interface PheromoneField {
  id: number;
  type: PheromoneType;
  position: Vec2;
  direction: Vec2;
  intensity: number;
  radius: number;
  age: number;
  decay: number;
  emitterId: number;
  confidence: number;
}

export interface Spider {
  id: number;
  guild: SpiderGuild;
  dominant: boolean;
  position: Vec2;
  home: Vec2;
  state: SpiderState;
  targetId: number | null;
  hunger: number;
  agitation: number;
  energy: number;
  mobility: number;
  legFunction: [number, number, number, number];
  cheliceraFunction: number;
  silkFunction: number;
  perception: number;
  wounds: number;
  consumed: number;
  visible: boolean;
  warningTicks: number;
  nextArrivalTick: number;
}

export interface WebHazard {
  id: number;
  a: Vec2;
  b: Vec2;
  integrity: number;
  wetness: number;
  ownerId: number;
}

export interface Alliance {
  factions: [FactionId, FactionId];
  kind: "emergency-truce" | "predator-signal" | "safe-corridor";
  expiresAtTick: number;
  cost: number;
}

export interface Metrics {
  spidersEncountered: number;
  attacksStarted: number;
  attacksAvoided: number;
  unitsConsumed: number;
  coloniesCollapsed: number;
  spidersExpelled: number;
  spidersKilled: number;
  alliancesCreated: number;
  alliancesBroken: number;
  lossesByFaction: Record<FactionId, number>;
  totalBiomassHarvested: number;
  visitedUnderground: boolean;
  priorityChanged: boolean;
  minorThreatResolved: boolean;
  routesEstablished: boolean;
}

export interface WorldState {
  version: 1;
  seed: number;
  rngState: number;
  tick: number;
  nextId: number;
  status: MatchStatus;
  statusReason: string;
  paused: boolean;
  difficulty: Difficulty;
  temperature: number;
  humidity: number;
  wind: Vec2;
  rain: number;
  playerAgentId: number;
  playerFaction: FactionId;
  playerSequence: number;
  mandate: number;
  authorityLevel: 1 | 2 | 3;
  colonyBiomass: number;
  rivalBiomass: number;
  fungusHealth: number;
  broodHealth: number;
  seasonPhase: 1 | 2 | 3 | 4; // 1: Reactivate, 2: Inhabit, 3: Persist, 4: Storm (End)
  colonyPriority: ColonyPriority;
  nest: NestState;
  tutorialStep: number;
  agents: Agent[];
  resources: ResourcePatch[];
  pheromones: PheromoneField[];
  spiders: Spider[];
  webs: WebHazard[];
  alliances: Alliance[];
  eventLog: SimEvent[];
  metrics: Metrics;
}

export interface SimEvent {
  tick: number;
  type:
    | "resource-delivered"
    | "authority-up"
    | "pheromone-emitted"
    | "predator-sign"
    | "spider-attack"
    | "spider-consumed"
    | "spider-retreated"
    | "spider-expelled"
    | "spider-killed"
    | "agent-died"
    | "succession"
    | "alliance-created"
    | "termite-sealed"
    | "bombus-rerouted"
    | "pollination"
    | "fauna-attack"
    | "fauna-repelled"
    | "waste-contaminated"
    | "nest-expanded"
    | "priority-changed"
    | "difficulty-changed"
    | "phase-changed"
    | "tutorial-step"
    | "storm-started"
    | "match-ended";
  entityId?: number;
  message: string;
}

export interface MovePayload {
  direction: Vec2;
  sprint?: boolean;
}
export interface PositionPayload {
  position: Vec2;
  radius?: number;
  intensity?: number;
  pheromone?: PheromoneType;
}
export interface TargetPayload {
  targetId: number;
}
export interface NestPayload {
  chamber: NestChamberType;
}
export interface PriorityPayload {
  priority: ColonyPriority;
}
export type CommandType =
  | "MOVE"
  | "INTERACT"
  | "PICK_UP"
  | "DROP"
  | "CUT"
  | "HARVEST"
  | "DIG"
  | "ATTACK"
  | "RETREAT"
  | "EMIT_PHEROMONE"
  | "REINFORCE_TRAIL"
  | "CANCEL_SIGNAL"
  | "ASSIGN_PRIORITY"
  | "FORM_EXPEDITION"
  | "EXPAND_NEST"
  | "SET_COLONY_PRIORITY"
  | "RETURN_TO_NEST"
  | "VISIT_UNDERGROUND";

export interface SimCommand {
  protocolVersion: 1;
  matchId: string;
  playerId: string;
  entityId: number;
  tick: number;
  sequence: number;
  type: CommandType;
  payload:
    | MovePayload
    | PositionPayload
    | TargetPayload
    | NestPayload
    | PriorityPayload
    | Record<string, never>;
}
