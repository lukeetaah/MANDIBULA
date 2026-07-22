"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  checksumWorld,
  type ColonyPriority,
  type NestChamberType,
} from "@mandibula/simulation";
import { useGameStore } from "@/lib/game-store";
import { audio } from "@/lib/audio";

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
    kicker: "06 · RITMO",
    title: "Acelerá el pulso",
    detail: "Probá ×2 arriba. La simulación avanza sin multiplicar renders.",
  },
  {
    kicker: "07 · INTERIOR",
    title: "Entrá al hormiguero",
    detail: "Abrí SUBSUELO: el hongo, la cría y los residuos dependen de vos.",
  },
  {
    kicker: "08 · ARQUITECTURA",
    title: "Excavá una cámara",
    detail:
      "Gastá biomasa en una cámara que resuelva la necesidad más urgente.",
  },
  {
    kicker: "09 · ECOLOGÍA",
    title: "Leé otra especie",
    detail: "Volvé a superficie y hacé clic sobre un insecto o una araña.",
  },
  {
    kicker: "RITO COMPLETO",
    title: "La colonia depende de tus criterios",
    detail:
      "Alterná logística, arquitectura y riesgo. No existe una única cosecha correcta.",
  },
] as const;

const signalLabels = {
  alarm: "ALARMA",
  forage: "FORRAJE",
  home: "RETORNO",
  avoid: "EVITAR",
  recruit: "RECLUTAR",
} as const;

const faunaProfiles = {
  wasp: {
    name: "VESPULA (Avispa)",
    role: "INTERCEPTORA AÉREA",
    effect:
      "Hostiga arañas pequeñas y puede cazar hormigas obreras aisladas. Mantené a tu patrulla unida.",
  },
  bumblebee: {
    name: "BOMBUS (Abejorro)",
    role: "CIRCUITO FLORAL",
    effect:
      "Inofensivo. Poliniza flores del mallín y suele evitar zonas pobladas o telas de araña.",
  },
  termite: {
    name: "POROTERMES (Termita)",
    role: "INGENIERÍA DE MADERA",
    effect:
      "Sella corredores y bloquea el paso cuando percibe vibraciones de depredadores (arañas).",
  },
  fly: {
    name: "MOSCA DE ESTEPA",
    role: "VECTOR DE RESIDUOS",
    effect:
      "Presa fácil. Si la higiene del nido baja mucho, buscará la basura y contaminará el hongo.",
  },
  beetle: {
    name: "ESCARABAJO CORREDOR",
    role: "DEPREDADOR TERRESTRE",
    effect:
      "Caza a ras del suelo y borra tus rastros químicos. Una patrulla densa puede repelerlo.",
  },
  ant: {
    name: "COLONIA RIVAL",
    role: "COMPETENCIA TERRITORIAL",
    effect:
      "Disputa tus fuentes de alimento y puede agotar recursos antes de que llegues.",
  },
} as const;

const spiderStateMap: Record<string, string> = {
  shelter: "Refugiándose",
  explore: "Patrullando",
  detect: "Alerta",
  stalk: "Acechando",
  strike: "Atacando",
  sated: "Saciada",
  retreat: "Huyendo",
};

const agentTaskMap: Record<string, string> = {
  idle: "Latente",
  move: "En tránsito",
  forage: "Recolección",
  return: "Retornando",
  flee: "Evadiendo",
  defend: "Defendiendo",
  attack: "Hostigando",
  sealed: "Cerrando paso",
};

