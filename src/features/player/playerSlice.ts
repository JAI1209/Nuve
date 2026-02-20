import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export type StreamQuality = "low" | "medium" | "high";
export type MediaType = "audio" | "video";

export interface Track {
  id: string;
  title: string;
  artist: string;
  mediaType: MediaType;
  coverUrl: string;
  videoPoster?: string;
  sources: Record<StreamQuality, string>;
  sourceKind?: "internal" | "youtube";
  youtubeVideoId?: string;
  externalUrl?: string;
}

export interface Playlist {
  id: string;
  name: string;
  trackIds: string[];
}

export interface EqualizerState {
  bass: number;
  mid: number;
  treble: number;
}

export interface PlayerPreferences {
  favorites?: string[];
  streamQuality?: StreamQuality;
  equalizer?: EqualizerState;
  volume?: number;
  currentTrackId?: string | null;
  playlists?: Playlist[];
  activePlaylistId?: string;
}

interface PlayerState {
  queue: Track[];
  currentTrackId: string | null;
  isPlaying: boolean;
  volume: number;
  favorites: string[];
  streamQuality: StreamQuality;
  equalizer: EqualizerState;
  playlists: Playlist[];
  activePlaylistId: string;
}

const initialState: PlayerState = {
  queue: [],
  currentTrackId: null,
  isPlaying: false,
  volume: 0.8,
  favorites: [],
  streamQuality: "high",
  equalizer: {
    bass: 65,
    mid: 55,
    treble: 60
  },
  playlists: [],
  activePlaylistId: "all"
};

const playerSlice = createSlice({
  name: "player",
  initialState,
  reducers: {
    setQueue(state, action: PayloadAction<Track[]>) {
      state.queue = action.payload;

      if (!state.currentTrackId && action.payload.length) {
        state.currentTrackId = action.payload[0].id;
      }
    },
    addTracksToQueue(state, action: PayloadAction<Track[]>) {
      for (const incoming of action.payload) {
        const exists = state.queue.some((track) => track.id === incoming.id);
        if (!exists) {
          state.queue.push(incoming);
        }
      }
    },
    addTrackToQueue(state, action: PayloadAction<Track>) {
      const incoming = action.payload;
      const exists = state.queue.some((track) => track.id === incoming.id);

      if (!exists) {
        state.queue.push(incoming);
      }
    },
    hydratePlayerPreferences(state, action: PayloadAction<PlayerPreferences>) {
      const payload = action.payload;

      if (payload.favorites) state.favorites = payload.favorites;
      if (payload.streamQuality) state.streamQuality = payload.streamQuality;
      if (payload.equalizer) state.equalizer = payload.equalizer;
      if (typeof payload.volume === "number") state.volume = payload.volume;
      if (payload.currentTrackId !== undefined) state.currentTrackId = payload.currentTrackId;
      if (payload.playlists) state.playlists = payload.playlists;
      if (payload.activePlaylistId) state.activePlaylistId = payload.activePlaylistId;
    },
    createPlaylist(state, action: PayloadAction<string>) {
      const name = action.payload.trim();
      if (!name) return;

      const id = `pl-${Date.now()}`;
      state.playlists.push({ id, name, trackIds: [] });
      state.activePlaylistId = id;
    },
    deletePlaylist(state, action: PayloadAction<string>) {
      state.playlists = state.playlists.filter((playlist) => playlist.id !== action.payload);
      if (state.activePlaylistId === action.payload) {
        state.activePlaylistId = "all";
      }
    },
    setActivePlaylist(state, action: PayloadAction<string>) {
      state.activePlaylistId = action.payload;
    },
    addTrackToPlaylist(
      state,
      action: PayloadAction<{
        playlistId: string;
        trackId: string;
      }>
    ) {
      const { playlistId, trackId } = action.payload;
      const playlist = state.playlists.find((item) => item.id === playlistId);
      if (!playlist) return;

      if (!playlist.trackIds.includes(trackId)) {
        playlist.trackIds.push(trackId);
      }
    },
    removeTrackFromPlaylist(
      state,
      action: PayloadAction<{
        playlistId: string;
        trackId: string;
      }>
    ) {
      const { playlistId, trackId } = action.payload;
      const playlist = state.playlists.find((item) => item.id === playlistId);
      if (!playlist) return;

      playlist.trackIds = playlist.trackIds.filter((id) => id !== trackId);
    },
    setCurrentTrack(state, action: PayloadAction<string>) {
      state.currentTrackId = action.payload;
    },
    setIsPlaying(state, action: PayloadAction<boolean>) {
      state.isPlaying = action.payload;
    },
    setVolume(state, action: PayloadAction<number>) {
      state.volume = action.payload;
    },
    toggleFavorite(state, action: PayloadAction<string>) {
      const id = action.payload;
      const exists = state.favorites.includes(id);

      if (exists) {
        state.favorites = state.favorites.filter((fav) => fav !== id);
      } else {
        state.favorites.push(id);
      }
    },
    setStreamQuality(state, action: PayloadAction<StreamQuality>) {
      state.streamQuality = action.payload;
    },
    setEqualizerBand(
      state,
      action: PayloadAction<{
        band: keyof EqualizerState;
        value: number;
      }>
    ) {
      state.equalizer[action.payload.band] = action.payload.value;
    }
  }
});

export const {
  setQueue,
  addTracksToQueue,
  addTrackToQueue,
  hydratePlayerPreferences,
  createPlaylist,
  deletePlaylist,
  setActivePlaylist,
  addTrackToPlaylist,
  removeTrackFromPlaylist,
  setCurrentTrack,
  setIsPlaying,
  setVolume,
  toggleFavorite,
  setStreamQuality,
  setEqualizerBand
} = playerSlice.actions;

export default playerSlice.reducer;
