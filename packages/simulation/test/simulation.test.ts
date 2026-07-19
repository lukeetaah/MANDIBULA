import { describe, expect, it } from "vitest";
import {
  checksumWorld,
  createWorld,
  nextRandom,
  parseCommand,
  restoreSnapshot,
  serializeSnapshot,
  stepWorld,
  type SimCommand,
} from "../src";

function command(
  world: ReturnType<typeof createWorld>,
  type: SimCommand["type"],
  payload: SimCommand["payload"],
): SimCommand {
  return {
    protocolVersion: 1,
    matchId: "test",
    playerId: "player-a",
    entityId: world.playerAgentId,
    tick: world.tick,
    sequence: world.playerSequence + 1,
    type,
    payload,
  };
}

describe("simulación determinista", () => {
  it("produce la misma secuencia RNG con la misma semilla", () => {
    let a = 42;
    let b = 42;
    for (let i = 0; i < 200; i += 1) {
      const resultA = nextRandom(a);
      const resultB = nextRandom(b);
      expect(resultA).toEqual(resultB);
      a = resultA[0];
      b = resultB[0];
    }
  });

  it("mantiene igualdad tick a tick y checksum estable", () => {
    const a = createWorld(91);
    const b = createWorld(91);
    for (let i = 0; i < 700; i += 1) {
      stepWorld(a);
      stepWorld(b);
      expect(checksumWorld(a)).toBe(checksumWorld(b));
    }
  });

  it("degrada las señales y la lluvia acelera la pérdida", () => {
    const dry = createWorld(2);
    const wet = createWorld(2);
    stepWorld(dry, [
      command(dry, "EMIT_PHEROMONE", {
        position: { x: 5, z: 2 },
        pheromone: "alarm",
        intensity: 1,
        radius: 5,
      }),
    ]);
    stepWorld(wet, [
      command(wet, "EMIT_PHEROMONE", {
        position: { x: 5, z: 2 },
        pheromone: "alarm",
        intensity: 1,
        radius: 5,
      }),
    ]);
    wet.rain = 1;
    for (let i = 0; i < 20; i += 1) {
      stepWorld(dry);
      stepWorld(wet);
    }
    expect(dry.pheromones[0]?.intensity).toBeGreaterThan(
      wet.pheromones[0]?.intensity ?? 0,
    );
  });

  it("valida y serializa comandos sin perder el payload", () => {
    const world = createWorld(3);
    const input = command(world, "MOVE", {
      direction: { x: 1, z: 0 },
      sprint: true,
    });
    expect(parseCommand(JSON.parse(JSON.stringify(input)))).toEqual(input);
    expect(() => parseCommand({ ...input, protocolVersion: 9 })).toThrow();
  });

  it("restaura snapshots con el mismo checksum", () => {
    const world = createWorld(4);
    for (let i = 0; i < 120; i += 1) stepWorld(world);
    expect(checksumWorld(restoreSnapshot(serializeSnapshot(world)))).toBe(
      checksumWorld(world),
    );
  });

  it("desbloquea tres niveles por contribución y no por tiempo", () => {
    const world = createWorld(5);
    world.mandate = 4;
    stepWorld(world);
    expect(world.authorityLevel).toBe(2);
    world.mandate = 10;
    stepWorld(world);
    expect(world.authorityLevel).toBe(3);
  });

  it("conserva una orden RTS de movimiento hasta alcanzar el destino", () => {
    const world = createWorld(51);
    const worker = world.agents.find(
      (agent) => agent.id === world.playerAgentId,
    )!;
    const start = { ...worker.position };
    stepWorld(world, [
      command(world, "ASSIGN_PRIORITY", { position: { x: 9, z: 6 } }),
    ]);
    expect(worker.order).toBe("move");
    expect(worker.destination).toEqual({ x: 9, z: 6 });
    for (let index = 0; index < 12; index += 1) stepWorld(world);
    expect(worker.position.x).toBeGreaterThan(start.x);
    expect(worker.position.z).toBeGreaterThan(start.z);
  });

  it("la muerte del individuo transfiere control y reduce mandato", () => {
    const world = createWorld(6);
    const player = world.agents.find(
      (agent) => agent.id === world.playerAgentId,
    )!;
    const formerId = player.id;
    world.mandate = 8;
    const spider = world.spiders[0]!;
    spider.visible = true;
    spider.nextArrivalTick = 0;
    spider.position = { ...player.position };
    player.integrity = 0.05;
    stepWorld(world);
    expect(world.playerAgentId).not.toBe(formerId);
    expect(world.mandate).toBeLessThan(8);
    expect(world.eventLog.some((item) => item.type === "succession")).toBe(
      true,
    );
  });
});
