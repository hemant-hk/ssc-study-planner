export interface YouTubeVideoInfo {
  videoId: string;
  title: string;
  author: string;
  thumbnailUrl: string;
  description: string;
  chapters: Chapter[];
}

export interface Chapter {
  title: string;
  timestamp: string;
  startSeconds: number;
}

export interface PlaylistVideo {
  videoId: string;
  title: string;
  thumbnailUrl: string;
}

export interface PlaylistInfo {
  playlistId: string;
  title: string;
  videos: PlaylistVideo[];
}

export function extractVideoId(url: string): string | null {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/,
    /^[a-zA-Z0-9_-]{11}$/,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1] ?? match[0];
  }
  return null;
}

export function extractPlaylistId(url: string): string | null {
  const match = url.match(/[?&]list=([a-zA-Z0-9_-]+)/);
  return match ? match[1] : null;
}

export async function fetchPlaylistInfo(playlistId: string): Promise<PlaylistInfo> {
  const res = await fetch(`https://www.youtube.com/playlist?list=${playlistId}`, {
    headers: { "Accept-Language": "en-US,en;q=0.9" },
  });
  if (!res.ok) throw new Error("Playlist not found or is private");
  const html = await res.text();

  let title = "YouTube Playlist";
  const titleMatch = html.match(/"title":"([^"]+)"/);
  if (titleMatch && titleMatch[1]) {
    title = titleMatch[1];
  }

  const videos: PlaylistVideo[] = [];
  const videoRegex = /"videoId":"([a-zA-Z0-9_-]{11})".*?"title":\{"runs":\[\{"text":"([^"]+)"\}/g;
  let match;
  const seen = new Set<string>();

  while ((match = videoRegex.exec(html)) !== null) {
    const videoId = match[1];
    const videoTitle = match[2];
    if (!seen.has(videoId)) {
      seen.add(videoId);
      videos.push({
        videoId,
        title: videoTitle,
        thumbnailUrl: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
      });
    }
  }

  if (videos.length === 0) {
    const altRegex = /watch\?v=([a-zA-Z0-9_-]{11})&amp;list=/g;
    while ((match = altRegex.exec(html)) !== null) {
      const videoId = match[1];
      if (!seen.has(videoId)) {
        seen.add(videoId);
        videos.push({
          videoId,
          title: `Video ${videos.length + 1}`,
          thumbnailUrl: `https://img.youtube.com/vi/${videoId}/mqdefault.jpg`,
        });
      }
    }
  }

  return { playlistId, title, videos };
}

export async function fetchVideoInfo(videoId: string): Promise<YouTubeVideoInfo> {
  const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
  const res = await fetch(oembedUrl);
  if (!res.ok) throw new Error("Video not found or is private");
  const data = await res.json();

  const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: { "Accept-Language": "en-US,en;q=0.9" },
  });
  const html = await pageRes.text();

  let description = "";
  const descMatch = html.match(/"shortDescription":"(.*?)"/);
  if (descMatch && descMatch[1]) {
    description = descMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"');
  }

  const chapters = extractChapters(description);

  return {
    videoId,
    title: data.title,
    author: data.author_name,
    thumbnailUrl: `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`,
    description,
    chapters,
  };
}

function extractChapters(description: string): Chapter[] {
  const lines = description.split("\n");
  const chapters: Chapter[] = [];
  const timestampRegex = /^(\d{1,2}:)?(\d{1,2}):(\d{2})\s*[-–—]?\s*(.*)/;

  for (const line of lines) {
    const match = line.trim().match(timestampRegex);
    if (match) {
      const timestamp = match[1] ? `${match[1]}${match[2]}:${match[3]}` : `${match[2]}:${match[3]}`;
      const title = match[4]?.trim() || `Chapter ${chapters.length + 1}`;
      chapters.push({
        title,
        timestamp,
        startSeconds: timestampToSeconds(timestamp),
      });
    }
  }
  return chapters;
}

function timestampToSeconds(ts: string): number {
  const parts = ts.split(":").reverse();
  let seconds = 0;
  if (parts[0]) seconds += parseInt(parts[0]);
  if (parts[1]) seconds += parseInt(parts[1]) * 60;
  if (parts[2]) seconds += parseInt(parts[2]) * 3600;
  return seconds;
}
