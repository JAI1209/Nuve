import type { Track } from "../features/player/playerSlice";

const catalog: Track[] = [
  {
    id: "demo-1",
    title: "Neon Drift",
    artist: "Nuvé Originals",
    mediaType: "audio",
    coverUrl: "https://images.unsplash.com/photo-1614680376593-902f74cf0d41?auto=format&fit=crop&w=1200&q=80",
    sources: {
      low: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
      medium: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
      high: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3"
    }
  },
  {
    id: "demo-2",
    title: "Skyline Pulse",
    artist: "Nuvé Originals",
    mediaType: "audio",
    coverUrl: "https://images.unsplash.com/photo-1514525253161-7a46d19cd819?auto=format&fit=crop&w=1200&q=80",
    sources: {
      low: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
      medium: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
      high: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3"
    }
  },
  {
    id: "demo-3",
    title: "Vision Loop",
    artist: "Nuvé Visual Set",
    mediaType: "video",
    coverUrl: "https://images.unsplash.com/photo-1470229538611-16ba8c7ffbd7?auto=format&fit=crop&w=1200&q=80",
    videoPoster:
      "https://images.unsplash.com/photo-1516280440614-37939bbacd81?auto=format&fit=crop&w=1200&q=80",
    sources: {
      low: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
      medium: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4",
      high: "https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4"
    }
  }
];

export async function fetchMediaCatalog(): Promise<Track[]> {
  await new Promise((resolve) => setTimeout(resolve, 420));
  return catalog;
}
