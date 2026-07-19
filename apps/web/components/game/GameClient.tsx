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
        <section className="entry-copy">
          <div className="eyebrow">ESTEPA NORPATAGÓNICA · PRIMERA LUZ</div>
          <h1>
            <span>MANDÍBULA</span>
            <small>PATAGONIA</small>
          </h1>
          <p className="entry-lede">
            No sos la colonia. Todavía sos una sola obrera.
          </p>
          <div className="entry-actions">
            <button className="primary-action" onClick={() => begin(false)}>
              EMERGER
            </button>
            {canResume && (
              <button className="text-action" onClick={() => begin(true)}>
                Continuar rastro
              </button>
            )}
          </div>
          <p className="entry-note">
            Partida local contra bots · 12–20 min · progreso de partida no
            competitivo
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
        shadows
        dpr={[1, 1.6]}
        camera={{ fov: 54, near: 0.05, far: 240, position: [0, 7, 10] }}
      >
        <GameScene />
      </Canvas>
      <HUD />
    </main>
  );
}
