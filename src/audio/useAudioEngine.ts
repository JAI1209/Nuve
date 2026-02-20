import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface AudioEngineOptions {
  src: string;
  isPlaying: boolean;
  volume: number;
  onEnded?: () => void;
}

export function useAudioEngine({ src, isPlaying, volume, onEnded }: AudioEngineOptions) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  if (!audioRef.current) {
    audioRef.current = new Audio();
    audioRef.current.preload = "metadata";
  }

  const audio = useMemo(() => audioRef.current!, []);

  useEffect(() => {
    const handleTimeUpdate = () => setCurrentTime(audio.currentTime || 0);
    const handleLoadedMetadata = () => setDuration(audio.duration || 0);
    const handleEnded = () => {
      setCurrentTime(0);
      onEnded?.();
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    audio.addEventListener("loadedmetadata", handleLoadedMetadata);
    audio.addEventListener("ended", handleEnded);

    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
      audio.removeEventListener("loadedmetadata", handleLoadedMetadata);
      audio.removeEventListener("ended", handleEnded);
    };
  }, [audio, onEnded]);

  useEffect(() => {
    if (!src) {
      audio.pause();
      setCurrentTime(0);
      setDuration(0);
      return;
    }

    if (audio.src !== src) {
      audio.src = src;
      audio.load();
      setCurrentTime(0);
    }
  }, [audio, src]);

  useEffect(() => {
    audio.volume = volume;
  }, [audio, volume]);

  useEffect(() => {
    if (!src) return;

    if (isPlaying) {
      void audio.play();
    } else {
      audio.pause();
    }
  }, [audio, isPlaying, src]);

  useEffect(() => {
    return () => {
      audio.pause();
      audio.src = "";
    };
  }, [audio]);

  const seek = useCallback(
    (seconds: number) => {
      audio.currentTime = seconds;
      setCurrentTime(seconds);
    },
    [audio]
  );

  return {
    currentTime,
    duration,
    play: () => audio.play(),
    pause: () => audio.pause(),
    seek
  };
}
