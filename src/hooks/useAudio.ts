import { useEffect, useState } from "react";
import { api } from "../lib/api";
import { audioManager } from "../lib/audioManager";
import { safeAudioUrl } from "../lib/format";
import { queryClient } from "../lib/queryClient";
import type { PreviewResponse } from "../lib/types";

export function useAudio() {
  const [playing, setPlaying] = useState<string | null>(audioManager.playing);

  useEffect(() => {
    return audioManager.subscribe(() => setPlaying(audioManager.playing));
  }, []);

  async function preview(filename: string, endpoint: string, body: object) {
    try {
      const res = await api.post<PreviewResponse>(endpoint, body);
      await audioManager.play(filename, safeAudioUrl(res.url));
      queryClient.invalidateQueries({ queryKey: ["service-status"] });
    } catch (e) {
      audioManager.stopBrowser();
      throw e;
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
