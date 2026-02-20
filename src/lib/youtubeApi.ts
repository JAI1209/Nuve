import type { Track } from "../features/player/playerSlice";

const YOUTUBE_API_KEY = import.meta.env.VITE_YOUTUBE_API_KEY as string | undefined;

export type MusicCategory = "global50" | "pop" | "rock" | "soothing";

interface YoutubeSearchItem {
  id: {
    videoId: string;
  };
  snippet: {
    title: string;
    channelTitle: string;
    thumbnails: {
      medium?: { url: string };
      high?: { url: string };
      default?: { url: string };
    };
  };
}

interface YoutubeSearchResponse {
  nextPageToken?: string;
  items: YoutubeSearchItem[];
}

const categoryQueries: Record<MusicCategory, string[]> = {
  global50: ["global top songs playlist official", "world top 50 songs official"],
  pop: ["latest pop hits playlist", "top pop songs official"],
  rock: ["best rock hits playlist", "classic and modern rock songs"],
  soothing: ["soothing songs playlist", "relaxing chill music playlist"]
};

function thumbnailOf(item: YoutubeSearchItem) {
  return (
    item.snippet.thumbnails.high?.url ??
    item.snippet.thumbnails.medium?.url ??
    item.snippet.thumbnails.default?.url ??
    ""
  );
}

function mapItem(item: YoutubeSearchItem): Track {
  const thumb = thumbnailOf(item);

  return {
    id: `yt-${item.id.videoId}`,
    title: item.snippet.title,
    artist: item.snippet.channelTitle,
    mediaType: "video",
    sourceKind: "youtube",
    youtubeVideoId: item.id.videoId,
    externalUrl: `https://www.youtube.com/watch?v=${item.id.videoId}`,
    coverUrl: thumb,
    videoPoster: thumb,
    sources: {
      low: "",
      medium: "",
      high: ""
    }
  };
}

async function searchYouTubeRaw(query: string, maxResults = 12, pageToken?: string) {
  if (!YOUTUBE_API_KEY) {
    throw new Error("Missing VITE_YOUTUBE_API_KEY");
  }

  const params = new URLSearchParams({
    part: "snippet",
    type: "video",
    maxResults: String(maxResults),
    q: query,
    key: YOUTUBE_API_KEY,
    videoCategoryId: "10"
  });

  if (pageToken) {
    params.set("pageToken", pageToken);
  }

  const response = await fetch(`https://www.googleapis.com/youtube/v3/search?${params.toString()}`);
  if (!response.ok) {
    throw new Error("YouTube search failed");
  }

  return (await response.json()) as YoutubeSearchResponse;
}

export async function searchYouTubeSongs(query: string): Promise<Track[]> {
  const normalized = query.trim();
  if (!normalized) return [];

  const data = await searchYouTubeRaw(normalized, 12);
  return data.items.filter((item) => item.id.videoId).map(mapItem);
}

export async function fetchCategorySongs(category: MusicCategory, limit = 50): Promise<Track[]> {
  const queries = categoryQueries[category];
  const tracks: Track[] = [];
  const seen = new Set<string>();

  for (const query of queries) {
    let pageToken: string | undefined;

    for (let i = 0; i < 2 && tracks.length < limit; i += 1) {
      const data = await searchYouTubeRaw(query, 25, pageToken);
      pageToken = data.nextPageToken;

      for (const item of data.items) {
        const videoId = item.id.videoId;
        if (!videoId || seen.has(videoId)) continue;

        seen.add(videoId);
        tracks.push(mapItem(item));

        if (tracks.length >= limit) {
          return tracks;
        }
      }

      if (!pageToken) break;
    }
  }

  return tracks;
}
