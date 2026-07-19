import { expect, it } from "vitest";
import { createWorld, stepWorld } from "../src";

it("ejecuta miles de ticks sin NaN ni crecimiento descontrolado", () => {
  const world = createWorld(0xc0ffee);
  for (let i = 0; i < 12_000; i += 1) {
    if (world.status !== "playing") {
      world.status = "playing";
      world.statusReason = "";
    }
    stepWorld(world);
  }
  for (const agent of world.agents) {
    expect(Number.isFinite(agent.position.x)).toBe(true);
    expect(Number.isFinite(agent.position.z)).toBe(true);
    expect(Number.isFinite(agent.energy)).toBe(true);
  }
  expect(world.pheromones.length).toBeLessThan(500);
  expect(world.eventLog.length).toBeLessThanOrEqual(80);
  expect(world.agents.length).toBeLessThan(250);
});
