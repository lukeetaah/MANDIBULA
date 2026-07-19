"use client";

import { Environment, Float, Sky } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { useEffect, useMemo, useRef } from "react";
import * as THREE from "three";
import type { Agent, PheromoneField, Spider } from "@mandibula/simulation";
import { useGameStore } from "@/lib/game-store";

const agentColors: Record<Agent["faction"], string> = {
  acromyrmex: "#2b1b13",
  rival: "#521c19",
  vespula: "#d9a82e",
  bombus: "#b9612c",
  porotermes: "#d7c8a0",
  npc: "#526349",
};
const signalColors = {
  forage: "#9fb66a",
  alarm: "#d56649",
  home: "#e1d59d",
  avoid: "#9364a5",
  recruit: "#58a5a6",
} as const;

function AntBody({ agent }: { agent: Agent }) {
  const scale = agent.controlled ? 1.15 : 0.82;
  if (!agent.alive)
    return (
      <group
        position={[agent.position.x, 0.17, agent.position.z]}
        rotation={[0, 0, Math.PI / 2]}
      >
        <mesh>
          <capsuleGeometry args={[0.08, 0.25, 4, 6]} />
          <meshStandardMaterial color="#40372d" roughness={1} />
        </mesh>
      </group>
    );
  return (
    <group position={[agent.position.x, 0.18, agent.position.z]} scale={scale}>
      <mesh castShadow position={[0, 0, 0.18]}>
        <sphereGeometry args={[0.13, 8, 6]} />
        <meshStandardMaterial
          color={agentColors[agent.faction]}
          roughness={0.78}
        />
      </mesh>
      <mesh castShadow position={[0, 0.01, -0.02]}>
        <sphereGeometry args={[0.11, 8, 6]} />
        <meshStandardMaterial
          color={agentColors[agent.faction]}
          roughness={0.76}
        />
      </mesh>
      <mesh castShadow position={[0, 0.015, -0.22]}>
        <sphereGeometry args={[0.17, 8, 6]} />
        <meshStandardMaterial
          color={agentColors[agent.faction]}
          roughness={0.8}
        />
      </mesh>
      {agent.carrying > 0 && (
        <mesh castShadow position={[0, 0.25, 0.05]} rotation={[0.4, 0, 0.2]}>
          <boxGeometry args={[0.55, 0.03, 0.32]} />
          <meshStandardMaterial color="#788747" roughness={0.9} />
        </mesh>
      )}
    </group>
  );
}

