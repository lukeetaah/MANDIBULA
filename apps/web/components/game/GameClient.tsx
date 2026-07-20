"use client";

import { Canvas } from "@react-three/fiber";
import { useEffect, useState } from "react";
import { GameScene } from "./GameScene";
import { HUD } from "./HUD";
import { hasLocalSave, useGameStore } from "@/lib/game-store";

export default function GameClient() {
  const started = useGameStore((state) => state.started);
  const begin = useGameStore((state) => state.begin);
  const tick = useGameStore((state) => state.tick);
  const settings = useGameStore((state) => state.settings);
  const difficulty = useGameStore((state) => state.difficulty);
  const setDifficulty = useGameStore((state) => state.setDifficulty);
  const [canResume, setCanResume] = useState(false);

  useEffect(() => setCanResume(hasLocalSave()), []);
  useEffect(() => {
    if (!started) return;
    const timer = window.setInterval(tick, 100);
    return () => window.clearInterval(timer);
  }, [started, tick]);

  if (!started) {
    return (
      <main className="entry-screen">
        <div className="entry-grain" aria-hidden="true" />
        <div className="entry-horizon" aria-hidden="true">
          <i className="entry-nest" />
          {Array.from({ length: 16 }, (_, index) => (
            <i
              key={index}
              className="entry-ant"
              style={{ "--n": index } as React.CSSProperties}
            />
          ))}
        </div>
        <section className="entry-copy">
          <div className="eyebrow">
            <i /> ESTEPA NORPATAGÓNICA · PRIMERA LUZ
          </div>
          <h1>
            <span>MANDÍBULA</span>
            <small>UNA ESTRATEGIA VIVA</small>
          </h1>
          <p className="entry-lede">
            No construís un imperio.{" "}
            <strong>Negociás con un ecosistema.</strong>
          </p>
          <div className="difficulty-picker" aria-label="Dificultad">
            <small>DIFICULTAD · PODÉS CAMBIARLA DURANTE LA PARTIDA</small>
            <div>
              {(
                [
                  ["gentle", "CALMA", "Aprende y reacciona"],
                  ["balanced", "EQUILIBRIO", "Amenaza gradual"],
                  ["wild", "SILVESTRE", "Sin protección"],
                ] as const
              ).map(([value, label, note]) => (
                <button
                  key={value}
                  className={difficulty === value ? "active" : ""}
                  onClick={() => setDifficulty(value)}
                >
                  <b>{label}</b>
                  <span>{note}</span>
                </button>
              ))}
            </div>
          </div>
          <div className="entry-actions">
            <button className="primary-action" onClick={() => begin(false)}>
              FUNDAR LA RED <span>→</span>
            </button>
            {canResume && (
              <button className="text-action" onClick={() => begin(true)}>
                Continuar rastro
              </button>
            )}
          </div>
          <p className="entry-note">
            ESTRATEGIA SISTÉMICA · TUTORIAL INTERACTIVO · PARTIDA LOCAL 12–20
            MIN
          </p>
        </section>
        <div className="entry-signal" aria-hidden="true">
          <i />
          <i />
          <i />
          <i />
        </div>
      </main>
    );
  }

  return (
    <main
      className={`game-shell ${settings.highContrast ? "is-high-contrast" : ""} ${settings.colorBlind ? "is-colorblind" : ""}`}
      style={{ "--ui-scale": settings.uiScale } as React.CSSProperties}
    >
      <Canvas
        shadows={false}
        orthographic
        frameloop="demand"
        dpr={1}
        camera={{ zoom: 28, near: 0.1, far: 240, position: [20, 27, 20] }}
        gl={{ antialias: false, powerPreference: "high-performance" }}
      >
        <GameScene />
      </Canvas>
      <HUD />
    </main>
  );
}
