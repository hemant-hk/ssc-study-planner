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
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (apiKey && apiKey !== "your_youtube_api_key_here") {
    return fetchPlaylistWithApi(playlistId, apiKey);
  }

  return fetchPlaylistScraping(playlistId);
}

async function fetchPlaylistWithApi(playlistId: string, apiKey: string): Promise<PlaylistInfo> {
  const metaRes = await fetch(
    `https://www.googleapis.com/youtube/v3/playlists?part=snippet&id=${playlistId}&key=${apiKey}`
  );
  if (!metaRes.ok) throw new Error("Failed to fetch playlist info");
  const metaData = await metaRes.json();
  const title = metaData.items?.[0]?.snippet?.title || "YouTube Playlist";

  const videos: PlaylistVideo[] = [];
  let nextPageToken = "";

  do {
    const url = `https://www.googleapis.com/youtube/v3/playlistItems?part=snippet&maxResults=50&playlistId=${playlistId}&key=${apiKey}${nextPageToken ? `&pageToken=${nextPageToken}` : ""}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Failed to fetch playlist videos");
    const data = await res.json();

    for (const item of data.items || []) {
      const snippet = item.snippet;
      if (snippet?.resourceId?.videoId) {
        videos.push({
          videoId: snippet.resourceId.videoId,
          title: snippet.title,
          thumbnailUrl: snippet.thumbnails?.medium?.url || `https://img.youtube.com/vi/${snippet.resourceId.videoId}/mqdefault.jpg`,
        });
      }
    }
    nextPageToken = data.nextPageToken || "";
  } while (nextPageToken);

  return { playlistId, title, videos };
}

async function fetchPlaylistScraping(playlistId: string): Promise<PlaylistInfo> {
  const pageRes = await fetch(`https://www.youtube.com/playlist?list=${playlistId}`, {
    headers: { "Accept-Language": "en-US,en;q=0.9" },
    signal: AbortSignal.timeout(15000),
  });
  if (!pageRes.ok) throw new Error("Playlist not found or is private");
  const html = await pageRes.text();

  let title = "YouTube Playlist";
  const titleMatch = html.match(/"title":"([^"]+)"/);
  if (titleMatch && titleMatch[1]) {
    title = titleMatch[1];
  }

  const apiKeyMatch = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/);
  const visitorDataMatch = html.match(/"visitorData":"([^"]+)"/);

  if (!apiKeyMatch?.[1]) {
    throw new Error("Could not extract API key from YouTube page");
  }

  const browseRes = await fetch(`https://www.youtube.com/youtubei/v1/browse?key=${apiKeyMatch[1]}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      context: {
        client: {
          clientName: "WEB",
          clientVersion: "2.20240101.00.00",
          visitorData: visitorDataMatch?.[1] || "",
        },
      },
      browseId: `VL${playlistId}`,
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!browseRes.ok) throw new Error("Failed to fetch playlist data");
  const browseData = await browseRes.json();

  const tab = browseData?.contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content;
  const items = tab?.sectionListRenderer?.contents?.[0]?.itemSectionRenderer?.contents;

  const videos: PlaylistVideo[] = [];

  if (items && Array.isArray(items)) {
    for (const item of items) {
      const vm = item?.lockupViewModel;
      if (vm?.contentId) {
        const videoTitle = vm.metadata?.lockupMetadataViewModel?.title?.content || `Video ${videos.length + 1}`;
        videos.push({
          videoId: vm.contentId,
          title: videoTitle,
          thumbnailUrl: `https://img.youtube.com/vi/${vm.contentId}/mqdefault.jpg`,
        });
      }
    }
  }

  return { playlistId, title, videos };
}

export async function fetchVideoInfo(videoId: string): Promise<YouTubeVideoInfo> {
  const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
  const res = await fetch(oembedUrl, { signal: AbortSignal.timeout(10000) });
  if (!res.ok) throw new Error("Video not found or is private");
  const data = await res.json();

  let description = "";
  try {
    const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: { "Accept-Language": "en-US,en;q=0.9" },
      signal: AbortSignal.timeout(10000),
    });
    const html = await pageRes.text();
    const descMatch = html.match(/"shortDescription":"(.*?)"/);
    if (descMatch && descMatch[1]) {
      description = descMatch[1].replace(/\\n/g, "\n").replace(/\\"/g, '"');
    }
  } catch {
    description = "";
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
