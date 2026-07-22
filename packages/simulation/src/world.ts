import { randomRange } from "./rng";
import type {
  Agent,
  Alliance,
  Difficulty,
  FactionId,
  PheromoneField,
  PheromoneType,
  SimCommand,
  Spider,
  Vec2,
  WorldState,
} from "./types";

const NEST: Vec2 = { x: 0, z: 0 };
const RIVAL_NEST: Vec2 = { x: 37, z: -28 };
const MAX_EVENTS = 80;

const difficultyProfiles = {
  gentle: {
    economyDrain: 0.54,
    spiderDamage: 0.55,
    spiderSpeed: 0.72,
    attackerLimit: 1,
    predatorLimit: 1,
  },
  balanced: {
    economyDrain: 0.78,
    spiderDamage: 0.8,
    spiderSpeed: 0.88,
    attackerLimit: 2,
    predatorLimit: 2,
  },
  wild: {
    economyDrain: 1,
    spiderDamage: 1,
    spiderSpeed: 1,
    attackerLimit: 3,
    predatorLimit: 3,
  },
} as const;

const difficultyProfile = (world: WorldState) =>
  difficultyProfiles[world.difficulty];

const distanceSq = (a: Vec2, b: Vec2) => (a.x - b.x) ** 2 + (a.z - b.z) ** 2;
const length = (v: Vec2) => Math.hypot(v.x, v.z);
const normalize = (v: Vec2): Vec2 => {
  const magnitude = length(v);
  return magnitude > 0.0001
    ? { x: v.x / magnitude, z: v.z / magnitude }
    : { x: 0, z: 0 };
};
const toward = (from: Vec2, to: Vec2) =>
  normalize({ x: to.x - from.x, z: to.z - from.z });
const clamp = (value: number, min: number, max: number) =>
  Math.max(min, Math.min(max, value));

function id(world: WorldState): number {
  const value = world.nextId;
  world.nextId += 1;
  return value;
}

function event(
  world: WorldState,
  type: WorldState["eventLog"][number]["type"],
  message: string,
  entityId?: number,
) {
  world.eventLog.push({
    tick: world.tick,
    type,
    message,
    ...(entityId === undefined ? {} : { entityId }),
  });
  if (world.eventLog.length > MAX_EVENTS)
    world.eventLog.splice(0, world.eventLog.length - MAX_EVENTS);
}

function makeAgent(
  world: WorldState,
  kind: Agent["kind"],
  faction: FactionId,
  position: Vec2,
  controlled = false,
): Agent {
  return {
    id: id(world),
    kind,
    faction,
    position: { ...position },
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
    controlled,
    poisonedTicks: 0,
  };
}

function emptyMetrics(): WorldState["metrics"] {
  return {
    spidersEncountered: 0,
    attacksStarted: 0,
    attacksAvoided: 0,
    unitsConsumed: 0,
    coloniesCollapsed: 0,
    spidersExpelled: 0,
    spidersKilled: 0,
    alliancesCreated: 0,
    alliancesBroken: 0,
    lossesByFaction: {
      acromyrmex: 0,
      vespula: 0,
      bombus: 0,
      porotermes: 0,
      rival: 0,
      npc: 0,
    },
    totalBiomassHarvested: 0,
    visitedUnderground: false,
    priorityChanged: false,
    minorThreatResolved: false,
    routesEstablished: false,
  };
}

export function createWorld(
  seed = 0x5eed1234,
  difficulty: Difficulty = "balanced",
  playerFaction: FactionId = "acromyrmex",
): WorldState {
  const initialFungus =
    difficulty === "gentle" ? 0.84 : difficulty === "balanced" ? 0.78 : 0.72;
  const world: WorldState = {
    version: 1,
    seed: seed >>> 0,
    rngState: seed >>> 0 || 1,
    tick: 0,
    nextId: 1,
    status: "playing",
    statusReason: "",
    paused: false,
    difficulty,
    temperature: 16,
    humidity: 0.32,
    wind: { x: 0.25, z: 0.05 },
    rain: 0,
    playerAgentId: 0,
    playerFaction,
    playerSequence: 0,
    mandate: 0,
    authorityLevel: 1,
    colonyBiomass: 2,
    rivalBiomass: 0,
    fungusHealth: initialFungus,
    broodHealth: 0.8,
    seasonPhase: 1,
    colonyLevel: 1,
    era: 1,
    colonyPriority: "forage",
    nest: {
      chambers: { fungus: 1, nursery: 1, ventilation: 1, waste: 0 },
      moisture: 0.66,
      hygiene: 0.82,
      ventilation: 0.54,
      wasteLoad: 0.12,
      thatchIntegrity: 0.88,
    },
    tutorialStep: 0,
    agents: [],
    resources: [],
    pheromones: [],
    spiders: [],
    webs: [],
    alliances: [],
    eventLog: [],
    metrics: emptyMetrics(),
  };

  const factionKindMap: Record<string, Agent["kind"]> = {
    acromyrmex: "ant",
    porotermes: "termite",
    vespula: "wasp",
    bombus: "bumblebee",
  };
  const factionOriginMap: Record<string, Vec2> = {
    acromyrmex: { x: 1.5, z: 0 },
    porotermes: { x: -32, z: -24 },
    vespula: { x: -24, z: 28 },
    bombus: { x: 18, z: 26 },
  };
  const factionUnitCount: Record<string, number> = {
    acromyrmex: 62,
    porotermes: 32,
    vespula: 16,
    bombus: 10,
  };

  const pKind = factionKindMap[playerFaction] || "ant";
  const pOrigin = factionOriginMap[playerFaction] || { x: 1.5, z: 0 };
  const pCount = factionUnitCount[playerFaction] || 62;

  const player = makeAgent(world, pKind, playerFaction, pOrigin, true);
  world.playerAgentId = player.id;
  world.agents.push(player);

  for (let i = 0; i < pCount; i += 1) {
    const angle = (i * 2.399963) % (Math.PI * 2);
    const radius = 1.2 + (i % 8) * 0.34;
    world.agents.push(
      makeAgent(world, pKind, playerFaction, {
        x: pOrigin.x + Math.cos(angle) * radius,
        z: pOrigin.z + Math.sin(angle) * radius,
      }),
    );
  }

  // Spawn non-player environmental & rival factions
  if (playerFaction !== "acromyrmex") {
    for (let i = 0; i < 40; i += 1) {
      const angle = (i * 2.399963) % (Math.PI * 2);
      const radius = 2 + (i % 8) * 0.34;
      world.agents.push(
        makeAgent(world, "ant", "acromyrmex", {
          x: Math.cos(angle) * radius,
          z: Math.sin(angle) * radius,
        }),
      );
    }
  }

  for (let i = 0; i < 28; i += 1) {
    world.agents.push(
      makeAgent(world, "ant", "rival", {
        x: RIVAL_NEST.x + (i % 7) * 0.35,
        z: RIVAL_NEST.z + Math.floor(i / 7) * 0.4,
      }),
    );
  }

  if (playerFaction !== "vespula") {
    const waspCount =
      difficulty === "gentle" ? 3 : difficulty === "balanced" ? 5 : 7;
    for (let i = 0; i < waspCount; i += 1)
      world.agents.push(
        makeAgent(world, "wasp", "vespula", { x: -24 + i * 0.9, z: 28 }),
      );
  }

  if (playerFaction !== "bombus") {
    for (let i = 0; i < 8; i += 1)
      world.agents.push(
        makeAgent(world, "bumblebee", "bombus", { x: 18 + i * 0.7, z: 26 }),
      );
  }

  if (playerFaction !== "porotermes") {
    for (let i = 0; i < 16; i += 1)
      world.agents.push(
        makeAgent(world, "termite", "porotermes", {
          x: -32 + (i % 8) * 0.45,
          z: -24 + Math.floor(i / 8) * 0.5,
        }),
      );
  }
  for (let i = 0; i < 24; i += 1) {
    const angle = (i / 24) * Math.PI * 2;
    world.agents.push(
      makeAgent(world, i % 4 === 0 ? "beetle" : "fly", "npc", {
        x: Math.cos(angle) * (18 + (i % 7)),
        z: Math.sin(angle) * (18 + (i % 7)),
      }),
    );
  }

  world.resources = [
    { id: id(world), kind: "leaf", position: { x: 9, z: 6 }, amount: 45 },
    { id: id(world), kind: "leaf", position: { x: -9, z: -8 }, amount: 35 },
    { id: id(world), kind: "leaf", position: { x: 16, z: 12 }, amount: 42 },
    { id: id(world), kind: "seed", position: { x: -18, z: 12 }, amount: 30 },
    { id: id(world), kind: "nectar", position: { x: 20, z: 22 }, amount: 40 },
    {
      id: id(world),
      kind: "deadwood",
      position: { x: -28, z: -20 },
      amount: 60,
    },
    { id: id(world), kind: "leaf", position: { x: 25, z: -16 }, amount: 35 },
  ];

  const runner: Spider = {
    id: id(world),
    guild: "ground-runner",
    dominant: false,
    position: { x: -11, z: -13 },
    home: { x: -11, z: -13 },
    state: "shelter",
    targetId: null,
    hunger: 0.58,
    agitation: 0,
    energy: 1,
    mobility: 1,
    legFunction: [1, 1, 1, 1],
    cheliceraFunction: 1,
    silkFunction: 0.15,
    perception: 15,
    wounds: 0,
    consumed: 0,
    visible: false,
    warningTicks:
      difficulty === "gentle" ? 1_000 : difficulty === "balanced" ? 520 : 120,
    nextArrivalTick:
      difficulty === "gentle" ? 1_000 : difficulty === "balanced" ? 520 : 120,
  };
  const weaver: Spider = {
    id: id(world),
    guild: "orb-weaver",
    dominant: false,
    position: { x: 20, z: 19 },
    home: { x: 20, z: 19 },
    state: "shelter",
    targetId: null,
    hunger: 0.38,
    agitation: 0,
    energy: 1,
    mobility: 0.7,
    legFunction: [1, 1, 1, 1],
    cheliceraFunction: 1,
    silkFunction: 1,
    perception: 11,
    wounds: 0,
    consumed: 0,
    visible: true,
    warningTicks: 0,
    nextArrivalTick: 0,
  };
  const dominant: Spider = {
    id: id(world),
    guild: "ground-runner",
    dominant: true,
    position: { x: 58, z: -46 },
    home: { x: 58, z: -46 },
    state: "relocate",
    targetId: null,
    hunger: 0.82,
    agitation: 0,
    energy: 1,
    mobility: 1,
    legFunction: [1, 1, 1, 1],
    cheliceraFunction: 1,
    silkFunction: 0.2,
    perception: 20,
    wounds: 0,
    consumed: 0,
    visible: false,
    warningTicks:
      difficulty === "gentle"
        ? 3_600
        : difficulty === "balanced"
          ? 2_400
          : 1_450,
    nextArrivalTick:
      difficulty === "gentle"
        ? 3_600
        : difficulty === "balanced"
          ? 2_400
          : 1_450,
  };
  world.spiders.push(runner, weaver, dominant);
  world.webs.push(
    {
      id: id(world),
      a: { x: 15, z: 20 },
      b: { x: 25, z: 20 },
      integrity: 1,
      wetness: 0,
      ownerId: weaver.id,
    },
    {
      id: id(world),
      a: { x: 20, z: 15 },
      b: { x: 20, z: 24 },
      integrity: 1,
      wetness: 0,
      ownerId: weaver.id,
    },
  );
  return world;
}

