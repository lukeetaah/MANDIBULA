"use client";

import { Canvas } from "@react-three/fiber";
import { useEffect, useState } from "react";
import { GameScene } from "./GameScene";
import { HUD } from "./HUD";
import { hasLocalSave, useGameStore } from "@/lib/game-store";
import { type FactionId } from "@mandibula/simulation";

const speciesRoster: Array<{
  id: FactionId;
  name: string;
  scientific: string;
  biome: string;
  style: string;
  strength: string;
  risk: string;
  complexity: string;
  desc: string;
}> = [
  {
    id: "acromyrmex",
    name: "Hormiga Cortadora de Hojas",
    scientific: "Acromyrmex lobicornis",
    biome: "Estepa y monte norpatagónico",
    style: "Enjambre subterráneo agrícola",
    strength: "Gran masa obrera y economía fúngica de alto rendimiento",
    risk: "Dependencia crítica de higiene y ventilación del nido",
    complexity: "Recomendado · Estándar",
    desc: "Fundá un superorganismo subterráneo. Cosechá hojas, cultivá el hongo simbiótico y expandí cámaras para sostener la colonia.",
  },
  {
    id: "porotermes",
    name: "Termita de Madera Patagónica",
    scientific: "Porotermes quadricollis",
    biome: "Bosque andino y estepa arbolada",
    style: "Ingeniería xilófaga defensiva",
    strength: "Galerías de madera duras y sellado de pasajes contra depredadores",
    risk: "Movilidad lenta y tasa de reproducción moderada",
    complexity: "Intermedio",
    desc: "Habitá estructuras de madera muerta. Cosechá celulosa y construí barreras de resina para aislar a las arañas de tus túneles.",
  },
  {
    id: "vespula",
    name: "Avispa Patagónica",
    scientific: "Vespula germanica",
    biome: "Valles y estepa abierta",
    style: "Depredación aérea oportunista",
    strength: "Alta velocidad de vuelo, movilidad tridimensional e intercepción",
    risk: "Sin hongo subterráneo; vulnerabilidad individual ante el frío",
    complexity: "Avanzado",
    desc: "Dominá el espacio aéreo patagónico. Patrullá desde perches elevados, interceptá presas expuestas y protegé tu avispero.",
  },
  {
    id: "bombus",
    name: "Abejorro Patagónico (Moscardón)",
    scientific: "Bombus dahlbomii",
    biome: "Mallines y matorrales patagónicos",
    style: "Forrajero floral robusto",
    strength: "Masa corporal resistente al viento y recolección eficiente por unidad",
    risk: "Bajo número de obreras; cada baja es una pérdida costosa",
    complexity: "Especialista",
    desc: "Controlá a los gigantes florales del sur. Cosechá néctar y polen en mallines fríos con alta tolerancia al viento patagónico.",
  },
];

export default function GameClient() {
  const started = useGameStore((state) => state.started);
  const begin = useGameStore((state) => state.begin);
  const tick = useGameStore((state) => state.tick);
  const settings = useGameStore((state) => state.settings);
  const difficulty = useGameStore((state) => state.difficulty);
  const setDifficulty = useGameStore((state) => state.setDifficulty);
  const playerFaction = useGameStore((state) => state.playerFaction);
  const setSpecies = useGameStore((state) => state.setSpecies);
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
      if (typeof screen !== "undefined" && screen.orientation && "lock" in screen.orientation) {
        await (screen.orientation as unknown as { lock: (orientation: string) => Promise<void> }).lock("landscape");
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
            <i /> ECOSISTEMA PATAGÓNICO · SELECCIÓN DE ESPECIE
          </div>
          <h1>
            <span>MANDÍBULA</span>
            <small>ESTRATEGIA ASIMÉTRICA VIVA</small>
          </h1>
          <p className="entry-lede">
            Elegí tu facción. <strong>Cada especie habita, compite y sobrevive según su biología real.</strong>
          </p>

          <div className="species-picker" aria-label="Especie jugable">
            <small>FACCIÓN JUGABLE · CADA UNA CAMBIA EL NIDO, LA ECONOMÍA Y EL MAPA</small>
            <div className="species-grid">
              {speciesRoster.map((sp) => (
                <button
                  key={sp.id}
                  className={`species-card ${playerFaction === sp.id ? "active" : ""}`}
                  onClick={() => setSpecies(sp.id)}
                >
                  <div className="species-header">
                    <b>{sp.name}</b>
                    <small><i>{sp.scientific}</i></small>
                  </div>
                  <div className="species-tags">
                    <span>{sp.biome}</span>
                    <span>{sp.style}</span>
                    <span className="complexity">{sp.complexity}</span>
                  </div>
                  <p>{sp.desc}</p>
                  <div className="species-stats">
                    <small>PRO: {sp.strength}</small>
                    <small>RIESGO: {sp.risk}</small>
                  </div>
                </button>
              ))}
            </div>
          </div>

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
            ESTRATEGIA SISTÉMICA · CONTROLES TÁCTILES & DESKTOP · PARTIDA LOCAL 12–20 MIN
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
        <div className="landscape-prompt-overlay" role="dialog" aria-label="Orientación recomendada">
          <div className="landscape-prompt-card">
            <i className="phone-rotate-icon" aria-hidden="true" />
            <h2>Giralo para ver el mapa, las unidades y el HUD completo.</h2>
            <p>El juego está diseñado para pantallas horizontales en dispositivos móviles.</p>
            <div className="landscape-prompt-actions">
              <button className="primary-action" onClick={requestLandscapeOrientation}>
                GIRAR / PANTALLA COMPLETA
              </button>
              <button className="text-action" onClick={() => setDismissedPortraitPrompt(true)}>
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
