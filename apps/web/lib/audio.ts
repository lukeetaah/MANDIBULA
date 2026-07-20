export class AudioManager {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private enabled = true;
  private lastPlay = 0;

  async init() {
    if (this.ctx || !this.enabled) return;
    try {
      const AC =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      this.ctx = new AC();
      if (this.ctx.state === "suspended") await this.ctx.resume();
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.value = 0.35;
      this.masterGain.connect(this.ctx.destination);
    } catch {
      this.enabled = false;
    }
  }

  private beep(
    freq: number,
    type: OscillatorType,
    dur: number,
    vol = 1,
    delay = 0,
  ) {
    if (!this.ctx || !this.masterGain || this.ctx.state !== "running") return;
    const now = Date.now();
    if (now - this.lastPlay < 60) return; // cooldown
    this.lastPlay = now;
    const t = this.ctx.currentTime + delay;
    const osc = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol * 0.5, t + 0.04);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.connect(g);
    g.connect(this.masterGain);
    osc.start(t);
    osc.stop(t + dur);
  }

  confirm() {
    this.beep(620, "sine", 0.12, 0.6);
    setTimeout(() => this.beep(880, "sine", 0.15, 0.5), 90);
  }
  alert() {
    this.beep(300, "square", 0.25, 0.5);
  }
  layerSwitch() {
    this.beep(220, "triangle", 0.18, 0.4);
  }
  phaseComplete() {
    this.beep(440, "sine", 0.3, 0.4);
    setTimeout(() => this.beep(660, "sine", 0.5, 0.5), 220);
  }
  endGame(victory: boolean) {
    if (victory) {
      this.beep(400, "sine", 0.5, 0.5);
      setTimeout(() => this.beep(600, "sine", 0.7, 0.6), 300);
    } else {
      this.beep(200, "sawtooth", 0.7, 0.5);
    }
  }

  dispose() {
    this.ctx?.close();
    this.ctx = null;
    this.masterGain = null;
  }
}

export const audio = new AudioManager();