export function configureDifficulty(
  world: WorldState,
  difficulty: Difficulty,
): WorldState {
  if (world.difficulty === difficulty) return world;
  const rank: Record<Difficulty, number> = { gentle: 0, balanced: 1, wild: 2 };
  const lowering = rank[difficulty] < rank[world.difficulty];
  world.difficulty = difficulty;
  if (lowering) {
    for (const agent of world.agents) {
      if (agent.kind !== "wasp" && agent.kind !== "beetle") continue;
      agent.targetId = null;
      if (agent.task === "attack") agent.task = "flee";
    }
    for (const spider of world.spiders) {
      if (spider.dominant || difficulty === "gentle") {
        spider.targetId = null;
        if (spider.visible && spider.state !== "shelter") {
          spider.agitation = Math.max(spider.agitation, 0.88);
          spider.state = "retreat";
        } else if (!spider.visible) {
          const delay = difficulty === "gentle" ? 1_800 : 900;
          spider.nextArrivalTick = Math.max(
            spider.nextArrivalTick,
            world.tick + delay,
          );
        }
      }
    }
  }
  event(
    world,
    "difficulty-changed",
    difficulty === "gentle"
      ? "El ecosistema entra en modo Calma: menos ataques simultáneos"
      : difficulty === "balanced"
        ? "El ecosistema adopta un pulso equilibrado"
        : "El ecosistema queda sin límites de protección",
  );
  return world;
}

function emitPheromone(
  world: WorldState,
  emitter: Agent,
  type: PheromoneType,
  position: Vec2,
  radius: number,
  intensity: number,
) {
  const field: PheromoneField = {
    id: id(world),
    type,
    position: { ...position },
    direction: toward(emitter.position, position),
    intensity,
    radius,
    age: 0,
    decay: type === "alarm" ? 0.0028 : 0.00125,
    emitterId: emitter.id,
    confidence: clamp(world.mandate / 20 + 0.2, 0.2, 1),
  };
  world.pheromones.push(field);
  event(world, "pheromone-emitted", `Señal ${type} depositada`, field.id);
}

function nearestResource(
  world: WorldState,
  agent: Agent,
): WorldState["resources"][number] | undefined {
  return world.resources
    .filter(
      (resource) =>
        resource.amount > 0 &&
        (resource.kind === "leaf" || resource.kind === "seed"),
    )
    .sort(
      (a, b) =>
        distanceSq(agent.position, a.position) -
          distanceSq(agent.position, b.position) || a.id - b.id,
    )[0];
}

function handleInteraction(world: WorldState, agent: Agent) {
  if (agent.carrying > 0 && distanceSq(agent.position, NEST) < 18) {
    world.colonyBiomass += agent.carrying;
    world.metrics.totalBiomassHarvested += agent.carrying;
    world.mandate += agent.controlled ? 1 : 0.06;
    world.fungusHealth = clamp(
      world.fungusHealth + agent.carrying * 0.012,
      0,
      1,
    );
    event(
      world,
      "resource-delivered",
      "Sustrato entregado al cultivo",
      agent.id,
    );
    agent.carrying = 0;
    if (agent.faction === "acromyrmex")
      world.tutorialStep = Math.max(world.tutorialStep, 4);
    if (agent.order === "gather" && agent.targetId !== null) {
      const orderedPatch = world.resources.find(
        (candidate) => candidate.id === agent.targetId && candidate.amount > 0,
      );
      if (orderedPatch) {
        agent.task = "forage";
        agent.destination = { ...orderedPatch.position };
      } else {
        agent.order = "autonomous";
        agent.destination = null;
        agent.targetId = null;
      }
    } else {
      agent.order = "autonomous";
      agent.destination = null;
      agent.targetId = null;
      agent.task = "idle";
    }
    return;
  }
  const resource = world.resources
    .filter((candidate) => candidate.amount > 0)
    .sort(
      (a, b) =>
        distanceSq(agent.position, a.position) -
          distanceSq(agent.position, b.position) || a.id - b.id,
    )[0];
  if (
    resource &&
    distanceSq(agent.position, resource.position) < 12 &&
    agent.carrying === 0
  ) {
    resource.amount -= 1;
    agent.carrying = 1;
    agent.task = "return";
    agent.destination = { ...NEST };
    emitPheromone(world, agent, "forage", { ...agent.position }, 12, 0.6);
  }
}

