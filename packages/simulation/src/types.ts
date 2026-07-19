export const TICK_RATE = 10;
export const PROTOCOL_VERSION = 1;

export type Vec2 = { x: number; z: number };
export type FactionId =
  "acromyrmex" | "vespula" | "bombus" | "porotermes" | "rival" | "npc";
export type AgentKind =
  "ant" | "wasp" | "bumblebee" | "termite" | "fly" | "beetle";
export type AgentTask =
  "idle" | "move" | "forage" | "return" | "flee" | "defend" | "sealed";
export type AgentOrder = "autonomous" | "move" | "gather" | "return";
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
  temperature: number;
  humidity: number;
  wind: Vec2;
  rain: number;
  playerAgentId: number;
  playerSequence: number;
  mandate: number;
  authorityLevel: 1 | 2 | 3;
  colonyBiomass: number;
  rivalBiomass: number;
  fungusHealth: number;
  broodHealth: number;
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
  | "RETURN_TO_NEST";

export interface SimCommand {
  protocolVersion: 1;
  matchId: string;
  playerId: string;
  entityId: number;
  tick: number;
  sequence: number;
  type: CommandType;
  payload:
    MovePayload | PositionPayload | TargetPayload | Record<string, never>;
}
