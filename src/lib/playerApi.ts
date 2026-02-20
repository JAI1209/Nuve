import { fetchMediaCatalog as fetchLocalCatalog } from "../data/mediaCatalog";
import type {
  EqualizerState,
  Playlist,
  StreamQuality,
  Track
} from "../features/player/playerSlice";

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001";
export const USER_ID = import.meta.env.VITE_USER_ID ?? "demo-user-1";

export interface PlayerProfile {
  id?: string;
  userId: string;
  favorites: string[];
  streamQuality: StreamQuality;
  equalizer: EqualizerState;
  volume: number;
  currentTrackId: string | null;
  playlists: Playlist[];
  activePlaylistId: string;
  autoplayMode?: boolean;
  loopMode?: boolean;
  shuffleMode?: boolean;
  theaterMode?: boolean;
  visualizerMode?: boolean;
}

export async function fetchCatalog(): Promise<Track[]> {
  try {
    const response = await fetch(`${API_BASE}/mediaCatalog`);
    if (!response.ok) throw new Error("catalog fetch failed");

    const data = (await response.json()) as Track[];
    return data;
  } catch {
    return fetchLocalCatalog();
  }
}

export async function fetchUserProfile(userId = USER_ID): Promise<PlayerProfile | null> {
  try {
    const response = await fetch(`${API_BASE}/userProfiles?userId=${encodeURIComponent(userId)}`);
    if (!response.ok) throw new Error("profile fetch failed");

    const data = (await response.json()) as PlayerProfile[];
    return data[0] ?? null;
  } catch {
    return null;
  }
}

export async function upsertUserProfile(profile: PlayerProfile): Promise<void> {
  try {
    const existing = await fetchUserProfile(profile.userId);

    if (existing?.id) {
      await fetch(`${API_BASE}/userProfiles/${existing.id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(profile)
      });
      return;
    }

    await fetch(`${API_BASE}/userProfiles`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(profile)
    });
  } catch {
    // Best-effort persist if backend is unavailable.
  }
}