const chamberCopy = {
  fungus: ["JARDÍN FÚNGICO", "amortigua hambre y estabiliza el cultivo"],
  nursery: ["CÁMARA DE CRÍA", "recupera larvas cuando el hongo está sano"],
  ventilation: [
    "POZO DE VENTILACIÓN",
    "reduce extremos térmicos y exceso de CO₂",
  ],
  waste: ["BOLSÓN DE RESIDUOS", "separa contaminación del jardín"],
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
            <span
              key={spider.id}
              className={`mini-danger-container ${spider.dominant ? "dominant" : ""}`}
              style={{
                left: scaleX(spider.position.x),
                top: scaleY(spider.position.z),
              }}
            >
              <i className="mini-danger-ping" />
              <i className="mini-danger" />
            </span>
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
            <div>
              <b>04</b>
              <span>
                <strong>ALTERNÁ</strong>superficie, ecología y cámaras
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
  const difficulty = useGameStore((state) => state.difficulty);
  const setSetting = useGameStore((state) => state.setSetting);
  const setDifficulty = useGameStore((state) => state.setDifficulty);
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
        <div className="settings-difficulty">
          <small>DIFICULTAD · EFECTO INMEDIATO</small>
          {(["gentle", "balanced", "wild"] as const).map((value) => (
            <button
              key={value}
              className={difficulty === value ? "active" : ""}
              onClick={() => setDifficulty(value)}
            >
              {value === "gentle"
                ? "CALMA"
                : value === "balanced"
                  ? "EQUILIBRIO"
                  : "SILVESTRE"}
            </button>
          ))}
        </div>
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
            label="Pausas que explican"
            checked={settings.guidedPauses}
            onChange={(value) => setSetting("guidedPauses", value)}
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

function useAmbientSound(
  enabled: boolean,
  latestEvent?: { tick: number; type: string },
  intense = false,
) {
  const audio = useRef<{ context: AudioContext; gain: GainNode } | null>(null);
  const lastCue = useRef("");
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
      filter.frequency.value = 760;
      const gain = context.createGain();
      gain.gain.value = enabled ? 0.05 : 0;
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
        enabled ? 0.05 : 0,
        audio.current.context.currentTime,
        0.12,
      );
  }, [enabled]);
  useEffect(() => {
    if (!enabled || !latestEvent || !audio.current) return;
    const key = `${latestEvent.tick}-${latestEvent.type}`;
    if (lastCue.current === key) return;
    lastCue.current = key;
    const { context, gain: master } = audio.current;
    const oscillator = context.createOscillator();
    const cueGain = context.createGain();
    const dangerous = [
      "predator-sign",
      "spider-attack",
      "fauna-attack",
    ].includes(latestEvent.type);
    oscillator.type = dangerous ? "sawtooth" : "sine";
    oscillator.frequency.setValueAtTime(
      dangerous ? 120 : 420,
      context.currentTime,
    );
    oscillator.frequency.exponentialRampToValueAtTime(
      dangerous ? 62 : 620,
      context.currentTime + 0.28,
    );
    cueGain.gain.setValueAtTime(0.0001, context.currentTime);
    cueGain.gain.exponentialRampToValueAtTime(
      intense ? 0.2 : 0.11,
      context.currentTime + 0.025,
    );
    cueGain.gain.exponentialRampToValueAtTime(
      0.0001,
      context.currentTime + 0.34,
    );
    oscillator.connect(cueGain).connect(master);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.36);
  }, [enabled, intense, latestEvent]);
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

export const NEST_WARNING_THRESHOLDS = {
  hygiene: { critical: 0.28, risk: 0.42, hyst: 0.04 },
  moisture: { critical: 0.22, risk: 0.38, hyst: 0.04 },
  wasteLoad: { critical: 0.82, risk: 0.65, hyst: 0.04 },
} as const;

export type WarningSeverity = "attention" | "risk" | "critical";

export interface EcoWarning {
  id: string;
  severity: WarningSeverity;
  title: string;
  causeEffect: string;
}

function useMetricTrend(
  value: number,
  type: "fungus" | "biomass" | "workers" | "temp",
) {
  const historyRef = useRef<number[]>([]);
  const [result, setResult] = useState<{
    direction: "up" | "down" | "stable";
    reason: string;
  }>({
    direction: "stable",
    reason: "Estable",
  });

  useEffect(() => {
    const history = historyRef.current;
    history.push(value);
    if (history.length > 20) history.shift();

    if (history.length < 4) return;

    const first = history[0] ?? 0;
    const last = history[history.length - 1] ?? 0;
    const diff = last - first;

    const threshold = type === "fungus" ? 0.02 : type === "temp" ? 0.8 : 1.0;
    const hystThreshold = threshold * 0.4;

    setResult((prev) => {
      let dir: "up" | "down" | "stable" = prev.direction;

      if (diff > threshold) {
        dir = "up";
      } else if (diff < -threshold) {
        dir = "down";
      } else if (Math.abs(diff) < hystThreshold) {
        dir = "stable";
      }

      let reason = "Tendencia estable";
      if (type === "fungus") {
        reason =
          dir === "up"
            ? "Forraje & sustrato activo"
            : dir === "down"
              ? "Descomposición / Estrés térmico"
              : "Equilibrio fúngico";
      } else if (type === "biomass") {
        reason =
          dir === "up"
            ? "Cosecha en aumento"
            : dir === "down"
              ? "Consumo de mantención"
              : "Reserva constante";
      } else if (type === "workers") {
        reason =
          dir === "up"
            ? "Nuevas eclosiones"
            : dir === "down"
              ? "Bajas en combate / depredación"
              : "Población estable";
      } else if (type === "temp") {
        reason =
          dir === "up"
            ? "Calentamiento diurno"
            : dir === "down"
              ? "Descenso térmico estacional"
              : "Temperatura estable";
      }

      return { direction: dir, reason };
    });
  }, [value, type]);

  return result;
}

