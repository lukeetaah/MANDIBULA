"use client";

import { Line } from "@react-three/drei";
import { useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import type {
  Agent,
  PheromoneField,
  ResourcePatch,
  Spider,
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

function AntColony({ agents }: { agents: Agent[] }) {
  const mesh = useRef<THREE.InstancedMesh>(null);
  const selectedIds = useGameStore((state) => state.selectedIds);
  const selectUnits = useGameStore((state) => state.selectUnits);
  useEffect(() => {
    if (!mesh.current) return;
    const matrix = new THREE.Matrix4();
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    const scale = new THREE.Vector3();
    const color = new THREE.Color();
    agents.forEach((agent, index) => {
      position.set(
        agent.position.x,
        agent.alive ? 0.18 : 0.07,
        agent.position.z,
      );
      quaternion.setFromEuler(
        new THREE.Euler(
          0,
          Math.atan2(agent.velocity.x, agent.velocity.z),
          agent.alive ? 0 : Math.PI / 2,
        ),
      );
      const size = agent.alive
        ? agent.faction === "acromyrmex"
          ? 1
          : 0.88
        : 0.42;
      scale.setScalar(size);
      matrix.compose(position, quaternion, scale);
      mesh.current!.setMatrixAt(index, matrix);
      color.set(agent.alive ? factionColors[agent.faction] : "#30291f");
      mesh.current!.setColorAt(index, color);
    });
    mesh.current.instanceMatrix.needsUpdate = true;
    if (mesh.current.instanceColor)
      mesh.current.instanceColor.needsUpdate = true;
    mesh.current.computeBoundingSphere();
  }, [agents]);

  const onPointerDown = (event: ThreeEvent<PointerEvent>) => {
    if (event.button !== 0 || event.instanceId === undefined) return;
    const agent = agents[event.instanceId];
    if (!agent?.alive || agent.faction !== "acromyrmex") return;
    event.stopPropagation();
    selectUnits([agent.id], event.nativeEvent.shiftKey);
  };

  return (
    <>
      <instancedMesh
        ref={mesh}
        args={[ANT_GEOMETRY, undefined, agents.length]}
        castShadow
        onPointerDown={onPointerDown}
      >
        <meshStandardMaterial color="#ffffff" roughness={0.76} />
      </instancedMesh>
      {agents
        .filter((agent) => selectedIds.includes(agent.id) && agent.alive)
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
      {agents
        .filter((agent) => agent.carrying > 0 && agent.alive)
        .map((agent) => (
          <mesh
            key={`load-${agent.id}`}
            castShadow
            position={[agent.position.x, 0.49, agent.position.z]}
            rotation={[0.08, 0.35, 0.15]}
          >
            <circleGeometry args={[0.38, 7]} />
            <meshStandardMaterial
              color="#71934c"
              roughness={0.95}
              side={THREE.DoubleSide}
            />
          </mesh>
        ))}
    </>
  );
}

function Flyer({ agent }: { agent: Agent }) {
  const color = factionColors[agent.faction];
  const y =
    agent.kind === "termite" ? 0.18 : 2.8 + Math.sin(agent.id * 2.1) * 0.6;
  return (
    <group
      position={[agent.position.x, y, agent.position.z]}
      rotation={[0, Math.atan2(agent.velocity.x, agent.velocity.z), 0]}
      scale={agent.kind === "bumblebee" ? 0.62 : 0.42}
    >
      <mesh castShadow scale={[0.7, 0.8, 1.4]}>
        <sphereGeometry args={[0.35, 8, 6]} />
        <meshStandardMaterial color={color} roughness={0.75} />
      </mesh>
      {agent.kind !== "termite" && (
        <>
          <mesh position={[0.28, 0.12, 0]} rotation={[0, 0.15, -0.48]}>
            <circleGeometry args={[0.46, 12]} />
            <meshBasicMaterial
              transparent
              opacity={0.3}
              color="#dff2e7"
              side={THREE.DoubleSide}
            />
          </mesh>
          <mesh position={[-0.28, 0.12, 0]} rotation={[0, -0.15, 0.48]}>
            <circleGeometry args={[0.46, 12]} />
            <meshBasicMaterial
              transparent
              opacity={0.3}
              color="#dff2e7"
              side={THREE.DoubleSide}
            />
          </mesh>
        </>
      )}
    </group>
  );
}

function SpiderBody({ spider }: { spider: Spider }) {
  if (!spider.visible) return null;
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
  return (
    <group
      position={[spider.position.x, 0.28 * scale, spider.position.z]}
      scale={scale}
    >
      <mesh castShadow position={[0, 0, 0.24]} scale={[0.8, 0.65, 1]}>
        <sphereGeometry args={[0.38, 10, 7]} />
        <meshStandardMaterial color={color} roughness={0.82} />
      </mesh>
      <mesh castShadow position={[0, 0.04, -0.32]} scale={[1, 0.72, 1.25]}>
        <sphereGeometry args={[0.5, 12, 8]} />
        <meshStandardMaterial color={color} roughness={0.88} />
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
            <meshStandardMaterial color={color} roughness={0.9} />
          </mesh>
        );
      })}
      <pointLight
        color="#c64e35"
        intensity={spider.dominant ? 0.5 : 0.15}
        distance={4}
      />
    </group>
  );
}

