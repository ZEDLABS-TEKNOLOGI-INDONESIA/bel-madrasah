import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { audioManager } from "../lib/audioManager";
import { queryClient } from "../lib/queryClient";

function safeAudioUrl(url: string): string {
  return url
    .split("/")
    .map((seg, i) => (i === 0 ? seg : encodeURIComponent(decodeURIComponent(seg))))
    .join("/");
}

export function useAudio() {
  // Sinkron dengan audioManager singleton — tidak hilang saat navigasi
  const [playing, setPlaying] = useState<string | null>(audioManager.playing);

  useEffect(() => {
    return audioManager.subscribe(() => setPlaying(audioManager.playing));
  }, []);

  async function preview(filename: string, endpoint: string, body: object) {
    try {
      const res: any = await api.post(endpoint, body);
      const url = safeAudioUrl(res.url ?? "");
      await audioManager.play(filename, url);
      // Langsung refresh dashboard setelah play
      queryClient.invalidateQueries({ queryKey: ["service-status"] });
    } catch {
      audioManager.stopBrowser();
    }
  }

  async function stop(endpoint = "/api/tones/stop") {
    try {
      await api.post(endpoint, {});
    } finally {
      audioManager.stopBrowser();
      queryClient.invalidateQueries({ queryKey: ["service-status"] });
    }
  }

  function isPlaying(filename: string) {
    return audioManager.isPlaying(filename);
  }

  return { playing, preview, stop, isPlaying };
}