function applyCommands(world: WorldState, commands: readonly SimCommand[]) {
  const ordered = [...commands].sort(
    (a, b) =>
      a.tick - b.tick || a.sequence - b.sequence || a.entityId - b.entityId,
  );
  for (const command of ordered) {
    if (command.tick > world.tick || command.sequence <= world.playerSequence)
      continue;
    const agent = world.agents.find(
      (candidate) => candidate.id === command.entityId && candidate.alive,
    );
    if (!agent) continue;
    world.playerSequence = command.sequence;
    if (command.type === "MOVE" && "direction" in command.payload) {
      const direction = normalize(command.payload.direction);
      const sprint =
        "sprint" in command.payload &&
        command.payload.sprint === true &&
        agent.energy > 0.08;
      const thermal =
        world.temperature < 7 ? 0.58 : world.temperature > 32 ? 0.72 : 1;
      const speed = (sprint ? 0.42 : 0.25) * thermal;
      agent.velocity = { x: direction.x * speed, z: direction.z * speed };
      agent.energy = clamp(agent.energy + (sprint ? -0.006 : 0.002), 0, 1);
      world.tutorialStep = Math.max(world.tutorialStep, 2);
    } else if (
      command.type === "INTERACT" ||
      command.type === "PICK_UP" ||
      command.type === "DROP"
    ) {
      handleInteraction(world, agent);
    } else if (command.type === "HARVEST" && "targetId" in command.payload) {
      const targetId = command.payload.targetId;
      const resource = world.resources.find(
        (candidate) => candidate.id === targetId && candidate.amount > 0,
      );
      if (resource) {
        agent.order = "gather";
        agent.task = agent.carrying > 0 ? "return" : "forage";
        agent.targetId = resource.id;
        agent.destination =
          agent.carrying > 0 ? { ...NEST } : { ...resource.position };
        world.tutorialStep = Math.max(world.tutorialStep, 3);
      }
    } else if (
      command.type === "EMIT_PHEROMONE" &&
      "position" in command.payload
    ) {
      const requested =
        "pheromone" in command.payload ? command.payload.pheromone : undefined;
      const allowed: PheromoneType[] =
        world.authorityLevel === 1
          ? ["alarm"]
          : world.authorityLevel === 2
            ? ["alarm", "forage", "home"]
            : ["alarm", "forage", "home", "avoid", "recruit"];
      const type =
        requested && allowed.includes(requested)
          ? requested
          : (allowed[allowed.length - 1] ?? "alarm");
      emitPheromone(
        world,
        agent,
        type,
        command.payload.position,
        command.payload.radius ?? 5,
        command.payload.intensity ?? 0.65,
      );
      if (world.tutorialStep >= 4) world.tutorialStep = 5;
    } else if (
      command.type === "CANCEL_SIGNAL" &&
      "position" in command.payload
    ) {
      const position = command.payload.position;
      world.pheromones = world.pheromones.filter(
        (field) =>
          field.emitterId !== agent.id ||
          distanceSq(field.position, position) > 64,
      );
    } else if (
      command.type === "ASSIGN_PRIORITY" &&
      "position" in command.payload
    ) {
      agent.order = "move";
      agent.task = "move";
      agent.targetId = null;
      agent.destination = { ...command.payload.position };
      world.tutorialStep = Math.max(world.tutorialStep, 2);
    } else if (
      command.type === "RETREAT" ||
      command.type === "RETURN_TO_NEST"
    ) {
      agent.order = "return";
      agent.task = "return";
      agent.targetId = null;
      agent.destination = { ...NEST };
    } else if (command.type === "ATTACK" && "targetId" in command.payload) {
      const targetId = command.payload.targetId;
      const spider = world.spiders.find(
        (candidate) => candidate.id === targetId && candidate.visible,
      );
      const fauna = world.agents.find(
        (candidate) =>
          candidate.id === targetId &&
          candidate.alive &&
          candidate.kind !== "ant" &&
          candidate.faction !== agent.faction,
      );
      const target = spider ?? fauna;
      if (target) {
        agent.order = "attack";
        agent.task = "attack";
        agent.targetId = target.id;
        agent.destination = { ...target.position };
      }
    } else if (
      command.type === "EXPAND_NEST" &&
      "chamber" in command.payload &&
      agent.faction === "acromyrmex"
    ) {
      const chamber = command.payload.chamber;
      const level = world.nest.chambers[chamber];
      const cost =
        world.colonyPriority === "excavate" ? 3 + level * 2 : 4 + level * 3;
      if (level < 3 && world.colonyBiomass >= cost) {
        world.colonyBiomass -= cost;
        world.nest.chambers[chamber] += 1;
        world.mandate += 0.8;
        world.tutorialStep = Math.max(world.tutorialStep, 8);
        event(
          world,
          "nest-expanded",
          `La red excavó una cámara de ${chamber}`,
          agent.id,
        );
      }
    } else if (
      command.type === "SET_COLONY_PRIORITY" &&
      "priority" in command.payload &&
      agent.faction === "acromyrmex"
    ) {
      world.colonyPriority = command.payload.priority;
      world.metrics.priorityChanged = true;
      event(
        world,
        "priority-changed",
        `Prioridad colectiva: ${command.payload.priority}`,
        agent.id,
      );
    } else if (command.type === "VISIT_UNDERGROUND") {
      world.metrics.visitedUnderground = true;
      world.tutorialStep = Math.max(world.tutorialStep, 6);
    }
  }
}

export function getTerrainAt(position: Vec2): {
  type: "estepa" | "mallin" | "pedregullo" | "roca";
  speedMulti: number;
  humidityMulti: number;
} {
  // Simple procedural regionalization using coords
  const dist = distanceSq(position, { x: 0, z: 0 });
  if (
    position.x > 10 &&
    position.z > 15 &&
    position.x < 35 &&
    position.z < 35
  ) {
    return { type: "mallin", speedMulti: 0.8, humidityMulti: 1.5 }; // Humid and slow
  }
  if (position.x < -15 && position.z < -10) {
    return { type: "pedregullo", speedMulti: 0.7, humidityMulti: 0.5 }; // Rocky and very slow
  }
  if (dist < 400 && position.x > -20 && position.x < 20) {
    return { type: "estepa", speedMulti: 1.0, humidityMulti: 1.0 }; // Standard
  }
  return { type: "roca", speedMulti: 0.9, humidityMulti: 0.8 }; // Rough terrain
}

function updateClimate(world: WorldState) {
  const day = (world.tick % 7200) / 7200;
  world.temperature =
    15 + Math.sin(day * Math.PI * 2 - 1.2) * 10 - world.rain * 4;
  if (world.tick % 900 === 0) {
    let chance: number;
    [world.rngState, chance] = randomRange(world.rngState, 0, 1);
    world.rain = chance > 0.76 ? 1 : 0;
  }
  world.rain = Math.max(0, world.rain - 0.0008);
  world.humidity = clamp(0.25 + world.rain * 0.6, 0, 1);
}

