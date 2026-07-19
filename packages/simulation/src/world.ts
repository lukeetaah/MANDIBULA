import { randomRange } from "./rng";
import type {
  Agent,
  Alliance,
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
  };
}

export function createWorld(seed = 0x5eed1234): WorldState {
  const world: WorldState = {
    version: 1,
    seed: seed >>> 0,
    rngState: seed >>> 0 || 1,
    tick: 0,
    nextId: 1,
    status: "playing",
    statusReason: "",
    paused: false,
    temperature: 16,
    humidity: 0.32,
    wind: { x: 0.25, z: 0.05 },
    rain: 0,
    playerAgentId: 0,
    playerSequence: 0,
    mandate: 0,
    authorityLevel: 1,
    colonyBiomass: 2,
    rivalBiomass: 0,
    fungusHealth: 0.72,
    broodHealth: 0.8,
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

  const player = makeAgent(world, "ant", "acromyrmex", { x: 1.5, z: 0 }, true);
  world.playerAgentId = player.id;
  world.agents.push(player);
  for (let i = 0; i < 62; i += 1) {
    const angle = (i * 2.399963) % (Math.PI * 2);
    const radius = 2 + (i % 8) * 0.34;
    world.agents.push(
      makeAgent(world, "ant", "acromyrmex", {
        x: Math.cos(angle) * radius,
        z: Math.sin(angle) * radius,
      }),
    );
  }
  for (let i = 0; i < 28; i += 1) {
    world.agents.push(
      makeAgent(world, "ant", "rival", {
        x: RIVAL_NEST.x + (i % 7) * 0.35,
        z: RIVAL_NEST.z + Math.floor(i / 7) * 0.4,
      }),
    );
  }
  for (let i = 0; i < 7; i += 1)
    world.agents.push(
      makeAgent(world, "wasp", "vespula", { x: -24 + i * 0.9, z: 28 }),
    );
  for (let i = 0; i < 8; i += 1)
    world.agents.push(
      makeAgent(world, "bumblebee", "bombus", { x: 18 + i * 0.7, z: 26 }),
    );
  for (let i = 0; i < 16; i += 1)
    world.agents.push(
      makeAgent(world, "termite", "porotermes", {
        x: -32 + (i % 8) * 0.45,
        z: -24 + Math.floor(i / 8) * 0.5,
      }),
    );
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
    { id: id(world), kind: "leaf", position: { x: 15, z: 7 }, amount: 42 },
    { id: id(world), kind: "seed", position: { x: -18, z: 12 }, amount: 30 },
    { id: id(world), kind: "nectar", position: { x: 24, z: 25 }, amount: 40 },
    {
      id: id(world),
      kind: "deadwood",
      position: { x: -34, z: -25 },
      amount: 60,
    },
    { id: id(world), kind: "leaf", position: { x: 28, z: -16 }, amount: 32 },
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
    warningTicks: 260,
    nextArrivalTick: 0,
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
    warningTicks: 1450,
    nextArrivalTick: 1450,
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
    if (agent.controlled) world.tutorialStep = Math.max(world.tutorialStep, 3);
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
    if (agent.controlled) world.tutorialStep = Math.max(world.tutorialStep, 2);
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
      world.tutorialStep = Math.max(world.tutorialStep, 1);
    } else if (
      command.type === "INTERACT" ||
      command.type === "PICK_UP" ||
      command.type === "DROP" ||
      command.type === "HARVEST"
    ) {
      handleInteraction(world, agent);
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
      world.tutorialStep = Math.max(world.tutorialStep, 4);
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
      command.type === "RETREAT" ||
      command.type === "RETURN_TO_NEST"
    ) {
      agent.task = "return";
    } else if (command.type === "ATTACK" && "targetId" in command.payload) {
      const targetId = command.payload.targetId;
      const spider = world.spiders.find(
        (candidate) => candidate.id === targetId && candidate.visible,
      );
      if (spider && distanceSq(agent.position, spider.position) < 8) {
        spider.agitation += 0.12;
        spider.wounds += spider.dominant ? 0.006 : 0.025;
        spider.mobility = clamp(
          spider.mobility - (spider.dominant ? 0.002 : 0.008),
          0.2,
          1,
        );
      }
    }
  }
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

