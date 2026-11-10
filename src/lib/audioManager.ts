type Listener = () => void;

export interface BrowserEqualizer {
  enabled: boolean;
  gains: readonly number[];
  frequencies: readonly number[];
  q: number;
}

class AudioManager {
  private audio: HTMLAudioElement | null = null;
  private _playing: string | null = null;
  private listeners = new Set<Listener>();
  private ctx: AudioContext | null = null;
  private filters: BiquadFilterNode[] = [];
  private eq: BrowserEqualizer | null = null;

  private notify() {
    this.listeners.forEach((fn) => fn());
  }

  setEqualizer(eq: BrowserEqualizer | null): void {
    this.eq = eq;
    this.applyGains();
  }

  private applyGains() {
    const eq = this.eq;
    this.filters.forEach((f, i) => {
      f.gain.value = eq?.enabled ? (eq.gains[i] ?? 0) : 0;
    });
  }

  private route(a: HTMLAudioElement) {
    this.filters = [];
    const eq = this.eq;
    if (!eq || typeof AudioContext === "undefined") return;
    try {
      this.ctx ??= new AudioContext();
      const ctx = this.ctx;
      const last = eq.frequencies.length - 1;
      const nodes = eq.frequencies.map((freq, i) => {
        const node = ctx.createBiquadFilter();
        node.type = i === 0 ? "lowshelf" : i === last ? "highshelf" : "peaking";
        node.frequency.value = freq;
        node.Q.value = eq.q;
        return node;
      });
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -1;
      limiter.ratio.value = 20;
      let tail: AudioNode = ctx.createMediaElementSource(a);
      for (const node of [...nodes, limiter]) {
        tail.connect(node);
        tail = node;
      }
      tail.connect(ctx.destination);
      this.filters = nodes;
      this.applyGains();
      void ctx.resume();
    } catch {
      this.filters = [];
    }
  }

  async play(filename: string, url: string): Promise<void> {
    this.stopBrowser();

    this._playing = filename;
    this.notify();

    const a = new Audio(url);
    this.audio = a;
    this.route(a);

    const clear = (name: string) => {
      if (this._playing === name) {
        this._playing = null;
        this.audio = null;
        this.filters = [];
        this.notify();
      }
    };

    a.onended = () => clear(filename);
    a.onerror = () => clear(filename);

    try {
      await a.play();
    } catch {
      clear(filename);
    }
  }

  stopBrowser(): void {
    if (this.audio) {
      this.audio.onended = null;
      this.audio.onerror = null;
      this.audio.pause();
      this.audio = null;
    }
    this.filters = [];
    this._playing = null;
    this.notify();
  }

  get playing(): string | null {
    return this._playing;
  }

  isPlaying(filename: string): boolean {
    return this._playing === filename;
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    return () => this.listeners.delete(fn);
  }
}

export const audioManager = new AudioManager();
