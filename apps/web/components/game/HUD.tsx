"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { checksumWorld } from "@mandibula/simulation";
import { useGameStore } from "@/lib/game-store";

const tutorial = [
  {
    title: "Orientate",
    detail: "WASD para moverte. El claro del nido queda detrás.",
  },
  {
    title: "Buscá sustrato",
    detail: "Seguí el pulso verde hasta hojas o semillas.",
  },
  {
    title: "Sujetá",
    detail: "E junto al material. Una obrera sólo carga una pieza.",
  },
  { title: "Volvé", detail: "Entregá con E en la boca oscura del hormiguero." },
  {
    title: "Dejá una señal",
    detail: "Q deposita química. F cambia el tipo desbloqueado.",
  },
  {
    title: "La ruta ya existe",
    detail: "Ahora abastecé el cultivo. Tab revela la lectura química.",
  },
] as const;

const authorityNames = [
  "",
  "RECIÉN EMERGIDA",
  "OBRERA FUNCIONAL",
  "ESPECIALISTA",
];
const signalLabels = {
  alarm: "ALARMA",
  forage: "FORRAJE",
  home: "RETORNO",
  avoid: "EVITAR",
  recruit: "RECLUTAR",
} as const;

function Meter({
  value,
  tone = "lichen",
  label,
}: {
  value: number;
  tone?: "lichen" | "amber" | "danger";
  label: string;
}) {
  return (
    <div className="meter" aria-label={`${label}: ${Math.round(value * 100)}%`}>
      <i
        className={`meter-fill ${tone}`}
        style={{ width: `${Math.max(2, value * 100)}%` }}
      />
    </div>
  );
}

function TacticalMap() {
  const world = useGameStore((state) => state.world);
  return (
    <section
      className="tactical-map"
      aria-label="Lectura química del territorio"
    >
      <div className="map-head">
        <span>LECTURA QUÍMICA</span>
        <small>NO ES VISIÓN DIRECTA</small>
      </div>
      <div className="map-field">
        <i className="map-nest player" style={{ left: "50%", top: "50%" }} />
        <i className="map-nest rival" style={{ left: "80%", top: "76%" }} />
        {world.resources
          .filter((resource) => resource.amount > 0)
          .map((resource) => (
            <i
              key={resource.id}
              className="map-resource"
              style={{
                left: `${50 + resource.position.x / 1.2}%`,
                top: `${50 + resource.position.z / 1.0}%`,
              }}
            />
          ))}
        {world.pheromones.map((field) => (
          <i
            key={field.id}
            className={`map-signal ${field.type}`}
            style={{
              left: `${50 + field.position.x / 1.2}%`,
              top: `${50 + field.position.z / 1.0}%`,
              width: field.radius * 2,
              height: field.radius * 2,
              opacity: field.intensity,
            }}
          />
        ))}
        {world.spiders
          .filter((spider) => spider.visible)
          .map((spider) => (
            <i
              key={spider.id}
              className={`map-predator ${spider.dominant ? "dominant" : ""}`}
              style={{
                left: `${50 + spider.position.x / 1.2}%`,
                top: `${50 + spider.position.z / 1.0}%`,
              }}
            />
          ))}
      </div>
      <div className="map-legend">
        <span>
          <i className="dot resource" /> recurso
        </span>
        <span>
          <i className="dot danger" /> riesgo confirmado
        </span>
        <span>
          <i className="dot uncertain" /> señal envejecida
        </span>
      </div>
    </section>
  );
}

function SettingsPanel() {
  const settings = useGameStore((state) => state.settings);
  const setSetting = useGameStore((state) => state.setSetting);
  const setSettingsOpen = useGameStore((state) => state.setSettingsOpen);
  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Accesibilidad y controles"
    >
      <section className="settings-panel">
        <header>
          <div>
            <small>PAUSA LOCAL</small>
            <h2>Percepción</h2>
          </div>
          <button onClick={() => setSettingsOpen(false)} aria-label="Cerrar">
            ×
          </button>
        </header>
        <label>
          Sensibilidad de cámara{" "}
          <input
            type="range"
            min="0.3"
            max="1.8"
            step="0.1"
            value={settings.cameraSensitivity}
            onChange={(event) =>
              setSetting("cameraSensitivity", Number(event.target.value))
            }
          />
        </label>
        <label>
          Escala de interfaz{" "}
          <input
            type="range"
            min="0.8"
            max="1.35"
            step="0.05"
            value={settings.uiScale}
            onChange={(event) =>
              setSetting("uiScale", Number(event.target.value))
            }
          />
        </label>
        <div className="toggle-grid">
          <Toggle
            label="Reducir movimiento"
            checked={settings.reducedMotion}
            onChange={(value) => setSetting("reducedMotion", value)}
          />
          <Toggle
            label="Alto contraste"
            checked={settings.highContrast}
            onChange={(value) => setSetting("highContrast", value)}
          />
          <Toggle
            label="Paleta daltónica"
            checked={settings.colorBlind}
            onChange={(value) => setSetting("colorBlind", value)}
          />
          <Toggle
            label="Subtítulos ambientales"
            checked={settings.subtitles}
            onChange={(value) => setSetting("subtitles", value)}
          />
          <Toggle
            label="Ambiente sonoro"
            checked={settings.sound}
            onChange={(value) => setSetting("sound", value)}
          />
          <Toggle
            label="Reducir sonidos intensos"
            checked={!settings.intenseSounds}
            onChange={(value) => setSetting("intenseSounds", !value)}
          />
        </div>
        <p className="settings-note">
          Controles: WASD mover · Shift acelerar · E interactuar · Q señal · F
          tipo · Tab lectura · rueda radio · clic derecho cancelar · Esc pausa.
        </p>
      </section>
    </div>
  );
}