function updatePheromones(world: WorldState) {
  for (const field of world.pheromones) {
    field.age += 1;
    const weatherLoss = 1 + world.rain * 7 + length(world.wind) * 0.08;
    field.intensity -= field.decay * weatherLoss;
  }
  world.pheromones = world.pheromones.filter(
    (field) => field.intensity > 0.015 && field.age < 3600,
  );
}

function steer(agent: Agent, target: Vec2, speed: number) {
  const direction = toward(agent.position, target);
  agent.velocity.x = direction.x * speed;
  agent.velocity.z = direction.z * speed;
}

function bestPheromone(
  world: WorldState,
  agent: Agent,
  types: readonly PheromoneType[],
) {
  return world.pheromones
    .filter(
      (field) =>
        types.includes(field.type) &&
        distanceSq(field.position, agent.position) < field.radius ** 2 * 7,
    )
    .sort(
      (a, b) =>
        b.intensity * b.confidence - a.intensity * a.confidence || a.id - b.id,
    )[0];
}

function removeAgent(world: WorldState, agent: Agent, message: string) {
  if (!agent.alive) return;
  agent.alive = false;
  agent.velocity = { x: 0, z: 0 };
  agent.task = "idle";
  agent.order = "autonomous";
  agent.targetId = null;
  agent.destination = null;
  world.metrics.lossesByFaction[agent.faction] += 1;
  event(world, "agent-died", message, agent.id);
  if (!agent.controlled) return;
  const successor = world.agents.find(
    (candidate) =>
      candidate.faction === "acromyrmex" &&
      candidate.alive &&
      !candidate.controlled,
  );
  if (successor) {
    successor.controlled = true;
    world.playerAgentId = successor.id;
    world.mandate *= 0.72;
    event(
      world,
      "succession",
      "La memoria operativa pasa a otra obrera",
      successor.id,
    );
  } else {
    endMatch(world, "defeat", "La colonia ya no tiene obreras disponibles");
  }
}

function updateAnt(agent: Agent, world: WorldState) {
  if (!agent.alive) return;
  const terrain = getTerrainAt(agent.position);
  let speed =
    world.temperature < 7 ? 0.07 : world.temperature > 31 ? 0.1 : 0.14;
  speed *= terrain.speedMulti;
  if (
    agent.faction === "rival" &&
    (world.tick < 900 || agent.id % 7 !== 0) &&
    agent.carrying === 0
  ) {
    agent.velocity.x *= 0.65;
    agent.velocity.z *= 0.65;
    agent.task = "idle";
    return;
  }

  // Evasión dinámica de obstáculos masivos (Arañas y Porotermes)
  if (agent.faction === "acromyrmex" || agent.faction === "rival") {
    const obstacles = world.agents.filter(
      (o) => o.alive && o.kind === "termite",
    );
    for (const obs of obstacles) {
      if (distanceSq(agent.position, obs.position) < 6) {
        const away = {
          x: agent.position.x - obs.position.x,
          z: agent.position.z - obs.position.z,
        };
        steer(
          agent,
          { x: agent.position.x + away.x, z: agent.position.z + away.z },
          speed * 1.5,
        );
      }
    }
  }

  // Comportamiento de Escarabajo: Degradación de rastros
  if (agent.kind === "beetle") {
    const nearbyPheromones = world.pheromones.filter(
      (p) => distanceSq(p.position, agent.position) < 8,
    );
    for (const p of nearbyPheromones) {
      p.intensity *= 0.85; // Borra rastros químicos
    }
  }
  const nearbySpider = world.spiders
    .filter(
      (spider) =>
        spider.visible &&
        !spider.dominant &&
        distanceSq(spider.position, agent.position) < 12,
    )
    .sort(
      (a, b) =>
        distanceSq(a.position, agent.position) -
          distanceSq(b.position, agent.position) || a.id - b.id,
    )[0];
  if (nearbySpider) {
    const mass = world.agents.filter(
      (other) =>
        other.alive &&
        other.faction === "acromyrmex" &&
        distanceSq(other.position, nearbySpider.position) < 25,
    ).length;
    if (mass >= 10) {
      agent.task = "defend";
      steer(agent, nearbySpider.position, speed * 0.92);
      nearbySpider.agitation += 0.0015;
      nearbySpider.wounds += 0.0007;
      nearbySpider.mobility = clamp(nearbySpider.mobility - 0.00012, 0.2, 1);
      agent.position.x += agent.velocity.x;
      agent.position.z += agent.velocity.z;
      return;
    }
  }
  if (agent.order === "attack" && agent.targetId !== null) {
    const spiderTarget = world.spiders.find(
      (spider) => spider.id === agent.targetId && spider.visible,
    );
    const faunaTarget = world.agents.find(
      (candidate) =>
        candidate.id === agent.targetId &&
        candidate.alive &&
        candidate.kind !== "ant" &&
        candidate.faction !== agent.faction,
    );
    const target = spiderTarget ?? faunaTarget;
    if (!target) {
      agent.order = "autonomous";
      agent.targetId = null;
      agent.destination = null;
      agent.task = "idle";
    } else {
      agent.destination = { ...target.position };
      agent.task = "attack";
      const targetDistance = distanceSq(agent.position, target.position);
      if (targetDistance > 2.8) steer(agent, target.position, speed * 1.18);
      else if (spiderTarget) {
        spiderTarget.agitation = clamp(spiderTarget.agitation + 0.005, 0, 1);
        const defenseFocus = world.colonyPriority === "defend" ? 1.28 : 1;
        spiderTarget.wounds +=
          (spiderTarget.dominant ? 0.00018 : 0.0012) * defenseFocus;
        spiderTarget.mobility = clamp(
          spiderTarget.mobility - (spiderTarget.dominant ? 0.00004 : 0.00018),
          0.2,
          1,
        );
        agent.energy = clamp(agent.energy - 0.0014, 0.15, 1);
      } else if (faunaTarget) {
        const defenseFocus = world.colonyPriority === "defend" ? 1.3 : 1;
        faunaTarget.integrity = clamp(
          faunaTarget.integrity - 0.0045 * defenseFocus,
          0,
          1,
        );
        faunaTarget.task = "flee";
        agent.energy = clamp(agent.energy - 0.001, 0.15, 1);
        if (faunaTarget.integrity <= 0) {
          removeAgent(
            world,
            faunaTarget,
            "La patrulla expulsó un individuo del corredor",
          );
          event(
            world,
            "fauna-repelled",
            "La presión colectiva liberó el corredor",
            faunaTarget.id,
          );
        }
      }
      agent.position.x += agent.velocity.x;
      agent.position.z += agent.velocity.z;
      return;
    }
  }
  const danger = bestPheromone(world, agent, ["alarm", "avoid"]);
  if (
    danger &&
    distanceSq(agent.position, danger.position) < danger.radius ** 2
  ) {
    const away = {
      x: agent.position.x * 2 - danger.position.x,
      z: agent.position.z * 2 - danger.position.z,
    };
    steer(agent, away, speed * 1.25);
    agent.task = "flee";
  } else if (agent.order !== "autonomous" && agent.destination) {
    if (
      agent.order === "gather" &&
      agent.targetId !== null &&
      agent.carrying === 0
    ) {
      const patch = world.resources.find(
        (candidate) => candidate.id === agent.targetId && candidate.amount > 0,
      );
      if (patch) agent.destination = { ...patch.position };
      else {
        agent.order = "autonomous";
        agent.destination = null;
        agent.targetId = null;
      }
    }
    if (agent.destination) {
      steer(agent, agent.destination, speed * 1.12);
      const arrived = distanceSq(agent.position, agent.destination) < 1.6;
      if (arrived && agent.order === "gather") handleInteraction(world, agent);
      else if (arrived && agent.order === "return")
        handleInteraction(world, agent);
      else if (arrived && agent.order === "move") {
        agent.order = "autonomous";
        agent.destination = null;
        agent.task = "idle";
      }
    }
  } else if (agent.carrying > 0 || agent.task === "return") {
    steer(agent, agent.faction === "rival" ? RIVAL_NEST : NEST, speed);

    // Rastros emergentes de forrajeo
    if (
      agent.carrying > 0 &&
      agent.faction === "acromyrmex" &&
      world.tick % 20 === 0
    ) {
      emitPheromone(world, agent, "forage", agent.position, 10, 0.4);
    }
    if (
      distanceSq(
        agent.position,
        agent.faction === "rival" ? RIVAL_NEST : NEST,
      ) < 10
    ) {
      if (agent.carrying > 0) {
        if (agent.faction === "rival") world.rivalBiomass += agent.carrying;
        else world.colonyBiomass += agent.carrying;
        agent.carrying = 0;
      }
      agent.task = "forage";
    }
  } else {
    const signal =
      agent.faction === "acromyrmex"
        ? bestPheromone(world, agent, ["forage", "recruit"])
        : undefined;
    if (agent.faction === "acromyrmex" && !signal) {
      const isDefending = world.colonyPriority === "defend";
      const isIndoor =
        world.colonyPriority === "brood" || world.colonyPriority === "excavate";
      const angle = agent.id * 2.399963 + (isDefending ? world.tick * 0.01 : 0);

      const baseRadius = isIndoor ? 1.5 : isDefending ? 5.5 : 2.2;
      const spread = isIndoor ? 0.2 : isDefending ? 0.8 : 0.33;
      const radius = baseRadius + (agent.id % 8) * spread;

      const restingPlace = {
        x: Math.cos(angle) * radius,
        z: Math.sin(angle) * radius,
      };

      if (distanceSq(agent.position, restingPlace) > 1.2)
        steer(agent, restingPlace, speed * (isDefending ? 0.6 : 0.42));
      else {
        agent.velocity.x *= 0.55;
        agent.velocity.z *= 0.55;
      }
      agent.task = isDefending ? "defend" : "idle";
    } else {
      const resource = signal
        ? { position: signal.position }
        : nearestResource(world, agent);
      if (resource) steer(agent, resource.position, speed);
      if (resource && distanceSq(agent.position, resource.position) < 8)
        handleInteraction(world, agent);
      agent.task = "forage";
    }
  }
  agent.position.x += agent.velocity.x;
  agent.position.z += agent.velocity.z;
  agent.position.x = clamp(agent.position.x, -58, 58);
  agent.position.z = clamp(agent.position.z, -48, 48);
  agent.energy = clamp(agent.energy - 0.00025, 0.25, 1);
}

