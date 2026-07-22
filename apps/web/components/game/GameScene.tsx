"use client";

import { Line, useTexture } from "@react-three/drei";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type {
  Agent,
  PheromoneField,
  ResourcePatch,
} from "@mandibula/simulation";
import { useGameStore } from "@/lib/game-store";

const factionColors: Record<Agent["faction"], string> = {
  acromyrmex: "#17130f",
  rival: "#6d241b",
  vespula: "#e5b23f",
  bombus: "#d56d2d",
  porotermes: "#d8c8a0",
  npc: "#4d6b55",
};

const signalColors = {
  forage: "#b9db66",
  alarm: "#ff684e",
  home: "#f4d99a",
  avoid: "#b783d7",
  recruit: "#56d5ce",
} as const;

function RenderBudget() {
  const { invalidate } = useThree();
  const reducedMotion = useGameStore((state) => state.settings.reducedMotion);
  const setFps = useGameStore((state) => state.setFps);
  const sample = useRef({ at: performance.now(), frames: 0 });
  useEffect(() => {
    const interval = window.setInterval(
      () => {
        if (!document.hidden) invalidate();
      },
      1000 / (reducedMotion ? 20 : 30),
    );
    return () => window.clearInterval(interval);
  }, [invalidate, reducedMotion]);
  useFrame(() => {
    sample.current.frames += 1;
    const now = performance.now();
    if (now - sample.current.at >= 1000) {
      setFps(
        Math.round((sample.current.frames * 1000) / (now - sample.current.at)),
      );
      sample.current = { at: now, frames: 0 };
    }
  });
  return null;
}

function antPart(
  geometry: THREE.BufferGeometry,
  position: [number, number, number],
  rotation: [number, number, number] = [0, 0, 0],
  scale: [number, number, number] = [1, 1, 1],
) {
  const matrix = new THREE.Matrix4().compose(
    new THREE.Vector3(...position),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),
    new THREE.Vector3(...scale),
  );
  geometry.applyMatrix4(matrix);
  return geometry;
}

