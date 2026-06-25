type Listener = () => void;

class AudioManager {
  private audio: HTMLAudioElement | null = null;
  private _playing: string | null = null;
  private listeners = new Set<Listener>();

  private notify() {
    this.listeners.forEach((fn) => fn());
  }

  async play(filename: string, url: string): Promise<void> {
    // Hentikan audio browser yang sedang berjalan
    this.stopBrowser();

    this._playing = filename;
    this.notify();

    const a = new Audio(url);
    this.audio = a;

    const clear = (name: string) => {
      if (this._playing === name) {
        this._playing = null;
        this.audio = null;
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

// Singleton — satu instance untuk seluruh aplikasi
export const audioManager = new AudioManager();
