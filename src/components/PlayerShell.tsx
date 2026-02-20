import { ChangeEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAppDispatch, useAppSelector } from "../app/hooks";
import { fetchCatalog, fetchUserProfile, upsertUserProfile, USER_ID, type PlayerProfile } from "../lib/playerApi";
import { fetchCategorySongs, searchYouTubeSongs, type MusicCategory } from "../lib/youtubeApi";
import {
  addTracksToQueue,
  addTrackToPlaylist,
  addTrackToQueue,
  createPlaylist,
  deletePlaylist,
  hydratePlayerPreferences,
  removeTrackFromPlaylist,
  setActivePlaylist,
  setCurrentTrack,
  setEqualizerBand,
  setIsPlaying,
  setQueue,
  setStreamQuality,
  setVolume,
  toggleFavorite,
  type StreamQuality,
  type Track
} from "../features/player/playerSlice";

declare global {
  interface Window {
    YT?: any;
    onYouTubeIframeAPIReady?: () => void;
  }
}

const YOUTUBE_PLAYER_STATE = {
  ENDED: 0,
  PLAYING: 1,
  PAUSED: 2
} as const;

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function isTypingContext(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60)
    .toString()
    .padStart(2, "0");
  return `${mins}:${secs}`;
}

function resolveTrackSrc(track: Track | null, quality: StreamQuality) {
  if (!track || track.sourceKind === "youtube") return "";
  return track.sources[quality] ?? track.sources.high;
}

function loadYouTubeApi() {
  if (window.YT?.Player) {
    return Promise.resolve(window.YT);
  }

  return new Promise<any>((resolve, reject) => {
    const existingScript = document.querySelector<HTMLScriptElement>(
      'script[src="https://www.youtube.com/iframe_api"]'
    );

    if (!existingScript) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      script.onerror = () => reject(new Error("Failed to load YouTube API"));
      document.body.appendChild(script);
    }

    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      previous?.();
      if (window.YT) {
        resolve(window.YT);
      } else {
        reject(new Error("YouTube API unavailable"));
      }
    };
  });
}

function randomIndex(max: number, except: number) {
  if (max <= 1) return except;

  let idx = except;
  while (idx === except) {
    idx = Math.floor(Math.random() * max);
  }
  return idx;
}