function faunaPart(
  geometry: THREE.BufferGeometry,
  color: string,
  position: [number, number, number],
  rotation: [number, number, number] = [0, 0, 0],
  scale: [number, number, number] = [1, 1, 1],
) {
  const shade = new THREE.Color(color);
  const colors = new Float32Array(geometry.getAttribute("position").count * 3);
  for (let index = 0; index < colors.length; index += 3) {
    colors[index] = shade.r;
    colors[index + 1] = shade.g;
    colors[index + 2] = shade.b;
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  return antPart(geometry, position, rotation, scale);
}

function createAntGeometry() {
  const parts: THREE.BufferGeometry[] = [
    antPart(
      new THREE.SphereGeometry(0.18, 8, 6),
      [0, 0.015, 0.24],
      [0, 0, 0],
      [0.8, 0.68, 1],
    ),
    antPart(
      new THREE.SphereGeometry(0.17, 8, 6),
      [0, 0, -0.01],
      [0, 0, 0],
      [0.7, 0.7, 0.85],
    ),
    antPart(
      new THREE.SphereGeometry(0.22, 9, 7),
      [0, 0.025, -0.31],
      [0, 0, 0],
      [1, 0.78, 1.35],
    ),
  ];
  for (const row of [-1, 0, 1]) {
    for (const side of [-1, 1]) {
      parts.push(
        antPart(
          new THREE.BoxGeometry(0.035, 0.025, 0.48),
          [side * 0.2, -0.02, row * 0.17 - 0.03],
          [0, side * (0.68 + row * 0.12), side * 0.12],
        ),
      );
    }
  }
  for (const side of [-1, 1]) {
    parts.push(
      antPart(
        new THREE.BoxGeometry(0.018, 0.018, 0.35),
        [side * 0.08, 0.07, 0.42],
        [0.18, side * 0.32, side * -0.28],
      ),
    );
  }
  const merged = mergeGeometries(parts, false);
  for (const part of parts) part.dispose();
  if (!merged) throw new Error("No se pudo construir la geometría de obrera");
  merged.computeVertexNormals();
  return merged;
}

const ANT_GEOMETRY = createAntGeometry();
const CARGO_GEOMETRY = new THREE.CircleGeometry(0.38, 7);

function CargoLoads() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  useFrame(() => {
    if (!mesh.current) return;
    const agents = useGameStore.getState().world.agents;
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion().setFromEuler(
      new THREE.Euler(0.08, 0.35, 0.15),
    );
    const scale = new THREE.Vector3(1, 1, 1);
    const hiddenScale = new THREE.Vector3(0, 0, 0);
    let cargoIndex = 0;

    for (const agent of agents) {
      if (agent.kind !== "ant") continue;

      if (agent.carrying > 0 && agent.alive) {
        position.set(
          agent.position.x,
          Math.hypot(agent.position.x, agent.position.z) < 4.8 ? 1.08 : 0.49,
          agent.position.z,
        );
        matrix.compose(position, quaternion, scale);
        mesh.current.setMatrixAt(cargoIndex, matrix);
      } else {
        matrix.compose(position, quaternion, hiddenScale);
        mesh.current.setMatrixAt(cargoIndex, matrix);
      }
      cargoIndex++;
    }
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={mesh} args={[CARGO_GEOMETRY, undefined, 91]} castShadow>
      <meshStandardMaterial
        color="#71934c"
        roughness={0.95}
        side={THREE.DoubleSide}
      />
    </instancedMesh>
  );
}

function AntColony() {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const selectedIds = useGameStore((state) => state.selectedIds);
  const selectUnits = useGameStore((state) => state.selectUnits);

  const prevPositions = useRef<Map<number, THREE.Vector3>>(new Map());

  useFrame((_, delta) => {
    if (!mesh.current) return;
    const world = useGameStore.getState().world;
    const agents = world.agents;

    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const color = new THREE.Color();

    let antIndex = 0;

    for (const agent of agents) {
      if (agent.kind !== "ant") continue;

      const prevPos =
        prevPositions.current.get(agent.id) ||
        new THREE.Vector3(agent.position.x, 0, agent.position.z);

      // Interpolate position based on velocity (extrapolation for smoothness)
      if (agent.alive && !world.paused) {
        prevPos.x = THREE.MathUtils.lerp(
          prevPos.x,
          agent.position.x + agent.velocity.x * delta * 10,
          0.5,
        );
        prevPos.z = THREE.MathUtils.lerp(
          prevPos.z,
          agent.position.z + agent.velocity.z * delta * 10,
          0.5,
        );
      } else {
        prevPos.x = agent.position.x;
        prevPos.z = agent.position.z;
      }
      prevPositions.current.set(agent.id, prevPos);

      const atMound =
        agent.faction === "acromyrmex" &&
        Math.hypot(prevPos.x, prevPos.z) < 4.8;

      position.set(
        prevPos.x,
        agent.alive ? (atMound ? 0.78 : 0.18) : 0.07,
        prevPos.z,
      );

      quaternion.setFromEuler(
        new THREE.Euler(
          0,
          Math.atan2(agent.velocity.x, agent.velocity.z),
          agent.alive ? 0 : Math.PI / 2,
        ),
      );

      const cLevel = world.colonyLevel || 1;
      const levelScale = 1 + (cLevel - 1) * 0.14;
      const size = agent.alive
        ? (agent.faction === "acromyrmex" ? 1 : 0.88) * levelScale
        : 0.42;
      scale.setScalar(size);

      matrix.compose(position, quaternion, scale);
      mesh.current.setMatrixAt(antIndex, matrix);

      const levelColor =
        cLevel >= 3
          ? "#e59866"
          : cLevel === 2
            ? "#d4ac0d"
            : factionColors[agent.faction] || "#17130f";
      color.set(agent.alive ? levelColor : "#30291f");
      mesh.current.setColorAt(antIndex, color);

      antIndex++;
    }

    mesh.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor)
      mesh.current.instanceColor.needsUpdate = true;
  });

  const onPointerDown = (event: ThreeEvent<PointerEvent>) => {
    if (event.button !== 0 || event.instanceId === undefined) return;
    const world = useGameStore.getState().world;
    const agents = world.agents.filter((a) => a.kind === "ant");
    const agent = agents[event.instanceId];
    const playerFaction = world.playerFaction || "acromyrmex";
    if (!agent?.alive || agent.faction !== playerFaction) {
      if (agent?.alive) useGameStore.getState().inspect("agent", agent.id);
      return;
    }
    event.stopPropagation();

    if (event.nativeEvent.detail === 2) {
      const radiusSq = 35 * 35; // Select units within 35 units
      const toSelect = agents
        .filter(
          (a) =>
            a.alive &&
            a.faction === playerFaction &&
            Math.pow(a.position.x - agent.position.x, 2) +
              Math.pow(a.position.z - agent.position.z, 2) <
              radiusSq,
        )
        .map((a) => a.id);
      selectUnits(toSelect, event.nativeEvent.shiftKey);
    } else {
      selectUnits([agent.id], event.nativeEvent.shiftKey);
    }
  };

  return (
    <>
      <instancedMesh
        ref={mesh}
        args={[ANT_GEOMETRY, undefined, 91]} // 1 player + 62 acromyrmex + 28 rival = 91 ants
        castShadow
        onPointerDown={onPointerDown}
      >
        <meshStandardMaterial color="#ffffff" roughness={0.76} flatShading />
      </instancedMesh>
      {useGameStore
        .getState()
        .world.agents.filter(
          (agent) => selectedIds.includes(agent.id) && agent.alive,
        )
        .map((agent) => (
          <mesh
            key={`selected-${agent.id}`}
            position={[agent.position.x, 0.045, agent.position.z]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <ringGeometry args={[0.42, 0.5, 24]} />
            <meshBasicMaterial
              color="#d9f27d"
              transparent
              opacity={0.9}
              depthWrite={false}
            />
          </mesh>
        ))}
      <CargoLoads />
    </>
  );
}

type FaunaKind = Exclude<Agent["kind"], "ant">;

function createFaunaGeometry(kind: FaunaKind) {
  const sphere = () => new THREE.SphereGeometry(0.5, 8, 6);
  const parts: THREE.BufferGeometry[] = [];
  const add = (
    geometry: THREE.BufferGeometry,
    color: string,
    position: [number, number, number],
    rotation: [number, number, number] = [0, 0, 0],
    scale: [number, number, number] = [1, 1, 1],
  ) => parts.push(faunaPart(geometry, color, position, rotation, scale));

  if (kind === "wasp") {
    add(sphere(), "#211d16", [0, 0.02, 0.58], [0, 0, 0], [0.52, 0.5, 0.58]);
    add(sphere(), "#d7aa30", [0, 0.02, 0.08], [0, 0, 0], [0.62, 0.56, 0.7]);
    add(sphere(), "#211d16", [0, 0, -0.52], [0, 0, 0], [0.48, 0.48, 0.9]);
    add(
      new THREE.BoxGeometry(0.34, 0.05, 0.72),
      "#d9e6d5",
      [0.35, 0.2, -0.02],
      [0.08, -0.22, -0.18],
    );
    add(
      new THREE.BoxGeometry(0.34, 0.05, 0.72),
      "#d9e6d5",
      [-0.35, 0.2, -0.02],
      [0.08, 0.22, 0.18],
    );
  } else if (kind === "bumblebee") {
    add(sphere(), "#241d1a", [0, 0.02, 0.5], [0, 0, 0], [0.62, 0.58, 0.6]);
    add(sphere(), "#d66b2e", [0, 0.04, -0.02], [0, 0, 0], [0.78, 0.7, 0.82]);
    add(sphere(), "#b54f25", [0, 0.03, -0.63], [0, 0, 0], [0.68, 0.62, 0.86]);
    add(
      new THREE.BoxGeometry(0.54, 0.06, 0.82),
      "#cfe2df",
      [0.46, 0.24, -0.08],
      [0.06, -0.3, -0.18],
    );
    add(
      new THREE.BoxGeometry(0.54, 0.06, 0.82),
      "#cfe2df",
      [-0.46, 0.24, -0.08],
      [0.06, 0.3, 0.18],
    );
  } else if (kind === "termite") {
    add(sphere(), "#8d6541", [0, 0.01, 0.64], [0, 0, 0], [0.58, 0.48, 0.58]);
    add(sphere(), "#dccca4", [0, 0.01, 0.12], [0, 0, 0], [0.58, 0.46, 0.68]);
    add(sphere(), "#c8b98f", [0, 0.01, -0.55], [0, 0, 0], [0.62, 0.46, 0.9]);
    add(
      new THREE.ConeGeometry(0.1, 0.4, 5),
      "#533b2b",
      [0.16, 0, 1.02],
      [Math.PI / 2, 0, -0.18],
    );
    add(
      new THREE.ConeGeometry(0.1, 0.4, 5),
      "#533b2b",
      [-0.16, 0, 1.02],
      [Math.PI / 2, 0, 0.18],
    );
  } else if (kind === "fly") {
    add(sphere(), "#366c59", [0, 0, 0.12], [0, 0, 0], [0.55, 0.5, 0.78]);
    add(sphere(), "#222925", [0, 0, 0.58], [0, 0, 0], [0.5, 0.45, 0.5]);
    add(sphere(), "#9e352e", [0.3, 0.08, 0.68], [0, 0, 0], [0.3, 0.3, 0.25]);
    add(sphere(), "#9e352e", [-0.3, 0.08, 0.68], [0, 0, 0], [0.3, 0.3, 0.25]);
    add(
      new THREE.BoxGeometry(0.44, 0.045, 0.72),
      "#c9dedb",
      [0.4, 0.18, 0],
      [0.08, -0.28, -0.12],
    );
    add(
      new THREE.BoxGeometry(0.44, 0.045, 0.72),
      "#c9dedb",
      [-0.4, 0.18, 0],
      [0.08, 0.28, 0.12],
    );
  } else {
    add(sphere(), "#2c2a20", [0, 0, 0.48], [0, 0, 0], [0.58, 0.42, 0.58]);
    add(
      sphere(),
      "#425a3b",
      [0.27, 0.08, -0.15],
      [0, 0, 0.08],
      [0.56, 0.46, 1],
    );
    add(
      sphere(),
      "#536847",
      [-0.27, 0.08, -0.15],
      [0, 0, -0.08],
      [0.56, 0.46, 1],
    );
    add(new THREE.BoxGeometry(0.045, 0.1, 0.94), "#20221b", [0, 0.28, -0.16]);
  }

  const merged = mergeGeometries(parts, false);
  for (const part of parts) part.dispose();
  if (!merged) throw new Error(`No se pudo construir la geometria ${kind}`);
  merged.computeVertexNormals();
  return merged;
}

const FAUNA_KINDS: FaunaKind[] = [
  "wasp",
  "bumblebee",
  "termite",
  "fly",
  "beetle",
];
const FAUNA_GEOMETRY = Object.fromEntries(
  FAUNA_KINDS.map((kind) => [kind, createFaunaGeometry(kind)]),
) as Record<FaunaKind, THREE.BufferGeometry>;
const FAUNA_SCALE: Record<FaunaKind, number> = {
  wasp: 0.62,
  bumblebee: 0.78,
  termite: 0.52,
  fly: 0.5,
  beetle: 0.63,
};

const FaunaInstances = memo(function FaunaInstances({
  kind,
}: {
  kind: FaunaKind;
}) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const inspect = useGameStore((state) => state.inspect);

  const prevPositions = useRef<Map<number, THREE.Vector3>>(new Map());

  useFrame((_, delta) => {
    if (!mesh.current) return;
    const world = useGameStore.getState().world;
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();

    let faunaIndex = 0;
    for (const agent of world.agents) {
      if (agent.kind !== kind) continue;

      const prevPos =
        prevPositions.current.get(agent.id) ||
        new THREE.Vector3(agent.position.x, 0, agent.position.z);

      if (agent.alive && !world.paused) {
        prevPos.x = THREE.MathUtils.lerp(
          prevPos.x,
          agent.position.x + agent.velocity.x * delta * 10,
          0.5,
        );
        prevPos.z = THREE.MathUtils.lerp(
          prevPos.z,
          agent.position.z + agent.velocity.z * delta * 10,
          0.5,
        );
      } else {
        prevPos.x = agent.position.x;
        prevPos.z = agent.position.z;
      }
      prevPositions.current.set(agent.id, prevPos);

      const ground = kind === "termite" || kind === "beetle";
      const altitude = ground
        ? kind === "beetle"
          ? 0.3
          : 0.22
        : kind === "bumblebee"
          ? 1.8 + Math.sin(agent.id) * 0.22
          : 2.15 + Math.sin(agent.id * 2.1) * 0.28;

      position.set(prevPos.x, agent.alive ? altitude : 0.1, prevPos.z);

      quaternion.setFromEuler(
        new THREE.Euler(
          0,
          Math.atan2(agent.velocity.x, agent.velocity.z),
          agent.alive ? 0 : Math.PI / 2,
        ),
      );

      scale.setScalar(FAUNA_SCALE[kind] * (agent.alive ? 1 : 0.45));
      matrix.compose(position, quaternion, scale);
      mesh.current.setMatrixAt(faunaIndex, matrix);

      faunaIndex++;
    }
    mesh.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={mesh}
      args={[FAUNA_GEOMETRY[kind], undefined, 8]} // max 8 per kind
      onPointerDown={(event) => {
        if (event.button !== 0 || event.instanceId === undefined) return;
        const world = useGameStore.getState().world;
        const agents = world.agents.filter((a) => a.kind === kind);
        const agent = agents[event.instanceId];
        if (!agent?.alive) return;
        event.stopPropagation();
        inspect("agent", agent.id);
      }}
    >
      <meshStandardMaterial vertexColors roughness={0.72} flatShading />
    </instancedMesh>
  );
});

function FaunaPopulation() {
  const observed = useGameStore((state) => state.observed);

  // Use state without reactively triggering every tick
  useGameStore.getState();

  const observedRef = useRef<THREE.Mesh>(null);
  useFrame(() => {
    if (observedRef.current && observed?.kind === "agent") {
      const world = useGameStore.getState().world;
      const agent = world.agents.find((a) => a.id === observed.id);
      if (agent && agent.alive) {
        observedRef.current.position.set(
          agent.position.x,
          0.08,
          agent.position.z,
        );
        observedRef.current.visible = true;
      } else {
        observedRef.current.visible = false;
      }
    } else if (observedRef.current) {
      observedRef.current.visible = false;
    }
  });

  return (
    <>
      {FAUNA_KINDS.map((kind) => {
        return <FaunaInstances key={kind} kind={kind} />;
      })}
      <mesh ref={observedRef} rotation={[-Math.PI / 2, 0, 0]} visible={false}>
        <ringGeometry args={[0.72, 0.86, 24]} />
        <meshBasicMaterial color="#65d8cf" transparent opacity={0.9} />
      </mesh>
    </>
  );
}

function SpiderBody({ id }: { id: number }) {
  const inspect = useGameStore((state) => state.inspect);
  const observed = useGameStore((state) => state.observed);
  const group = useRef<THREE.Group>(null);
  const [staticProps, setStaticProps] = useState<{
    dominant: boolean;
    guild: string;
    visible: boolean;
    color: string;
    scale: number;
  } | null>(null);

  useEffect(() => {
    const spider = useGameStore
      .getState()
      .world.spiders.find((s) => s.id === id);
    if (spider) {
      const scale = spider.dominant
        ? 2.2
        : spider.guild === "orb-weaver"
          ? 1.25
          : 1;
      const color = spider.dominant
        ? "#211819"
        : spider.guild === "orb-weaver"
          ? "#743b25"
          : "#4a3026";
      setStaticProps({
        dominant: spider.dominant,
        guild: spider.guild,
        visible: spider.visible,
        color,
        scale,
      });
    }
  }, [id]);

  useFrame(() => {
    if (!group.current) return;
    const world = useGameStore.getState().world;
    const spider = world.spiders.find((s) => s.id === id);
    if (!spider) return;

    group.current.visible = spider.visible;
    if (spider.visible && !world.paused) {
      group.current.position.x = THREE.MathUtils.lerp(
        group.current.position.x,
        spider.position.x,
        0.1,
      );
      group.current.position.z = THREE.MathUtils.lerp(
        group.current.position.z,
        spider.position.z,
        0.1,
      );
    } else if (spider.visible) {
      group.current.position.x = spider.position.x;
      group.current.position.z = spider.position.z;
    }
  });

  if (!staticProps) return null;
  const { scale, color } = staticProps;
  return (
    <group
      ref={group}
      position={[0, 0.28 * scale, 0]}
      scale={scale}
      onPointerDown={(event) => {
        if (event.button !== 0) return;
        event.stopPropagation();
        inspect("spider", id);
      }}
    >
      <mesh castShadow position={[0, 0, 0.24]} scale={[0.8, 0.65, 1]}>
        <sphereGeometry args={[0.38, 10, 7]} />
        <meshStandardMaterial color={color} roughness={0.82} flatShading />
      </mesh>
      <mesh castShadow position={[0, 0.04, -0.32]} scale={[1, 0.72, 1.25]}>
        <sphereGeometry args={[0.5, 12, 8]} />
        <meshStandardMaterial color={color} roughness={0.88} flatShading />
      </mesh>
      {Array.from({ length: 8 }, (_, index) => {
        const side = index < 4 ? -1 : 1;
        const row = index % 4;
        return (
          <mesh
            key={index}
            castShadow
            position={[side * (0.48 + row * 0.08), -0.02, 0.3 - row * 0.2]}
            rotation={[0, side * (0.62 + row * 0.15), Math.PI / 2]}
          >
            <capsuleGeometry args={[0.035, 0.78, 3, 5]} />
            <meshStandardMaterial color={color} roughness={0.9} flatShading />
          </mesh>
        );
      })}
      {observed?.kind === "spider" && observed.id === id && (
        <mesh position={[0, -0.18, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.9, 1.04, 32]} />
          <meshBasicMaterial color="#f06b4f" transparent opacity={0.92} />
        </mesh>
      )}
    </group>
  );
}

function Pheromone({ field }: { field: PheromoneField }) {
  const color = signalColors[field.type];
  const group = useRef<THREE.Group>(null);

  useFrame(({ clock }) => {
    if (!group.current) return;
    const pulse = 1 + Math.sin(clock.elapsedTime * 2 + field.id) * 0.05;
    group.current.scale.setScalar(pulse);
  });

  return (
    <group ref={group} position={[field.position.x, 0.05, field.position.z]}>
      {[0.44, 0.72, 1].map((factor) => (
        <mesh
          key={factor}
          rotation={[-Math.PI / 2, 0, 0]}
          scale={field.radius * factor}
        >
          <ringGeometry args={[0.94, 1, 48]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={Math.max(0.04, field.intensity * (0.28 - factor * 0.06))}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}

function ProceduralTerrain() {
  const paintedGround = useTexture("/art/patagonia-ground-painted.webp");
  const grassRef = useRef<THREE.InstancedMesh>(null);
  const rockRef = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => {
    const plane = new THREE.PlaneGeometry(160, 140, 44, 36);
    plane.rotateX(-Math.PI / 2);
    const positions = plane.getAttribute("position");
    const colors: number[] = [];
    const steppe = new THREE.Color("#766747");
    const gravel = new THREE.Color("#a28d62");
    const mallin = new THREE.Color("#536845");
    const basalt = new THREE.Color("#3f423a");
    for (let index = 0; index < positions.count; index += 1) {
      const x = positions.getX(index);
      const z = positions.getZ(index);
      const noise =
        (Math.sin(x * 0.29) + Math.cos(z * 0.23) + Math.sin((x + z) * 0.11)) /
          6 +
        0.5;
      const wetAxis = 8 + Math.sin(x * 0.075) * 5;
      const wetness = Math.max(0, 1 - Math.abs(z - wetAxis) / 9);
      const basaltRise =
        Math.exp(-((x + 31) ** 2 + (z + 20) ** 2) / 230) +
        Math.exp(-((x - 37) ** 2 + (z + 27) ** 2) / 150);
      const height = (noise - 0.5) * 0.18 + basaltRise * 0.44 - wetness * 0.08;
      positions.setY(index, height);
      const color = steppe.clone().lerp(gravel, noise * 0.55);
      if (wetness > 0.18) color.lerp(mallin, wetness * 0.72);
      if (basaltRise > 0.3) color.lerp(basalt, Math.min(0.86, basaltRise));
      colors.push(color.r, color.g, color.b);
    }
    plane.computeVertexNormals();
    plane.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    return plane;
  }, []);

  useEffect(() => {
    paintedGround.wrapS = THREE.RepeatWrapping;
    paintedGround.wrapT = THREE.RepeatWrapping;
    paintedGround.repeat.set(2.7, 2.35);
    paintedGround.colorSpace = THREE.SRGBColorSpace;
    paintedGround.anisotropy = 2;
    paintedGround.needsUpdate = true;
  }, [paintedGround]);

  useEffect(() => {
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3();
    for (let index = 0; index < 180; index += 1) {
      const x = ((index * 47) % 113) - 56;
      const z = ((index * 71) % 97) - 48;
      const mallinBand = Math.abs(z - (8 + Math.sin(x * 0.075) * 5)) < 10;
      const height = (mallinBand ? 1.05 : 0.62) + (index % 7) * 0.16;
      position.set(x, height / 2, z);
      quaternion.setFromEuler(
        new THREE.Euler(
          (index % 3) * 0.05,
          index * 1.71,
          ((index % 5) - 2) * 0.05,
        ),
      );
      scale.set(0.045 + (index % 4) * 0.012, height, 0.045);
      matrix.compose(position, quaternion, scale);
      grassRef.current?.setMatrixAt(index, matrix);
    }
    grassRef.current!.instanceMatrix.needsUpdate = true;
    for (let index = 0; index < 42; index += 1) {
      const x = ((index * 61) % 107) - 53;
      const z = ((index * 37) % 89) - 44;
      const size = 0.32 + (index % 9) * 0.11;
      position.set(x, size * 0.22, z);
      quaternion.setFromEuler(new THREE.Euler(0, index * 0.81, 0));
      scale.set(size * 1.3, size * 0.42, size);
      matrix.compose(position, quaternion, scale);
      rockRef.current?.setMatrixAt(index, matrix);
    }
    rockRef.current!.instanceMatrix.needsUpdate = true;
  }, []);

  return (
    <>
      <mesh geometry={geometry} receiveShadow>
        <meshStandardMaterial
          map={paintedGround}
          roughness={1}
          metalness={0}
          flatShading
        />
      </mesh>
      {[0, 1, 2, 3].map((ring) => (
        <Line
          key={`contour-${ring}`}
          points={Array.from({ length: 49 }, (_, index) => {
            const angle = (index / 48) * Math.PI * 2;
            return [
              -31 + Math.cos(angle) * (7 + ring * 2.1),
              0.05 + ring * 0.015,
              -20 + Math.sin(angle) * (4.5 + ring * 1.35),
            ] as [number, number, number];
          })}
          color="#d1bd88"
          lineWidth={0.45}
          transparent
          opacity={0.2}
        />
      ))}
      <Line
        points={Array.from({ length: 33 }, (_, index) => {
          const x = -62 + index * 4;
          return [x, 0.065, 8 + Math.sin(x * 0.075) * 5] as [
            number,
            number,
            number,
          ];
        })}
        color="#92ad76"
        lineWidth={3}
        transparent
        opacity={0.22}
      />
      {[
        [-25, -15, 14, "#625635"],
        [22, 16, 18, "#71603a"],
        [30, -24, 12, "#4b452c"],
        [-31, 28, 16, "#756641"],
      ].map(([x, z, radius, color], index) => (
        <mesh
          key={index}
          position={[Number(x), 0.012, Number(z)]}
          rotation={[-Math.PI / 2, 0, index * 0.7]}
          scale={[1.6, 1, 1]}
        >
          <circleGeometry args={[Number(radius), 36]} />
          <meshStandardMaterial
            color={String(color)}
            roughness={1}
            transparent
            opacity={0.22}
          />
        </mesh>
      ))}
      <instancedMesh
        ref={grassRef}
        args={[undefined, undefined, 180]}
        castShadow
      >
        <coneGeometry args={[1, 1, 4]} />
        <meshStandardMaterial color="#63713c" roughness={1} />
      </instancedMesh>
      <instancedMesh
        ref={rockRef}
        args={[undefined, undefined, 42]}
        castShadow
        receiveShadow
      >
        <dodecahedronGeometry args={[1, 0]} />
        <meshStandardMaterial color="#69614d" roughness={0.96} />
      </instancedMesh>
    </>
  );
}

function Nest() {
  const trailAngles = [-0.2, 0.85, 2.15, 3.55, 4.7];
  const moundLobes = [
    [-1.5, 0.2, 2.2, 1.3],
    [0.1, 0.45, 2.8, 1.6],
    [1.7, -0.4, 2.1, 1.25],
    [-0.7, -1.35, 2.4, 1.1],
    [0.6, 1.45, 2.25, 1.15],
  ] as const;
  const entrances = [
    [-2.35, 0.35, 0.42],
    [1.7, 1.15, 0.36],
    [1.9, -1.25, 0.32],
  ] as const;
  return (
    <group>
      {trailAngles.map((angle) => (
        <Line
          key={angle}
          points={[
            [Math.cos(angle) * 2.6, 0.035, Math.sin(angle) * 2.6],
            [Math.cos(angle) * 7.5, 0.035, Math.sin(angle) * 7.5],
            [Math.cos(angle + 0.08) * 13, 0.035, Math.sin(angle + 0.08) * 13],
          ]}
          color="#29251a"
          lineWidth={5}
          transparent
          opacity={0.34}
        />
      ))}
      {moundLobes.map(([x, z, width, depth], index) => (
        <mesh
          key={`mound-${index}`}
          position={[x, 0.18 + (index % 2) * 0.08, z]}
          rotation={[0, index * 0.74, 0]}
          scale={[width, 0.55 + (index % 3) * 0.08, depth]}
          receiveShadow
        >
          <dodecahedronGeometry args={[1, 1]} />
          <meshStandardMaterial
            color={index % 2 ? "#51452f" : "#5c4d31"}
            roughness={1}
          />
        </mesh>
      ))}
      {Array.from({ length: 26 }, (_, index) => {
        const angle = index * 2.399963;
        const radius = 0.7 + (index % 7) * 0.42;
        return (
          <mesh
            key={`thatch-${index}`}
            position={[
              Math.cos(angle) * radius,
              0.55 + (index % 5) * 0.055,
              Math.sin(angle) * radius * 0.82,
            ]}
            rotation={[0.2, angle, (index % 3) * 0.18]}
          >
            <boxGeometry args={[0.08, 0.055, 0.7 + (index % 4) * 0.12]} />
            <meshStandardMaterial color="#88733e" roughness={1} />
          </mesh>
        );
      })}
      {entrances.map(([x, z, size], index) => (
        <mesh
          key={`entrance-${index}`}
          position={[x, 0.66, z]}
          rotation={[-Math.PI / 2, 0, index * 0.7]}
        >
          <circleGeometry args={[size, 18]} />
          <meshStandardMaterial color="#090806" roughness={1} />
        </mesh>
      ))}
      <pointLight
        position={[0, 1.3, 0]}
        color="#b9d77a"
        intensity={0.32}
        distance={8}
      />
    </group>
  );
}

function UndergroundNest() {
  const nest = useGameStore((state) => state.world.nest);
  const chambers = [
    { key: "fungus", at: [0, 0] as const, color: "#9bb968", size: 3.1 },
    { key: "nursery", at: [7, 2] as const, color: "#d7b982", size: 2.25 },
    {
      key: "ventilation",
      at: [-7, 3] as const,
      color: "#7ab7aa",
      size: 2,
    },
    { key: "waste", at: [-5, -5] as const, color: "#9a6651", size: 1.8 },
  ] as const;
  return (
    <group>
      <mesh position={[0, -0.18, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[18, 64]} />
        <meshStandardMaterial color="#241b14" roughness={1} />
      </mesh>
      {chambers.slice(1).map((chamber) => (
        <Line
          key={`tunnel-${chamber.key}`}
          points={[
            [0, 0.18, 0],
            [chamber.at[0] * 0.52, 0.2, chamber.at[1] * 0.4],
            [chamber.at[0], 0.18, chamber.at[1]],
          ]}
          color="#bc9662"
          lineWidth={12 + nest.chambers[chamber.key] * 2}
          transparent
          opacity={0.3}
        />
      ))}
      {chambers.map((chamber) => {
        const level = nest.chambers[chamber.key];
        const size = chamber.size + level * 0.38;
        return (
          <group key={chamber.key} position={[chamber.at[0], 0, chamber.at[1]]}>
            <mesh scale={[size, 0.56, size * 0.75]}>
              <sphereGeometry args={[1, 24, 14]} />
              <meshStandardMaterial
                color="#33251b"
                emissive={chamber.color}
                emissiveIntensity={0.1 + level * 0.035}
                roughness={1}
              />
            </mesh>
            <Line
              points={Array.from({ length: 33 }, (_, index) => {
                const angle = (index / 32) * Math.PI * 2;
                return [
                  Math.cos(angle) * size * 0.92,
                  0.43,
                  Math.sin(angle) * size * 0.68,
                ] as [number, number, number];
              })}
              color={chamber.color}
              lineWidth={1.2}
              transparent
              opacity={0.54}
            />
            {Array.from({ length: 5 + level * 3 }, (_, index) => {
              const angle = index * 2.399;
              return (
                <mesh
                  key={index}
                  position={[
                    Math.cos(angle) * size * 0.42,
                    0.48 + (index % 2) * 0.08,
                    Math.sin(angle) * size * 0.33,
                  ]}
                  scale={
                    chamber.key === "nursery"
                      ? [0.2, 0.08, 0.36]
                      : chamber.key === "ventilation"
                        ? [0.1, 0.1, 0.1]
                        : [0.24, 0.12, 0.2]
                  }
                >
                  <sphereGeometry args={[1, 10, 7]} />
                  <meshStandardMaterial color={chamber.color} roughness={0.9} />
                </mesh>
              );
            })}
          </group>
        );
      })}
      <mesh position={[4.7, 0.05, -5.2]} scale={[2.3, 0.7, 1.7]}>
        <sphereGeometry args={[1, 20, 12]} />
        <meshStandardMaterial
          color="#2c2018"
          emissive="#71573a"
          emissiveIntensity={0.13}
          roughness={1}
        />
      </mesh>
      <pointLight
        position={[0, 5, 0]}
        color="#d3b06e"
        intensity={5}
        distance={30}
      />
    </group>
  );
}

function ResourceNode({ resource }: { resource: ResourcePatch }) {
  const issueGather = useGameStore((state) => state.issueGather);
  if (resource.amount <= 0) return null;
  const pieces = Math.min(10, Math.ceil(resource.amount / 5));
  const gather = (event: ThreeEvent<PointerEvent>) => {
    if (event.button !== 2) return;
    event.stopPropagation();
    issueGather(resource.id, resource.position);
  };
  const color =
    resource.kind === "seed"
      ? "#c69a54"
      : resource.kind === "deadwood"
        ? "#533622"
        : resource.kind === "nectar"
          ? "#d45f4d"
          : "#73a54c";
  return (
    <group
      position={[resource.position.x, 0.09, resource.position.z]}
      onPointerDown={gather}
    >
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.04, 0]}>
        <ringGeometry args={[1.5, 1.62, 40]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.38}
          depthWrite={false}
        />
      </mesh>
      {Array.from({ length: pieces }, (_, index) => {
        const angle = index * 2.399;
        const radius = 0.25 + (index % 4) * 0.3;
        return (
          <mesh
            key={index}
            castShadow
            position={[
              Math.cos(angle) * radius,
              0.1 + (index % 2) * 0.04,
              Math.sin(angle) * radius,
            ]}
            rotation={[0.05, angle, resource.kind === "leaf" ? 0.18 : 0]}
          >
            {resource.kind === "seed" ? (
              <sphereGeometry args={[0.22, 8, 6]} />
            ) : resource.kind === "deadwood" ? (
              <boxGeometry args={[0.72, 0.2, 0.26]} />
            ) : resource.kind === "nectar" ? (
              <dodecahedronGeometry args={[0.24, 0]} />
            ) : (
              <circleGeometry args={[0.48, 7]} />
            )}
            <meshStandardMaterial
              color={color}
              roughness={0.88}
              side={THREE.DoubleSide}
            />
          </mesh>
        );
      })}
      <mesh position={[0, 0.65, 0]}>
        <octahedronGeometry args={[0.12, 0]} />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
}

function ResourceNodes() {
  const resources = useGameStore((state) => state.world.resources);
  return (
    <>
      {resources.map((resource) => (
        <ResourceNode key={resource.id} resource={resource} />
      ))}
    </>
  );
}

function SilkWeb({
  a,
  b,
  integrity,
}: {
  a: { x: number; z: number };
  b: { x: number; z: number };
  integrity: number;
}) {
  const centerX = (a.x + b.x) / 2;
  const centerZ = (a.z + b.z) / 2;
  const radius = Math.max(2.5, Math.hypot(b.x - a.x, b.z - a.z) / 2);
  const rotation = -Math.atan2(b.z - a.z, b.x - a.x);
  const opacity = 0.1 + integrity * 0.22;
  const geometry = useMemo(() => {
    const segments: number[] = [];
    const radialCount = 14;
    const squash = 0.64;
    const hub = { x: radius * 0.07, y: -radius * 0.035 };
    const rim = Array.from({ length: radialCount }, (_, index) => {
      const angle = (index / radialCount) * Math.PI * 2;
      const irregularity = 0.93 + ((index * 17) % 5) * 0.025;
      return {
        x: Math.cos(angle) * radius * irregularity,
        y: Math.sin(angle) * radius * squash * irregularity,
      };
    });
    const line = (x1: number, y1: number, x2: number, y2: number) =>
      segments.push(x1, y1, 0, x2, y2, 0);

    rim.forEach((point, index) => {
      const next = rim[(index + 1) % rim.length]!;
      line(point.x, point.y, next.x, next.y);
      line(hub.x, hub.y, point.x, point.y);
    });

    const spiralSamples = 132;
    let previous: { x: number; y: number } | undefined;
    for (let index = 0; index < spiralSamples; index += 1) {
      const progress = index / (spiralSamples - 1);
      const angle = progress * Math.PI * 12.2;
      const spiralRadius = radius * (0.09 + progress * 0.79);
      const point = {
        x: hub.x + Math.cos(angle) * spiralRadius,
        y: hub.y + Math.sin(angle) * spiralRadius * squash,
      };
      if (previous) line(previous.x, previous.y, point.x, point.y);
      previous = point;
    }

    [1, 4, 8, 11].forEach((index) => {
      const point = rim[index]!;
      const length = Math.hypot(point.x, point.y / squash) || 1;
      const dirX = point.x / length;
      const dirY = point.y / squash / length;
      // Normal anchor
      line(
        point.x,
        point.y,
        point.x + dirX * radius * 0.45,
        point.y + dirY * radius * 0.34,
      );

      // Ground anchors for the lower half
      if (point.y < 0) {
        line(point.x, point.y, point.x + dirX * radius * 1.5, -2.4);
      }
    });

    const result = new THREE.BufferGeometry();
    result.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(segments, 3),
    );
    result.computeBoundingSphere();
    return result;
  }, [radius]);
  return (
    <group position={[centerX, 2.4, centerZ]} rotation={[0, rotation, 0]}>
      <lineSegments geometry={geometry}>
        <lineBasicMaterial
          color="#e7e1c9"
          transparent
          opacity={opacity}
          depthWrite={false}
        />
      </lineSegments>
    </group>
  );
}

function Webs() {
  const webs = useGameStore((state) => state.world.webs);
  return (
    <>
      {webs
        .filter((web) => web.integrity > 0.05)
        .filter(
          (web, index, active) =>
            active.findIndex(
              (candidate) => candidate.ownerId === web.ownerId,
            ) === index,
        )
        .map((web) => (
          <SilkWeb key={web.id} a={web.a} b={web.b} integrity={web.integrity} />
        ))}
    </>
  );
}

function OrderMarker() {
  const marker = useGameStore((state) => state.orderMarker);
  const group = useRef<THREE.Group>(null);
  const startTime = useRef(0);
  const prevSerial = useRef(0);

  useFrame(({ clock }) => {
    if (!group.current || !marker) return;

    // Detectar nueva orden
    if (marker.serial !== prevSerial.current) {
      prevSerial.current = marker.serial;
      startTime.current = clock.elapsedTime;
    }

    const timeSinceOrder = clock.elapsedTime - startTime.current;
    if (timeSinceOrder > 1.2) {
      group.current.visible = false;
      return;
    }
    group.current.visible = true;

    // Animación de expansión rápida y desvanecimiento
    const progress = Math.min(1, timeSinceOrder / 1.2);
    const easeOutQuart = 1 - Math.pow(1 - progress, 4);

    group.current.scale.setScalar(1 + easeOutQuart * 2.5);

    const material = (group.current.children[0] as THREE.Mesh)
      .material as THREE.MeshBasicMaterial;
    if (material) {
      material.opacity = 0.85 * (1 - progress);
    }
  });
  if (!marker) return null;
  const color =
    marker.kind === "gather"
      ? "#d7b458"
      : marker.kind === "signal"
        ? "#69ded0"
        : "#d4ef79";
  return (
    <group
      key={marker.serial}
      ref={group}
      position={[marker.position.x, 0.07, marker.position.z]}
    >
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.55, 0.75, 32]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.85}
          depthWrite={false}
        />
      </mesh>
      {[0, 1, 2, 3].map((index) => (
        <mesh
          key={index}
          position={[
            Math.cos((index * Math.PI) / 2) * 1.05,
            0,
            Math.sin((index * Math.PI) / 2) * 1.05,
          ]}
          rotation={[-Math.PI / 2, 0, (-index * Math.PI) / 2]}
        >
          <coneGeometry args={[0.15, 0.35, 3]} />
          <meshBasicMaterial color={color} />
        </mesh>
      ))}
    </group>
  );
}

function SelectionPaths() {
  const world = useGameStore((state) => state.world);
  const selectedIds = useGameStore((state) => state.selectedIds);
  return (
    <>
      {world.agents
        .filter((agent) => selectedIds.includes(agent.id) && agent.destination)
        .slice(0, 14)
        .map((agent) => (
          <Line
            key={agent.id}
            points={[
              [agent.position.x, 0.045, agent.position.z],
              [agent.destination!.x, 0.045, agent.destination!.z],
            ]}
            color={agent.order === "gather" ? "#d6b354" : "#b9d76b"}
            lineWidth={0.55}
            dashed
            dashSize={0.45}
            gapSize={0.7}
            transparent
            opacity={0.34}
          />
        ))}
    </>
  );
}

function CameraRig() {
  const { camera, gl } = useThree();
  const selectedIds = useGameStore((state) => state.selectedIds);
  const agents = useGameStore((state) => state.world.agents);
  const focusRequest = useGameStore((state) => state.focusRequest);
  const sensitivity = useGameStore((state) => state.settings.cameraSensitivity);
  const setTactical = useGameStore((state) => state.setTactical);
  const tactical = useGameStore((state) => state.tactical);
  const underground = useGameStore((state) => state.underground);
  const setUnderground = useGameStore((state) => state.setUnderground);
  const togglePause = useGameStore((state) => state.togglePause);
  const emitSignal = useGameStore((state) => state.emitSignal);
  const returnSelected = useGameStore((state) => state.returnSelected);
  const center = useRef(new THREE.Vector3(0, 0, 0));
  const targetCenter = useRef(new THREE.Vector3(0, 0, 0));
  const keys = useRef(new Set<string>());
  const pointer = useRef({ x: -1, y: -1 });
  const zoom = useRef(28);
  const yaw = useRef(Math.PI * 0.24);
  const rotating = useRef<{ x: number; yaw: number } | null>(null);
  const previousFocus = useRef(focusRequest);

  useEffect(() => {
    const canvas = gl.domElement;
    const down = (event: KeyboardEvent) => {
      if (["Tab", "Space"].includes(event.code)) event.preventDefault();
      keys.current.add(event.code);
      if (event.repeat) return;
      if (event.code === "Tab") setTactical(!tactical);
      if (event.code === "Escape") togglePause();
      if (event.code === "KeyQ") emitSignal();
      if (event.code === "KeyR") returnSelected();
      if (event.code === "KeyB") setUnderground(!underground);
      if (event.code === "Home") targetCenter.current.set(0, 0, 0);
    };
    const up = (event: KeyboardEvent) => keys.current.delete(event.code);
    const move = (event: PointerEvent) => {
      pointer.current = { x: event.clientX, y: event.clientY };
      if (rotating.current)
        yaw.current =
          rotating.current.yaw - (event.clientX - rotating.current.x) * 0.006;
    };
    const pointerDown = (event: PointerEvent) => {
      if (event.button === 1)
        rotating.current = { x: event.clientX, yaw: yaw.current };
    };
    const pointerUp = (event: PointerEvent) => {
      if (event.button === 1) rotating.current = null;
    };
    const wheel = (event: WheelEvent) => {
      event.preventDefault();
      zoom.current = THREE.MathUtils.clamp(
        zoom.current - event.deltaY * 0.018,
        18,
        46,
      );
    };
    const context = (event: MouseEvent) => event.preventDefault();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", pointerUp);
    window.addEventListener("contextmenu", context);
    canvas.addEventListener("pointerdown", pointerDown);
    canvas.addEventListener("wheel", wheel, { passive: false });
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", pointerUp);
      window.removeEventListener("contextmenu", context);
      canvas.removeEventListener("pointerdown", pointerDown);
      canvas.removeEventListener("wheel", wheel);
    };
  }, [
    emitSignal,
    gl,
    returnSelected,
    setTactical,
    setUnderground,
    tactical,
    togglePause,
    underground,
  ]);

  useFrame((_, delta) => {
    if (previousFocus.current !== focusRequest) {
      previousFocus.current = focusRequest;
      const chosen = agents.filter((agent) => selectedIds.includes(agent.id));
      if (chosen.length) {
        targetCenter.current.set(
          chosen.reduce((sum, agent) => sum + agent.position.x, 0) /
            chosen.length,
          0,
          chosen.reduce((sum, agent) => sum + agent.position.z, 0) /
            chosen.length,
        );
      }
    }
    const rect = gl.domElement.getBoundingClientRect();
    const edge = 16;
    const edgeX =
      pointer.current.x >= 0
        ? pointer.current.x < rect.left + edge
          ? -1
          : pointer.current.x > rect.right - edge
            ? 1
            : 0
        : 0;
    const edgeZ =
      pointer.current.y >= 0
        ? pointer.current.y < rect.top + edge
          ? -1
          : pointer.current.y > rect.bottom - edge
            ? 1
            : 0
        : 0;
    const inputX =
      (keys.current.has("KeyD") || keys.current.has("ArrowRight") ? 1 : 0) -
      (keys.current.has("KeyA") || keys.current.has("ArrowLeft") ? 1 : 0) +
      edgeX;
    const inputZ =
      (keys.current.has("KeyS") || keys.current.has("ArrowDown") ? 1 : 0) -
      (keys.current.has("KeyW") || keys.current.has("ArrowUp") ? 1 : 0) +
      edgeZ;
    const speed =
      delta * 13 * sensitivity * (keys.current.has("ShiftLeft") ? 1.7 : 1);
    targetCenter.current.x = THREE.MathUtils.clamp(
      targetCenter.current.x + inputX * speed,
      -44,
      44,
    );
    targetCenter.current.z = THREE.MathUtils.clamp(
      targetCenter.current.z + inputZ * speed,
      -36,
      36,
    );
    center.current.lerp(targetCenter.current, 1 - Math.pow(0.001, delta));
    const distance = 28;
    camera.position.set(
      center.current.x + Math.sin(yaw.current) * distance,
      27,
      center.current.z + Math.cos(yaw.current) * distance,
    );
    camera.lookAt(center.current);
    if (camera instanceof THREE.OrthographicCamera) {
      camera.zoom = THREE.MathUtils.lerp(
        camera.zoom,
        zoom.current,
        1 - Math.pow(0.002, delta),
      );
      camera.updateProjectionMatrix();
    }
  });
  return null;
}

function RTSInteractionPlane() {
  const { camera, gl } = useThree();
  const world = useGameStore((state) => state.world);
  const issueMove = useGameStore((state) => state.issueMove);
  const selectUnits = useGameStore((state) => state.selectUnits);
  const clearSelection = useGameStore((state) => state.clearSelection);
  const setSelectionBox = useGameStore((state) => state.setSelectionBox);
  const drag = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const move = (event: PointerEvent) => {
      if (!drag.current) return;
      setSelectionBox({
        left: Math.min(drag.current.x, event.clientX),
        top: Math.min(drag.current.y, event.clientY),
        width: Math.abs(event.clientX - drag.current.x),
        height: Math.abs(event.clientY - drag.current.y),
      });
    };
    const up = (event: PointerEvent) => {
      const start = drag.current;
      if (!start || event.button !== 0) return;
      drag.current = null;
      const distance = Math.hypot(
        event.clientX - start.x,
        event.clientY - start.y,
      );
      if (distance < 6) {
        if (!event.shiftKey) clearSelection();
        setSelectionBox(null);
        return;
      }
      const bounds = {
        left: Math.min(start.x, event.clientX),
        right: Math.max(start.x, event.clientX),
        top: Math.min(start.y, event.clientY),
        bottom: Math.max(start.y, event.clientY),
      };
      const canvas = gl.domElement.getBoundingClientRect();
      const pFaction = world.playerFaction || "acromyrmex";
      const selected = world.agents
        .filter((agent) => agent.alive && agent.faction === pFaction)
        .filter((agent) => {
          const point = new THREE.Vector3(
            agent.position.x,
            0.25,
            agent.position.z,
          ).project(camera);
          const x = canvas.left + ((point.x + 1) / 2) * canvas.width;
          const y = canvas.top + ((1 - point.y) / 2) * canvas.height;
          return (
            x >= bounds.left &&
            x <= bounds.right &&
            y >= bounds.top &&
            y <= bounds.bottom
          );
        })
        .map((agent) => agent.id);
      selectUnits(selected, event.shiftKey);
      setSelectionBox(null);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [
    camera,
    clearSelection,
    gl,
    selectUnits,
    setSelectionBox,
    world.agents,
    world.playerFaction,
  ]);

  const pointerDown = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    // Issue move on right click or on touch pointer when units are selected
    const selectedCount = useGameStore.getState().selectedIds.length;
    if (
      event.button === 2 ||
      (event.nativeEvent.pointerType === "touch" && selectedCount > 0)
    ) {
      issueMove({ x: event.point.x, z: event.point.z });
    }
    if (event.button === 0) {
      drag.current = {
        x: event.nativeEvent.clientX,
        y: event.nativeEvent.clientY,
      };
      setSelectionBox({
        left: event.nativeEvent.clientX,
        top: event.nativeEvent.clientY,
        width: 0,
        height: 0,
      });
    }
  };

  return (
    <mesh
      position={[0, 0.04, 0]}
      rotation={[-Math.PI / 2, 0, 0]}
      onPointerDown={pointerDown}
    >
      <planeGeometry args={[160, 140]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  );
}

export function GameScene() {
  const world = useGameStore((state) => state.world);
  const tactical = useGameStore((state) => state.tactical);
  const underground = useGameStore((state) => state.underground);
  return (
    <>
      <RenderBudget />
      <color
        attach="background"
        args={[
          underground
            ? "#100c09"
            : world.seasonPhase === 4
              ? "#2a363b"
              : tactical
                ? "#18231d"
                : "#78908a",
        ]}
      />
      <fog
        attach="fog"
        args={[
          underground
            ? "#100c09"
            : world.seasonPhase === 4
              ? "#2a363b"
              : tactical
                ? "#18231d"
                : "#73847c",
          world.seasonPhase === 4 ? 20 : 46,
          world.seasonPhase === 4 ? 80 : 105,
        ]}
      />
      <ambientLight
        intensity={tactical ? 1.08 : world.seasonPhase === 4 ? 0.6 : 1.28}
        color="#d9dfc0"
      />
      <hemisphereLight
        intensity={world.seasonPhase === 4 ? 0.3 : 0.65}
        color="#c8ded1"
        groundColor="#5c452b"
      />
      <directionalLight
        intensity={world.seasonPhase === 4 ? 0.8 : 2.05}
        color={world.seasonPhase === 4 ? "#9ab4c2" : "#ffe1ae"}
        position={[-32, 46, 22]}
      />
      {underground ? (
        <UndergroundNest />
      ) : (
        <>
          <ProceduralTerrain />
          <Nest />
          <ResourceNodes />
          <Webs />
          <AntColony />
          <FaunaPopulation />
          {world.spiders.map((spider) => (
            <SpiderBody key={spider.id} id={spider.id} />
          ))}
          {(tactical || world.tutorialStep >= 4) &&
            world.pheromones.map((field) => (
              <Pheromone key={field.id} field={field} />
            ))}
          <SelectionPaths />
          <OrderMarker />
          <RTSInteractionPlane />
        </>
      )}
      <CameraRig />
    </>
  );
}
