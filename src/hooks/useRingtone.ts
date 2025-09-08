import { useRef, useCallback } from "react";

export const useRingtone = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const playRingtone = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.currentTime = 0; // Reset to beginning
      audioRef.current.play().catch((error) => {
        console.warn("Failed to play ringtone:", error);
      });
    }
  }, []);

  const stopRingtone = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
  }, []);

  const initializeAudio = useCallback(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio("/ringtone.mp3");
      audioRef.current.loop = true;
      audioRef.current.volume = 0.7; // Set volume to 70%
    }
  }, []);

  return {
    playRingtone,
    stopRingtone,
    initializeAudio,
  };
};