function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="toggle">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

function Diagnostics() {
  const world = useGameStore((state) => state.world);
  const fps = useGameStore((state) => state.fps);
  return (
    <aside className="diagnostics">
      <b>DIAGNÓSTICO</b>
      <span>{fps} fps</span>
      <span>tick {world.tick}</span>
      <span>
        {world.agents.filter((agent) => agent.alive).length} entidades
      </span>
      <span>{world.pheromones.length} campos</span>
      <span>hash {checksumWorld(world)}</span>
    </aside>
  );
}

function useAmbientSound(enabled: boolean) {
  const audio = useRef<{ context: AudioContext; gain: GainNode } | null>(null);
  useEffect(() => {
    const start = () => {
      if (audio.current) return;
      const context = new AudioContext();
      const frames = context.sampleRate * 3;
      const buffer = context.createBuffer(1, frames, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < frames; i += 1)
        data[i] = (Math.random() * 2 - 1) * (0.35 + Math.sin(i / 19000) * 0.15);
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      const filter = context.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 520;
      const gain = context.createGain();
      gain.gain.value = enabled ? 0.026 : 0;
      source.connect(filter).connect(gain).connect(context.destination);
      source.start();
      audio.current = { context, gain };
    };
    window.addEventListener("pointerdown", start, { once: true });
    return () => window.removeEventListener("pointerdown", start);
  }, [enabled]);
  useEffect(() => {
    if (audio.current)
      audio.current.gain.gain.setTargetAtTime(
        enabled ? 0.026 : 0,
        audio.current.context.currentTime,
        0.12,
      );
  }, [enabled]);
}

