import { useRef, useState } from "react";
import { api } from "../lib/api";

export function useAudio() {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playing, setPlaying] = useState<string | null>(null);

  async function preview(filename: string, endpoint: string, body: object) {
    try {
      const res: any = await api.post(endpoint, body);
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      const a = new Audio(res.url);
      audioRef.current = a;
      setPlaying(filename);
      a.onended = () => setPlaying(null);
      a.onerror = () => setPlaying(null);
      await a.play();
    } catch {
      setPlaying(null);
    }
  }

  async function stop(endpoint = "/api/tones/stop") {
    try {
      await api.post(endpoint, {});
    } finally {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setPlaying(null);
    }
  }

  function isPlaying(filename: string) {
    return playing === filename;
  }

  return { playing, preview, stop, isPlaying };
}
