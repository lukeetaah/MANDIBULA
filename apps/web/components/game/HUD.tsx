"use client";

import { useEffect, useMemo, useRef } from "react";
import { checksumWorld } from "@mandibula/simulation";
import { useGameStore } from "@/lib/game-store";

const tutorial = [
  {
    kicker: "01 · ESCUCHA",
    title: "Elegí una patrulla",
    detail: "Arrastrá una caja sobre varias obreras o hacé clic en una.",
  },
  {
    kicker: "02 · INTENCIÓN",
    title: "Dales un destino",
    detail:
      "Clic derecho sobre terreno abierto. Ellas resolverán la formación.",
  },
  {
    kicker: "03 · SUSTRATO",
    title: "Asigná una fuente",
    detail: "Clic derecho sobre el parche verde al este del nido.",
  },
  {
    kicker: "04 · RED",
    title: "Observá el regreso",
    detail:
      "No microgestiones: la patrulla cosecha, vuelve y repite el circuito.",
  },
  {
    kicker: "05 · MEMORIA",
    title: "Volvé visible una decisión",
    detail: "Pulsá Q o SEÑAL para dejar una memoria química en la patrulla.",
  },
  {
    kicker: "RITO COMPLETO",
    title: "La colonia ya te escucha",
    detail:
      "Ahora dirigís flujos, no cuerpos. Expandí la red antes de la helada.",
  },
] as const;

const signalLabels = {
  alarm: "ALARMA",
  forage: "FORRAJE",
  home: "RETORNO",
  avoid: "EVITAR",
  recruit: "RECLUTAR",
} as const;

function Meter({ value, danger = false }: { value: number; danger?: boolean }) {
  return (
    <span className="micro-meter" aria-label={`${Math.round(value * 100)}%`}>
      <i
        className={danger ? "danger" : ""}
        style={{ width: `${Math.max(2, value * 100)}%` }}
      />
    </span>
  );
}

function MiniMap() {
  const world = useGameStore((state) => state.world);
  const selectedIds = useGameStore((state) => state.selectedIds);
  const tactical = useGameStore((state) => state.tactical);
  const setTactical = useGameStore((state) => state.setTactical);
  const scaleX = (x: number) => `${50 + (x / 120) * 100}%`;
  const scaleY = (z: number) => `${50 + (z / 100) * 100}%`;
  return (
    <button
      className={`minimap ${tactical ? "is-chemical" : ""}`}
      onClick={() => setTactical(!tactical)}
      aria-label="Alternar lectura química"
    >
      <span className="minimap-label">
        <b>{tactical ? "MEMORIA QUÍMICA" : "TERRITORIO"}</b>
        <small>TAB</small>
      </span>
      <span className="minimap-field">
        <i className="mini-nest" style={{ left: "50%", top: "50%" }} />
        <i
          className="mini-rival"
          style={{ left: scaleX(37), top: scaleY(-28) }}
        />
        {world.resources
          .filter((resource) => resource.amount > 0)
          .map((resource) => (
            <i
              key={resource.id}
              className="mini-resource"
              style={{
                left: scaleX(resource.position.x),
                top: scaleY(resource.position.z),
              }}
            />
          ))}
        {world.spiders
          .filter((spider) => spider.visible)
          .map((spider) => (
            <i
              key={spider.id}
              className={`mini-danger ${spider.dominant ? "dominant" : ""}`}
              style={{
                left: scaleX(spider.position.x),
                top: scaleY(spider.position.z),
              }}
            />
          ))}
        {world.agents
          .filter((agent) => selectedIds.includes(agent.id))
          .slice(0, 24)
          .map((agent) => (
            <i
              key={agent.id}
              className="mini-selected"
              style={{
                left: scaleX(agent.position.x),
                top: scaleY(agent.position.z),
              }}
            />
          ))}
        {tactical &&
          world.pheromones.map((field) => (
            <i
              key={field.id}
              className={`mini-signal ${field.type}`}
              style={{
                left: scaleX(field.position.x),
                top: scaleY(field.position.z),
                width: `${Math.max(8, field.radius * 2)}px`,
                height: `${Math.max(8, field.radius * 2)}px`,
                opacity: field.intensity,
              }}
            />
          ))}
      </span>
    </button>
  );
}