function lineDistanceSq(point: Vec2, a: Vec2, b: Vec2): number {
  const ab = { x: b.x - a.x, z: b.z - a.z };
  const denominator = ab.x * ab.x + ab.z * ab.z;
  const t =
    denominator === 0
      ? 0
      : clamp(
          ((point.x - a.x) * ab.x + (point.z - a.z) * ab.z) / denominator,
          0,
          1,
        );
  return distanceSq(point, { x: a.x + ab.x * t, z: a.z + ab.z * t });
}

function updateOtherFaction(agent: Agent, world: WorldState) {
  if (!agent.alive) return;
  const profile = difficultyProfile(world);
  const terrain = getTerrainAt(agent.position);
  const flight =
    agent.kind === "wasp" || agent.kind === "bumblebee" || agent.kind === "fly";
  const speedMulti = flight ? 1.0 : terrain.speedMulti;

  if (agent.kind === "wasp") {
    const target = world.spiders
      .filter(
        (spider) =>
          spider.visible &&
          !spider.dominant &&
          distanceSq(agent.position, spider.position) < 100,
      )
      .sort(
        (a, b) =>
          distanceSq(a.position, agent.position) -
            distanceSq(b.position, agent.position) || a.id - b.id,
      )[0];
    if (target && agent.energy > 0.35) {
      agent.task = "defend";
      const pass = {
        x: target.position.x + Math.sin(world.tick * 0.08 + agent.id) * 2,
        z: target.position.z + Math.cos(world.tick * 0.08 + agent.id) * 2,
      };
      steer(agent, pass, 0.24 * speedMulti);
      agent.position.x += agent.velocity.x;
      agent.position.z += agent.velocity.z;
      agent.energy = clamp(agent.energy - 0.0018, 0, 1);
      if ((world.tick + agent.id) % 31 === 0) {
        target.wounds += 0.025;
        target.agitation += 0.045;
        target.mobility = clamp(target.mobility - 0.008, 0.2, 1);
      }
      return;
    }
    const activeWasps = world.agents.filter(
      (candidate) =>
        candidate.id !== agent.id &&
        candidate.alive &&
        candidate.kind === "wasp" &&
        candidate.task === "attack" &&
        candidate.targetId !== null,
    ).length;
    const exposedAnt =
      activeWasps < profile.attackerLimit
        ? world.agents
            .filter((candidate) => {
              if (
                !candidate.alive ||
                candidate.kind !== "ant" ||
                candidate.faction !== "acromyrmex"
              )
                return false;
              if (
                distanceSq(agent.position, candidate.position) >=
                196 * profile.spiderSpeed
              )
                return false;
              if (candidate.carrying === 0 && candidate.order === "autonomous")
                return false;

              // Filtro de aislamiento: solo caza hormigas con menos de 3 compañeras cerca
              const nearbyAllies = world.agents.filter(
                (other) =>
                  other.alive &&
                  other.faction === "acromyrmex" &&
                  other.id !== candidate.id &&
                  distanceSq(other.position, candidate.position) < 16,
              ).length;

              return nearbyAllies < 3;
            })
            .sort(
              (a, b) =>
                Number(b.carrying > 0) - Number(a.carrying > 0) ||
                distanceSq(a.position, agent.position) -
                  distanceSq(b.position, agent.position) ||
                a.id - b.id,
            )[0]
        : undefined;
    if (exposedAnt && agent.energy > 0.22) {
      if (agent.targetId !== exposedAnt.id)
        event(
          world,
          "fauna-attack",
          "Una avispa (Vespula) detectó una obrera expuesta y se lanzó al ataque",
          exposedAnt.id,
        );
      agent.targetId = exposedAnt.id;
      agent.task = "attack";
      steer(agent, exposedAnt.position, 0.2 * speedMulti);
      agent.position.x += agent.velocity.x;
      agent.position.z += agent.velocity.z;
      if (
        distanceSq(agent.position, exposedAnt.position) < 2.6 &&
        (world.tick + agent.id) % 23 === 0
      ) {
        exposedAnt.integrity = clamp(
          exposedAnt.integrity - 0.16 * profile.spiderDamage,
          0,
          1,
        );
        exposedAnt.poisonedTicks = Math.max(
          exposedAnt.poisonedTicks,
          Math.round(70 * profile.spiderDamage),
        );
        exposedAnt.task = "flee";
        agent.energy = clamp(agent.energy - 0.028, 0, 1);
        if (exposedAnt.integrity <= 0)
          removeAgent(
            world,
            exposedAnt,
            "Una avispa derribó a la obrera aislada",
          );
      }
      return;
    }
    if (agent.task === "attack") {
      agent.targetId = null;
      agent.task = "idle";
    }
  }
  if (agent.kind === "termite") {
    const danger = world.spiders.some(
      (spider) =>
        spider.visible && distanceSq(agent.position, spider.position) < 100,
    );
    if (danger) {
      agent.task = "sealed";
      if (world.tick % 300 === 0)
        event(
          world,
          "termite-sealed",
          "Las termitas (Porotermes) sellaron su túnel por miedo a las arañas",
          agent.id,
        );
      return;
    }
  }
  if (agent.kind === "bumblebee") {
    const flower = world.resources
      .filter((resource) => resource.kind === "nectar" && resource.amount > 0)
      .sort(
        (a, b) =>
          distanceSq(a.position, agent.position) -
            distanceSq(b.position, agent.position) || a.id - b.id,
      )[0];
    if (flower) {
      const circuit = {
        x: flower.position.x + Math.sin(world.tick * 0.018 + agent.id) * 3.2,
        z: flower.position.z + Math.cos(world.tick * 0.016 + agent.id) * 2.4,
      };
      steer(agent, circuit, 0.13 * speedMulti);
      if ((world.tick + agent.id) % 420 === 0 && flower.amount < 64) {
        flower.amount += 1;
        event(
          world,
          "pollination",
          "Un abejorro (Bombus) polinizó una flor y renovó el néctar local",
          agent.id,
        );
      }
    }
  }
  if (agent.kind === "beetle") {
    const activeBeetles = world.agents.filter(
      (candidate) =>
        candidate.id !== agent.id &&
        candidate.alive &&
        candidate.kind === "beetle" &&
        candidate.task === "attack" &&
        candidate.targetId !== null,
    ).length;
    const exposedAnt =
      activeBeetles < profile.attackerLimit
        ? world.agents
            .filter(
              (candidate) =>
                candidate.alive &&
                candidate.kind === "ant" &&
                candidate.faction === "acromyrmex" &&
                distanceSq(agent.position, candidate.position) <
                  64 * profile.spiderSpeed,
            )
            .sort(
              (a, b) =>
                distanceSq(a.position, agent.position) -
                  distanceSq(b.position, agent.position) || a.id - b.id,
            )[0]
        : undefined;
    if (exposedAnt) {
      if (agent.targetId !== exposedAnt.id)
        event(
          world,
          "fauna-attack",
          "Un escarabajo corredor entró en contacto con la patrulla",
          exposedAnt.id,
        );
      agent.targetId = exposedAnt.id;
      agent.task = "attack";
      steer(agent, exposedAnt.position, 0.105 * speedMulti);
      agent.position.x += agent.velocity.x;
      agent.position.z += agent.velocity.z;
      if (
        distanceSq(agent.position, exposedAnt.position) < 1.8 &&
        (world.tick + agent.id) % 41 === 0
      ) {
        exposedAnt.integrity = clamp(
          exposedAnt.integrity - 0.085 * profile.spiderDamage,
          0,
          1,
        );
        if (exposedAnt.integrity <= 0)
          removeAgent(
            world,
            exposedAnt,
            "Un escarabajo corredor capturó una obrera aislada",
          );
      }
      return;
    }
    if (agent.task === "attack") {
      agent.targetId = null;
      agent.task = "idle";
    }
  }
  if (agent.kind === "fly" && world.nest.wasteLoad > 0.45) {
    steer(agent, NEST, 0.095 * speedMulti);
    agent.position.x += agent.velocity.x;
    agent.position.z += agent.velocity.z;
    agent.task = "forage";
    if (
      distanceSq(agent.position, NEST) < 12 &&
      (world.tick + agent.id) % 240 === 0
    ) {
      world.nest.wasteLoad = clamp(world.nest.wasteLoad + 0.012, 0, 1);
      world.fungusHealth = clamp(world.fungusHealth - 0.008, 0, 1);
      event(
        world,
        "waste-contaminated",
        "Las moscas alcanzaron el bolsón de residuos",
        agent.id,
      );
    }
    return;
  }
  const blocked =
    flight &&
    world.webs.some(
      (web) =>
        web.integrity > 0.15 &&
        lineDistanceSq(agent.position, web.a, web.b) < 3,
    );
  if (blocked) {
    agent.position.z += agent.kind === "bumblebee" ? 0.34 : -0.24;
    agent.task = "flee";
    if (agent.kind === "bumblebee" && world.tick % 180 === 0)
      event(
        world,
        "bombus-rerouted",
        "El abejorro esquivó una tela de araña y desvió su circuito floral",
        agent.id,
      );
  } else {
    let jitter: number;
    [world.rngState, jitter] = randomRange(world.rngState, -0.09, 0.09);
    agent.position.x = clamp(
      agent.position.x +
        (Math.sin(world.tick * 0.018 + agent.id) * 0.055 + jitter * 0.05) *
          speedMulti,
      -55,
      55,
    );
    agent.position.z = clamp(
      agent.position.z +
        Math.cos(world.tick * 0.015 + agent.id) * 0.045 * speedMulti,
      -45,
      45,
    );
  }
}