function Pheromone({ field }: { field: PheromoneField }) {
  const color = signalColors[field.type];
  return (
    <group position={[field.position.x, 0.05, field.position.z]}>
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
            opacity={Math.max(0.04, field.intensity * (0.22 - factor * 0.08))}
            depthWrite={false}
          />
        </mesh>
      ))}
    </group>
  );
}

function ProceduralTerrain() {
  const grassRef = useRef<THREE.InstancedMesh>(null);
  const rockRef = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => {
    const plane = new THREE.PlaneGeometry(160, 140, 44, 36);
    plane.rotateX(-Math.PI / 2);
    const positions = plane.getAttribute("position");
    const colors: number[] = [];
    const dark = new THREE.Color("#4f4228");
    const light = new THREE.Color("#80704a");
    for (let index = 0; index < positions.count; index += 1) {
      const x = positions.getX(index);
      const z = positions.getZ(index);
      const noise =
        (Math.sin(x * 0.29) + Math.cos(z * 0.23) + Math.sin((x + z) * 0.11)) /
          6 +
        0.5;
      const color = dark
        .clone()
        .lerp(light, THREE.MathUtils.clamp(noise, 0, 1));
      colors.push(color.r, color.g, color.b);
    }
    plane.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
    return plane;
  }, []);

  useEffect(() => {
    const matrix = new THREE.Matrix4();
    const quaternion = new THREE.Quaternion();
    const position = new THREE.Vector3();
    const scale = new THREE.Vector3();
    for (let index = 0; index < 180; index += 1) {
      const x = ((index * 47) % 113) - 56;
      const z = ((index * 71) % 97) - 48;
      const height = 0.7 + (index % 7) * 0.18;
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
        <meshStandardMaterial vertexColors roughness={1} metalness={0} />
      </mesh>
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
      <mesh
        position={[0, 0.12, 0]}
        rotation={[Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <torusGeometry args={[3.15, 0.72, 8, 48]} />
        <meshStandardMaterial color="#392e20" roughness={1} />
      </mesh>
      <mesh position={[0, 0.035, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[2.45, 48]} />
        <meshStandardMaterial color="#100e0a" roughness={1} />
      </mesh>
      <mesh position={[0, 0.12, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.45, 2.1, 48]} />
        <meshBasicMaterial
          color="#91b85c"
          transparent
          opacity={0.18}
          depthWrite={false}
        />
      </mesh>
      <mesh position={[0, 0.2, 0]}>
        <sphereGeometry args={[0.7, 16, 8]} />
        <meshStandardMaterial
          color="#809a57"
          emissive="#5f763d"
          emissiveIntensity={0.35}
          roughness={0.9}
        />
      </mesh>
      <pointLight
        position={[0, 1, 0]}
        color="#b9d77a"
        intensity={0.65}
        distance={8}
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
  return (
    <group position={[centerX, 2.4, centerZ]} rotation={[0, rotation, 0]}>
      {Array.from({ length: 8 }, (_, index) => {
        const angle = (index / 8) * Math.PI * 2;
        return (
          <Line
            key={`r${index}`}
            points={[
              [0, 0, 0],
              [Math.cos(angle) * radius, Math.sin(angle) * radius * 0.62, 0],
            ]}
            color="#e7e1c9"
            lineWidth={0.6}
            transparent
            opacity={opacity}
          />
        );
      })}
      {[0.34, 0.62, 0.9].map((factor) => (
        <Line
          key={factor}
          points={Array.from({ length: 33 }, (_, index) => {
            const angle = (index / 32) * Math.PI * 2;
            return [
              Math.cos(angle) * radius * factor,
              Math.sin(angle) * radius * 0.62 * factor,
              0,
            ] as [number, number, number];
          })}
          color="#e7e1c9"
          lineWidth={0.55}
          transparent
          opacity={opacity}
        />
      ))}
    </group>
  );
}

function Webs() {
  const webs = useGameStore((state) => state.world.webs);
  return (
    <>
      {webs
        .filter((web) => web.integrity > 0.05)
        .map((web) => (
          <SilkWeb key={web.id} a={web.a} b={web.b} integrity={web.integrity} />
        ))}
    </>
  );
}

function OrderMarker() {
  const marker = useGameStore((state) => state.orderMarker);
  const group = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    if (!group.current) return;
    const pulse = 1 + Math.sin(clock.elapsedTime * 5) * 0.09;
    group.current.scale.setScalar(pulse);
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
        <ringGeometry args={[0.55, 0.68, 32]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.82}
          depthWrite={false}
        />
      </mesh>
      {[0, 1, 2, 3].map((index) => (
        <mesh
          key={index}
          position={[
            Math.cos((index * Math.PI) / 2) * 0.88,
            0,
            Math.sin((index * Math.PI) / 2) * 0.88,
          ]}
          rotation={[-Math.PI / 2, 0, (-index * Math.PI) / 2]}
        >
          <coneGeometry args={[0.12, 0.28, 3]} />
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
  }, [emitSignal, gl, returnSelected, setTactical, tactical, togglePause]);

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
      const selected = world.agents
        .filter(
          (agent) =>
            agent.alive &&
            agent.kind === "ant" &&
            agent.faction === "acromyrmex",
        )
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
  }, [camera, clearSelection, gl, selectUnits, setSelectionBox, world.agents]);

  const pointerDown = (event: ThreeEvent<PointerEvent>) => {
    event.stopPropagation();
    if (event.button === 2) issueMove({ x: event.point.x, z: event.point.z });
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
  return (
    <>
      <color attach="background" args={[tactical ? "#18231d" : "#78908a"]} />
      <fog attach="fog" args={[tactical ? "#18231d" : "#73847c", 46, 105]} />
      <ambientLight intensity={tactical ? 1.25 : 1.65} color="#d9dfc0" />
      <hemisphereLight intensity={0.8} color="#c8ded1" groundColor="#5c452b" />
      <directionalLight
        intensity={3.2}
        color="#ffd390"
        position={[-32, 46, 22]}
      />
      <ProceduralTerrain />
      <Nest />
      <ResourceNodes />
      <Webs />
      <AntColony
        agents={world.agents.filter((agent) => agent.kind === "ant")}
      />
      {world.agents
        .filter((agent) => agent.kind !== "ant")
        .map((agent) => (
          <Flyer key={agent.id} agent={agent} />
        ))}
      {world.spiders.map((spider) => (
        <SpiderBody key={spider.id} spider={spider} />
      ))}
      {(tactical || world.tutorialStep >= 4) &&
        world.pheromones.map((field) => (
          <Pheromone key={field.id} field={field} />
        ))}
      <SelectionPaths />
      <OrderMarker />
      <RTSInteractionPlane />
      <CameraRig />
    </>
  );
}