export function HUD() {
  const world = useGameStore((state) => state.world);
  const selectedIds = useGameStore((state) => state.selectedIds);
  const selectionBox = useGameStore((state) => state.selectionBox);
  const helpOpen = useGameStore((state) => state.helpOpen);
  const settingsOpen = useGameStore((state) => state.settingsOpen);
  const signalType = useGameStore((state) => state.signalType);
  const signalRadius = useGameStore((state) => state.signalRadius);
  const timeScale = useGameStore((state) => state.timeScale);
  const underground = useGameStore((state) => state.underground);
  const observed = useGameStore((state) => state.observed);
  const setHelpOpen = useGameStore((state) => state.setHelpOpen);
  const setSettingsOpen = useGameStore((state) => state.setSettingsOpen);
  const setSignalRadius = useGameStore((state) => state.setSignalRadius);
  const cycleSignal = useGameStore((state) => state.cycleSignal);
  const setTimeScale = useGameStore((state) => state.setTimeScale);
  const setUnderground = useGameStore((state) => state.setUnderground);
  const inspect = useGameStore((state) => state.inspect);
  const clearInspection = useGameStore((state) => state.clearInspection);
  const attackObserved = useGameStore((state) => state.attackObserved);
  const retreatSelected = useGameStore((state) => state.retreatSelected);
  const expandNest = useGameStore((state) => state.expandNest);
  const setColonyPriority = useGameStore((state) => state.setColonyPriority);
  const issueMove = useGameStore((state) => state.issueMove);
  const returnSelected = useGameStore((state) => state.returnSelected);
  const emitSignal = useGameStore((state) => state.emitSignal);
  const requestFocus = useGameStore((state) => state.requestFocus);
  const selectUnits = useGameStore((state) => state.selectUnits);
  const togglePause = useGameStore((state) => state.togglePause);
  const restart = useGameStore((state) => state.restart);
  const nextEra = useGameStore((state) => state.nextEra);
  const sound = useGameStore((state) => state.settings.sound);
  const intenseSounds = useGameStore((state) => state.settings.intenseSounds);
  const subtitles = useGameStore((state) => state.settings.subtitles);

  // Audio init on first interaction
  useEffect(() => {
    const init = () => {
      audio.init();
      document.removeEventListener("click", init);
    };
    document.addEventListener("click", init);
    return () => document.removeEventListener("click", init);
  }, []);

  // Audio: phase changes and end game
  const prevPhase = useRef(world.seasonPhase);
  const prevStatus = useRef(world.status);
  useEffect(() => {
    if (world.seasonPhase !== prevPhase.current) {
      prevPhase.current = world.seasonPhase;
      if (world.seasonPhase === 4) audio.alert();
      else audio.phaseComplete();
    }
    if (world.status !== prevStatus.current) {
      prevStatus.current = world.status;
      if (world.status === "victory" || world.status === "defeat")
        audio.endGame(world.status === "victory");
    }
  }, [world.seasonPhase, world.status]);

  const selected = world.agents.filter((agent) =>
    selectedIds.includes(agent.id),
  );
  const colony = world.agents.filter(
    (agent) =>
      agent.alive && agent.kind === "ant" && agent.faction === "acromyrmex",
  );
  const latestEvent = world.eventLog[world.eventLog.length - 1];
  const coach = useGameStore((state) => state.coach);
  const dismissCoach = useGameStore((state) => state.dismissCoach);
  const difficulty = useGameStore((state) => state.difficulty);
  const setDifficulty = useGameStore((state) => state.setDifficulty);
  const tutorialItem =
    tutorial[Math.min(world.tutorialStep, tutorial.length - 1)]!;

  useAmbientSound(sound, latestEvent, intenseSounds);

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
  const chamberTotal = Object.values(world.nest.chambers).reduce(
    (sum, level) => sum + level,
    0,
  );
  const mission =
    world.seasonPhase === 1
      ? {
          kicker: "I · REACTIVAR",
          title: "Alimentá lo que no ves.",
          current: world.colonyBiomass,
          target: 18,
          note: "El jardín fúngico necesita sustrato antes de poder expandirse.",
        }
      : world.seasonPhase === 2
        ? {
            kicker: "II · HABITAR",
            title: "Convertí refugio en organismo.",
            current: chamberTotal,
            target: 7,
            note: "Excavá cámaras y sostené la cría; cosechar ya no alcanza.",
          }
        : world.seasonPhase === 3
          ? {
              kicker: "III · PERSISTIR",
              title: "Llegá completa al invierno.",
              current: world.colonyBiomass,
              target: 52,
              note: "Territorio, higiene y depredadores deciden el desenlace.",
            }
          : {
              kicker: "⚡ TORMENTA",
              title: "Sobreviví la caída térmica.",
              current: world.fungusHealth,
              target: 0.3,
              note: "La estepa se congela. Protegé el hongo y conservá biomasa.",
            };
  const fungusTrend = useMetricTrend(world.fungusHealth, "fungus");
  const biomassTrend = useMetricTrend(world.colonyBiomass, "biomass");
  const workersTrend = useMetricTrend(colony.length, "workers");
  const tempTrend = useMetricTrend(world.temperature, "temp");

  const observedAgent =
    observed?.kind === "agent"
      ? world.agents.find((agent) => agent.id === observed.id && agent.alive)
      : undefined;
  const observedSpider =
    observed?.kind === "spider"
      ? world.spiders.find((spider) => spider.id === observed.id)
      : undefined;

  const activeWarnings = useMemo(() => {
    const list: EcoWarning[] = [];
    const { hygiene, moisture, wasteLoad } = NEST_WARNING_THRESHOLDS;

    if (world.nest.hygiene < hygiene.critical) {
      list.push({
        id: "hygiene-crit",
        severity: "critical",
        title: "CRÍTICO · Higiene severa",
        causeEffect:
          "La contaminación del nido enferma la cría y drena la colonia.",
      });
    } else if (world.nest.hygiene < hygiene.risk) {
      list.push({
        id: "hygiene-risk",
        severity: "risk",
        title: "RIESGO · Higiene deficiente",
        causeEffect: "Residuos acumulados aumentan el riesgo de patógenos.",
      });
    }

    if (world.nest.moisture < moisture.critical) {
      list.push({
        id: "moisture-crit",
        severity: "critical",
        title: "CRÍTICO · Deshidratación",
        causeEffect:
          "El cultivo fúngico se seca rápidamente por falta de humedad.",
      });
    } else if (world.nest.moisture < moisture.risk) {
      list.push({
        id: "moisture-risk",
        severity: "risk",
        title: "RIESGO · Humedad baja",
        causeEffect: "Baja humedad reduce el ritmo de eclosión de la cría.",
      });
    }

    if (world.nest.wasteLoad > wasteLoad.critical) {
      list.push({
        id: "waste-crit",
        severity: "critical",
        title: "CRÍTICO · Residuos desbordados",
        causeEffect:
          "Bolsón de residuos al límite atrae moscas y pudre el sustrato.",
      });
    } else if (world.nest.wasteLoad > wasteLoad.risk) {
      list.push({
        id: "waste-risk",
        severity: "risk",
        title: "ATENCIÓN · Carga de residuos alta",
        causeEffect: "Construí un bolsón de residuos o amplia ventilación.",
      });
    }

    return list;
  }, [world.nest.hygiene, world.nest.moisture, world.nest.wasteLoad]);

  const getSpiderGoal = (spider: (typeof world.spiders)[0]) => {
    if (spider.state === "stalk")
      return "Objetivo: Acechando presa en el perímetro";
    if (spider.state === "immobilize" || spider.state === "consume")
      return "Objetivo: Capturando obrera aislada";
    if (spider.state === "sated" || spider.state === "retreat")
      return "Objetivo: Buscando refugio tras cacería";
    if (spider.state === "detect")
      return "Objetivo: Evaluando vibraciones de tránsito";
    if (spider.state === "explore")
      return "Objetivo: Patrullando corredor de caza";
    return "Objetivo: Oculta en terreno";
  };

  const getAgentGoal = (agent: (typeof world.agents)[0]) => {
    if (agent.carrying > 0)
      return "Objetivo: Transportando biomasa hacia el nido";
    if (agent.task === "forage")
      return "Objetivo: Buscando sustrato y alimento";
    if (agent.task === "flee") return "Objetivo: Evadiendo amenaza cercana";
    if (agent.task === "defend") return "Objetivo: Protegiendo acceso al nido";
    if (agent.task === "attack")
      return "Objetivo: Expulsando depredador detectado";
    if (agent.task === "move") return "Objetivo: Desplazándose según mandato";
    if (agent.task === "sealed") return "Objetivo: Sellando galería de madera";
    return "Objetivo: Esperando intención de colonia";
  };

  return (
    <div className={`hud ${underground ? "is-underground" : ""}`}>
      <header className="rts-topbar">
        <div className="colony-brand">
          <i />
          <div>
            <b>MANDÍBULA</b>
            <span>
              ACROMYRMEX · ERA {world.era || 1} (NIVEL {world.colonyLevel || 1})
            </span>
          </div>
        </div>
        <div className="world-pulse">
          <span
            className={`trend-span trend-${fungusTrend.direction}`}
            title={`CULTIVO: ${fungusTrend.reason}`}
            aria-label={`Cultivo al ${Math.round(world.fungusHealth * 100)}%, ${fungusTrend.reason}`}
          >
            <small>CULTIVO</small>
            <b>{Math.round(world.fungusHealth * 100)}%</b>
            <i className="trend-icon" />
          </span>
          <span
            className={`trend-span trend-${biomassTrend.direction}`}
            title={`BIOMASA: ${biomassTrend.reason}`}
            aria-label={`Biomasa ${Math.floor(world.colonyBiomass)}, ${biomassTrend.reason}`}
          >
            <small>BIOMASA</small>
            <b>{Math.floor(world.colonyBiomass)}</b>
            <i className="trend-icon" />
          </span>
          <span
            className={`trend-span trend-${workersTrend.direction}`}
            title={`OBRERAS: ${workersTrend.reason}`}
            aria-label={`Obreras ${colony.length}, ${workersTrend.reason}`}
          >
            <small>OBRERAS</small>
            <b>{colony.length}</b>
            <i className="trend-icon" />
          </span>
          <span
            className={`trend-span trend-${tempTrend.direction}`}
            title={`CLIMA: ${tempTrend.reason}`}
            aria-label={`Clima ${Math.round(world.temperature)}°, ${tempTrend.reason}`}
          >
            <small>CLIMA</small>
            <b>{Math.round(world.temperature)}°</b>
            <i className="trend-icon" />
          </span>
          <span className={`priority-badge priority-${world.colonyPriority}`}>
            <small>PRIORIDAD</small>
            <b>
              {world.colonyPriority === "forage"
                ? "HONGO"
                : world.colonyPriority === "brood"
                  ? "CRÍA"
                  : world.colonyPriority === "excavate"
                    ? "EXCAVAR"
                    : "DEFENSA"}
            </b>
          </span>
        </div>
        <div className="top-actions">
          <div className="speed-control" aria-label="Velocidad de simulación">
            {([1, 2, 3, 6] as const).map((speed) => (
              <button
                key={speed}
                className={timeScale === speed ? "active" : ""}
                onClick={() => setTimeScale(speed)}
                aria-label={`Velocidad por ${speed}`}
              >
                ×{speed}
              </button>
            ))}
          </div>
          <button
            className={`nest-access ${underground ? "active" : ""} ${
              world.tutorialStep === 6 ? "is-called" : ""
            } dominant-toggle`}
            data-danger={
              underground
                ? world.spiders.some((s) => s.agitation > 0.2)
                : world.nest.hygiene < 0.4 || world.nest.moisture < 0.3
            }
            onClick={() => {
              setUnderground(!underground);
              audio.layerSwitch();
            }}
            aria-label={
              underground ? "Volver a superficie" : "Entrar al subsuelo"
            }
          >
            <span aria-hidden="true">{underground ? "↑" : "↓"}</span>
            <b>{underground ? "SUPERFICIE" : "SUBSUELO"}</b>
            <small>B · {underground ? "MAPA" : "CÁMARAS"}</small>
            {(underground
              ? world.spiders.some((s) => s.agitation > 0.2)
              : world.nest.hygiene < 0.4 || world.nest.moisture < 0.3) && (
              <i className="danger-ping" title="¡Atención requerida!" />
            )}
          </button>
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
          {mission.kicker} · {Math.max(0, 20 - Math.floor(world.tick / 600))}:00
        </small>
        <div>
          <h2>{mission.title}</h2>
          <b>
            {Math.floor(mission.current)} <i>/ {mission.target}</i>
          </b>
        </div>
        <Meter value={mission.current / mission.target} />
        <p>{mission.note}</p>
      </section>

      <section className={`tutorial-beacon step-${world.tutorialStep}`}>
        <small>{tutorialItem.kicker}</small>
        <h3>{tutorialItem.title}</h3>
        <p>{tutorialItem.detail}</p>
        {world.tutorialStep === 6 && (
          <button
            className="tutorial-action"
            onClick={() => setUnderground(true)}
          >
            ABRIR SUBSUELO <b>B ↓</b>
          </button>
        )}
        <div className="tutorial-track">
          {tutorial.map((_, index) => (
            <i
              key={index}
              className={index <= world.tutorialStep ? "done" : ""}
            />
          ))}
        </div>
      </section>

      {underground && (
        <section className="nest-console">
          <header>
            <div>
              <small>CORTE A 30–70 CM · RED VIVA</small>
              <h2>Arquitectura del nido</h2>
            </div>
            <button onClick={() => setUnderground(false)}>VOLVER ↑</button>
          </header>
          <div className="nest-vitals">
            <span>
              HUMEDAD <b>{Math.round(world.nest.moisture * 100)}%</b>
            </span>
            <span>
              HIGIENE <b>{Math.round(world.nest.hygiene * 100)}%</b>
            </span>
            <span>
              VENTILACIÓN <b>{Math.round(world.nest.ventilation * 100)}%</b>
            </span>
            <span>
              RESIDUOS <b>{Math.round(world.nest.wasteLoad * 100)}%</b>
            </span>
          </div>
          <div className="nest-warnings">
            {activeWarnings.length > 0 ? (
              activeWarnings.map((warn) => (
                <p key={warn.id} className={`warning ${warn.severity}`}>
                  <b>{warn.title}:</b> {warn.causeEffect}
                </p>
              ))
            ) : (
              <p className="stable">✓ Ecosistema subterráneo estable.</p>
            )}
          </div>
          <div className="chamber-grid">
            {(
              Object.entries(chamberCopy) as [
                NestChamberType,
                (typeof chamberCopy)[NestChamberType],
              ][]
            ).map(([chamber, copy]) => {
              const level = world.nest.chambers[chamber];
              const cost =
                world.colonyPriority === "excavate"
                  ? 3 + level * 2
                  : 4 + level * 3;
              return (
                <button
                  key={chamber}
                  onClick={() => expandNest(chamber)}
                  disabled={level >= 3 || world.colonyBiomass < cost}
                >
                  <small>NIVEL {level} / 3</small>
                  <strong>{copy[0]}</strong>
                  <span>{copy[1]}</span>
                  <b>{level >= 3 ? "MADURA" : `EXCAVAR · ${cost} biomasa`}</b>
                </button>
              );
            })}
          </div>
          <div className="priority-strip">
            <small>¿QUÉ NECESIDAD DOMINA EL TRÁNSITO?</small>
            {(
              ["forage", "brood", "excavate", "defend"] as ColonyPriority[]
            ).map((priority) => (
              <button
                key={priority}
                className={world.colonyPriority === priority ? "active" : ""}
                onClick={() => setColonyPriority(priority)}
              >
                {priority === "forage"
                  ? "HONGO"
                  : priority === "brood"
                    ? "CRÍA"
                    : priority === "excavate"
                      ? "EXCAVAR"
                      : "DEFENSA"}
              </button>
            ))}
          </div>
        </section>
      )}

      {!underground && (observedAgent || observedSpider) && (
        <section className="ecology-dossier">
          <button className="dossier-close" onClick={clearInspection}>
            ×
          </button>
          {observedSpider ? (
            <>
              <small>LECTURA DE VIBRACIÓN · DEPREDADOR</small>
              <h2>
                {observedSpider.guild === "orb-weaver"
                  ? "Araña de tela"
                  : observedSpider.dominant
                    ? "Corredora dominante"
                    : "Corredora terrestre"}
              </h2>
              <b className="dossier-state">
                ESTADO ·{" "}
                {spiderStateMap[observedSpider.state] ||
                  observedSpider.state.toUpperCase()}
              </b>
              <small className="dossier-goal">
                {getSpiderGoal(observedSpider)}
              </small>
              <p>
                {observedSpider.state === "sated" ||
                observedSpider.state === "retreat"
                  ? "Se retira del conflicto. Atacar ahora desperdicia obreras."
                  : observedSpider.dominant
                    ? "Controla un corredor. Rodearla sirve para expulsar, no para vaciar una barra."
                    : "Puede aislar una patrulla; masa, terreno y retirada importan."}
              </p>
              <div className="dossier-functions">
                <span>
                  HAMBRE <Meter value={observedSpider.hunger} />
                </span>
                <span>
                  MOVILIDAD <Meter value={observedSpider.mobility} />
                </span>
                <span>
                  AGITACIÓN <Meter value={observedSpider.agitation} danger />
                </span>
              </div>
              <div className="dossier-actions">
                <button disabled={!selected.length} onClick={attackObserved}>
                  RODEAR CON {selected.length || "—"}
                </button>
                <button disabled={!selected.length} onClick={retreatSelected}>
                  RETIRAR PATRULLA
                </button>
              </div>
            </>
          ) : observedAgent ? (
            <>
              <small>RED TRÓFICA · ACTIVIDAD OBSERVADA</small>
              <h2>{faunaProfiles[observedAgent.kind].name}</h2>
              <b className="dossier-role">
                {faunaProfiles[observedAgent.kind].role}
              </b>
              <small className="dossier-goal">
                {getAgentGoal(observedAgent)}
              </small>
              <p>{faunaProfiles[observedAgent.kind].effect}</p>
              <div className="dossier-functions">
                <span>
                  ENERGÍA <Meter value={observedAgent.energy} />
                </span>
                <span>
                  INTEGRIDAD <Meter value={observedAgent.integrity} />
                </span>
                <span className="dossier-state-pill">
                  CONDUCTA ·{" "}
                  {agentTaskMap[observedAgent.task] ||
                    observedAgent.task.toUpperCase()}
                </span>
              </div>
              <div className="dossier-actions">
                {(["wasp", "fly", "beetle"] as const).includes(
                  observedAgent.kind as "wasp" | "fly" | "beetle",
                ) ? (
                  <button disabled={!selected.length} onClick={attackObserved}>
                    AHUYENTAR CON {selected.length || "—"}
                  </button>
                ) : (
                  <button
                    disabled={!selected.length}
                    onClick={() => issueMove(observedAgent.position)}
                  >
                    LLEVAR PATRULLA
                  </button>
                )}
                <button disabled={!selected.length} onClick={retreatSelected}>
                  NO INTERFERIR
                </button>
              </div>
            </>
          ) : null}
        </section>
      )}

      {!underground && (
        <section className="fauna-key" aria-label="Fauna activa">
          <small>RED VIVA · CLIC PARA IDENTIFICAR</small>
          {(["wasp", "bumblebee", "termite", "fly", "beetle"] as const).map(
            (kind) => {
              const population = world.agents.filter(
                (agent) => agent.kind === kind && agent.alive,
              );
              const specimen = population[0];
              return (
                <button
                  key={kind}
                  className={`fauna-${kind}`}
                  disabled={!specimen}
                  onClick={() => specimen && inspect("agent", specimen.id)}
                >
                  <i />
                  <span>
                    <b>{faunaProfiles[kind].name}</b>
                    <small>{faunaProfiles[kind].role}</small>
                  </span>
                  <em>{population.length}</em>
                </button>
              );
            },
          )}
        </section>
      )}

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
        WASD / BORDES <i /> RUEDA ZOOM <i /> B SUBSUELO <i /> BOTÓN CENTRAL
        ROTAR
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
        <div className={`paused-card ${coach ? `coach-${coach.tone}` : ""}`}>
          <small>{coach ? "LA RED TE EXPLICA · PAUSA" : "PAUSA TÁCTICA"}</small>
          <strong>{coach?.title ?? "La estepa contiene el aliento."}</strong>
          {coach ? (
            <>
              <p>{coach.body}</p>
              <div className="coach-response">
                <b>QUÉ PODÉS HACER</b>
                <span>{coach.response}</span>
              </div>
              <div className="coach-actions">
                {difficulty !== "gentle" && (
                  <button onClick={() => setDifficulty("gentle")}>
                    BAJAR A CALMA
                  </button>
                )}
                <button onClick={dismissCoach}>ENTENDIDO · SEGUIR</button>
              </div>
            </>
          ) : (
            <>
              <p>
                Mirá las rutas, la higiene y los depredadores. Nada avanza hasta
                que decidas.
              </p>
              <button onClick={togglePause}>CONTINUAR</button>
            </>
          )}
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
              <b>{Math.floor(world.colonyBiomass)}</b>biomasa
            </span>
            <span>
              <b>{Math.round(world.fungusHealth * 100)}%</b>hongo
            </span>
            <span>
              <b>{Math.round(world.nest.hygiene * 100)}%</b>higiene
            </span>
            <span>
              <b>{colony.length}</b>sobrevivientes
            </span>
            <span>
              <b>{world.metrics.unitsConsumed}</b>perdidas
            </span>
            <span>
              <b>{Math.round(world.broodHealth * 100)}%</b>cría
            </span>
          </div>
          <div className="end-causes">
            <small>CAUSAS PRINCIPALES</small>
            {world.colonyBiomass < 20 && (
              <p>⚠ Reserva de biomasa insuficiente para la tormenta.</p>
            )}
            {world.fungusHealth < 0.4 && (
              <p>⚠ El jardín fúngico sufrió daño crítico.</p>
            )}
            {world.nest.hygiene < 0.4 && (
              <p>⚠ La contaminación del nido debilitó la colonia.</p>
            )}
            {world.metrics.unitsConsumed > 8 && (
              <p>⚠ Las pérdidas por fauna fueron altas.</p>
            )}
            {colony.length > 40 && world.fungusHealth > 0.5 && (
              <p>✓ La colonia mantuvo masa crítica.</p>
            )}
            {world.nest.chambers.fungus > 1 && (
              <p>✓ Infraestructura fúngica expandida.</p>
            )}
            {world.metrics.totalBiomassHarvested > 60 && (
              <p>✓ Recolección eficiente durante la partida.</p>
            )}
          </div>
          {world.status === "victory" && (
            <div className="evolution-reward-box">
              <small>
                HERENCIA GENÉTICA DESBLOQUEADA · ERA {(world.era || 1) + 1}
              </small>
              <b>
                {(world.colonyLevel || 1) === 1
                  ? "🧬 Quitina Reforzada Patagónica (+25% Carga, +15% Armadura, Obreras Doradas)"
                  : (world.colonyLevel || 1) === 2
                    ? "🧬 Feromona de Asalto & Espinas Cuticulares (+30% Ataque, +20% Velocidad)"
                    : "🧬 Superorganismo Eosférico Patagónico (Jardín Fúngico Ultra-rendimiento)"}
              </b>
            </div>
          )}
          <div className="end-actions">
            {world.status === "victory" ? (
              <>
                <button
                  className="primary-action next-era-btn"
                  onClick={nextEra}
                >
                  EVOLUCIONAR A ERA {(world.era || 1) + 1} (NIVEL{" "}
                  {(world.colonyLevel || 1) + 1}) ➔
                </button>
                <button className="text-action" onClick={restart}>
                  Reiniciar desde cero (Era I)
                </button>
              </>
            ) : (
              <button onClick={restart}>NUEVA COLONIA</button>
            )}
          </div>
        </div>
      )}
      {diagnostics && <Diagnostics />}
    </div>
  );
}