export function HUD() {
  const world = useGameStore((state) => state.world);
  const tactical = useGameStore((state) => state.tactical);
  const signalRadius = useGameStore((state) => state.signalRadius);
  const signalType = useGameStore((state) => state.signalType);
  const settingsOpen = useGameStore((state) => state.settingsOpen);
  const setSettingsOpen = useGameStore((state) => state.setSettingsOpen);
  const togglePause = useGameStore((state) => state.togglePause);
  const restart = useGameStore((state) => state.restart);
  const sound = useGameStore((state) => state.settings.sound);
  const subtitles = useGameStore((state) => state.settings.subtitles);
  const setFps = useGameStore((state) => state.setFps);
  const player = world.agents.find((agent) => agent.id === world.playerAgentId);
  const latestEvent = world.eventLog[world.eventLog.length - 1];
  const diagnostics =
    process.env.NODE_ENV === "development" ||
    process.env.NEXT_PUBLIC_ENABLE_DIAGNOSTICS === "true";
  const lastFrame = useRef(performance.now());
  const frameCount = useRef(0);
  const [showControls, setShowControls] = useState(true);

  useAmbientSound(sound);
  useEffect(() => {
    let handle = 0;
    const frame = (now: number) => {
      frameCount.current += 1;
      if (now - lastFrame.current > 1000) {
        setFps(
          Math.round((frameCount.current * 1000) / (now - lastFrame.current)),
        );
        frameCount.current = 0;
        lastFrame.current = now;
      }
      handle = requestAnimationFrame(frame);
    };
    handle = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(handle);
  }, [setFps]);
  useEffect(() => {
    const timer = window.setTimeout(() => setShowControls(false), 9000);
    return () => window.clearTimeout(timer);
  }, []);

  const danger = useMemo(
    () =>
      world.spiders.some(
        (spider) =>
          spider.visible &&
          player &&
          (spider.position.x - player.position.x) ** 2 +
            (spider.position.z - player.position.z) ** 2 <
            180,
      ),
    [player, world.spiders],
  );
  const objectiveProgress = Math.min(1, world.colonyBiomass / 24);
  const tutorialItem =
    tutorial[Math.min(world.tutorialStep, tutorial.length - 1)]!;

  return (
    <div className="hud">
      <header className="top-bar">
        <div className="colony-mark">
          <i />
          <div>
            <span>ACROMYRMEX</span>
            <small>{authorityNames[world.authorityLevel]}</small>
          </div>
        </div>
        <div className="climate">
          <span>{Math.round(world.temperature)}°</span>
          <i className={world.rain > 0.15 ? "weather rain" : "weather wind"} />
          <small>
            {world.rain > 0.15
              ? "LLUVIA BREVE"
              : world.temperature < 8
                ? "ACTIVIDAD LENTA"
                : "VIENTO SECO"}
          </small>
        </div>
        <div className="top-actions">
          <button
            onClick={() => setSettingsOpen(true)}
            aria-label="Abrir accesibilidad"
          >
            PERCEPCIÓN
          </button>
          <button onClick={togglePause}>
            {world.paused ? "SEGUIR" : "PAUSA"}
          </button>
        </div>
      </header>

      <aside className="colony-status">
        <div className="status-title">
          <span>CULTIVO</span>
          <small>
            {world.fungusHealth > 0.7
              ? "VIGOROSO"
              : world.fungusHealth > 0.4
                ? "NECESITA SUSTRATO"
                : "RIESGO DE COLAPSO"}
          </small>
        </div>
        <Meter
          label="Salud del cultivo"
          value={world.fungusHealth}
          tone={world.fungusHealth < 0.4 ? "danger" : "lichen"}
        />
        <div className="status-row">
          <span>CRÍAS</span>
          <Meter
            label="Salud de crías"
            value={world.broodHealth}
            tone="amber"
          />
        </div>
        <div className="status-row">
          <span>ENERGÍA</span>
          <Meter
            label="Energía individual"
            value={player?.energy ?? 0}
            tone={player && player.energy < 0.25 ? "danger" : "amber"}
          />
        </div>
        <div className="mandate">
          <span>MANDATO QUÍMICO</span>
          <div>
            {[1, 2, 3].map((level) => (
              <i
                key={level}
                className={world.authorityLevel >= level ? "active" : ""}
              />
            ))}
          </div>
        </div>
      </aside>

      <section className="objective">
        <small>ANTES DE LA HELADA</small>
        <div>
          <strong>ABASTECÉ EL CULTIVO</strong>
          <span>{Math.floor(world.colonyBiomass)} / 24</span>
        </div>
        <Meter label="Progreso del objetivo" value={objectiveProgress} />
        <p>La colonia rival lleva {Math.floor(world.rivalBiomass)}.</p>
      </section>

      {world.tutorialStep < 5 && (
        <section className="tutorial-card">
          <span>0{world.tutorialStep + 1}</span>
          <div>
            <strong>{tutorialItem.title}</strong>
            <p>{tutorialItem.detail}</p>
          </div>
        </section>
      )}
      {danger && <div className="danger-vignette" aria-hidden="true" />}
      {danger && (
        <div className="danger-pulse">
          <i /> VIBRACIÓN IRREGULAR
        </div>
      )}
      {tactical && <TacticalMap />}

      <footer className="bottom-bar">
        <div className="signal-readout">
          <small>SEÑAL ACTIVA</small>
          <strong>{signalLabels[signalType]}</strong>
          <span>RADIO {signalRadius} · Q</span>
        </div>
        <button className="tactical-button" aria-pressed={tactical}>
          TAB <span>{tactical ? "VOLVER AL CUERPO" : "LECTURA COLECTIVA"}</span>
        </button>
        {showControls && (
          <div className="control-hint">
            WASD mover · E sujetar/entregar · Shift acelerar · clic para
            orientar cámara
          </div>
        )}
      </footer>

      {subtitles && latestEvent && world.tick - latestEvent.tick < 45 && (
        <div className="subtitle">
          <i />
          {latestEvent.message}
        </div>
      )}
      {world.paused && !settingsOpen && (
        <div className="paused-card">
          <small>EL MODO LOCAL ESTÁ PAUSADO</small>
          <strong>La estepa espera.</strong>
          <button onClick={togglePause}>Continuar</button>
        </div>
      )}
      {settingsOpen && <SettingsPanel />}
      {world.status !== "playing" && (
        <div className={`end-card ${world.status}`}>
          <small>
            {world.status === "victory"
              ? "LA VENTANA SE CIERRA"
              : "LA COLONIA CEDE"}
          </small>
          <h2>
            {world.status === "victory"
              ? "El cultivo sobrevivirá."
              : "La memoria no alcanza."}
          </h2>
          <p>{world.statusReason}</p>
          <div className="end-stats">
            <span>
              <b>{Math.floor(world.colonyBiomass)}</b>sustrato
            </span>
            <span>
              <b>{world.metrics.unitsConsumed}</b>consumidas
            </span>
            <span>
              <b>{world.metrics.attacksAvoided}</b>evasiones
            </span>
          </div>
          <button onClick={restart}>NUEVA EMERGENCIA</button>
        </div>
      )}
      {diagnostics && <Diagnostics />}
    </div>
  );
}