function Briefing() {
  const setHelpOpen = useGameStore((state) => state.setHelpOpen);
  return (
    <div
      className="briefing-backdrop"
      role="dialog"
      aria-modal="true"
      aria-label="Tutorial de mando colectivo"
    >
      <section className="briefing-panel">
        <div className="briefing-sigil" aria-hidden="true">
          <i />
          <i />
          <i />
        </div>
        <div className="briefing-copy">
          <small>PROTOCOLO DE EMERGENCIA · 90 SEGUNDOS</small>
          <h2>
            No movés hormigas.
            <br />
            <em>Movés intención.</em>
          </h2>
          <p>
            MANDÍBULA no premia el clic más rápido. Leés una ecología,
            distribuís atención y dejás que la colonia convierta órdenes simples
            en conducta compleja.
          </p>
          <div className="briefing-principles">
            <div>
              <b>01</b>
              <span>
                <strong>SELECCIONÁ</strong>una patrulla con clic o arrastre
              </span>
            </div>
            <div>
              <b>02</b>
              <span>
                <strong>ORDENÁ</strong>con clic derecho en suelo o alimento
              </span>
            </div>
            <div>
              <b>03</b>
              <span>
                <strong>OBSERVÁ</strong>antes de corregir el sistema
              </span>
            </div>
          </div>
          <button onClick={() => setHelpOpen(false)}>
            ENTRAR AL PULSO <span>→</span>
          </button>
        </div>
      </section>
    </div>
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
          Velocidad de cámara{" "}
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
          WASD o bordes: desplazar · rueda: zoom · botón central: rotar ·
          clic/arrastre: seleccionar · clic derecho: ordenar · Q: señal · R:
          regresar · Tab: química · Esc: pausa.
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

function useAmbientSound(enabled: boolean) {
  const audio = useRef<{ context: AudioContext; gain: GainNode } | null>(null);
  useEffect(() => {
    const start = () => {
      if (audio.current) return;
      const context = new AudioContext();
      const frames = context.sampleRate * 2;
      const buffer = context.createBuffer(1, frames, context.sampleRate);
      const data = buffer.getChannelData(0);
      for (let index = 0; index < frames; index += 1)
        data[index] =
          (Math.random() * 2 - 1) * (0.28 + Math.sin(index / 13000) * 0.1);
      const source = context.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      const filter = context.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 430;
      const gain = context.createGain();
      gain.gain.value = enabled ? 0.018 : 0;
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
        enabled ? 0.018 : 0,
        audio.current.context.currentTime,
        0.12,
      );
  }, [enabled]);
}

function Diagnostics() {
  const world = useGameStore((state) => state.world);
  const fps = useGameStore((state) => state.fps);
  return (
    <aside className="diagnostics">
      <b>SIM</b>
      <span>{fps} fps</span>
      <span>tick {world.tick}</span>
      <span>
        {world.agents.filter((agent) => agent.alive).length} entidades
      </span>
      <span>hash {checksumWorld(world)}</span>
    </aside>
  );
}

export function HUD() {
  const world = useGameStore((state) => state.world);
  const selectedIds = useGameStore((state) => state.selectedIds);
  const selectionBox = useGameStore((state) => state.selectionBox);
  const helpOpen = useGameStore((state) => state.helpOpen);
  const settingsOpen = useGameStore((state) => state.settingsOpen);
  const signalType = useGameStore((state) => state.signalType);
  const signalRadius = useGameStore((state) => state.signalRadius);
  const setHelpOpen = useGameStore((state) => state.setHelpOpen);
  const setSettingsOpen = useGameStore((state) => state.setSettingsOpen);
  const setSignalRadius = useGameStore((state) => state.setSignalRadius);
  const cycleSignal = useGameStore((state) => state.cycleSignal);
  const returnSelected = useGameStore((state) => state.returnSelected);
  const emitSignal = useGameStore((state) => state.emitSignal);
  const requestFocus = useGameStore((state) => state.requestFocus);
  const selectUnits = useGameStore((state) => state.selectUnits);
  const togglePause = useGameStore((state) => state.togglePause);
  const restart = useGameStore((state) => state.restart);
  const sound = useGameStore((state) => state.settings.sound);
  const subtitles = useGameStore((state) => state.settings.subtitles);
  const setFps = useGameStore((state) => state.setFps);
  const selected = world.agents.filter((agent) =>
    selectedIds.includes(agent.id),
  );
  const colony = world.agents.filter(
    (agent) =>
      agent.alive && agent.kind === "ant" && agent.faction === "acromyrmex",
  );
  const latestEvent = world.eventLog[world.eventLog.length - 1];
  const tutorialItem =
    tutorial[Math.min(world.tutorialStep, tutorial.length - 1)]!;
  const frame = useRef({ at: performance.now(), count: 0 });

  useAmbientSound(sound);
  useEffect(() => {
    let handle = 0;
    const count = (now: number) => {
      frame.current.count += 1;
      if (now - frame.current.at >= 1000) {
        setFps(
          Math.round((frame.current.count * 1000) / (now - frame.current.at)),
        );
        frame.current = { at: now, count: 0 };
      }
      handle = requestAnimationFrame(count);
    };
    handle = requestAnimationFrame(count);
    return () => cancelAnimationFrame(handle);
  }, [setFps]);

  const danger = useMemo(() => {
    const watched = selected.length ? selected : colony.slice(0, 1);
    return world.spiders.some(
      (spider) =>
        spider.visible &&
        watched.some(
          (agent) =>
            (spider.position.x - agent.position.x) ** 2 +
              (spider.position.z - agent.position.z) ** 2 <
            120,
        ),
    );
  }, [colony, selected, world.spiders]);
  const averageEnergy = selected.length
    ? selected.reduce((sum, agent) => sum + agent.energy, 0) / selected.length
    : 0;
  const carrying = selected.filter((agent) => agent.carrying > 0).length;
  const available = colony
    .filter(
      (agent) => agent.order === "autonomous" || agent.order === undefined,
    )
    .map((agent) => agent.id);
  const diagnostics =
    process.env.NODE_ENV === "development" ||
    process.env.NEXT_PUBLIC_ENABLE_DIAGNOSTICS === "true";

  return (
    <div className="hud">
      <header className="rts-topbar">
        <div className="colony-brand">
          <i />
          <div>
            <b>MANDÍBULA</b>
            <span>ACROMYRMEX · RED 01</span>
          </div>
        </div>
        <div className="world-pulse">
          <span>
            <small>CULTIVO</small>
            <b>{Math.round(world.fungusHealth * 100)}%</b>
          </span>
          <span>
            <small>BIOMASA</small>
            <b>{Math.floor(world.colonyBiomass)}</b>
          </span>
          <span>
            <small>OBRERAS</small>
            <b>{colony.length}</b>
          </span>
          <span>
            <small>CLIMA</small>
            <b>{Math.round(world.temperature)}°</b>
          </span>
        </div>
        <div className="top-actions">
          <button onClick={() => setHelpOpen(true)}>GUÍA</button>
          <button
            onClick={() => setSettingsOpen(true)}
            aria-label="Abrir accesibilidad"
          >
            AJUSTES
          </button>
          <button onClick={togglePause}>{world.paused ? "SEGUIR" : "Ⅱ"}</button>
        </div>
      </header>

      <section className="mission-card">
        <small>
          VENTANA TÉRMICA · {Math.max(0, 15 - Math.floor(world.tick / 600))}:00
        </small>
        <div>
          <h2>Alimentá lo que no ves.</h2>
          <b>
            {Math.floor(world.colonyBiomass)} <i>/ 24</i>
          </b>
        </div>
        <Meter value={world.colonyBiomass / 24} />
        <p>
          El cultivo subterráneo convierte hojas en futuro. La colonia rival
          lleva {Math.floor(world.rivalBiomass)}.
        </p>
      </section>

      <section className={`tutorial-beacon step-${world.tutorialStep}`}>
        <small>{tutorialItem.kicker}</small>
        <h3>{tutorialItem.title}</h3>
        <p>{tutorialItem.detail}</p>
        <div className="tutorial-track">
          {tutorial.map((_, index) => (
            <i
              key={index}
              className={index <= world.tutorialStep ? "done" : ""}
            />
          ))}
        </div>
      </section>

      {danger && <div className="danger-vignette" aria-hidden="true" />}
      {danger && (
        <div className="danger-pulse">
          <i /> PATRÓN DE CAZA DETECTADO
        </div>
      )}

      <section
        className={`selection-panel ${selected.length ? "has-selection" : ""}`}
      >
        <div className="selection-avatar">
          <span>{selected.length || "—"}</span>
          <small>{selected.length === 1 ? "OBRERA" : "PATRULLA"}</small>
        </div>
        <div className="selection-copy">
          <small>
            {selected.length ? "SELECCIÓN ACTIVA" : "SIN SELECCIÓN"}
          </small>
          <strong>
            {selected.length
              ? `${selected.length} conciencias, una intención`
              : "Arrastrá sobre la colonia"}
          </strong>
          <div className="selection-stats">
            <span>
              ENERGÍA{" "}
              <Meter value={averageEnergy} danger={averageEnergy < 0.3} />
            </span>
            <span>
              CARGA{" "}
              <b>
                {carrying}/{selected.length || 0}
              </b>
            </span>
          </div>
        </div>
        {!selected.length && (
          <button
            className="select-available"
            onClick={() => selectUnits(available.slice(0, 12))}
          >
            ELEGIR 12 DISPONIBLES
          </button>
        )}
      </section>

      <nav className="command-dock" aria-label="Órdenes de colonia">
        <button className="command passive" disabled={!selected.length}>
          <span className="command-icon move">⌖</span>
          <b>MOVER</b>
          <small>clic derecho</small>
        </button>
        <button className="command passive" disabled={!selected.length}>
          <span className="command-icon gather">◇</span>
          <b>COSECHAR</b>
          <small>sobre recurso</small>
        </button>
        <button
          className="command"
          disabled={!selected.length}
          onClick={returnSelected}
        >
          <span className="command-icon return">↙</span>
          <b>REGRESAR</b>
          <small>R</small>
        </button>
        <button
          className="command signal-command"
          disabled={!selected.length}
          onClick={() => emitSignal()}
        >
          <span className="command-icon signal">◉</span>
          <b>{signalLabels[signalType]}</b>
          <small>SEÑAL · Q</small>
        </button>
        <button
          className="command narrow"
          onClick={cycleSignal}
          title="Cambiar señal"
        >
          <span className="command-icon">↻</span>
          <b>TIPO</b>
          <small>cambiar</small>
        </button>
        <button
          className="command narrow"
          disabled={!selected.length}
          onClick={requestFocus}
        >
          <span className="command-icon">◎</span>
          <b>ENFOCAR</b>
          <small>cámara</small>
        </button>
        <label className="radius-control">
          RADIO{" "}
          <input
            type="range"
            min="2"
            max="14"
            value={signalRadius}
            onChange={(event) => setSignalRadius(Number(event.target.value))}
          />
          <b>{signalRadius}m</b>
        </label>
      </nav>

      <MiniMap />
      <div className="camera-hint">
        WASD / BORDES <i /> RUEDA ZOOM <i /> BOTÓN CENTRAL ROTAR
      </div>

      {selectionBox && <div className="selection-box" style={selectionBox} />}
      {subtitles && latestEvent && world.tick - latestEvent.tick < 45 && (
        <div className="subtitle">
          <i />
          {latestEvent.message}
        </div>
      )}
      {world.rain > 0.15 && (
        <div className="weather-wash">
          <span>LLUVIA · LAS SEÑALES SE DEGRADAN</span>
        </div>
      )}
      {world.paused && !settingsOpen && (
        <div className="paused-card">
          <small>SIMULACIÓN EN SUSPENSO</small>
          <strong>La estepa contiene el aliento.</strong>
          <button onClick={togglePause}>CONTINUAR</button>
        </div>
      )}
      {helpOpen && <Briefing />}
      {settingsOpen && <SettingsPanel />}
      {world.status !== "playing" && (
        <div className={`end-card ${world.status}`}>
          <small>
            {world.status === "victory"
              ? "LA VENTANA SE CIERRA"
              : "LA RED CEDE"}
          </small>
          <h2>
            {world.status === "victory"
              ? "El cultivo recordará esta ruta."
              : "La memoria no alcanzó."}
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
          <button onClick={restart}>NUEVA COLONIA</button>
        </div>
      )}
      {diagnostics && <Diagnostics />}
    </div>
  );
}