function Flyer({ agent }: { agent: Agent }) {
  const color = agentColors[agent.faction];
  const y =
    agent.kind === "termite" ? 0.15 : 2.2 + Math.sin(agent.id * 2.1) * 0.5;
  return (
    <group
      position={[agent.position.x, y, agent.position.z]}
      scale={agent.kind === "bumblebee" ? 0.7 : 0.45}
    >
      <mesh castShadow>
        <capsuleGeometry args={[0.22, 0.5, 5, 8]} />
        <meshStandardMaterial color={color} roughness={0.8} />
      </mesh>
      {agent.kind !== "termite" && (
        <>
          <mesh position={[0.22, 0.1, 0]} rotation={[0, 0.2, -0.45]}>
            <planeGeometry args={[0.7, 0.25]} />
            <meshStandardMaterial
              transparent
              opacity={0.38}
              color="#dce4d0"
              side={THREE.DoubleSide}
            />
          </mesh>
          <mesh position={[-0.22, 0.1, 0]} rotation={[0, -0.2, 0.45]}>
            <planeGeometry args={[0.7, 0.25]} />
            <meshStandardMaterial
              transparent
              opacity={0.38}
              color="#dce4d0"
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
    ? 2.4
    : spider.guild === "orb-weaver"
      ? 1.25
      : 1;
  const color = spider.dominant
    ? "#241e1c"
    : spider.guild === "orb-weaver"
      ? "#5e3d25"
      : "#48372d";
  return (
    <group
      position={[spider.position.x, 0.3 * scale, spider.position.z]}
      scale={scale}
    >
      <mesh castShadow position={[0, 0, 0.25]}>
        <sphereGeometry args={[0.33, 10, 8]} />
        <meshStandardMaterial color={color} roughness={0.88} />
      </mesh>
      <mesh castShadow position={[0, 0, -0.25]}>
        <sphereGeometry args={[0.45, 12, 8]} />
        <meshStandardMaterial color={color} roughness={0.9} />
      </mesh>
      {Array.from({ length: 8 }, (_, index) => {
        const side = index < 4 ? -1 : 1;
        const row = index % 4;
        return (
          <mesh
            key={index}
            castShadow
            position={[side * (0.38 + row * 0.08), 0, 0.22 - row * 0.18]}
            rotation={[0, side * (0.55 + row * 0.14), Math.PI / 2]}
          >
            <capsuleGeometry args={[0.025, 0.7, 3, 5]} />
            <meshStandardMaterial color={color} />
          </mesh>
        );
      })}
    </group>
  );
}

function Pheromone({ field }: { field: PheromoneField }) {
  return (
    <mesh
      position={[field.position.x, 0.035, field.position.z]}
      rotation={[-Math.PI / 2, 0, 0]}
    >
      <ringGeometry
        args={[Math.max(0.3, field.radius - 0.22), field.radius, 40]}
      />
      <meshBasicMaterial
        color={signalColors[field.type]}
        transparent
        opacity={Math.max(0.06, field.intensity * 0.28)}
        depthWrite={false}
      />
    </mesh>
  );
}

function Terrain() {
  const stones = useMemo(
    () =>
      Array.from({ length: 70 }, (_, i) => ({
        x: ((i * 37) % 109) - 54,
        z: ((i * 71) % 91) - 45,
        s: 0.35 + ((i * 17) % 18) / 10,
        r: (i * 0.73) % Math.PI,
      })),
    [],
  );
  const grass = useMemo(
    () =>
      Array.from({ length: 90 }, (_, i) => ({
        x: ((i * 29) % 111) - 55,
        z: ((i * 43) % 93) - 46,
        s: 1.2 + (i % 5) * 0.45,
      })),
    [],
  );
  return (
    <>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[120, 100, 1, 1]} />
        <meshStandardMaterial color="#695b3c" roughness={1} />
      </mesh>
      <mesh
        receiveShadow
        position={[0, -0.08, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <ringGeometry args={[0, 7, 48]} />
        <meshStandardMaterial color="#3d3526" roughness={1} />
      </mesh>
      {stones.map((stone, i) => (
        <mesh
          key={`s${i}`}
          castShadow
          receiveShadow
          position={[stone.x, stone.s * 0.22, stone.z]}
          rotation={[0, stone.r, 0]}
          scale={[stone.s, stone.s * 0.45, stone.s * 0.8]}
        >
          <dodecahedronGeometry args={[0.7, 0]} />
          <meshStandardMaterial
            color={i % 3 === 0 ? "#786c55" : "#615b4b"}
            roughness={1}
          />
        </mesh>
      ))}
      {grass.map((blade, i) => (
        <mesh
          key={`g${i}`}
          castShadow
          position={[blade.x, blade.s / 2, blade.z]}
          rotation={[0.1, (i * 1.7) % Math.PI, ((i % 3) - 1) * 0.12]}
        >
          <coneGeometry args={[0.06, blade.s, 4]} />
          <meshStandardMaterial
            color={i % 4 === 0 ? "#7f7a45" : "#555f36"}
            roughness={1}
          />
        </mesh>
      ))}
      <group position={[-34, 0, -25]}>
        <mesh
          castShadow
          position={[0, 1.2, 0]}
          rotation={[0, 0.4, Math.PI / 2]}
        >
          <cylinderGeometry args={[1.2, 1.8, 9, 9]} />
          <meshStandardMaterial color="#4b3525" roughness={1} />
        </mesh>
      </group>
      <group position={[0, 0, 0]}>
        {Array.from({ length: 6 }, (_, i) => (
          <mesh
            key={i}
            position={[
              Math.cos(i) * (2.2 + (i % 2)),
              0.03,
              Math.sin(i) * (2.2 + (i % 2)),
            ]}
            rotation={[-Math.PI / 2, 0, i]}
          >
            <circleGeometry args={[0.45 + (i % 2) * 0.3, 12]} />
            <meshStandardMaterial color="#211d16" />
          </mesh>
        ))}
      </group>
    </>
  );
}

function ResourceNodes() {
  const resources = useGameStore((state) => state.world.resources);
  return (
    <>
      {resources
        .filter((resource) => resource.amount > 0)
        .map((resource) => (
          <group
            key={resource.id}
            position={[resource.position.x, 0.1, resource.position.z]}
          >
            {Array.from(
              { length: Math.min(8, Math.ceil(resource.amount / 5)) },
              (_, i) => (
                <mesh
                  key={i}
                  castShadow
                  position={[
                    (i % 4) * 0.45 - 0.7,
                    0.06 + Math.floor(i / 4) * 0.08,
                    Math.floor(i / 4) * 0.4 - 0.2,
                  ]}
                  rotation={[0.1, i * 0.8, 0.25]}
                >
                  {resource.kind === "seed" ? (
                    <sphereGeometry args={[0.18, 7, 5]} />
                  ) : resource.kind === "deadwood" ? (
                    <boxGeometry args={[0.55, 0.18, 0.25]} />
                  ) : (
                    <boxGeometry args={[0.7, 0.04, 0.35]} />
                  )}
                  <meshStandardMaterial
                    color={
                      resource.kind === "seed"
                        ? "#a48e58"
                        : resource.kind === "deadwood"
                          ? "#5b402b"
                          : resource.kind === "nectar"
                            ? "#b96655"
                            : "#6d8040"
                    }
                    roughness={0.9}
                  />
                </mesh>
              ),
            )}
          </group>
        ))}
    </>
  );
}

function Webs() {
  const webs = useGameStore((state) => state.world.webs);
  return (
    <>
      {webs
        .filter((web) => web.integrity > 0.05)
        .map((web) => {
          const dx = web.b.x - web.a.x,
            dz = web.b.z - web.a.z;
          const len = Math.hypot(dx, dz);
          return (
            <mesh
              key={web.id}
              position={[(web.a.x + web.b.x) / 2, 2.3, (web.a.z + web.b.z) / 2]}
              rotation={[0, -Math.atan2(dz, dx), 0]}
            >
              <planeGeometry args={[len, 4, 12, 6]} />
              <meshBasicMaterial
                wireframe
                transparent
                opacity={0.14 + web.integrity * 0.2}
                color="#d9d7c6"
                side={THREE.DoubleSide}
              />
            </mesh>
          );
        })}
    </>
  );
}

function CameraRig() {
  const { camera, gl } = useThree();
  const player = useGameStore((state) =>
    state.world.agents.find((agent) => agent.id === state.world.playerAgentId),
  );
  const yaw = useGameStore((state) => state.yaw);
  const setYaw = useGameStore((state) => state.setYaw);
  const sensitivity = useGameStore((state) => state.settings.cameraSensitivity);
  const reducedMotion = useGameStore((state) => state.settings.reducedMotion);
  const target = useRef(new THREE.Vector3());

  useEffect(() => {
    const element = gl.domElement;
    const lockPointer = () => {
      if (document.pointerLockElement !== element) {
        void element.requestPointerLock();
      }
    };
    const onMove = (event: MouseEvent) => {
      if (document.pointerLockElement === element)
        setYaw((value) => value - event.movementX * 0.0022 * sensitivity);
    };
    element.addEventListener("click", lockPointer);
    window.addEventListener("mousemove", onMove);
    return () => {
      element.removeEventListener("click", lockPointer);
      window.removeEventListener("mousemove", onMove);
    };
  }, [gl, sensitivity, setYaw]);

  useFrame((_, delta) => {
    if (!player) return;
    target.current.set(player.position.x, 0.28, player.position.z);
    const desired = new THREE.Vector3(
      player.position.x + Math.sin(yaw) * 6.5,
      reducedMotion ? 3.4 : 2.8,
      player.position.z + Math.cos(yaw) * 6.5,
    );
    camera.position.lerp(desired, 1 - Math.pow(0.001, delta));
    camera.lookAt(target.current);
  });
  return null;
}

function Controls() {
  const enqueue = useGameStore((state) => state.enqueue);
  const world = useGameStore((state) => state.world);
  const yaw = useGameStore((state) => state.yaw);
  const tactical = useGameStore((state) => state.tactical);
  const setTactical = useGameStore((state) => state.setTactical);
  const radius = useGameStore((state) => state.signalRadius);
  const setRadius = useGameStore((state) => state.setSignalRadius);
  const signalType = useGameStore((state) => state.signalType);
  const cycleSignal = useGameStore((state) => state.cycleSignal);
  const togglePause = useGameStore((state) => state.togglePause);
  const keys = useRef(new Set<string>());

  useEffect(() => {
    const down = (event: KeyboardEvent) => {
      if (["Tab", "Space"].includes(event.code)) event.preventDefault();
      keys.current.add(event.code);
      const player = world.agents.find(
        (agent) => agent.id === world.playerAgentId,
      );
      if (!player) return;
      if (event.code === "KeyE") enqueue("INTERACT", {});
      if (event.code === "KeyQ")
        enqueue("EMIT_PHEROMONE", {
          position: { ...player.position },
          radius,
          intensity: 0.72,
          pheromone: signalType,
        });
      if (event.code === "Tab" && !event.repeat) setTactical(!tactical);
      if (event.code === "KeyF" && !event.repeat) cycleSignal();
      if (event.code === "Escape" && !event.repeat) togglePause();
    };
    const up = (event: KeyboardEvent) => keys.current.delete(event.code);
    const context = (event: MouseEvent) => {
      event.preventDefault();
      const player = world.agents.find(
        (agent) => agent.id === world.playerAgentId,
      );
      if (player)
        enqueue("CANCEL_SIGNAL", { position: { ...player.position } });
    };
    const wheel = (event: WheelEvent) =>
      setRadius(radius + (event.deltaY > 0 ? -1 : 1));
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("contextmenu", context);
    window.addEventListener("wheel", wheel, { passive: true });
    const interval = window.setInterval(() => {
      const x =
        (keys.current.has("KeyD") ? 1 : 0) - (keys.current.has("KeyA") ? 1 : 0);
      const z =
        (keys.current.has("KeyS") ? 1 : 0) - (keys.current.has("KeyW") ? 1 : 0);
      if (x || z) {
        const cos = Math.cos(yaw),
          sin = Math.sin(yaw);
        enqueue("MOVE", {
          direction: { x: x * cos - z * sin, z: x * sin + z * cos },
          sprint:
            keys.current.has("ShiftLeft") || keys.current.has("ShiftRight"),
        });
      }
    }, 100);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("contextmenu", context);
      window.removeEventListener("wheel", wheel);
      window.clearInterval(interval);
    };
  }, [
    cycleSignal,
    enqueue,
    radius,
    setRadius,
    setTactical,
    signalType,
    tactical,
    togglePause,
    world,
    yaw,
  ]);
  return null;
}

export function GameScene() {
  const world = useGameStore((state) => state.world);
  const tactical = useGameStore((state) => state.tactical);
  return (
    <>
      <color attach="background" args={[tactical ? "#20271d" : "#89927b"]} />
      <fog attach="fog" args={[tactical ? "#20271d" : "#89927b", 18, 105]} />
      <ambientLight intensity={tactical ? 0.8 : 1.15} color="#cdd2b1" />
      <directionalLight
        castShadow
        intensity={2.2}
        color="#f1c88d"
        position={[-24, 35, 18]}
        shadow-mapSize={[1024, 1024]}
      />
      <Sky
        sunPosition={[-2, 0.8, 1]}
        turbidity={7}
        rayleigh={2.3}
        mieCoefficient={0.012}
        mieDirectionalG={0.82}
      />
      <Environment preset="sunset" environmentIntensity={0.25} />
      <Terrain />
      <ResourceNodes />
      <Webs />
      {world.agents.map((agent) =>
        agent.kind === "ant" ? (
          <AntBody key={agent.id} agent={agent} />
        ) : (
          <Flyer key={agent.id} agent={agent} />
        ),
      )}
      {world.spiders.map((spider) => (
        <SpiderBody key={spider.id} spider={spider} />
      ))}
      {(tactical || world.tutorialStep < 5) &&
        world.pheromones.map((field) => (
          <Pheromone key={field.id} field={field} />
        ))}
      {world.rain > 0.1 && (
        <Float speed={8} floatIntensity={0.2}>
          <mesh position={[0, 12, 0]}>
            <boxGeometry args={[100, 0.01, 80]} />
            <meshBasicMaterial
              color="#84949b"
              transparent
              opacity={world.rain * 0.16}
            />
          </mesh>
        </Float>
      )}
      <CameraRig />
      <Controls />
    </>
  );
}
