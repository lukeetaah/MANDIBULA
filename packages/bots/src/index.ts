import type { Spider, WorldState } from "@mandibula/simulation";

export type BotProfile =
  | "conservative"
  | "expansive"
  | "forager"
  | "territorial"
  | "opportunist"
  | "aggressive"
  | "adaptive";
export type PredatorDecision =
  "avoid" | "request-truce" | "harass" | "expel" | "exploit-chaos";

export interface BotAssessment {
  decision: PredatorDecision;
  utility: number;
  estimatedLosses: number;
  reason: string;
}

export function assessPredator(
  world: WorldState,
  spider: Spider,
  profile: BotProfile = "adaptive",
): BotAssessment {
  const visibleForce = world.agents.filter(
    (agent) => agent.faction === "rival" && agent.alive,
  ).length;
  const threat =
    (spider.dominant ? 2.4 : 1) * spider.mobility * (0.5 + spider.hunger);
  const force = visibleForce / 30;
  const terrainValue =
    0.35 + (Math.abs(spider.position.x - 37) < 12 ? 0.45 : 0);
  const riskTolerance =
    profile === "aggressive" ? 1.35 : profile === "conservative" ? 0.62 : 0.92;
  const winChance = Math.max(
    0.02,
    Math.min(0.95, (force * riskTolerance) / (threat + 0.25)),
  );
  const estimatedLosses = Math.ceil(
    (threat * (spider.dominant ? 15 : 6)) / riskTolerance,
  );
  if (spider.dominant && winChance < 0.45)
    return {
      decision: "request-truce",
      utility: terrainValue,
      estimatedLosses,
      reason: "amenaza dominante; preservar fuerza",
    };
  if (winChance < 0.3)
    return {
      decision: "avoid",
      utility: 1 - terrainValue,
      estimatedLosses,
      reason: "la evasión cuesta menos que el sector",
    };
  if (profile === "opportunist" && world.colonyBiomass < world.rivalBiomass)
    return {
      decision: "exploit-chaos",
      utility: 0.72,
      estimatedLosses: 0,
      reason: "el depredador presiona al rival",
    };
  if (winChance > 0.72 && terrainValue > 0.6)
    return {
      decision: "expel",
      utility: winChance * terrainValue,
      estimatedLosses,
      reason: "sector valioso y superioridad suficiente",
    };
  return {
    decision: "harass",
    utility: winChance * 0.65,
    estimatedLosses: Math.ceil(estimatedLosses / 2),
    reason: "presión limitada con ruta de retirada",
  };
}