function updatePlayer(world: WorldState) {
  const player = world.agents.find((agent) => agent.id === world.playerAgentId);
  if (!player?.alive) return;
  player.position.x = clamp(player.position.x + player.velocity.x, -58, 58);
  player.position.z = clamp(player.position.z + player.velocity.z, -48, 48);
  player.velocity.x *= 0.78;
  player.velocity.z *= 0.78;
  player.energy = clamp(player.energy + 0.0015, 0, 1);
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

function updateAnt(agent: Agent, world: WorldState) {
  if (agent.controlled || !agent.alive) return;
  const speed =
    world.temperature < 7 ? 0.07 : world.temperature > 31 ? 0.1 : 0.14;
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
  } else if (agent.carrying > 0 || agent.task === "return") {
    steer(agent, agent.faction === "rival" ? RIVAL_NEST : NEST, speed);
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
    const resource = signal
      ? { position: signal.position }
      : nearestResource(world, agent);
    if (resource) steer(agent, resource.position, speed);
    if (resource && distanceSq(agent.position, resource.position) < 8)
      handleInteraction(world, agent);
    agent.task = "forage";
  }
  agent.position.x += agent.velocity.x;
  agent.position.z += agent.velocity.z;
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
  const flight =
    agent.kind === "wasp" || agent.kind === "bumblebee" || agent.kind === "fly";
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
      steer(agent, pass, 0.24);
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
          "Porotermes selló un corredor",
          agent.id,
        );
      return;
    }
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
        "Bombus cambió su circuito floral",
        agent.id,
      );
  } else {
    let jitter: number;
    [world.rngState, jitter] = randomRange(world.rngState, -0.09, 0.09);
    agent.position.x = clamp(
      agent.position.x +
        Math.sin(world.tick * 0.018 + agent.id) * 0.055 +
        jitter * 0.05,
      -55,
      55,
    );
    agent.position.z = clamp(
      agent.position.z + Math.cos(world.tick * 0.015 + agent.id) * 0.045,
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
  agent.alive = false;
  agent.velocity = { x: 0, z: 0 };
  world.metrics.lossesByFaction[agent.faction] += 1;
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
  event(world, "agent-died", "Un individuo fue perdido", agent.id);
  if (agent.controlled) {
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
}

function updateSpider(spider: Spider, world: WorldState) {
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
    event(
      world,
      "spider-killed",
      "Murió una araña; los corredores ecológicos siguen abiertos",
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
      (spider.dominant ? 0.19 : 0.15) * spider.mobility,
    );
    spider.energy = clamp(spider.energy - 0.0007, 0, 1);
  } else {
    spider.state = "immobilize";
    prey.poisonedTicks += spider.dominant ? 34 : 20;
    prey.integrity -= spider.dominant ? 0.42 : 0.3;
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
  world.fungusHealth = clamp(
    world.fungusHealth - 0.000035 * (1 + Math.abs(world.temperature - 18) / 20),
    0,
    1,
  );
  world.broodHealth = clamp(
    world.broodHealth + (world.fungusHealth - 0.5) * 0.00015,
    0,
    1,
  );
  if (world.colonyBiomass >= 24 && world.fungusHealth >= 0.45)
    endMatch(
      world,
      "victory",
      "El cultivo quedó abastecido antes del cambio térmico",
    );
  if (world.rivalBiomass >= 26)
    endMatch(world, "defeat", "La colonia rival dominó la red de recursos");
  if (world.fungusHealth <= 0.05)
    endMatch(world, "defeat", "El cultivo colapsó por falta de sustrato");
  if (world.tick >= 9000)
    endMatch(
      world,
      world.colonyBiomass > world.rivalBiomass ? "victory" : "defeat",
      "La helada cerró la ventana de forrajeo",
    );
}

export function stepWorld(
  world: WorldState,
  commands: readonly SimCommand[] = [],
): WorldState {
  if (world.paused || world.status !== "playing") return world;
  applyCommands(world, commands);
  updateClimate(world);
  updatePheromones(world);
  updatePlayer(world);
  for (const agent of world.agents) {
    agent.age += 1;
    if (agent.kind === "ant") updateAnt(agent, world);
    else updateOtherFaction(agent, world);
    if (agent.poisonedTicks > 0 && agent.alive) {
      agent.poisonedTicks -= 1;
      agent.energy = clamp(agent.energy - 0.006, 0, 1);
    }
  }
  for (const spider of world.spiders) updateSpider(spider, world);
  updateWebs(world);
  updateAlliance(world);
  updateAuthority(world);
  updateEconomy(world);
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
