import "server-only";

import { createAdminClient } from "@/utils/supabase/admin";
import { getAccessToken } from "@/app/lib/spotify";
import {
  buildArcProfile,
  buildBlockMetrics,
  buildQualityMetrics,
  clamp,
  computeCompatibility,
  computeSequencerCompatibility,
  describeBoundaryChanges,
  getBoundaryKey,
  getRiskLabel,
  summarizeBlock,
} from "@/app/music/lib/sequencer-heuristics";
import {
  buildMiniPlaylistChapters,
  buildOptimizedBlockPlan,
  buildOptimizedTrackOrder,
} from "@/app/music/lib/sequencer-optimizer";
import type {
  SequencerArcProfile,
  SequencerBlock,
  SequencerBoundary,
  SequencerBoundaryPreference,
  SequencerGoal,
  SequencerModifier,
  SequencerPlaylistMeta,
  SequencerQualityMetrics,
  SequencerSaveInput,
  SequencerSnapshot,
  SequencerSuggestion,
  SequencerTrack,
  SequencerTrackFeatures,
} from "@/app/music/lib/sequencer-types";
import {
  SEQUENCER_GOAL_PURPOSES,
  normalizeSequencerGoal,
  normalizeSequencerModifier,
} from "@/app/music/lib/sequencer-types";

type SpotifyImage = { url: string };

type SpotifyArtist = {
  id: string | null;
  name: string;
};

type SpotifyTrackPayload = {
  id: string;
  uri: string | null;
  name: string;
  artists: SpotifyArtist[];
  album: { name: string; images: SpotifyImage[] };
  duration_ms: number | null;
  popularity: number | null;
  preview_url: string | null;
  explicit: boolean;
  external_urls?: { spotify?: string };
};

type SpotifyPlaylistPayload = {
  id: string;
  name: string;
  description: string | null;
  images: SpotifyImage[];
  external_urls?: { spotify?: string };
  owner?: { display_name?: string | null };
  tracks?: { total?: number };
  snapshot_id?: string | null;
};

type SpotifyPlaylistTrackItem = {
  added_at: string | null;
  track: SpotifyTrackPayload | null;
};

type SpotifyArtistPayload = {
  id: string;
  name: string;
  genres: string[];
  popularity: number;
};

type SequencePersistenceBlock = {
  id: string;
  name: string;
  purpose: string;
  position: number;
  colorToken: string | null;
  notes: string | null;
  locked: boolean;
};

type SequencePersistenceTrack = {
  trackId: string;
  blockId: string;
  position: number;
  roleTags: string[];
  locked: boolean;
  hiddenFromAutosort: boolean;
  derivedProfile: SequencerTrackFeatures;
};

type ReviewTrackRow = {
  track_id: string;
  spotify_uri: string | null;
  title: string;
  artist_names: string[];
  artist_display: string;
  album_name: string | null;
  album_image_url: string | null;
  preview_url: string | null;
  song_url: string | null;
  duration_ms: number | null;
  popularity: number | null;
  explicit: boolean;
  is_liked: boolean;
  added_to_liked_at: string | null;
  removed_from_liked_at: string | null;
  last_played_at: string | null;
  play_count: number | null;
  source_snapshot: Record<string, unknown> | null;
  spotify_review_state?: any;
  spotify_review_track_buckets?: any[];
};

const GOAL_BLOCK_NAMES: Record<SequencerGoal, string[]> = {
  journey: [
    "soft intro",
    "familiar anchors",
    "deepening center",
    "lift point",
    "comedown",
    "landing",
  ],
  immersion: [
    "entry zone",
    "same-world anchors",
    "deeper pocket",
    "seam bridge",
    "settling close",
  ],
  discovery: [
    "easy entry",
    "anchor run",
    "new terrain",
    "bridge zone",
    "statement close",
  ],
  comfort: ["warm open", "trusted core", "gentle drift", "soft landing"],
  atmosphere: [
    "setting the room",
    "locked pocket",
    "textural bloom",
    "long exhale",
  ],
  drive: ["ignition", "open road", "night stretch", "peak lane", "last pull"],
  release: ["low burn", "set the fuse", "lift zone", "payoff", "afterglow"],
};

function nameBlockFromContent(
  tracks: SequencerTrack[],
  blockIndex: number,
  totalBlocks: number,
  goal: SequencerGoal
): string {
  if (tracks.length === 0) return `section ${blockIndex + 1}`;

  const avgEnergy = average(tracks.map((t) => t.featureProfile.energy));
  const avgFamiliarity = average(tracks.map((t) => t.featureProfile.familiarity));
  const avgNovelty = average(tracks.map((t) => t.featureProfile.novelty));
  const avgIntensity = average(tracks.map((t) => t.featureProfile.intensity));
  const avgComfort = average(tracks.map((t) => t.featureProfile.comfort));

  // Dominant genre family
  const genreCounts = new Map<string, number>();
  for (const t of tracks) {
    const g = t.featureProfile.genreFamily;
    genreCounts.set(g, (genreCounts.get(g) || 0) + 1);
  }
  const dominantGenre = Array.from(genreCounts.entries())
    .sort((a, b) => b[1] - a[1])[0]?.[0] || "general";

  // Dominant texture
  const textureCounts = new Map<string, number>();
  for (const t of tracks) {
    const tx = t.featureProfile.texture;
    textureCounts.set(tx, (textureCounts.get(tx) || 0) + 1);
  }
  const dominantTexture = Array.from(textureCounts.entries())
    .sort((a, b) => b[1] - a[1])[0]?.[0] || "hybrid";

  // Build a descriptive name from the block's character
  const energyWord =
    avgEnergy >= 0.65
      ? "high energy"
      : avgEnergy >= 0.45
        ? "mid energy"
        : avgEnergy <= 0.25
          ? "quiet"
          : "mellow";

  const moodWord =
    avgComfort >= 0.65
      ? "cozy"
      : avgIntensity >= 0.6
        ? "intense"
        : avgFamiliarity >= 0.7
          ? "familiar"
          : avgNovelty >= 0.6
            ? "exploratory"
            : "balanced";

  // Use arc-position names for the first and last blocks
  const names = GOAL_BLOCK_NAMES[goal];
  if (blockIndex === 0 && names.length > 0) return names[0];
  if (blockIndex === totalBlocks - 1 && names.length > 1) return names[names.length - 1];

  // For middle blocks: if the goal has a name at roughly this arc position, use it
  // if it fits the block's character; otherwise derive from content
  const arcRatio = blockIndex / Math.max(1, totalBlocks - 1);
  const arcNameIndex = Math.round(arcRatio * (names.length - 1));
  if (arcNameIndex > 0 && arcNameIndex < names.length - 1 && totalBlocks <= names.length) {
    return names[arcNameIndex];
  }

  // Genre-flavored names for variety
  const genreHint =
    dominantGenre === "general" || dominantGenre === "pop"
      ? ""
      : dominantGenre === "electronic"
        ? "electronic "
        : dominantGenre === "acoustic"
          ? "acoustic "
          : dominantGenre === "hip-hop"
            ? "hip-hop "
            : dominantGenre === "ambient"
              ? "ambient "
              : dominantGenre === "rock"
                ? "rock "
                : dominantGenre === "soul"
                  ? "soul "
                  : "";

  // Combine into a mini-playlist name
  if (avgEnergy >= 0.6 && avgFamiliarity >= 0.6) return `${genreHint}favorites run`.trim();
  if (avgEnergy >= 0.6 && avgNovelty >= 0.5) return `${genreHint}energy push`.trim();
  if (avgEnergy >= 0.6) return `${genreHint}${energyWord} stretch`.trim();
  if (avgComfort >= 0.65 && avgFamiliarity >= 0.65) return `${genreHint}comfort zone`.trim();
  if (avgNovelty >= 0.55) return `${genreHint}new finds`.trim();
  if (avgIntensity >= 0.55) return `${genreHint}deep cut`.trim();
  if (avgEnergy <= 0.3) return `${genreHint}${energyWord} drift`.trim();
  if (dominantTexture === "acoustic") return "acoustic pocket";
  if (dominantTexture === "electronic") return "electronic run";

  return `${genreHint}${moodWord} stretch`.trim();
}