function validSpiderPrey(world: WorldState, spider: Spider): Agent[] {
  return world.agents.filter((agent) => {
    if (!agent.alive) return false;
    if (
      spider.guild === "orb-weaver" &&
      !(
        agent.kind === "fly" ||
        agent.kind === "wasp" ||
        agent.kind === "bumblebee"
      )
    )
      return false;
    return (
      distanceSq(agent.position, spider.position) <= spider.perception ** 2
    );
  });
}

function choosePrey(world: WorldState, spider: Spider): Agent | undefined {
  return validSpiderPrey(world, spider).sort((a, b) => {
    const riskA =
      (a.kind === "wasp" ? 5 : a.faction === "acromyrmex" ? 1.6 : 0.4) +
      a.integrity;
    const riskB =
      (b.kind === "wasp" ? 5 : b.faction === "acromyrmex" ? 1.6 : 0.4) +
      b.integrity;
    const scoreA =
      distanceSq(a.position, spider.position) +
      riskA * (spider.hunger < 0.7 ? 10 : 3);
    const scoreB =
      distanceSq(b.position, spider.position) +
      riskB * (spider.hunger < 0.7 ? 10 : 3);
    return scoreA - scoreB || a.id - b.id;
  })[0];
}

function killAgent(world: WorldState, agent: Agent, spider: Spider) {
  world.metrics.unitsConsumed += 1;
  spider.consumed += 1;
  spider.hunger = clamp(
    spider.hunger - (agent.kind === "ant" ? 0.18 : 0.34),
    0,
    1,
  );
  event(
    world,
    "spider-consumed",
    "El depredador se alimentó y redujo su actividad",
    agent.id,
  );
  removeAgent(world, agent, "Un individuo fue perdido");
}

