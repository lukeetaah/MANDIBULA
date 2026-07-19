import {
  checksumWorld,
  restoreSnapshot,
  serializeSnapshot,
  stepWorld,
  type SimCommand,
  type WorldState,
} from "@mandibula/simulation";

export interface CommandBatch {
  matchId: string;
  fromTick: number;
  toTick: number;
  commands: SimCommand[];
  checksumBefore: string;
}

export interface AuthoritySnapshot {
  tick: number;
  checksum: string;
  snapshot: string;
}

export interface MatchAuthorityAdapter {
  submitCommands(batch: CommandBatch): Promise<void>;
  acknowledgeTick(
    matchId: string,
    playerId: string,
    tick: number,
    checksum: string,
  ): Promise<void>;
  requestSnapshot(
    matchId: string,
    afterTick: number,
  ): Promise<AuthoritySnapshot>;
  publishSnapshot(matchId: string, snapshot: AuthoritySnapshot): Promise<void>;
}

export class LocalAuthorityAdapter implements MatchAuthorityAdapter {
  #snapshot: AuthoritySnapshot;
  readonly batches: CommandBatch[] = [];

  constructor(world: WorldState) {
    this.#snapshot = {
      tick: world.tick,
      checksum: checksumWorld(world),
      snapshot: serializeSnapshot(world),
    };
  }

  async submitCommands(batch: CommandBatch) {
    this.batches.push(structuredClone(batch));
  }
  async acknowledgeTick(
    _matchId: string,
    _playerId: string,
    _tick: number,
    _checksum: string,
  ) {
    return;
  }
  async requestSnapshot(_matchId: string, afterTick: number) {
    if (this.#snapshot.tick < afterTick)
      throw new Error("No hay snapshot suficientemente reciente");
    return structuredClone(this.#snapshot);
  }
  async publishSnapshot(_matchId: string, snapshot: AuthoritySnapshot) {
    this.#snapshot = structuredClone(snapshot);
  }
}

export function advanceLockstep(
  world: WorldState,
  batch: CommandBatch,
): { world: WorldState; checksum: string } {
  if (batch.checksumBefore !== checksumWorld(world))
    throw new Error("Checksum previo divergente");
  const byTick = new Map<number, SimCommand[]>();
  for (const command of batch.commands)
    byTick.set(command.tick, [...(byTick.get(command.tick) ?? []), command]);
  while (world.tick <= batch.toTick)
    stepWorld(world, byTick.get(world.tick) ?? []);
  return { world, checksum: checksumWorld(world) };
}

export function verifyAuthoritySnapshot(
  snapshot: AuthoritySnapshot,
): WorldState {
  const world = restoreSnapshot(snapshot.snapshot);
  if (
    world.tick !== snapshot.tick ||
    checksumWorld(world) !== snapshot.checksum
  )
    throw new Error("Snapshot de autoridad inválido");
  return world;
}