export function PlayerShell() {
  const dispatch = useAppDispatch();
  const {
    queue,
    currentTrackId,
    isPlaying,
    volume,
    favorites,
    streamQuality,
    equalizer,
    playlists,
    activePlaylistId
  } = useAppSelector((state) => state.player);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const youtubeHostRef = useRef<HTMLDivElement | null>(null);
  const youtubePlayerRef = useRef<any>(null);
  const youtubeTickerRef = useRef<number | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const centerColumnRef = useRef<HTMLElement | null>(null);
  const settingsRef = useRef<HTMLDivElement | null>(null);
  const dockRef = useRef<HTMLElement | null>(null);
  const hydratedRef = useRef(false);

  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [youtubeState, setYoutubeState] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [youtubeResults, setYoutubeResults] = useState<Track[]>([]);
  const [youtubeLoading, setYoutubeLoading] = useState(false);
  const [youtubeError, setYoutubeError] = useState<string | null>(null);
  const [youtubePlayerLoading, setYoutubePlayerLoading] = useState(false);
  const [youtubePlayerError, setYoutubePlayerError] = useState<string | null>(null);
  const [loopMode, setLoopMode] = useState(false);
  const [autoplayMode, setAutoplayMode] = useState(true);
  const [theaterMode, setTheaterMode] = useState(false);
  const [visualizerMode, setVisualizerMode] = useState(true);
  const [shuffleMode, setShuffleMode] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [categoryLoading, setCategoryLoading] = useState<MusicCategory | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<MusicCategory | "all">("all");

  if (!audioRef.current) {
    audioRef.current = new Audio();
    audioRef.current.preload = "metadata";
  }

  useEffect(() => {
    let mounted = true;

    void Promise.all([fetchCatalog(), fetchUserProfile(USER_ID)]).then(([catalog, profile]) => {
      if (!mounted) return;

      dispatch(setQueue(catalog));

      if (profile) {
        const safeProfile = profile as PlayerProfile;
        const trackExists = catalog.some((track) => track.id === safeProfile.currentTrackId);

        dispatch(
          hydratePlayerPreferences({
            favorites: safeProfile.favorites,
            streamQuality: safeProfile.streamQuality,
            equalizer: safeProfile.equalizer,
            volume: safeProfile.volume,
            currentTrackId: trackExists ? safeProfile.currentTrackId : catalog[0]?.id ?? null,
            playlists: safeProfile.playlists,
            activePlaylistId: safeProfile.activePlaylistId
          })
        );
        setAutoplayMode(safeProfile.autoplayMode ?? true);
        setLoopMode(safeProfile.loopMode ?? false);
        setShuffleMode(safeProfile.shuffleMode ?? false);
        setTheaterMode(safeProfile.theaterMode ?? false);
        setVisualizerMode(safeProfile.visualizerMode ?? true);
      } else if (catalog.length) {
        dispatch(setCurrentTrack(catalog[0].id));
      }

      hydratedRef.current = true;
    });

    return () => {
      mounted = false;
    };
  }, [dispatch]);

  useEffect(() => {
    if (!hydratedRef.current) return;

    void upsertUserProfile({
      userId: USER_ID,
      favorites,
      streamQuality,
      equalizer,
      volume,
      currentTrackId,
      playlists,
      activePlaylistId,
      autoplayMode,
      loopMode,
      shuffleMode,
      theaterMode,
      visualizerMode
    });
  }, [
    activePlaylistId,
    autoplayMode,
    currentTrackId,
    equalizer,
    favorites,
    loopMode,
    playlists,
    shuffleMode,
    streamQuality,
    theaterMode,
    visualizerMode,
    volume
  ]);

  const activePlaylist = useMemo(
    () => playlists.find((playlist) => playlist.id === activePlaylistId) ?? null,
    [playlists, activePlaylistId]
  );

  const playlistBase = useMemo(() => {
    if (activePlaylistId === "favorites") {
      return queue.filter((track) => favorites.includes(track.id));
    }

    if (activePlaylist) {
      const ids = new Set(activePlaylist.trackIds);
      return queue.filter((track) => ids.has(track.id));
    }

    return queue;
  }, [activePlaylist, activePlaylistId, favorites, queue]);

  const filteredTracks = useMemo(() => {
    const query = search.trim().toLowerCase();
    return playlistBase.filter((track) => {
      if (!query) return true;
      return `${track.title} ${track.artist}`.toLowerCase().includes(query);
    });
  }, [playlistBase, search]);

  const currentIndex = useMemo(
    () => playlistBase.findIndex((track) => track.id === currentTrackId),
    [playlistBase, currentTrackId]
  );

  const currentTrack = useMemo(
    () => queue.find((track) => track.id === currentTrackId) ?? null,
    [queue, currentTrackId]
  );
  const isYouTubeTrack = currentTrack?.sourceKind === "youtube" && !!currentTrack.youtubeVideoId;
  const currentSrc = resolveTrackSrc(currentTrack, streamQuality);

  const playTrackAt = useCallback(
    (index: number) => {
      if (!playlistBase.length) return;
      const normalized = (index + playlistBase.length) % playlistBase.length;
      const track = playlistBase[normalized];
      if (!track) return;
      dispatch(setCurrentTrack(track.id));
      dispatch(setIsPlaying(true));
    },
    [dispatch, playlistBase]
  );

  const playNext = useCallback(() => {
    if (!playlistBase.length) return;

    if (shuffleMode) {
      const idx = randomIndex(playlistBase.length, currentIndex >= 0 ? currentIndex : 0);
      playTrackAt(idx);
      return;
    }

    const baseIndex = currentIndex >= 0 ? currentIndex : 0;
    playTrackAt(baseIndex + 1);
  }, [currentIndex, playTrackAt, playlistBase.length, shuffleMode]);

  const playPrev = useCallback(() => {
    if (!playlistBase.length) return;

    if (shuffleMode) {
      const idx = randomIndex(playlistBase.length, currentIndex >= 0 ? currentIndex : 0);
      playTrackAt(idx);
      return;
    }

    const baseIndex = currentIndex >= 0 ? currentIndex : 0;
    playTrackAt(baseIndex - 1);
  }, [currentIndex, playTrackAt, playlistBase.length, shuffleMode]);

  useEffect(() => {
    if (!playlistBase.length) {
      dispatch(setIsPlaying(false));
      return;
    }

    const existsInCurrentBase = playlistBase.some((track) => track.id === currentTrackId);
    if (!existsInCurrentBase) {
      dispatch(setCurrentTrack(playlistBase[0].id));
    }
  }, [currentTrackId, dispatch, playlistBase]);

  const activeMedia = useMemo(() => {
    if (isYouTubeTrack) return null;
    if (currentTrack?.mediaType === "video") return videoRef.current;
    return audioRef.current;
  }, [currentTrack?.mediaType, isYouTubeTrack]);

  const clearYouTubeTicker = useCallback(() => {
    if (youtubeTickerRef.current) {
      window.clearInterval(youtubeTickerRef.current);
      youtubeTickerRef.current = null;
    }
  }, []);

  const syncYouTubeClock = useCallback(() => {
    const player = youtubePlayerRef.current;
    if (!player?.getCurrentTime || !player?.getDuration) return;

    const nextTime = Number(player.getCurrentTime()) || 0;
    const nextDuration = Number(player.getDuration()) || 0;
    setCurrentTime(nextTime);
    setDuration(nextDuration);
  }, []);

  useEffect(() => {
    if (!activeMedia) return;

    const media = activeMedia;
    const handleTime = () => setCurrentTime(media.currentTime || 0);
    const handleMeta = () => setDuration(media.duration || 0);
    const handleEnd = () => {
      setCurrentTime(0);
      if (loopMode) {
        media.currentTime = 0;
        if (autoplayMode) {
          void media.play();
        } else {
          dispatch(setIsPlaying(false));
        }
        return;
      }

      if (autoplayMode) {
        playNext();
      } else {
        dispatch(setIsPlaying(false));
      }
    };

    media.addEventListener("timeupdate", handleTime);
    media.addEventListener("loadedmetadata", handleMeta);
    media.addEventListener("ended", handleEnd);

    return () => {
      media.removeEventListener("timeupdate", handleTime);
      media.removeEventListener("loadedmetadata", handleMeta);
      media.removeEventListener("ended", handleEnd);
    };
  }, [activeMedia, autoplayMode, dispatch, loopMode, playNext]);

  useEffect(() => {
    if (isYouTubeTrack) {
      setCurrentTime(0);
      setDuration(0);
      audioRef.current?.pause();
      videoRef.current?.pause();
      return;
    }

    if (!currentTrack || !currentSrc) {
      setCurrentTime(0);
      setDuration(0);
      return;
    }

    const audio = audioRef.current;
    const video = videoRef.current;
    audio?.pause();
    video?.pause();

    if (currentTrack.mediaType === "video" && video) {
      if (video.src !== currentSrc) {
        video.src = currentSrc;
        video.load();
      }
    } else if (audio) {
      if (audio.src !== currentSrc) {
        audio.src = currentSrc;
        audio.load();
      }
    }

    setCurrentTime(0);
  }, [currentSrc, currentTrack, isYouTubeTrack]);

  useEffect(() => {
    const audio = audioRef.current;
    const video = videoRef.current;
    if (audio) audio.volume = volume;
    if (video) video.volume = volume;

    const youtube = youtubePlayerRef.current;
    if (youtube?.setVolume) {
      youtube.setVolume(Math.round(volume * 100));
      if (volume <= 0) {
        youtube.mute?.();
      } else {
        youtube.unMute?.();
      }
    }
  }, [volume]);

  useEffect(() => {
    const media = activeMedia;
    if (!media || !currentSrc) return;

    if (isPlaying) {
      void media.play();
    } else {
      media.pause();
    }
  }, [activeMedia, currentSrc, isPlaying]);

  useEffect(() => {
    if (!isYouTubeTrack) return;
    const youtube = youtubePlayerRef.current;
    if (!youtube) return;

    if (isPlaying) {
      youtube.playVideo?.();
    } else {
      youtube.pauseVideo?.();
    }
  }, [isPlaying, isYouTubeTrack, currentTrack?.id]);

  useEffect(() => {
    if (!isYouTubeTrack || !currentTrack?.youtubeVideoId || !youtubeHostRef.current) return;

    let cancelled = false;
    const host = youtubeHostRef.current;
    host.innerHTML = "";
    setYoutubePlayerLoading(true);
    setYoutubePlayerError(null);

    void loadYouTubeApi()
      .then((YT) => {
        if (cancelled || !youtubeHostRef.current) return;

        const player = new YT.Player(youtubeHostRef.current, {
          videoId: currentTrack.youtubeVideoId,
          playerVars: {
            rel: 0,
            modestbranding: 1,
            playsinline: 1,
            autoplay: isPlaying ? 1 : 0
          },
          events: {
            onReady: () => {
              const youtube = youtubePlayerRef.current;
              if (youtube?.setVolume) {
                youtube.setVolume(Math.round(volume * 100));
              }
              syncYouTubeClock();
              setYoutubePlayerLoading(false);
            },
            onStateChange: (event: any) => {
              const state = Number(event?.data);
              setYoutubeState(state);
              if (state === YOUTUBE_PLAYER_STATE.PLAYING) {
                dispatch(setIsPlaying(true));
              } else if (state === YOUTUBE_PLAYER_STATE.PAUSED) {
                dispatch(setIsPlaying(false));
              }
            },
            onError: () => {
              setYoutubePlayerLoading(false);
              setYoutubePlayerError("This video cannot be played in embedded mode.");
            }
          }
        });

        youtubePlayerRef.current = player;
      })
      .catch(() => {
        setYoutubePlayerLoading(false);
        setYoutubePlayerError("Unable to initialize YouTube player.");
        setYoutubeError("Unable to initialize YouTube player.");
      });

    return () => {
      cancelled = true;
      clearYouTubeTicker();
      if (youtubePlayerRef.current?.destroy) {
        youtubePlayerRef.current.destroy();
      }
      youtubePlayerRef.current = null;
      setYoutubeState(null);
      setYoutubePlayerLoading(false);
    };
  }, [
    clearYouTubeTicker,
    currentTrack?.youtubeVideoId,
    dispatch,
    isPlaying,
    isYouTubeTrack,
    syncYouTubeClock,
    volume
  ]);

  useEffect(() => {
    if (isYouTubeTrack) return;
    setYoutubePlayerLoading(false);
    setYoutubePlayerError(null);
  }, [isYouTubeTrack]);

  useEffect(() => {
    clearYouTubeTicker();
    if (!isYouTubeTrack) return;

    syncYouTubeClock();
    youtubeTickerRef.current = window.setInterval(syncYouTubeClock, 250);

    return () => {
      clearYouTubeTicker();
    };
  }, [clearYouTubeTicker, isYouTubeTrack, syncYouTubeClock, currentTrack?.id]);

  useEffect(() => {
    if (!isYouTubeTrack || youtubeState !== YOUTUBE_PLAYER_STATE.ENDED) return;

    setCurrentTime(0);
    const youtube = youtubePlayerRef.current;
    if (loopMode) {
      youtube?.seekTo?.(0, true);
      if (autoplayMode) {
        youtube?.playVideo?.();
      } else {
        dispatch(setIsPlaying(false));
      }
      return;
    }

    if (autoplayMode) {
      playNext();
    } else {
      dispatch(setIsPlaying(false));
    }
  }, [autoplayMode, dispatch, isYouTubeTrack, loopMode, playNext, youtubeState]);

  const handleSeek = (event: ChangeEvent<HTMLInputElement>) => {
    const targetTime = Number(event.target.value);
    if (isYouTubeTrack) {
      youtubePlayerRef.current?.seekTo?.(targetTime, true);
      setCurrentTime(targetTime);
      return;
    }

    const media = activeMedia;
    if (!media) return;
    media.currentTime = targetTime;
    setCurrentTime(targetTime);
  };

  const handleVolume = (event: ChangeEvent<HTMLInputElement>) => {
    dispatch(setVolume(Number(event.target.value)));
  };

  const setVolumeClamped = useCallback(
    (next: number) => {
      dispatch(setVolume(clamp(next, 0, 1)));
    },
    [dispatch]
  );

  const seekTo = useCallback(
    (nextTime: number) => {
      const safe = clamp(nextTime, 0, duration || 0);
      if (isYouTubeTrack) {
        youtubePlayerRef.current?.seekTo?.(safe, true);
        setCurrentTime(safe);
        return;
      }

      const media = activeMedia;
      if (!media) return;
      media.currentTime = safe;
      setCurrentTime(safe);
    },
    [activeMedia, duration, isYouTubeTrack]
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isTypingContext(event.target)) return;

      if (event.code === "Space") {
        event.preventDefault();
        dispatch(setIsPlaying(!isPlaying));
        return;
      }

      if (event.code === "ArrowRight") {
        event.preventDefault();
        seekTo(currentTime + 5);
        return;
      }

      if (event.code === "ArrowLeft") {
        event.preventDefault();
        seekTo(currentTime - 5);
        return;
      }

      if (event.code === "ArrowUp") {
        event.preventDefault();
        setVolumeClamped(volume + 0.05);
        return;
      }

      if (event.code === "ArrowDown") {
        event.preventDefault();
        setVolumeClamped(volume - 0.05);
        return;
      }

      if (event.code === "KeyN") {
        playNext();
        return;
      }

      if (event.code === "KeyP") {
        playPrev();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [currentTime, dispatch, isPlaying, playNext, playPrev, seekTo, setVolumeClamped, volume]);

  const handleYouTubeSearch = async () => {
    try {
      setYoutubeError(null);
      setYoutubeLoading(true);
      setSelectedCategory("all");
      const results = await searchYouTubeSongs(search);
      setYoutubeResults(results);
    } catch (error) {
      const message =
        error instanceof Error && error.message.includes("VITE_YOUTUBE_API_KEY")
          ? "Set VITE_YOUTUBE_API_KEY in .env to enable YouTube search."
          : "Unable to fetch YouTube results right now.";
      setYoutubeError(message);
      setYoutubeResults([]);
    } finally {
      setYoutubeLoading(false);
    }
  };

  const loadCategory = async (category: MusicCategory) => {
    try {
      setYoutubeError(null);
      setCategoryLoading(category);
      setSelectedCategory(category);
      const tracks = await fetchCategorySongs(category, 50);
      setYoutubeResults(tracks);
      dispatch(addTracksToQueue(tracks));
      if (tracks[0]) {
        dispatch(setCurrentTrack(tracks[0].id));
        dispatch(setIsPlaying(true));
      }
    } catch {
      setYoutubeError("Unable to load category right now.");
    } finally {
      setCategoryLoading(null);
    }
  };

  const createPlaylistAction = () => {
    if (!newPlaylistName.trim()) return;
    dispatch(createPlaylist(newPlaylistName));
    setNewPlaylistName("");
  };

  const addToActivePlaylist = (trackId: string) => {
    if (!activePlaylist || activePlaylistId === "all" || activePlaylistId === "favorites") return;
    dispatch(addTrackToPlaylist({ playlistId: activePlaylistId, trackId }));
  };

  const removeFromActivePlaylist = (trackId: string) => {
    if (!activePlaylist || activePlaylistId === "all" || activePlaylistId === "favorites") return;
    dispatch(removeTrackFromPlaylist({ playlistId: activePlaylistId, trackId }));
  };

  const recentTracks = queue.slice(0, 6);
  const fanCards = queue.slice(0, 3);
  const popularTracks = filteredTracks.slice(0, 8);

  const focusSearch = () => {
    searchInputRef.current?.focus();
  };

  const jumpHome = () => {
    centerColumnRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    dispatch(setActivePlaylist("all"));
  };

  const jumpNowPlaying = () => {
    dockRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  };

  const jumpSettings = () => {
    settingsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <main
      className={`player-shell cinematic-shell nuve-fusion fade-in ${isPlaying ? "is-playing" : ""} ${theaterMode ? "theater-mode" : ""}`}
    >
      <div className="glass-wave" aria-hidden="true"></div>

      <div className="glass-app">
        <aside className="rail-column glass-panel">
          <button className="rail-btn" onClick={jumpNowPlaying} title="Now Playing">
            ◉
          </button>
          <button className="rail-btn" onClick={jumpHome} title="Home">
            ⌂
          </button>
          <button
            className="rail-btn"
            onClick={() => dispatch(setActivePlaylist("favorites"))}
            title="Favorites"
          >
            ♫
          </button>
          <button className="rail-btn" onClick={() => dispatch(setActivePlaylist("all"))} title="Library">
            ☰
          </button>
          <button className="rail-btn" onClick={jumpSettings} title="Settings">
            ⚙
          </button>
          <button className="rail-btn" onClick={focusSearch} title="Search">
            ⌕
          </button>
        </aside>

        <aside className="left-column glass-panel">
          <div className="brand-mini">
            <span className="dot"></span>
            <strong>NuvéTrek</strong>
          </div>

          <div className="nav-stack">
            <button className="ghost-btn tiny-btn" onClick={() => dispatch(setActivePlaylist("all"))}>
              All Music
            </button>
            <button className="ghost-btn tiny-btn" onClick={() => dispatch(setActivePlaylist("favorites"))}>
              Favorites
            </button>
            <button className="ghost-btn tiny-btn" onClick={() => loadCategory("global50")}>
              {categoryLoading === "global50" ? "Loading..." : "Global 50"}
            </button>
          </div>

          <div className="playlist-create">
            <input
              className="search-input"
              value={newPlaylistName}
              placeholder="Create playlist"
              onChange={(event) => setNewPlaylistName(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  createPlaylistAction();
                }
              }}
            />
            <button className="ghost-btn tiny-btn" onClick={createPlaylistAction}>
              Create
            </button>
          </div>

          <div className="playlist-chip-wrap">
            <button
              className={`ghost-btn tiny-btn ${activePlaylistId === "all" ? "active" : ""}`}
              onClick={() => dispatch(setActivePlaylist("all"))}
            >
              All
            </button>
            <button
              className={`ghost-btn tiny-btn ${activePlaylistId === "favorites" ? "active" : ""}`}
              onClick={() => dispatch(setActivePlaylist("favorites"))}
            >
              Favorites
            </button>
            {playlists.map((playlist) => (
              <div key={playlist.id} className="playlist-chip-item">
                <button
                  className={`ghost-btn tiny-btn ${activePlaylistId === playlist.id ? "active" : ""}`}
                  onClick={() => dispatch(setActivePlaylist(playlist.id))}
                >
                  {playlist.name}
                </button>
                <button className="mini-like" onClick={() => dispatch(deletePlaylist(playlist.id))}>
                  ×
                </button>
              </div>
            ))}
          </div>

          <p className="side-label">Recently Played</p>
          <ul className="mini-list">
            {recentTracks.map((track) => (
              <li key={`recent-${track.id}`}>
                <button
                  className="mini-item"
                  type="button"
                  onClick={() => {
                    dispatch(setCurrentTrack(track.id));
                    dispatch(setIsPlaying(true));
                  }}
                >
                  <img src={track.coverUrl} alt={track.title} />
                  <span>{track.title}</span>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <section ref={centerColumnRef} className="center-column glass-panel">
          <div className="topbar">
            <p>Home / Artist</p>
            <div className="search-row">
              <input
                ref={searchInputRef}
                className="search-input"
                placeholder="Search by title, album, artist..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <button className="ghost-btn tiny-btn" type="button" onClick={handleYouTubeSearch}>
                {youtubeLoading ? "Searching..." : "YouTube"}
              </button>
              <button
                className={`ghost-btn tiny-btn ${selectedCategory === "global50" ? "active" : ""}`}
                type="button"
                onClick={() => loadCategory("global50")}
              >
                {categoryLoading === "global50" ? "..." : "Global 50"}
              </button>
              <button className="ghost-btn tiny-btn" type="button" onClick={() => loadCategory("pop")}>
                {categoryLoading === "pop" ? "..." : "Pop"}
              </button>
              <button className="ghost-btn tiny-btn" type="button" onClick={() => loadCategory("rock")}>
                {categoryLoading === "rock" ? "..." : "Rock"}
              </button>
              <button className="ghost-btn tiny-btn" type="button" onClick={() => loadCategory("soothing")}>
                {categoryLoading === "soothing" ? "..." : "Soothing"}
              </button>
            </div>
          </div>

          <div className="hero-pane">
            <div className="hero-media">
              {isYouTubeTrack && currentTrack?.youtubeVideoId ? (
                <div className="youtube-stage">
                  <div ref={youtubeHostRef} className="media-video youtube-host" />
                  {youtubePlayerLoading ? <div className="youtube-status">Loading YouTube player...</div> : null}
                  {youtubePlayerError ? <div className="youtube-status error">{youtubePlayerError}</div> : null}
                </div>
              ) : currentTrack?.mediaType === "video" ? (
                <video
                  ref={videoRef}
                  className="media-video"
                  controls
                  playsInline
                  poster={currentTrack.videoPoster ?? currentTrack.coverUrl}
                />
              ) : (
                <img
                  src={currentTrack?.coverUrl}
                  className="album-art"
                  alt={currentTrack ? `${currentTrack.title} album art` : "Album art"}
                />
              )}
            </div>
            <div className="artist-pane">
              <div className="artist-head">
                <img src={currentTrack?.coverUrl} alt={currentTrack?.artist ?? "Artist"} />
                <div>
                  <h3>{currentTrack?.artist ?? "Artist"}</h3>
                  <p>Verified Artist</p>
                </div>
              </div>
              <div className="hero-text">
                <h2>{currentTrack?.title ?? "Loading Track..."}</h2>
                <p>{currentTrack?.artist ?? "Fetching media catalog..."}</p>
              </div>
              <ul className="popular-mini">
                {popularTracks.slice(0, 4).map((track) => (
                  <li key={`pop-${track.id}`}>
                    <span>{track.title}</span>
                    <button
                      className={`mini-like ${favorites.includes(track.id) ? "active" : ""}`}
                      onClick={() => dispatch(toggleFavorite(track.id))}
                    >
                      ♥
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="fans-grid">
            {fanCards.map((track) => (
              <button
                key={`fan-${track.id}`}
                className="fan-card"
                type="button"
                onClick={() => {
                  dispatch(setCurrentTrack(track.id));
                  dispatch(setIsPlaying(true));
                }}
              >
                <img src={track.coverUrl} alt={track.title} />
                <span>{track.title}</span>
              </button>
            ))}
          </div>
        </section>

        <aside className="right-column glass-panel">
          <div className="playlist-head">
            <p className="eyebrow">Popular</p>
            <span className="playlist-count">{popularTracks.length} Tracks</span>
          </div>

          <ul className="track-list">
            {popularTracks.map((track) => {
              const active = track.id === currentTrackId;
              const fav = favorites.includes(track.id);
              const canAddToPlaylist = !!activePlaylist && activePlaylistId !== "all" && activePlaylistId !== "favorites";

              return (
                <li key={track.id}>
                  <button
                    type="button"
                    className={`track-btn ${active ? "active" : ""}`}
                    onClick={() => {
                      dispatch(setCurrentTrack(track.id));
                      dispatch(setIsPlaying(true));
                    }}
                  >
                    <span className="track-title">{track.title}</span>
                    <span className="track-artist">
                      {track.artist} · {track.mediaType === "video" ? "Video" : "Audio"}
                      {track.sourceKind === "youtube" ? " · YouTube" : ""}
                      {fav ? " · ❤" : ""}
                    </span>
                  </button>
                  <div className="track-ops">
                    <button className="ghost-btn tiny-btn" onClick={() => dispatch(toggleFavorite(track.id))}>
                      {fav ? "Unfav" : "Fav"}
                    </button>
                    <button
                      className="ghost-btn tiny-btn"
                      onClick={() => {
                        dispatch(setCurrentTrack(track.id));
                        dispatch(setIsPlaying(true));
                      }}
                    >
                      Play
                    </button>
                    {canAddToPlaylist ? (
                      <>
                        <button
                          className="ghost-btn tiny-btn"
                          onClick={() => addToActivePlaylist(track.id)}
                        >
                          +Playlist
                        </button>
                        <button
                          className="ghost-btn tiny-btn"
                          onClick={() => removeFromActivePlaylist(track.id)}
                        >
                          -Playlist
                        </button>
                      </>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>

          {youtubeError ? <p className="yt-error">{youtubeError}</p> : null}
          {youtubeResults.length > 0 ? (
            <div className="yt-results">
              {youtubeResults.map((track) => {
                const inQueue = queue.some((item) => item.id === track.id);
                const fav = favorites.includes(track.id);
                const canAddToPlaylist = !!activePlaylist && activePlaylistId !== "all" && activePlaylistId !== "favorites";

                return (
                  <div className="yt-item" key={track.id}>
                    <img src={track.coverUrl} alt={track.title} />
                    <div>
                      <p className="yt-title">{track.title}</p>
                      <p className="yt-sub">{track.artist}</p>
                    </div>
                    <div className="yt-actions">
                      <button
                        className="ghost-btn tiny-btn"
                        type="button"
                        onClick={() => {
                          dispatch(addTrackToQueue(track));
                          dispatch(setCurrentTrack(track.id));
                          dispatch(setIsPlaying(true));
                        }}
                      >
                        {inQueue ? "Play" : "Add+Play"}
                      </button>
                      <button
                        className={`ghost-btn tiny-btn ${fav ? "active" : ""}`}
                        type="button"
                        onClick={() => dispatch(toggleFavorite(track.id))}
                      >
                        {fav ? "Fav" : "♡"}
                      </button>
                      {canAddToPlaylist ? (
                        <button className="ghost-btn tiny-btn" onClick={() => addToActivePlaylist(track.id)}>
                          +Playlist
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : null}

          <div ref={settingsRef} className="settings-box">
            <p className="eyebrow">Settings</p>

            <div className="option-grid">
              <button
                type="button"
                className={`ghost-btn tiny-btn ${autoplayMode ? "active" : ""}`}
                onClick={() => setAutoplayMode((prev) => !prev)}
              >
                Autoplay
              </button>
              <button
                type="button"
                className={`ghost-btn tiny-btn ${loopMode ? "active" : ""}`}
                onClick={() => setLoopMode((prev) => !prev)}
              >
                Loop
              </button>
              <button
                type="button"
                className={`ghost-btn tiny-btn ${theaterMode ? "active" : ""}`}
                onClick={() => setTheaterMode((prev) => !prev)}
              >
                Theater
              </button>
              <button
                type="button"
                className={`ghost-btn tiny-btn ${visualizerMode ? "active" : ""}`}
                onClick={() => setVisualizerMode((prev) => !prev)}
              >
                Visualizer
              </button>
              <button
                type="button"
                className={`ghost-btn tiny-btn ${shuffleMode ? "active" : ""}`}
                onClick={() => setShuffleMode((prev) => !prev)}
              >
                Shuffle
              </button>
            </div>

            <label className="settings-label" htmlFor="quality">
              Stream Quality
            </label>
            <select
              id="quality"
              className="quality-select"
              value={streamQuality}
              onChange={(event) => dispatch(setStreamQuality(event.target.value as StreamQuality))}
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>

            <div className="equalizer-box" aria-label="Equalizer controls">
              {(["bass", "mid", "treble"] as const).map((band) => (
                <div className="eq-row" key={band}>
                  <label className="settings-label" htmlFor={`eq-${band}`}>
                    {band}
                  </label>
                  <input
                    id={`eq-${band}`}
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={equalizer[band]}
                    onChange={(event) =>
                      dispatch(setEqualizerBand({ band, value: Number(event.target.value) }))
                    }
                  />
                </div>
              ))}
            </div>
          </div>
        </aside>
      </div>

      <footer ref={dockRef} className="dock glass-panel">
        <div className="dock-now">
          <img src={currentTrack?.coverUrl} alt={currentTrack?.title ?? "Current track"} />
          <div>
            <p>{currentTrack?.title ?? "No Track"}</p>
            <span>{currentTrack?.artist ?? "Nuvé"}</span>
          </div>
        </div>

        <div className="dock-controls">
          <button className="icon-btn rail-btn dock-btn" type="button" onClick={playPrev}>
            ◀◀
          </button>
          <button
            className="icon-btn play-main rail-btn dock-btn"
            type="button"
            onClick={() => dispatch(setIsPlaying(!isPlaying))}
          >
            {isPlaying ? "❚❚" : "▶"}
          </button>
          <button className="icon-btn rail-btn dock-btn" type="button" onClick={playNext}>
            ▶▶
          </button>
        </div>

        <div className="dock-progress">
          <div className="time-row">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
          <input
            id="progress-dock"
            type="range"
            min={0}
            max={duration || 0}
            step={0.1}
            value={Math.min(currentTime, duration || 0)}
            onChange={handleSeek}
            disabled={!currentTrack}
          />
        </div>

        <div className={`wave-strip ${isPlaying && visualizerMode ? "active" : ""}`}>
          {Array.from({ length: 12 }).map((_, idx) => (
            <span key={`dock-wave-${idx}`}></span>
          ))}
        </div>

        <div className="dock-volume">
          <input
            id="volume-dock"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={handleVolume}
          />
        </div>
      </footer>
    </main>
  );
}