function updateSpider(spider: Spider, world: WorldState) {
  const profile = difficultyProfile(world);
  if (spider.nextArrivalTick > world.tick) {
    if (spider.warningTicks > 0 && world.tick === spider.warningTicks - 300)
      event(
        world,
        "predator-sign",
        "El tránsito de insectos disminuye al sudeste",
        spider.id,
      );
    if (spider.warningTicks > 0 && world.tick === spider.warningTicks - 120)
      event(
        world,
        "predator-sign",
        "Vibraciones profundas bajo el pedregullo",
        spider.id,
      );
    return;
  }
  if (!spider.visible) {
    const activePredators = world.spiders.filter(
      (candidate) =>
        candidate.id !== spider.id &&
        candidate.visible &&
        (candidate.guild === "ground-runner" ||
          ["detect", "stalk", "attack", "immobilize"].includes(
            candidate.state,
          )),
    ).length;
    if (activePredators >= profile.predatorLimit) {
      spider.nextArrivalTick = world.tick + 300;
      return;
    }
    spider.visible = true;
    world.metrics.spidersEncountered += 1;
    spider.state = "explore";
  }
  const lethalInjury =
    spider.wounds >= 0.95 && spider.mobility <= 0.35 && spider.agitation >= 0.8;
  if (lethalInjury) {
    spider.visible = false;
    spider.state = "shelter";
    spider.targetId = null;
    spider.nextArrivalTick = world.tick + (spider.dominant ? 3_600 : 2_100);
    spider.position = { ...spider.home };
    spider.wounds = 0;
    spider.mobility = 1;
    spider.agitation = 0;
    spider.hunger = 0.72;
    world.metrics.spidersKilled += 1;
    world.colonyBiomass += 16;
    world.resources.push({
      id: id(world),
      kind: "leaf",
      position: { ...spider.position },
      amount: 40,
    });
    event(
      world,
      "spider-killed",
      "¡Cacería exitosa! +16 Biomasa recuperada y restos de presa disponibles para cosecha",
      spider.id,
    );
    return;
  }
  spider.hunger = clamp(spider.hunger + 0.00028, 0, 1);
  spider.agitation = clamp(spider.agitation - 0.0015, 0, 1);
  const prey = choosePrey(world, spider);

  if (
    spider.wounds > (spider.dominant ? 0.48 : 0.72) ||
    spider.agitation > 0.86 ||
    spider.energy < 0.18
  ) {
    if (spider.state !== "retreat")
      event(
        world,
        "spider-retreated",
        "La araña evita más riesgo y retrocede",
        spider.id,
      );
    spider.state = "retreat";
    steerSpider(spider, spider.home, 0.12);
    if (distanceSq(spider.position, spider.home) < 8) {
      spider.visible = false;
      spider.state = "shelter";
      spider.nextArrivalTick = world.tick + 1400;
      world.metrics.spidersExpelled += spider.agitation > 0.86 ? 1 : 0;
      if (spider.agitation > 0.86)
        event(
          world,
          "spider-expelled",
          "El sector dejó de ser rentable para la araña",
          spider.id,
        );
    }
    return;
  }
  if (spider.hunger < 0.22) {
    spider.state = "sated";
    steerSpider(spider, spider.home, 0.045);
    if (distanceSq(spider.position, spider.home) < 8) spider.state = "shelter";
    return;
  }
  if (!prey) {
    spider.targetId = null;
    spider.state = spider.state === "shelter" ? "shelter" : "explore";
    const orbit = {
      x: spider.home.x + Math.sin(world.tick * 0.009 + spider.id) * 7,
      z: spider.home.z + Math.cos(world.tick * 0.008 + spider.id) * 6,
    };
    steerSpider(spider, orbit, 0.055);
    return;
  }
  if (spider.targetId !== prey.id) {
    spider.targetId = prey.id;
    spider.state = "detect";
    world.metrics.attacksStarted += 1;
    event(
      world,
      "spider-attack",
      "Una araña respondió a vibraciones de tránsito",
      spider.id,
    );
  }
  const preyDistance = distanceSq(spider.position, prey.position);
  if (preyDistance > 2.4) {
    spider.state = preyDistance > 30 ? "stalk" : "attack";
    steerSpider(
      spider,
      prey.position,
      (spider.dominant ? 0.19 : 0.15) * spider.mobility * profile.spiderSpeed,
    );
    spider.energy = clamp(spider.energy - 0.0007, 0, 1);
  } else {
    spider.state = "immobilize";
    prey.poisonedTicks += Math.round(
      (spider.dominant ? 34 : 20) * profile.spiderDamage,
    );
    prey.integrity -= (spider.dominant ? 0.42 : 0.3) * profile.spiderDamage;
    if (prey.integrity <= 0 || prey.poisonedTicks > 38) {
      spider.state = "consume";
      killAgent(world, prey, spider);
      spider.targetId = null;
    }
  }
}

function steerSpider(spider: Spider, target: Vec2, speed: number) {
  const direction = toward(spider.position, target);
  spider.position.x += direction.x * speed;
  spider.position.z += direction.z * speed;
}

function updateWebs(world: WorldState) {
  for (const web of world.webs) {
    web.wetness = clamp(web.wetness + world.rain * 0.008 - 0.0004, 0, 1);
    web.integrity = clamp(
      web.integrity - world.rain * 0.0008 - length(world.wind) * 0.000015,
      0,
      1,
    );
    const owner = world.spiders.find((spider) => spider.id === web.ownerId);
    if (owner?.visible && owner.state === "shelter" && owner.silkFunction > 0.4)
      web.integrity = clamp(web.integrity + 0.00045, 0, 1);
  }
}

function updateAlliance(world: WorldState) {
  world.alliances = world.alliances.filter(
    (alliance) => alliance.expiresAtTick > world.tick,
  );
  const dominant = world.spiders.find(
    (spider) => spider.dominant && spider.visible,
  );
  if (dominant && world.alliances.length === 0 && world.tick % 600 === 0) {
    const truce: Alliance = {
      factions: ["acromyrmex", "porotermes"],
      kind: "emergency-truce",
      expiresAtTick: world.tick + 900,
      cost: 0.08,
    };
    world.alliances.push(truce);
    world.metrics.alliancesCreated += 1;
    world.fungusHealth = clamp(world.fungusHealth - truce.cost, 0, 1);
    event(
      world,
      "alliance-created",
      "Tregua abstracta: corredores defensivos tolerados",
      dominant.id,
    );
  }
}

function updateAuthority(world: WorldState) {
  const next = world.mandate >= 10 ? 3 : world.mandate >= 4 ? 2 : 1;
  if (next > world.authorityLevel) {
    world.authorityLevel = next as 2 | 3;
    event(
      world,
      "authority-up",
      next === 2 ? "Mandato: obrera funcional" : "Mandato: especialista",
      world.playerAgentId,
    );
  }
}

function endMatch(
  world: WorldState,
  status: "victory" | "defeat",
  reason: string,
) {
  if (world.status !== "playing") return;
  world.status = status;
  world.statusReason = reason;
  event(world, "match-ended", reason);
}

