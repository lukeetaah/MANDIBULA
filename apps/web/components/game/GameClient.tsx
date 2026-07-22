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
  const [isPortraitMobile, setIsPortraitMobile] = useState(false);
  const [dismissedPortraitPrompt, setDismissedPortraitPrompt] = useState(false);

  useEffect(() => setCanResume(hasLocalSave()), []);

  useEffect(() => {
    const checkOrientation = () => {
      if (typeof window === "undefined") return;
      const isMobile = window.innerWidth <= 840 || "ontouchstart" in window;
      const isPortrait = window.innerHeight > window.innerWidth;
      setIsPortraitMobile(isMobile && isPortrait);
    };
    checkOrientation();
    window.addEventListener("resize", checkOrientation);
    window.addEventListener("orientationchange", checkOrientation);
    return () => {
      window.removeEventListener("resize", checkOrientation);
      window.removeEventListener("orientationchange", checkOrientation);
    };
  }, []);

  useEffect(() => {
    if (!started) return;
    const timer = window.setInterval(tick, 100);
    return () => window.clearInterval(timer);
  }, [started, tick]);

  const requestLandscapeOrientation = async () => {
    try {
      if (document.documentElement.requestFullscreen) {
        await document.documentElement.requestFullscreen();
      }
      if (
        typeof screen !== "undefined" &&
        screen.orientation &&
        "lock" in screen.orientation
      ) {
        await (
          screen.orientation as unknown as {
            lock: (orientation: string) => Promise<void>;
          }
        ).lock("landscape");
      }
    } catch {
      // Non-blocking fallback if browser policy rejects lock
    }
    setDismissedPortraitPrompt(true);
  };

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
            <i /> ECOSISTEMA PATAGÓNICO · SIMULACIÓN SISTÉMICA
          </div>
          <h1>
            <span>MANDÍBULA</span>
            <small>ESTRATEGIA ASIMÉTRICA VIVA</small>
          </h1>
          <p className="entry-lede">
            Goberná una colonia de <strong>Acromyrmex lobicornis</strong> en la
            estepa patagónica.
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
              INICIAR PARTIDA <span>→</span>
            </button>
            {canResume && (
              <button className="text-action" onClick={() => begin(true)}>
                Continuar rastro
              </button>
            )}
          </div>
          <p className="entry-note">
            ESTRATEGIA SISTÉMICA · CONTROLES TÁCTILES & DESKTOP · PARTIDA LOCAL
            12–20 MIN
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
      {isPortraitMobile && !dismissedPortraitPrompt && (
        <div
          className="landscape-prompt-overlay"
          role="dialog"
          aria-label="Orientación recomendada"
        >
          <div className="landscape-prompt-card">
            <i className="phone-rotate-icon" aria-hidden="true" />
            <h2>Giralo para ver el mapa, las unidades y el HUD completo.</h2>
            <p>
              El juego está diseñado para pantallas horizontales en dispositivos
              móviles.
            </p>
            <div className="landscape-prompt-actions">
              <button
                className="primary-action"
                onClick={requestLandscapeOrientation}
              >
                GIRAR / PANTALLA COMPLETA
              </button>
              <button
                className="text-action"
                onClick={() => setDismissedPortraitPrompt(true)}
              >
                Continuar en vertical
              </button>
            </div>
          </div>
        </div>
      )}
      <Canvas
        shadows={false}
        orthographic
        frameloop="demand"
        dpr={[1, 2]}
        camera={{ zoom: 28, near: 0.1, far: 240, position: [20, 27, 20] }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
      >
        <GameScene />
      </Canvas>
      <HUD />
    </main>
  );
}
