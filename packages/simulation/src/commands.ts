import { z } from "zod";
import { PROTOCOL_VERSION, type SimCommand } from "./types";

const vec2 = z.object({
  x: z.number().finite().min(-1_000).max(1_000),
  z: z.number().finite().min(-1_000).max(1_000),
});
const base = z.object({
  protocolVersion: z.literal(PROTOCOL_VERSION),
  matchId: z.string().min(1).max(64),
  playerId: z.string().min(1).max(64),
  entityId: z.number().int().nonnegative(),
  tick: z.number().int().nonnegative(),
  sequence: z.number().int().nonnegative(),
});

export const commandSchema = z.discriminatedUnion("type", [
  base.extend({
    type: z.literal("MOVE"),
    payload: z.object({ direction: vec2, sprint: z.boolean().optional() }),
  }),
  base.extend({ type: z.literal("INTERACT"), payload: z.object({}) }),
  base.extend({ type: z.literal("PICK_UP"), payload: z.object({}) }),
  base.extend({ type: z.literal("DROP"), payload: z.object({}) }),
  base.extend({ type: z.literal("CUT"), payload: z.object({}) }),
  base.extend({
    type: z.literal("HARVEST"),
    payload: z.object({ targetId: z.number().int().nonnegative() }),
  }),
  base.extend({
    type: z.literal("DIG"),
    payload: z.object({ position: vec2 }),
  }),
  base.extend({
    type: z.literal("ATTACK"),
    payload: z.object({ targetId: z.number().int().nonnegative() }),
  }),
  base.extend({ type: z.literal("RETREAT"), payload: z.object({}) }),
  base.extend({
    type: z.literal("EMIT_PHEROMONE"),
    payload: z.object({
      position: vec2,
      radius: z.number().min(1).max(18).optional(),
      intensity: z.number().min(0.05).max(1).optional(),
      pheromone: z
        .enum(["forage", "alarm", "home", "avoid", "recruit"])
        .optional(),
    }),
  }),
  base.extend({
    type: z.literal("REINFORCE_TRAIL"),
    payload: z.object({ position: vec2 }),
  }),
  base.extend({
    type: z.literal("CANCEL_SIGNAL"),
    payload: z.object({ position: vec2 }),
  }),
  base.extend({
    type: z.literal("ASSIGN_PRIORITY"),
    payload: z.object({ position: vec2 }),
  }),
  base.extend({
    type: z.literal("FORM_EXPEDITION"),
    payload: z.object({ position: vec2 }),
  }),
  base.extend({ type: z.literal("RETURN_TO_NEST"), payload: z.object({}) }),
]);

export function parseCommand(input: unknown): SimCommand {
  return commandSchema.parse(input) as SimCommand;
}