function updateEconomy(world: WorldState) {
  const profile = difficultyProfile(world);
  const chamberTotal = Object.values(world.nest.chambers).reduce(
    (sum, level) => sum + level,
    0,
  );
  const livingWorkers = world.agents.filter(
    (agent) =>
      agent.alive && agent.kind === "ant" && agent.faction === "acromyrmex",
  ).length;
  const ventilationTarget = clamp(
    0.32 + world.nest.chambers.ventilation * 0.18,
    0,
    1,
  );
  world.nest.ventilation +=
    (ventilationTarget - world.nest.ventilation) * 0.0008;
  world.nest.moisture = clamp(
    world.nest.moisture +
      world.rain * 0.0008 -
      world.nest.ventilation * 0.00011,
    0.18,
    0.94,
  );
  world.nest.wasteLoad = clamp(
    world.nest.wasteLoad +
      0.000018 * livingWorkers -
      world.nest.chambers.waste * 0.00034,
    0,
    1,
  );
  world.nest.hygiene = clamp(
    world.nest.hygiene +
      world.nest.chambers.waste * 0.00012 -
      world.nest.wasteLoad * 0.00017,
    0,
    1,
  );
  const thermalStress =
    Math.abs(world.temperature - 18) / (20 + world.nest.ventilation * 14);
  world.fungusHealth = clamp(
    world.fungusHealth -
      0.00003 * (1 + thermalStress) * profile.economyDrain -
      world.nest.wasteLoad * 0.000035 * profile.economyDrain +
      world.nest.chambers.fungus * 0.000012 +
      (world.colonyPriority === "forage" ? 0.000025 : 0),
    0,
    1,
  );
  world.broodHealth = clamp(
    world.broodHealth +
      (world.fungusHealth - 0.5) * 0.00012 +
      world.nest.chambers.nursery * 0.000018 +
      (world.colonyPriority === "brood" ? 0.000035 : 0) -
      (1 - world.nest.hygiene) * 0.000045,
    0,
    1,
  );

  // Regeneración estacional de recursos para evitar mapas agotados
  if (world.tick % 200 === 0) {
    for (const patch of world.resources) {
      if (patch.amount < 50) {
        patch.amount = Math.min(50, patch.amount + 4);
      }
    }
    const activePatches = world.resources.filter((p) => p.amount > 0).length;
    if (activePatches < 5) {
      const angle = (world.tick / 200) * 1.618;
      const dist = 10 + ((world.tick / 200) % 16);
      world.resources.push({
        id: id(world),
        kind: "leaf",
        position: { x: Math.cos(angle) * dist, z: Math.sin(angle) * dist },
        amount: 35,
      });
      event(
        world,
        "phase-changed",
        "Brote vegetal patagónico: nuevos brotes de hojarasca disponibles para recolección.",
      );
    }
  }

  // Auto-preservación y conversión de emergencia del cultivo
  if (world.fungusHealth < 0.18) {
    if (world.colonyBiomass > 0) {
      world.colonyBiomass -= 1;
      world.fungusHealth = Math.min(1, world.fungusHealth + 0.06);
      if (world.tick % 200 === 0) {
        event(
          world,
          "phase-changed",
          "Conversión de emergencia: la colonia convirtió reserva de biomasa en sustrato para evitar el colapso.",
        );
      }
    } else if (world.tick % 300 === 0) {
      event(
        world,
        "phase-changed",
        "¡SUSTRATO CRÍTICO! Sin reservas de biomasa. Mandá obreras a recolectar hojas inmediatamente.",
      );
    }
    if (world.colonyPriority !== "forage" && world.tick % 400 === 0) {
      world.colonyPriority = "forage";
    }
  }

  if (world.seasonPhase === 1 && world.colonyBiomass >= 18) {
    world.seasonPhase = 2;
    event(
      world,
      "phase-changed",
      "La colonia deja de resistir: ahora debe convertirse en hogar",
    );
  }
  if (
    world.seasonPhase === 2 &&
    chamberTotal >= 7 &&
    world.colonyBiomass >= 28 &&
    world.broodHealth >= 0.62
  ) {
    world.seasonPhase = 3;
    event(
      world,
      "phase-changed",
      "La red madura; ahora debe controlar territorio y depredadores",
    );
  }
  const targetBiomass = 52 + ((world.era || 1) - 1) * 45;
  if (
    world.seasonPhase === 3 &&
    world.colonyBiomass >= targetBiomass &&
    world.fungusHealth >= 0.52 &&
    world.nest.hygiene >= 0.5
  )
    endMatch(
      world,
      "victory",
      `La colonia completa la Era ${world.era || 1} como un organismo supremo`,
    );
  if (world.rivalBiomass >= 58 + ((world.era || 1) - 1) * 20)
    endMatch(world, "defeat", "La colonia rival dominó la red de recursos");
  if (world.fungusHealth <= 0.01 && world.colonyBiomass === 0)
    endMatch(world, "defeat", "El cultivo colapsó por falta de sustrato");
  if (world.tick >= 12000 && world.seasonPhase < 4)
    endMatch(
      world,
      world.colonyBiomass > world.rivalBiomass ? "victory" : "defeat",
      "La helada cerró la ventana de forrajeo",
    );
}

function updateCampaign(world: WorldState) {
  if (world.status !== "playing") return;

  const harvestTarget = 30 + ((world.era || 1) - 1) * 35;
  if (world.seasonPhase === 1) {
    if (
      world.metrics.totalBiomassHarvested >= harvestTarget &&
      world.fungusHealth > 0.4 &&
      world.metrics.visitedUnderground &&
      world.metrics.priorityChanged &&
      world.metrics.minorThreatResolved
    ) {
      world.seasonPhase = 2;
      event(
        world,
        "phase-changed",
        "Fase 2: Habitar - La colonia se establece",
        undefined,
      );
    }
  } else if (world.seasonPhase === 2) {
    const hasEnoughChambers =
      world.nest.chambers.fungus > 1 || world.nest.chambers.nursery > 1;
    const isHealthy =
      world.fungusHealth > 0.6 &&
      world.broodHealth > 0.6 &&
      world.nest.hygiene > 0.5;
    if (
      hasEnoughChambers &&
      isHealthy &&
      world.tick > 4500 &&
      world.metrics.routesEstablished
    ) {
      world.seasonPhase = 3;
      event(
        world,
        "phase-changed",
        "Fase 3: Persistir - La colonia prospera",
        undefined,
      );
    }
  } else if (world.seasonPhase === 3) {
    if (world.tick > 8500) {
      world.seasonPhase = 4;
      event(
        world,
        "storm-started",
        "Tormenta patagónica: Caída térmica drástica",
        undefined,
      );
    }
  } else if (world.seasonPhase === 4) {
    world.temperature = clamp(world.temperature - 0.05, 2, 20);
    world.rain = clamp(world.rain + 0.005, 0, 1);
    world.humidity = clamp(world.humidity + 0.01, 0, 1);

    if (world.tick > 10500) {
      const survived =
        world.colonyBiomass > 20 &&
        world.fungusHealth > 0.3 &&
        world.nest.hygiene > 0.3;
      if (survived) {
        endMatch(
          world,
          "victory",
          `La colonia conservó suficiente biomasa y calor para atravesar la tormenta. Sobrevivientes: ${world.agents.filter((a) => a.alive && a.faction === "acromyrmex").length}`,
        );
      } else {
        if (world.colonyBiomass <= 20)
          endMatch(
            world,
            "defeat",
            "La reserva de biomasa se agotó durante la tormenta.",
          );
        else if (world.fungusHealth <= 0.3)
          endMatch(
            world,
            "defeat",
            "El hongo colapsó por exceso de frío y humedad.",
          );
        else
          endMatch(
            world,
            "defeat",
            "La contaminación de la colonia durante la tormenta fue letal.",
          );
      }
    }
  }
}

export function stepWorld(
  world: WorldState,
  commands: readonly SimCommand[] = [],
): WorldState {
  if (world.paused || world.status !== "playing") return world;
  applyCommands(world, commands);
  updateClimate(world);
  updatePheromones(world);
  for (const agent of world.agents) {
    agent.age += 1;
    if (agent.kind === "ant") updateAnt(agent, world);
    else updateOtherFaction(agent, world);
    if (agent.poisonedTicks > 0 && agent.alive) {
      agent.poisonedTicks -= 1;
      agent.energy = clamp(
        agent.energy - 0.006 * difficultyProfile(world).spiderDamage,
        0,
        1,
      );
    }
  }
  for (const spider of world.spiders) updateSpider(spider, world);
  updateWebs(world);
  updateAlliance(world);
  updateAuthority(world);
  updateEconomy(world);
  updateCampaign(world);
  world.tick += 1;
  return world;
}

export function cloneWorld(world: WorldState): WorldState {
  return structuredClone(world);
}

export function runHeadless(
  seed: number,
  ticks: number,
  commandProvider?: (world: WorldState) => readonly SimCommand[],
): WorldState {
  const world = createWorld(seed);
  for (let i = 0; i < ticks && world.status === "playing"; i += 1)
    stepWorld(world, commandProvider?.(world) ?? []);
  return world;
}
