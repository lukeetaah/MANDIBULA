import { describe, expect, it } from "vitest";
import { createWorld } from "@mandibula/simulation";
import { assessPredator } from "../src";

describe("bots", () => {
  it("un bot conservador no enfrenta sin cálculo a la dominante", () => {
    const world = createWorld(44);
    const dominant = world.spiders.find((spider) => spider.dominant)!;
    const assessment = assessPredator(world, dominant, "conservative");
    expect(["avoid", "request-truce"]).toContain(assessment.decision);
    expect(assessment.estimatedLosses).toBeGreaterThan(0);
  });
});