const BLOCK_COLORS = [
  "#ff6b3d",
  "#7c77c6",
  "#2fbf71",
  "#e6b325",
  "#5bc0eb",
  "#d96c9d",
];

function nowIso() {
  return new Date().toISOString();
}

function differenceInDays(date: string | null | undefined) {
  if (!date) return null;
  const diffMs = Date.now() - new Date(date).getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

function unique<T>(values: T[]) {
  return Array.from(new Set(values));
}

function chunk<T>(values: T[], size: number) {
  const items: T[][] = [];
  for (let index = 0; index < values.length; index += size) {
    items.push(values.slice(index, index + size));
  }
  return items;
}

function average(values: number[]) {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function normalizeSingleRelation<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] || null;
  return value || null;
}

async function spotifyFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const accessToken = await getAccessToken();
  const response = await fetch(`https://api.spotify.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers || {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Spotify request failed for ${path}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

async function fetchPlaylistMeta(playlistId: string): Promise<SequencerPlaylistMeta> {
  const playlist = await spotifyFetch<SpotifyPlaylistPayload>(
    `/playlists/${playlistId}?fields=id,name,description,images,external_urls,owner(display_name),tracks(total),snapshot_id`
  );

  return {
    id: playlist.id,
    name: playlist.name,
    description: playlist.description,
    imageUrl: playlist.images?.[0]?.url || null,
    playlistUrl: playlist.external_urls?.spotify || null,
    owner: playlist.owner?.display_name || null,
    trackCount: playlist.tracks?.total || 0,
    snapshotId: playlist.snapshot_id || null,
  };
}

async function fetchPlaylistTracks(
  playlistId: string
): Promise<Array<SpotifyPlaylistTrackItem & { position: number }>> {
  const items: Array<SpotifyPlaylistTrackItem & { position: number }> = [];
  let offset = 0;

  while (true) {
    const data = await spotifyFetch<{
      items: SpotifyPlaylistTrackItem[];
      next: string | null;
    }>(
      `/playlists/${playlistId}/tracks?limit=100&offset=${offset}&fields=items(added_at,track(id,uri,name,artists(id,name),album(name,images),duration_ms,popularity,preview_url,explicit,external_urls)),next`
    );

    const nextItems = data.items.map((item, index) => ({
      ...item,
      position: offset + index,
    }));
    items.push(...nextItems);

    if (!data.next) break;
    offset += 100;
  }

  return items.filter((item) => Boolean(item.track?.id));
}

async function fetchArtistDetails(artistIds: string[]) {
  const uniqueArtistIds = unique(artistIds.filter(Boolean));
  const artistMap = new Map<string, SpotifyArtistPayload>();

  for (const artistChunk of chunk(uniqueArtistIds, 50)) {
    const payload = await spotifyFetch<{ artists: SpotifyArtistPayload[] }>(
      `/artists?ids=${artistChunk.join(",")}`
    );
    for (const artist of payload.artists || []) {
      artistMap.set(artist.id, artist);
    }
  }

  return artistMap;
}

function scriptLanguage(input: string) {
  if (!input.trim()) return "Unknown";
  if (/[가-힣]/.test(input)) return "Korean";
  if (/[ぁ-ゔァ-ヶ]/.test(input)) return "Japanese";
  if (/[一-龯]/.test(input)) return "Chinese";
  if (/[ऀ-ॿ]/.test(input)) return "Hindi";
  if (/[؀-ۿ]/.test(input)) return "Arabic";
  if (/[Ѐ-ӿ]/.test(input)) return "Cyrillic";
  if (/[A-Za-z]/.test(input)) return "Latin";
  return "Unknown";
}

function inferLanguage(title: string, genres: string[]) {
  const fromScript = scriptLanguage(title);
  if (fromScript !== "Latin" && fromScript !== "Unknown") return fromScript;

  const genreText = genres.join(" ").toLowerCase();
  if (/(k-pop|k-rap|k-indie)/.test(genreText)) return "Korean";
  if (/(j-pop|j-rock|anime|city pop)/.test(genreText)) return "Japanese";
  if (/(bollywood|desi|indian)/.test(genreText)) return "Hindi";
  if (/(latin|reggaeton|bachata|cumbia|corrido|salsa)/.test(genreText)) {
    return "Spanish/Portuguese";
  }

  return fromScript === "Latin" ? "Latin" : "Unknown";
}

function inferGenreFamily(genres: string[]) {
  const joined = genres.join(" ").toLowerCase();

  if (!joined) return "general";
  if (/(ambient|lo-fi|downtempo|sleep|study)/.test(joined)) return "ambient";
  if (/(rap|hip hop|trap|grime|drill)/.test(joined)) return "hip-hop";
  if (/(house|techno|edm|electro|dance|garage|trance)/.test(joined)) return "electronic";
  if (/(metal|punk|hardcore|emo|shoegaze|rock)/.test(joined)) return "rock";
  if (/(r&b|soul|funk|neo soul)/.test(joined)) return "soul";
  if (/(jazz|blues)/.test(joined)) return "jazz";
  if (/(folk|singer-songwriter|acoustic|americana|country)/.test(joined)) return "acoustic";
  if (/(classical|orchestra|piano|instrumental|soundtrack)/.test(joined)) return "instrumental";
  if (/(reggaeton|latin|salsa|bachata|corridos|cumbia)/.test(joined)) return "latin";
  if (/(pop|indie pop|bedroom pop|dream pop)/.test(joined)) return "pop";

  return "general";
}

function inferTexture(genres: string[], title: string) {
  const joined = `${genres.join(" ").toLowerCase()} ${title.toLowerCase()}`;

  if (/(acoustic|folk|americana|singer-songwriter|unplugged)/.test(joined)) {
    return "acoustic";
  }

  if (/(ambient|electronic|synth|house|techno|edm|hyperpop)/.test(joined)) {
    return "electronic";
  }

  if (/(orchestra|classical|jazz|organic|band|soul)/.test(joined)) {
    return "organic";
  }

  if (/(instrumental|interlude|hybrid)/.test(joined)) {
    return "hybrid";
  }

  return "hybrid";
}

function inferEnergy(
  genres: string[],
  popularity: number | null,
  explicit: boolean,
  durationMs: number | null
) {
  const joined = genres.join(" ").toLowerCase();
  let score = 0.45;

  if (/(ambient|sleep|acoustic|piano|classical|study)/.test(joined)) score -= 0.18;
  if (/(dance|edm|house|techno|metal|punk|hyperpop|drill|trap)/.test(joined)) score += 0.18;
  if (/(funk|disco|pop|reggaeton)/.test(joined)) score += 0.08;

  if (explicit) score += 0.04;
  if ((popularity ?? 50) >= 75) score += 0.05;
  if ((durationMs ?? 0) >= 1000 * 60 * 5) score -= 0.04;

  return clamp(score);
}

function inferValence(genres: string[], title: string) {
  const joined = `${genres.join(" ").toLowerCase()} ${title.toLowerCase()}`;
  let score = 0.5;

  if (/(sad|blue|alone|night|cry|hurt|ghost|dark|empty|slow)/.test(joined)) score -= 0.18;
  if (/(sun|summer|light|shine|smile|love|dance|gold|happy|warm)/.test(joined)) score += 0.14;
  if (/(emo|post-punk|grunge|doom)/.test(joined)) score -= 0.12;
  if (/(house|funk|disco|soul)/.test(joined)) score += 0.1;

  return clamp(score);
}

function inferLyricDensity(genres: string[], title: string, durationMs: number | null) {
  const joined = `${genres.join(" ").toLowerCase()} ${title.toLowerCase()}`;
  let score = 0.48;

  if (/(rap|hip hop|drill|grime|spoken|slam)/.test(joined)) score += 0.26;
  if (/(instrumental|ambient|interlude|soundtrack|piano|classical)/.test(joined)) score -= 0.26;
  if ((durationMs ?? 0) <= 1000 * 60 * 2.2) score += 0.05;

  return clamp(score);
}

function deriveTrackFeatures(row: ReviewTrackRow, genres: string[]) {
  const daysSinceListen = differenceInDays(row.last_played_at);
  const state = normalizeSingleRelation(row.spotify_review_state) || {};
  const reviewCount = Number(state.review_count || 0);
  const confirmStreak = Number(state.confirm_streak || 0);
  const deferCount = Number(state.defer_count || 0);
  const unsureCount = Number(state.unsure_count || 0);
  const playCount = Number(row.play_count || 0);
  const skipPenalty = clamp((deferCount + unsureCount * 1.2) / 8, 0, 0.65);
  const recencySignal =
    daysSinceListen == null ? 0.34 : 1 - clamp(daysSinceListen / 120, 0, 1);

  const familiarity = clamp(
    reviewCount / 12 * 0.28 +
      confirmStreak / 8 * 0.18 +
      playCount / 25 * 0.12 +
      ((row.popularity ?? 45) / 100) * 0.16 +
      recencySignal * 0.32 -
      skipPenalty * 0.28
  );

  const novelty = clamp(
    (1 - familiarity) * 0.58 +
      (reviewCount === 0 ? 0.26 : 0) +
      (daysSinceListen != null && daysSinceListen >= 60 ? 0.12 : 0) +
      ((row.spotify_review_track_buckets || []).length <= 1 ? 0.06 : 0)
  );

  const energy = inferEnergy(genres, row.popularity, Boolean(row.explicit), row.duration_ms);
  const valence = inferValence(genres, row.title);
  const lyricDensity = inferLyricDensity(genres, row.title, row.duration_ms);
  const texture = inferTexture(genres, row.title);
  const genreFamily = inferGenreFamily(genres);
  const language = inferLanguage(row.title, genres);
  const intensity = clamp(energy * 0.62 + lyricDensity * 0.18 + (1 - valence) * 0.2);
  const comfort = clamp(familiarity * 0.62 + (1 - intensity) * 0.22 + valence * 0.16);
  const anchor = clamp(
    familiarity * 0.58 +
      comfort * 0.22 +
      ((row.popularity ?? 50) / 100) * 0.1 +
      (genreFamily === "general" || genreFamily === "pop" ? 0.08 : 0) -
      novelty * 0.14
  );
  const demand = clamp(intensity * 0.55 + lyricDensity * 0.2 + (1 - comfort) * 0.25);

  return {
    energy,
    familiarity,
    novelty,
    intensity,
    valence,
    lyricDensity,
    bridgePotential: 0,
    comfort,
    anchor,
    demand,
    language,
    genreFamily,
    texture,
  } satisfies SequencerTrackFeatures;
}

function roleTagsForTrack(
  track: SequencerTrack,
  index: number,
  total: number,
  previous?: SequencerTrack
) {
  const tags = new Set(track.roleTags);

  if (index === 0) tags.add("opener");
  if (index === total - 1) tags.add("closer");
  if (track.featureProfile.anchor >= 0.72) tags.add("anchor");
  if (track.featureProfile.novelty >= 0.7) tags.add("new");
  if (track.featureProfile.familiarity >= 0.76) tags.add("favorite");
  if (track.featureProfile.bridgePotential >= 0.68) tags.add("bridge");

  if (previous) {
    if (track.featureProfile.energy - previous.featureProfile.energy >= 0.15) {
      tags.add("lift");
    }
    if (
      previous.featureProfile.intensity - track.featureProfile.intensity >= 0.18 &&
      track.featureProfile.comfort >= 0.52
    ) {
      tags.add("reset");
    }
  }

  return Array.from(tags).slice(0, 4);
}

function withBridgePotential(tracks: SequencerTrack[]) {
  const averages = {
    energy: average(tracks.map((track) => track.featureProfile.energy)),
    familiarity: average(tracks.map((track) => track.featureProfile.familiarity)),
    novelty: average(tracks.map((track) => track.featureProfile.novelty)),
    intensity: average(tracks.map((track) => track.featureProfile.intensity)),
    valence: average(tracks.map((track) => track.featureProfile.valence)),
    lyricDensity: average(tracks.map((track) => track.featureProfile.lyricDensity)),
  };

  return tracks.map((track) => {
    const centrality =
      1 -
      average([
        Math.abs(track.featureProfile.energy - averages.energy),
        Math.abs(track.featureProfile.familiarity - averages.familiarity),
        Math.abs(track.featureProfile.novelty - averages.novelty),
        Math.abs(track.featureProfile.intensity - averages.intensity),
        Math.abs(track.featureProfile.valence - averages.valence),
        Math.abs(track.featureProfile.lyricDensity - averages.lyricDensity),
      ]);

    return {
      ...track,
      featureProfile: {
        ...track.featureProfile,
        bridgePotential: clamp(centrality),
      },
    };
  });
}

function reorderLocally(tracks: SequencerTrack[], goal: SequencerGoal, iterations = 2) {
  const next = [...tracks];

  for (let pass = 0; pass < iterations; pass += 1) {
    for (let index = 0; index < next.length - 2; index += 1) {
      const current = next[index];
      const left = next[index + 1];
      const right = next[index + 2];
      const asIs =
        computeCompatibility(current.featureProfile, left.featureProfile, goal) +
        computeCompatibility(left.featureProfile, right.featureProfile, goal);
      const swapped =
        computeCompatibility(current.featureProfile, right.featureProfile, goal) +
        computeCompatibility(right.featureProfile, left.featureProfile, goal);

      if (swapped > asIs + 12) {
        next[index + 1] = right;
        next[index + 2] = left;
      }
    }
  }

  return next;
}

function chooseOrderedTracks(
  tracks: SequencerTrack[],
  goal: SequencerGoal,
  dominantLanguage: string | null,
  secondaryGoal: SequencerModifier | null,
  arcProfile?: SequencerArcProfile | null
) {
  if (tracks.length <= 2) return tracks;

  const languagePrioritized =
    goal === "immersion" && dominantLanguage
      ? [...tracks].sort((left, right) => {
          const leftMatch = left.featureProfile.language === dominantLanguage ? 1 : 0;
          const rightMatch = right.featureProfile.language === dominantLanguage ? 1 : 0;
          return rightMatch - leftMatch;
        })
      : tracks;

  return buildOptimizedTrackOrder(languagePrioritized, {
    goalType: goal,
    secondaryGoal,
    arcProfile: arcProfile || null,
  });
}

function blockCountFor(totalTracks: number) {
  if (totalTracks <= 6) return 2;
  if (totalTracks <= 14) return 3;
  if (totalTracks <= 22) return 4;
  if (totalTracks <= 35) return 5;
  if (totalTracks <= 55) return 6;
  if (totalTracks <= 80) return 7;
  return Math.min(10, Math.ceil(totalTracks / 12));
}

function pickBoundaryIndexes(tracks: SequencerTrack[], goal: SequencerGoal) {
  const targetBlocks = Math.max(2, Math.min(blockCountFor(tracks.length), tracks.length));
  const minBlockSize = tracks.length >= 10 ? 3 : 2;
  const maxBlockSize = Math.max(minBlockSize + 1, Math.ceil(tracks.length / targetBlocks * 1.6));

  const candidateBoundaries = tracks.slice(0, -1).map((track, index) => ({
    index,
    compatibility: computeCompatibility(
      track.featureProfile,
      tracks[index + 1].featureProfile,
      goal
    ),
  }));

  const selected: number[] = [];

  // Score each candidate boundary: low compatibility = good split point,
  // but also reward splits that keep blocks within a reasonable size range.
  const idealBlockSize = Math.round(tracks.length / targetBlocks);

  for (const candidate of candidateBoundaries
    .map((c) => {
      // Bonus for splitting near the ideal size intervals
      const nearestIdeal = Math.round((c.index + 1) / idealBlockSize) * idealBlockSize - 1;
      const distanceFromIdeal = Math.abs(c.index - nearestIdeal);
      const sizeBonus = Math.max(0, 20 - distanceFromIdeal * 3);
      // Lower combined score = better split point
      return { ...c, score: c.compatibility - sizeBonus };
    })
    .sort((a, b) => a.score - b.score)) {
    if (selected.length >= targetBlocks - 1) break;

    const proposed = [...selected, candidate.index].sort((a, b) => a - b);
    let cursor = 0;
    let valid = true;

    for (const boundary of proposed) {
      const size = boundary + 1 - cursor;
      if (size < minBlockSize || size > maxBlockSize) {
        valid = false;
        break;
      }
      cursor = boundary + 1;
    }

    // Check the final block too
    if (valid && (tracks.length - cursor < minBlockSize || tracks.length - cursor > maxBlockSize)) {
      valid = false;
    }

    if (!valid) continue;
    selected.push(candidate.index);
  }

  // If we didn't find enough boundaries with the strict max constraint,
  // relax the max and try again with just min enforcement
  if (selected.length < targetBlocks - 1) {
    selected.length = 0;
    for (const candidate of candidateBoundaries.sort((a, b) => a.compatibility - b.compatibility)) {
      if (selected.length >= targetBlocks - 1) break;

      const proposed = [...selected, candidate.index].sort((a, b) => a - b);
      let cursor = 0;
      let valid = true;

      for (const boundary of proposed) {
        const size = boundary + 1 - cursor;
        if (size < minBlockSize) {
          valid = false;
          break;
        }
        cursor = boundary + 1;
      }

      if (!valid || tracks.length - cursor < minBlockSize) continue;
      selected.push(candidate.index);
    }
  }

  if (selected.length === 0 && tracks.length > 6) {
    selected.push(Math.floor(tracks.length / 2) - 1);
  }

  return selected.sort((a, b) => a - b);
}

function buildInitialBlocks(
  orderedTracks: SequencerTrack[],
  goal: SequencerGoal,
  secondaryGoal: SequencerModifier | null,
  arcProfile?: SequencerArcProfile | null
): { blocks: SequencePersistenceBlock[]; tracks: SequencePersistenceTrack[] } {
  const blocks: SequencePersistenceBlock[] = [];
  const sequenceTracks: SequencePersistenceTrack[] = [];

  const slices: SequencerTrack[][] = [];
  const plan = buildOptimizedBlockPlan(orderedTracks, {
    goalType: goal,
    secondaryGoal,
    arcProfile: arcProfile || null,
  });

  if (plan.length === 0) {
    slices.push(orderedTracks);
  } else {
    for (const range of plan) {
      slices.push(orderedTracks.slice(range.start, range.end));
    }
  }

  const totalBlocks = slices.length;
  let globalPos = 0;

  for (let blockIndex = 0; blockIndex < slices.length; blockIndex++) {
    const slice = slices[blockIndex];
    const blockId = crypto.randomUUID();
    const blockName = nameBlockFromContent(slice, blockIndex, totalBlocks, goal);

    blocks.push({
      id: blockId,
      name: blockName,
      purpose: SEQUENCER_GOAL_PURPOSES[goal],
      position: blockIndex,
      colorToken: BLOCK_COLORS[blockIndex % BLOCK_COLORS.length],
      notes: null,
      locked: false,
    });

    slice.forEach((track) => {
      sequenceTracks.push({
        trackId: track.trackId,
        blockId,
        position: globalPos++,
        roleTags: [],
        locked: false,
        hiddenFromAutosort: false,
        derivedProfile: track.featureProfile,
      });
    });
  }

  return { blocks, tracks: sequenceTracks };
}

function bridgeCandidatesForBoundary(
  allTracks: SequencerTrack[],
  left: SequencerTrack,
  right: SequencerTrack,
  goal: SequencerGoal,
  secondaryGoal: SequencerModifier | null
) {
  const directCompatibility = computeSequencerCompatibility(
    left.featureProfile,
    right.featureProfile,
    goal,
    secondaryGoal
  );

  return allTracks
    .filter(
      (track) =>
        track.trackId !== left.trackId &&
        track.trackId !== right.trackId
    )
    .map((track) => {
      const leftCompatibility = computeSequencerCompatibility(
        left.featureProfile,
        track.featureProfile,
        goal,
        secondaryGoal
      );
      const rightCompatibility = computeSequencerCompatibility(
        track.featureProfile,
        right.featureProfile,
        goal,
        secondaryGoal
      );
      const score =
        (leftCompatibility + rightCompatibility) / 2 -
        directCompatibility +
        track.featureProfile.bridgePotential * 22 +
        track.featureProfile.comfort * 8;

      return {
        trackId: track.trackId,
        score,
      };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3)
    .map((candidate) => candidate.trackId);
}

function hydrateBlocks(
  orderedTracks: SequencerTrack[],
  blockRows: SequencePersistenceBlock[],
  goal: SequencerGoal,
  secondaryGoal: SequencerModifier | null
) {
  const blockMap = new Map<string, SequencerBlock>();

  for (const row of blockRows.sort((a, b) => a.position - b.position)) {
    blockMap.set(row.id, {
      id: row.id,
      name: row.name,
      purpose: row.purpose,
      position: row.position,
      colorToken: row.colorToken,
      notes: row.notes,
      locked: row.locked,
      summary: "",
      warnings: [],
      metrics: {
        cohesion: 0,
        energy: 0,
        familiarity: 0,
        novelty: 0,
        intensity: 0,
      },
      tracks: [],
    });
  }

  for (const track of orderedTracks) {
    const block = blockMap.get(track.blockId);
    if (block) block.tracks.push(track);
  }

  const blocks = Array.from(blockMap.values())
    .sort((a, b) => a.position - b.position)
    .map((block) => {
      if (block.tracks.length === 0) {
        block.metrics = {
          cohesion: 100,
          energy: 0,
          familiarity: 0,
          novelty: 0,
          intensity: 0,
        };
        block.summary = "empty / staging / waiting for songs";
        block.warnings = [];
        return block;
      }

      block.metrics = {
        cohesion: 0,
        energy: average(block.tracks.map((track) => track.featureProfile.energy)),
        familiarity: average(block.tracks.map((track) => track.featureProfile.familiarity)),
        novelty: average(block.tracks.map((track) => track.featureProfile.novelty)),
        intensity: average(block.tracks.map((track) => track.featureProfile.intensity)),
      };
      block.metrics = buildBlockMetrics(block, goal, secondaryGoal);
      block.summary = summarizeBlock(block);
      block.warnings = [];
      return block;
    });

  return blocks;
}

function buildTransitions(
  blocks: SequencerBlock[],
  goal: SequencerGoal,
  secondaryGoal: SequencerModifier | null,
  boundaryPreferences: Record<string, SequencerBoundaryPreference>
) {
  const orderedTracks = blocks.flatMap((block) => block.tracks);
  const transitions: SequencerBoundary[] = [];

  for (let index = 0; index < blocks.length - 1; index += 1) {
    const current = blocks[index];
    const next = blocks[index + 1];
    if (current.tracks.length === 0 || next.tracks.length === 0) {
      continue;
    }
    const tail = current.tracks[current.tracks.length - 1];
    const head = next.tracks[0];
    const boundaryId = getBoundaryKey(current.id, next.id);
    const mode = boundaryPreferences[boundaryId]?.mode || "smooth";
    const compatibility = computeSequencerCompatibility(
      tail.featureProfile,
      head.featureProfile,
      goal,
      secondaryGoal,
      mode
    );
    const riskLabel = getRiskLabel(compatibility);

    transitions.push({
      id: boundaryId,
      fromBlockId: current.id,
      toBlockId: next.id,
      mode,
      compatibility,
      riskLabel,
      changeSummary: describeBoundaryChanges(tail.featureProfile, head.featureProfile),
      bridgeCandidateTrackIds: bridgeCandidatesForBoundary(
        orderedTracks,
        tail,
        head,
        goal,
        secondaryGoal
      ),
    });

    if (riskLabel !== "smooth") {
      current.warnings.push(
        riskLabel === "abrupt" ? "edge transition is abrupt" : "edge transition is noticeable"
      );
    }
  }

  for (const block of blocks) {
    block.warnings = unique(block.warnings).slice(0, 2);
  }

  return transitions;
}

function buildSuggestions(
  blocks: SequencerBlock[],
  transitions: SequencerBoundary[],
  metrics: SequencerQualityMetrics,
  goal: SequencerGoal,
  secondaryGoal: SequencerModifier | null
) {
  const suggestions: SequencerSuggestion[] = [];

  for (const transition of transitions.filter((item) => item.riskLabel === "abrupt").slice(0, 2)) {
    suggestions.push({
      id: `boundary-${transition.id}`,
      type: "boundary",
      boundaryId: transition.id,
      title: "This handoff wants a bridge.",
      detail:
        transition.changeSummary.length > 0
          ? `Too much changes at once: ${transition.changeSummary.join(", ")}.`
          : "The boundary shifts too many dimensions at once.",
    });
  }

  const tracks = blocks.flatMap((block) => block.tracks);
  const demandingRun = tracks.some(
    (track, index) =>
      track.featureProfile.demand >= 0.72 &&
      tracks[index + 1]?.featureProfile.demand >= 0.72
  );
  if (demandingRun) {
    suggestions.push({
      id: "anchor-run",
      type: "anchor",
      title: "The run gets demanding without relief.",
      detail: "Drop a familiar anchor or reset song into the densest stretch.",
    });
  }

  if (metrics.endingStrength < 66) {
    const endingDetail =
      goal === "discovery"
        ? "Use a stronger final statement or a favorite with sharper identity."
        : goal === "release"
          ? "Use a clearer payoff track or a closer that releases more tension."
          : secondaryGoal === "soft-landing"
            ? "The softer finish still needs a more decisive landing track."
            : "Use a softer closer or a more familiar landing track.";

    suggestions.push({
      id: "ending",
      type: "ending",
      title: "The ending lands softly but not clearly.",
      detail: endingDetail,
      blockId: blocks[blocks.length - 1]?.id,
    });
  }

  if (metrics.noveltyPacing < 60) {
    suggestions.push({
      id: "novelty",
      type: "novelty",
      title: "New or difficult songs are bunching up.",
      detail: "Spread unfamiliar picks apart so the playlist can breathe.",
    });
  }

  return suggestions.slice(0, 5);
}

function orderTracksWithCompatibility(
  tracks: SequencerTrack[],
  goal: SequencerGoal,
  secondaryGoal: SequencerModifier | null
) {
  return tracks.map((track, index) => ({
    ...track,
    currentPosition: index,
    prevCompatibility:
      index > 0
        ? computeSequencerCompatibility(
            tracks[index - 1].featureProfile,
            track.featureProfile,
            goal,
            secondaryGoal
          )
        : null,
    nextCompatibility:
      index < tracks.length - 1
        ? computeSequencerCompatibility(
            track.featureProfile,
            tracks[index + 1].featureProfile,
            goal,
            secondaryGoal
          )
        : null,
  }));
}

async function upsertPlaylistIntoReviewTables(
  playlist: SequencerPlaylistMeta,
  playlistTracks: Array<SpotifyPlaylistTrackItem & { position: number }>
) {
  const supabase = createAdminClient();
  const trackIds = playlistTracks.map((item) => item.track!.id);
  const { data: existingTrackRows } = await supabase
    .from("spotify_review_tracks")
    .select(
      "track_id, source_snapshot, is_liked, added_to_liked_at, removed_from_liked_at, last_played_at, play_count"
    )
    .in("track_id", trackIds);

  const existingMap = new Map(
    (existingTrackRows || []).map((row) => [row.track_id as string, row])
  );

  await supabase.from("spotify_review_buckets").upsert(
    {
      bucket_id: playlist.id,
      name: playlist.name,
      description: playlist.description,
      image_url: playlist.imageUrl,
      playlist_url: playlist.playlistUrl,
      owner_name: playlist.owner,
      is_public: true,
      track_count: playlist.trackCount,
      is_active: true,
      last_synced_at: nowIso(),
      updated_at: nowIso(),
    },
    { onConflict: "bucket_id" }
  );

  const reviewTrackRows = playlistTracks.map((item) => {
    const track = item.track!;
    const existing = existingMap.get(track.id) as any;
    const snapshot = {
      ...((existing?.source_snapshot as Record<string, unknown> | null) || {}),
      bucket_ids: unique([
        ...((((existing?.source_snapshot as any)?.bucket_ids as string[]) || [])),
        playlist.id,
      ]),
      playlist_positions: {
        ...((((existing?.source_snapshot as any)?.playlist_positions as Record<string, number>) || {})),
        [playlist.id]: item.position,
      },
    };

    return {
      track_id: track.id,
      spotify_uri: track.uri,
      title: track.name,
      artist_names: track.artists.map((artist) => artist.name),
      artist_display: track.artists.map((artist) => artist.name).join(", "),
      album_name: track.album?.name || null,
      album_image_url: track.album?.images?.[0]?.url || null,
      preview_url: track.preview_url || null,
      song_url: track.external_urls?.spotify || null,
      duration_ms: track.duration_ms,
      popularity: track.popularity,
      explicit: Boolean(track.explicit),
      is_liked: existing?.is_liked ?? true,
      added_to_liked_at: existing?.added_to_liked_at || null,
      removed_from_liked_at: existing?.removed_from_liked_at || null,
      last_played_at: existing?.last_played_at || null,
      play_count: existing?.play_count || 0,
      source_snapshot: snapshot,
      last_synced_at: nowIso(),
      updated_at: nowIso(),
    };
  });

  for (const upsertChunk of chunk(reviewTrackRows, 100)) {
    await supabase
      .from("spotify_review_tracks")
      .upsert(upsertChunk, { onConflict: "track_id" });
  }

  for (const stateChunk of chunk(trackIds, 100)) {
    await supabase
      .from("spotify_review_state")
      .upsert(
        stateChunk.map((trackId) => ({
          track_id: trackId,
          next_review_at: nowIso(),
        })),
        { onConflict: "track_id", ignoreDuplicates: true }
      );
  }

  const { data: existingMemberships } = await supabase
    .from("spotify_review_track_buckets")
    .select("track_id")
    .eq("bucket_id", playlist.id)
    .eq("active", true);

  const existingMembershipIds = new Set(
    (existingMemberships || []).map((row) => row.track_id as string)
  );
  const activeSet = new Set(trackIds);
  const removedIds = Array.from(existingMembershipIds).filter((id) => !activeSet.has(id));

  if (removedIds.length > 0) {
    for (const removeChunk of chunk(removedIds, 100)) {
      await supabase
        .from("spotify_review_track_buckets")
        .update({
          active: false,
          removed_at: nowIso(),
          updated_at: nowIso(),
        })
        .eq("bucket_id", playlist.id)
        .in("track_id", removeChunk);
    }
  }

  for (const bucketChunk of chunk(trackIds, 100)) {
    await supabase.from("spotify_review_track_buckets").upsert(
      bucketChunk.map((trackId) => ({
        track_id: trackId,
        bucket_id: playlist.id,
        active: true,
        removed_at: null,
        added_via: "spotify",
        updated_at: nowIso(),
      })),
      { onConflict: "track_id,bucket_id" }
    );
  }
}

async function fetchReviewTracks(trackIds: string[]) {
  const supabase = createAdminClient();
  const rows: ReviewTrackRow[] = [];

  for (const trackChunk of chunk(trackIds, 120)) {
    const { data } = await supabase
      .from("spotify_review_tracks")
      .select(
        `
          track_id,
          spotify_uri,
          title,
          artist_names,
          artist_display,
          album_name,
          album_image_url,
          preview_url,
          song_url,
          duration_ms,
          popularity,
          explicit,
          is_liked,
          added_to_liked_at,
          removed_from_liked_at,
          last_played_at,
          play_count,
          source_snapshot,
          spotify_review_state (
            review_count,
            confirm_streak,
            defer_count,
            unsure_count
          ),
          spotify_review_track_buckets (
            active,
            bucket_id
          )
        `
      )
      .in("track_id", trackChunk);

    rows.push(...((data || []) as ReviewTrackRow[]));
  }

  return rows;
}

async function loadStoredSequence(playlistId: string) {
  const supabase = createAdminClient();
  const [{ data: sequenceRow }, { data: blockRows }, { data: trackRows }] =
    await Promise.all([
      supabase
        .from("spotify_playlist_sequences")
        .select("*")
        .eq("playlist_id", playlistId)
        .maybeSingle(),
      supabase
        .from("spotify_playlist_sequence_blocks")
        .select("*")
        .eq("playlist_id", playlistId)
        .order("position"),
      supabase
        .from("spotify_playlist_sequence_tracks")
        .select("*")
        .eq("playlist_id", playlistId)
        .order("position"),
    ]);

  return {
    sequenceRow,
    blockRows: (blockRows || []).map((row: any) => ({
      id: row.id as string,
      name: row.name as string,
      purpose: (row.purpose as string) || "",
      position: Number(row.position || 0),
      colorToken: (row.color_token as string | null) || null,
      notes: (row.notes as string | null) || null,
      locked: Boolean(row.locked),
    })),
    trackRows: (trackRows || []).map((row: any) => ({
      trackId: row.track_id as string,
      blockId: row.block_id as string,
      position: Number(row.position || 0),
      roleTags: (row.role_tags as string[]) || [],
      locked: Boolean(row.locked),
      hiddenFromAutosort: Boolean(row.hidden_from_autosort),
      derivedProfile: row.derived_profile as SequencerTrackFeatures,
    })),
  };
}

async function persistSequence(
  playlistId: string,
  sequence: {
    goalType: SequencerGoal;
    secondaryGoal: SequencerModifier | null;
    arcProfile: SequencerArcProfile;
    boundaryPreferences: Record<string, SequencerBoundaryPreference>;
    blocks: SequencePersistenceBlock[];
    tracks: SequencePersistenceTrack[];
    metrics: SequencerQualityMetrics;
    sourceSnapshot: Record<string, unknown>;
    incrementVersion?: boolean;
  }
) {
  const supabase = createAdminClient();
  const existing = await supabase
    .from("spotify_playlist_sequences")
    .select("version")
    .eq("playlist_id", playlistId)
    .maybeSingle();

  const nextVersion =
    sequence.incrementVersion === false
      ? Number(existing.data?.version || 1)
      : Number(existing.data?.version || 0) + 1;

  await supabase.from("spotify_playlist_sequences").upsert(
    {
      playlist_id: playlistId,
      goal_type: sequence.goalType,
      secondary_goal: sequence.secondaryGoal,
      arc_profile: sequence.arcProfile,
      boundary_preferences: sequence.boundaryPreferences,
      quality_metrics: sequence.metrics,
      source_snapshot: sequence.sourceSnapshot,
      last_generated_at: nowIso(),
      version: nextVersion,
      updated_at: nowIso(),
    },
    { onConflict: "playlist_id" }
  );

  const { data: existingBlocks } = await supabase
    .from("spotify_playlist_sequence_blocks")
    .select("id")
    .eq("playlist_id", playlistId);
  const existingBlockIds = new Set(
    (existingBlocks || []).map((row) => row.id as string)
  );
  const nextBlockIds = new Set(sequence.blocks.map((block) => block.id));
  const staleBlockIds = Array.from(existingBlockIds).filter((id) => !nextBlockIds.has(id));

  if (staleBlockIds.length > 0) {
    await supabase
      .from("spotify_playlist_sequence_blocks")
      .delete()
      .eq("playlist_id", playlistId)
      .in("id", staleBlockIds);
  }

  if (sequence.blocks.length > 0) {
    await supabase.from("spotify_playlist_sequence_blocks").upsert(
      sequence.blocks.map((block) => ({
        id: block.id,
        playlist_id: playlistId,
        name: block.name,
        purpose: block.purpose,
        position: block.position,
        color_token: block.colorToken,
        notes: block.notes,
        locked: block.locked,
        updated_at: nowIso(),
      })),
      { onConflict: "id" }
    );
  }

  const { data: existingTracks } = await supabase
    .from("spotify_playlist_sequence_tracks")
    .select("track_id")
    .eq("playlist_id", playlistId);
  const existingTrackIds = new Set(
    (existingTracks || []).map((row) => row.track_id as string)
  );
  const nextTrackIds = new Set(sequence.tracks.map((track) => track.trackId));
  const staleTrackIds = Array.from(existingTrackIds).filter((id) => !nextTrackIds.has(id));

  if (staleTrackIds.length > 0) {
    await supabase
      .from("spotify_playlist_sequence_tracks")
      .delete()
      .eq("playlist_id", playlistId)
      .in("track_id", staleTrackIds);
  }

  if (sequence.tracks.length > 0) {
    const trackUpsertRows = sequence.tracks.map((track) => ({
      playlist_id: playlistId,
      track_id: track.trackId,
      block_id: track.blockId,
      position: track.position,
      role_tags: track.roleTags,
      locked: track.locked,
      hidden_from_autosort: track.hiddenFromAutosort,
      derived_profile: track.derivedProfile,
      updated_at: nowIso(),
    }));

    for (const trackChunk of chunk(trackUpsertRows, 100)) {
      await supabase
        .from("spotify_playlist_sequence_tracks")
        .upsert(trackChunk, { onConflict: "playlist_id,track_id" });
    }
  }
}

function dominantLanguageForTracks(tracks: SequencerTrack[]) {
  const counts = new Map<string, number>();
  for (const track of tracks) {
    const language = track.featureProfile.language;
    counts.set(language, (counts.get(language) || 0) + 1);
  }
  return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
}

function composeSnapshot(params: {
  playlist: SequencerPlaylistMeta;
  goalType: SequencerGoal;
  secondaryGoal: SequencerModifier | null;
  arcProfile?: SequencerArcProfile | null;
  blocks: SequencePersistenceBlock[];
  tracks: SequencePersistenceTrack[];
  trackMap: Map<string, SequencerTrack>;
  boundaryPreferences: Record<string, SequencerBoundaryPreference>;
  savedAt: string | null;
  dirty?: boolean;
}) {
  const orderedTracks = orderTracksWithCompatibility(
    params.tracks
      .sort((a, b) => a.position - b.position)
      .filter((row) => params.trackMap.has(row.trackId))
      .map((row) => {
        const track = params.trackMap.get(row.trackId)!;
        return {
          ...track,
          blockId: row.blockId,
          locked: row.locked,
          hiddenFromAutosort: row.hiddenFromAutosort,
          roleTags: row.roleTags,
        };
      }),
    params.goalType,
    params.secondaryGoal
  ).map((track, index, allTracks) => ({
    ...track,
    roleTags: roleTagsForTrack(track, index, allTracks.length, allTracks[index - 1]),
  }));

  const hydratedBlocks = hydrateBlocks(
    orderedTracks,
    params.blocks,
    params.goalType,
    params.secondaryGoal
  );
  const arcProfile =
    params.arcProfile && params.arcProfile.energy.length > 0
      ? params.arcProfile
      : buildArcProfile(params.goalType, hydratedBlocks);
  const transitions = buildTransitions(
    hydratedBlocks,
    params.goalType,
    params.secondaryGoal,
    params.boundaryPreferences
  );
  const chapters = buildMiniPlaylistChapters(hydratedBlocks, {
    goalType: params.goalType,
    secondaryGoal: params.secondaryGoal,
    arcProfile,
  });
  const metrics = buildQualityMetrics(
    hydratedBlocks,
    params.goalType,
    transitions,
    params.secondaryGoal
  );
  const suggestions = buildSuggestions(
    hydratedBlocks,
    transitions,
    metrics,
    params.goalType,
    params.secondaryGoal
  );

  return {
    authenticated: true,
    playlist: params.playlist,
    goalType: params.goalType,
    secondaryGoal: params.secondaryGoal,
    arcProfile,
    boundaryPreferences: params.boundaryPreferences,
    blocks: hydratedBlocks,
    transitions,
    chapters,
    metrics,
    suggestions,
    generatedAt: nowIso(),
    savedAt: params.savedAt,
    dirty: Boolean(params.dirty),
  } satisfies SequencerSnapshot;
}

async function buildTrackMapForPlaylist(
  playlistTracks: Array<SpotifyPlaylistTrackItem & { position: number }>
) {
  const trackIds = playlistTracks.map((item) => item.track!.id);
  const reviewRows = await fetchReviewTracks(trackIds);
  const artistIds = unique(
    playlistTracks.flatMap((item) =>
      item.track?.artists.map((artist) => artist.id).filter(Boolean) as string[]
    )
  );
  const artistMap = await fetchArtistDetails(artistIds);
  const reviewMap = new Map(reviewRows.map((row) => [row.track_id, row]));

  const tracks = playlistTracks
    .map((item) => {
      const spotifyTrack = item.track!;
      const row = reviewMap.get(spotifyTrack.id);
      if (!row) return null;
      const primaryArtistIds = spotifyTrack.artists
        .map((artist) => artist.id)
        .filter(Boolean) as string[];
      const genres = unique(
        primaryArtistIds.flatMap((artistId) => artistMap.get(artistId)?.genres || [])
      );
      const featureProfile = deriveTrackFeatures(row, genres);

      return {
        trackId: row.track_id,
        spotifyUri: row.spotify_uri,
        title: row.title,
        artistDisplay: row.artist_display,
        artistNames: row.artist_names || [],
        albumName: row.album_name,
        albumImageUrl: row.album_image_url,
        previewUrl: row.preview_url,
        songUrl: row.song_url,
        durationMs: row.duration_ms,
        popularity: row.popularity,
        explicit: Boolean(row.explicit),
        currentPosition: item.position,
        blockId: "",
        roleTags: [],
        locked: false,
        hiddenFromAutosort: false,
        reasons: [],
        featureProfile,
        prevCompatibility: null,
        nextCompatibility: null,
      } satisfies SequencerTrack;
    })
    .filter(Boolean) as SequencerTrack[];

  const withBridges = withBridgePotential(tracks);
  return new Map(withBridges.map((track) => [track.trackId, track]));
}

function generateInitialState(params: {
  playlist: SequencerPlaylistMeta;
  goalType: SequencerGoal;
  secondaryGoal: SequencerModifier | null;
  trackMap: Map<string, SequencerTrack>;
  playlistTracks: Array<SpotifyPlaylistTrackItem & { position: number }>;
}) {
  const tracks = params.playlistTracks
    .sort((a, b) => a.position - b.position)
    .map((item) => params.trackMap.get(item.track!.id))
    .filter((t): t is SequencerTrack => t != null);

  const dominantLanguage = dominantLanguageForTracks(tracks);
  const ordered = chooseOrderedTracks(
    tracks,
    params.goalType,
    dominantLanguage,
    params.secondaryGoal,
    null
  );
  const seeded = buildInitialBlocks(ordered, params.goalType, params.secondaryGoal, null);
  const snapshot = composeSnapshot({
    playlist: params.playlist,
    goalType: params.goalType,
    secondaryGoal: params.secondaryGoal,
    arcProfile: null,
    blocks: seeded.blocks,
    tracks: seeded.tracks,
    trackMap: params.trackMap,
    boundaryPreferences: {},
    savedAt: null,
  });

  return {
    blocks: seeded.blocks,
    tracks: snapshot.blocks.flatMap((block) =>
      block.tracks.map((track, index) => ({
        trackId: track.trackId,
        blockId: block.id,
        position:
          snapshot.blocks
            .slice(0, block.position)
            .reduce((sum, current) => sum + current.tracks.length, 0) + index,
        roleTags: track.roleTags,
        locked: false,
        hiddenFromAutosort: false,
        derivedProfile: track.featureProfile,
      }))
    ),
    snapshot,
  };
}

export async function getPlaylistSequence(
  playlistId: string,
  options?: { regenerate?: boolean }
) {
  const playlist = await fetchPlaylistMeta(playlistId);
  const playlistTracks = await fetchPlaylistTracks(playlistId);
  await upsertPlaylistIntoReviewTables(playlist, playlistTracks);
  const trackMap = await buildTrackMapForPlaylist(playlistTracks);
  const stored = await loadStoredSequence(playlistId);

  const currentTrackIds = playlistTracks.map((item) => item.track!.id);
  const storedTrackIds = stored.trackRows.map((row) => row.trackId);
  const hasSameTracks =
    currentTrackIds.length === storedTrackIds.length &&
    currentTrackIds.every((trackId) => storedTrackIds.includes(trackId));

  const goalType = normalizeSequencerGoal(stored.sequenceRow?.goal_type) || "journey";
  const secondaryGoal = normalizeSequencerModifier(stored.sequenceRow?.secondary_goal);

  if (!stored.sequenceRow || stored.blockRows.length === 0 || stored.trackRows.length === 0 || !hasSameTracks || options?.regenerate) {
    const generated = generateInitialState({
      playlist,
      goalType,
      secondaryGoal,
      trackMap,
      playlistTracks,
    });

    await persistSequence(playlistId, {
      goalType,
      secondaryGoal,
      arcProfile: generated.snapshot.arcProfile,
      boundaryPreferences: {},
      blocks: generated.blocks,
      tracks: generated.tracks,
      metrics: generated.snapshot.metrics,
      sourceSnapshot: {
        track_ids: currentTrackIds,
        spotify_snapshot_id: playlist.snapshotId,
      },
      incrementVersion: true,
    });

    return {
      ...generated.snapshot,
      savedAt: nowIso(),
    } satisfies SequencerSnapshot;
  }

  const snapshot = composeSnapshot({
    playlist,
    goalType,
    secondaryGoal,
    blocks: stored.blockRows,
    tracks: stored.trackRows,
    trackMap,
    arcProfile: (stored.sequenceRow?.arc_profile as SequencerArcProfile | null) || null,
    boundaryPreferences:
      (stored.sequenceRow?.boundary_preferences as Record<string, SequencerBoundaryPreference>) ||
      {},
    savedAt: (stored.sequenceRow?.updated_at as string | null) || null,
  });

  return snapshot;
}

export async function savePlaylistSequence(
  playlistId: string,
  input: SequencerSaveInput
) {
  const playlist = await fetchPlaylistMeta(playlistId);
  const playlistTracks = await fetchPlaylistTracks(playlistId);
  await upsertPlaylistIntoReviewTables(playlist, playlistTracks);
  const trackMap = await buildTrackMapForPlaylist(playlistTracks);

  const blocks: SequencePersistenceBlock[] = [...input.blocks]
    .sort((a, b) => a.position - b.position)
    .map((block, index) => ({
      id: block.id,
      name: block.name.trim() || `section ${index + 1}`,
      purpose: block.purpose || SEQUENCER_GOAL_PURPOSES[input.goalType],
      position: index,
      colorToken: block.colorToken || BLOCK_COLORS[index % BLOCK_COLORS.length],
      notes: block.notes,
      locked: block.locked,
    }));

  const validBlockIds = new Set(blocks.map((block) => block.id));
  const currentTrackIds = new Set(playlistTracks.map((item) => item.track!.id));

  const tracks: SequencePersistenceTrack[] = [...input.tracks]
    .filter((track) => currentTrackIds.has(track.trackId) && validBlockIds.has(track.blockId))
    .sort((a, b) => a.position - b.position)
    .map((track, index) => ({
      trackId: track.trackId,
      blockId: track.blockId,
      position: index,
      roleTags: unique(track.roleTags).slice(0, 4),
      locked: track.locked,
      hiddenFromAutosort: track.hiddenFromAutosort,
      derivedProfile:
        trackMap.get(track.trackId)?.featureProfile ||
        ({
          energy: 0.5,
          familiarity: 0.5,
          novelty: 0.5,
          intensity: 0.5,
          valence: 0.5,
          lyricDensity: 0.5,
          bridgePotential: 0.5,
          comfort: 0.5,
          anchor: 0.5,
          demand: 0.5,
          language: "Unknown",
          genreFamily: "general",
          texture: "hybrid",
        } satisfies SequencerTrackFeatures),
    }));

  const snapshot = composeSnapshot({
    playlist,
    goalType: input.goalType,
    secondaryGoal: input.secondaryGoal,
    arcProfile: input.arcProfile || null,
    blocks,
    tracks,
    trackMap,
    boundaryPreferences: input.boundaryPreferences || {},
    savedAt: nowIso(),
  });

  await persistSequence(playlistId, {
    goalType: input.goalType,
    secondaryGoal: input.secondaryGoal,
    arcProfile: snapshot.arcProfile,
    boundaryPreferences: input.boundaryPreferences || {},
    blocks,
    tracks: snapshot.blocks.flatMap((block) =>
      block.tracks.map((track, index) => ({
        trackId: track.trackId,
        blockId: block.id,
        position:
          snapshot.blocks
            .slice(0, block.position)
            .reduce((sum, current) => sum + current.tracks.length, 0) + index,
        roleTags: track.roleTags,
        locked: track.locked,
        hiddenFromAutosort: track.hiddenFromAutosort,
        derivedProfile: track.featureProfile,
      }))
    ),
    metrics: snapshot.metrics,
    sourceSnapshot: {
      track_ids: playlistTracks.map((item) => item.track!.id),
      spotify_snapshot_id: playlist.snapshotId,
    },
    incrementVersion: true,
  });

  return snapshot;
}

export async function applyPlaylistSequenceToSpotify(playlistId: string) {
  const snapshot = await getPlaylistSequence(playlistId);
  const currentPlaylist = await fetchPlaylistMeta(playlistId);
  const currentPlaylistTracks = await fetchPlaylistTracks(playlistId);
  const desiredTrackIds = snapshot.blocks.flatMap((block) =>
    block.tracks.map((track) => track.trackId)
  );
  const workingTrackIds = currentPlaylistTracks.map((item) => item.track!.id);

  if (
    desiredTrackIds.length !== workingTrackIds.length ||
    desiredTrackIds.some((trackId) => !workingTrackIds.includes(trackId))
  ) {
    throw new Error("Playlist contents changed. Refresh the sequencer before applying.");
  }

  let snapshotId = currentPlaylist.snapshotId;

  for (let targetIndex = 0; targetIndex < desiredTrackIds.length; targetIndex += 1) {
    const desiredTrackId = desiredTrackIds[targetIndex];
    if (workingTrackIds[targetIndex] === desiredTrackId) continue;

    const currentIndex = workingTrackIds.indexOf(desiredTrackId);
    if (currentIndex === -1) continue;

    const response = await spotifyFetch<{ snapshot_id?: string }>(
      `/playlists/${playlistId}/tracks`,
      {
        method: "PUT",
        body: JSON.stringify({
          range_start: currentIndex,
          insert_before: targetIndex,
          snapshot_id: snapshotId,
        }),
      }
    );

    snapshotId = response?.snapshot_id || snapshotId;
    const [moved] = workingTrackIds.splice(currentIndex, 1);
    workingTrackIds.splice(targetIndex, 0, moved);
  }

  const supabase = createAdminClient();
  await supabase
    .from("spotify_playlist_sequences")
    .update({
      last_applied_at: nowIso(),
      updated_at: nowIso(),
    })
    .eq("playlist_id", playlistId);

  return {
    snapshotId: snapshotId || null,
    appliedAt: nowIso(),
  };
}
