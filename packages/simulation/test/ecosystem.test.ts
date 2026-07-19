import { describe, expect, it } from "vitest";
import { createWorld, stepWorld, type SimCommand } from "../src";

function attackCommand(
  world: ReturnType<typeof createWorld>,
  entityId: number,
  targetId: number,
): SimCommand {
  return {
    protocolVersion: 1,
    matchId: "ecosystem-test",
    playerId: "player-a",
    entityId,
    tick: world.tick,
    sequence: world.playerSequence + 1,
    type: "ATTACK",
    payload: { targetId },
  };
}

describe("red trófica y depredadores", () => {
  it("una araña elige también fauna NPC y respeta saciedad", () => {
    const world = createWorld(101);
    const spider = world.spiders[0]!;
    spider.visible = true;
    spider.nextArrivalTick = 0;
    const fly = world.agents.find((agent) => agent.faction === "npc")!;
    spider.position = { ...fly.position };
    spider.home = { ...fly.position };
    fly.integrity = 0.05;
    for (let i = 0; i < 8; i += 1) stepWorld(world);
    expect(world.metrics.lossesByFaction.npc).toBeGreaterThan(0);
    spider.hunger = 0.05;
    stepWorld(world);
    expect(["sated", "shelter"]).toContain(spider.state);
  });

  it("la seda persiste y desvía a Bombus", () => {
    const world = createWorld(102);
    const bee = world.agents.find((agent) => agent.kind === "bumblebee")!;
    const web = world.webs[0]!;
    bee.position = { x: (web.a.x + web.b.x) / 2, z: (web.a.z + web.b.z) / 2 };
    const before = bee.position.z;
    stepWorld(world);
    expect(bee.task).toBe("flee");
    expect(bee.position.z).not.toBe(before);
    expect(world.webs[0]?.integrity).toBeGreaterThan(0);
  });

  it("Porotermes sella cuando detecta una araña cercana", () => {
    const world = createWorld(103);
    const termite = world.agents.find((agent) => agent.kind === "termite")!;
    const spider = world.spiders[0]!;
    spider.visible = true;
    spider.nextArrivalTick = 0;
    spider.position = { ...termite.position };
    stepWorld(world);
    expect(termite.task).toBe("sealed");
  });

  it("Vespula hostiga una araña pequeña con pasadas y costo energético", () => {
    const world = createWorld(106);
    const spider = world.spiders[0]!;
    spider.visible = true;
    spider.nextArrivalTick = 0;
    spider.position = { x: -24, z: 28 };
    spider.home = { ...spider.position };
    spider.hunger = 0.05;
    const wasps = world.agents.filter((agent) => agent.kind === "wasp");
    const energyBefore = wasps.reduce((sum, wasp) => sum + wasp.energy, 0);
    for (let i = 0; i < 80; i += 1) stepWorld(world);
    expect(spider.wounds).toBeGreaterThan(0);
    expect(wasps.reduce((sum, wasp) => sum + wasp.energy, 0)).toBeLessThan(
      energyBefore,
    );
  });

  it("Vespula intercepta una obrera expuesta con carga", () => {
    const world = createWorld(108);
    const wasp = world.agents.find((agent) => agent.kind === "wasp")!;
    const ant = world.agents.find(
      (agent) => agent.kind === "ant" && agent.faction === "acromyrmex",
    )!;
    world.spiders.forEach((spider) => {
      spider.visible = false;
      spider.nextArrivalTick = 99_999;
    });
    ant.position = { ...wasp.position };
    ant.carrying = 1;
    ant.order = "gather";
    world.tick = (23 - (wasp.id % 23)) % 23;
    stepWorld(world);
    expect(ant.integrity).toBeLessThan(1);
    expect(ant.poisonedTicks).toBeGreaterThan(0);
    expect(wasp.task).toBe("attack");
  });

  it("una patrulla puede expulsar fauna hostil observada", () => {
    const world = createWorld(109);
    const ant = world.agents.find(
      (agent) => agent.kind === "ant" && agent.faction === "acromyrmex",
    )!;
    const beetle = world.agents.find((agent) => agent.kind === "beetle")!;
    ant.position = { ...beetle.position };
    beetle.integrity = 0.003;
    stepWorld(world, [attackCommand(world, ant.id, beetle.id)]);
    expect(beetle.alive).toBe(false);
    expect(world.eventLog.some((entry) => entry.type === "fauna-repelled")).toBe(
      true,
    );
  });

  it("Acromyrmex sólo presiona por masa contra una araña pequeña", () => {
    const world = createWorld(107);
    const spider = world.spiders[0]!;
    spider.visible = true;
    spider.nextArrivalTick = 0;
    spider.position = { x: 3, z: 3 };
    spider.home = { ...spider.position };
    spider.hunger = 0.05;
    for (const ant of world.agents
      .filter((agent) => agent.faction === "acromyrmex" && !agent.controlled)
      .slice(0, 14)) {
      ant.position = { x: 3.2, z: 3.2 };
    }
    stepWorld(world);
    expect(spider.wounds).toBeGreaterThan(0);
    expect(
      world.agents.filter((agent) => agent.task === "defend").length,
    ).toBeGreaterThan(0);
  });

  it("una araña dominante normalmente se retira antes de morir", () => {
    const world = createWorld(104);
    const dominant = world.spiders.find((spider) => spider.dominant)!;
    dominant.visible = true;
    dominant.nextArrivalTick = 0;
    dominant.position = { x: 8, z: 8 };
    dominant.agitation = 0.9;
    stepWorld(world);
    expect(dominant.state).toBe("retreat");
    expect(world.metrics.spidersKilled).toBe(0);
  });

  it("sólo una condición funcional extrema mata a la dominante y no cierra el corredor", () => {
    const world = createWorld(105);
    const dominant = world.spiders.find((spider) => spider.dominant)!;
    dominant.visible = true;
    dominant.nextArrivalTick = 0;
    dominant.position = { x: 4, z: 4 };
    dominant.wounds = 0.96;
    dominant.mobility = 0.3;
    dominant.agitation = 0.86;
    stepWorld(world);
    expect(world.metrics.spidersKilled).toBe(1);
    expect(dominant.visible).toBe(false);
    expect(dominant.nextArrivalTick).toBeGreaterThan(world.tick + 3_000);
  });
});
