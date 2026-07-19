import type { WorldState } from "./types";

function stable(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stable).join(",")}]`;
  return `{${Object.entries(value as Record<string, unknown>)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, item]) => `${JSON.stringify(key)}:${stable(item)}`)
    .join(",")}}`;
}

export function checksumWorld(world: WorldState): string {
  const relevant = {
    version: world.version,
    seed: world.seed,
    rngState: world.rngState,
    tick: world.tick,
    nextId: world.nextId,
    status: world.status,
    temperature: Math.round(world.temperature * 1000),
    humidity: Math.round(world.humidity * 1000),
    mandate: Math.round(world.mandate * 1000),
    colonyBiomass: world.colonyBiomass,
    rivalBiomass: world.rivalBiomass,
    fungusHealth: Math.round(world.fungusHealth * 10000),
    broodHealth: Math.round(world.broodHealth * 10000),
    agents: world.agents.map((agent) => [
      agent.id,
      agent.alive,
      Math.round(agent.position.x * 1000),
      Math.round(agent.position.z * 1000),
      agent.carrying,
      agent.task,
      Math.round(agent.integrity * 1000),
    ]),
    pheromones: world.pheromones.map((field) => [
      field.id,
      field.type,
      Math.round(field.intensity * 10000),
      field.age,
    ]),
    spiders: world.spiders.map((spider) => [
      spider.id,
      spider.state,
      spider.visible,
      Math.round(spider.position.x * 1000),
      Math.round(spider.position.z * 1000),
      Math.round(spider.hunger * 10000),
      spider.consumed,
    ]),
  };
  let hash = 2166136261;
  for (const char of stable(relevant)) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

export function serializeSnapshot(world: WorldState): string {
  return JSON.stringify(world);
}

export function restoreSnapshot(snapshot: string): WorldState {
  const parsed = JSON.parse(snapshot) as WorldState;
  if (
    parsed.version !== 1 ||
    !Number.isFinite(parsed.tick) ||
    !Array.isArray(parsed.agents)
  )
    throw new Error("Snapshot incompatible");
  return parsed;
}
