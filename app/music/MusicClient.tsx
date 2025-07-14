"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import useSWR from "swr";
import Image from "next/image";
import Navigation from "@/app/components/Navigation";
import { formatDistanceToNow } from "date-fns";

interface SpotifyTrack {
  id: string;
  title: string;
  artist: string;
  album: string;
  albumImageUrl: string | null;
  songUrl: string | null;
  playedAt?: string;
  duration?: number;
  preview_url?: string | null;
  popularity?: number;
  explicit?: boolean;
}

interface SpotifyPlaylist {
  id: string;
  name: string;
  description: string;
  imageUrl: string | null;
  playlistUrl: string;
  trackCount: number;
  owner: string;
  public: boolean;
}

interface NowPlayingTrack {
  isPlaying: boolean;
  title: string;
  artist: string;
  album: string;
  albumImageUrl: string | null;
  songUrl: string | null;
  progress?: number;
  duration?: number;
  playedAt?: string;
}

const fetcher = (url: string) => fetch(url).then((res) => res.json());

function formatTime(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
}

function TrackCard({
  track,
  index,
  isTopTrack = false,
}: {
  track: SpotifyTrack;
  index: number;
  isTopTrack?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        delay: index * 0.05,
        duration: 0.6,
        ease: [0.25, 0.1, 0.25, 1],
      }}
      whileHover={{ y: -4, transition: { duration: 0.3 } }}
      className="group cursor-pointer"
    >
      <div className="relative bg-gradient-to-br from-charcoal-black/90 via-charcoal-black/70 to-void-black/90 backdrop-blur-xl border border-white/5 rounded-2xl p-6 overflow-hidden transition-all duration-700 hover:border-white/10 hover:shadow-2xl hover:shadow-black/50">
        {/* Ambient Light Effect */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700">
          <div className="absolute inset-0 bg-gradient-to-br from-accent-orange/10 via-transparent to-accent-purple/10 blur-3xl" />
        </div>

        {/* Content */}
        <div className="relative z-10 flex items-center gap-4">
          {/* Track Number for Top Tracks */}
          {isTopTrack && (
            <div className="text-2xl font-light text-gray-500 w-8">
              {index + 1}
            </div>
          )}

          {/* Album Art */}
          {track.albumImageUrl && (
            <div className="relative w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-charcoal-black">
              <Image
                src={track.albumImageUrl}
                alt={track.album}
                fill
                className="object-cover transition-transform duration-700 group-hover:scale-105"
                sizes="64px"
              />
              <div className="absolute inset-0 bg-gradient-to-tr from-accent-orange/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
            </div>
          )}

          {/* Track Info */}
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-white text-lg truncate mb-1 group-hover:text-accent-orange transition-colors duration-300">
              {track.title}
            </h3>
            <p className="text-gray-400 text-sm truncate mb-1">
              by {track.artist}
            </p>
            <p className="text-gray-500 text-sm truncate">{track.album}</p>
          </div>

          {/* Metadata */}
          <div className="flex flex-col items-end gap-2 text-xs text-gray-500">
            {track.duration && <span>{formatTime(track.duration)}</span>}
            {track.playedAt && (
              <span>
                {formatDistanceToNow(new Date(track.playedAt), {
                  addSuffix: true,
                })}
              </span>
            )}
            {track.popularity && (
              <div className="flex items-center gap-1">
                <svg
                  className="w-3 h-3"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                </svg>
                <span>{track.popularity}</span>
              </div>
            )}
          </div>

          {/* Spotify Link */}
          {track.songUrl && (
            <motion.a
              href={track.songUrl}
              target="_blank"
              rel="noopener noreferrer"
              onClick={(e) => e.stopPropagation()}
              className="opacity-0 group-hover:opacity-100 transition-opacity duration-300 p-2 rounded-full bg-white/5 hover:bg-green-500/20 border border-white/10 hover:border-green-500/20"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.95 }}
            >
              <svg
                className="w-4 h-4 text-green-500"
                viewBox="0 0 24 24"
                fill="currentColor"
              >
                <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.299.421-1.02.599-1.559.3z" />
              </svg>
            </motion.a>
          )}
        </div>

        {/* Accent Line */}
        <motion.div
          className="absolute bottom-0 left-0 h-0.5 bg-gradient-to-r from-accent-orange via-accent-purple to-accent-orange opacity-0 group-hover:opacity-100"
          initial={{ width: "0%" }}
          whileHover={{ width: "100%" }}
          transition={{ duration: 0.6, ease: [0.25, 0.1, 0.25, 1] }}
        />
      </div>
    </motion.div>
  );
}

function PlaylistCard({
  playlist,
  index,
}: {
  playlist: SpotifyPlaylist;
  index: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{
        delay: index * 0.1,
        duration: 0.6,
        ease: [0.25, 0.1, 0.25, 1],
      }}
      whileHover={{ scale: 1.05, transition: { duration: 0.3 } }}
      className="group cursor-pointer"
    >
      <div className="relative bg-gradient-to-br from-charcoal-black/90 via-charcoal-black/70 to-void-black/90 backdrop-blur-xl border border-white/5 rounded-2xl p-6 overflow-hidden transition-all duration-700 hover:border-white/10 hover:shadow-2xl hover:shadow-black/50 aspect-square">
        {/* Ambient Light Effect */}
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-700">
          <div className="absolute inset-0 bg-gradient-to-br from-accent-purple/10 via-transparent to-accent-orange/10 blur-3xl" />
        </div>

        <div className="relative z-10 h-full flex flex-col">
          {/* Playlist Image */}
          <div className="relative w-full aspect-square rounded-xl overflow-hidden mb-4 bg-gradient-to-br from-charcoal-black via-void-black to-charcoal-black">
            {playlist.imageUrl ? (
              <Image
                src={playlist.imageUrl}
                alt={playlist.name}
                fill
                className="object-cover transition-transform duration-700 group-hover:scale-105"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <svg
                  className="w-12 h-12 text-gray-600"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                >
                  <path d="M18 3a1 1 0 00-1.196-.98l-10 2A1 1 0 006 5v9.114A4.369 4.369 0 005 14c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V7.82l8-1.6v5.894A4.37 4.37 0 0015 12c-1.657 0-3 .895-3 2s1.343 2 3 2 3-.895 3-2V3z" />
                </svg>
              </div>
            )}
          </div>

          {/* Playlist Info */}
          <div className="flex-1">
            <h3 className="font-medium text-white text-lg truncate mb-2 group-hover:text-accent-purple transition-colors duration-300">
              {playlist.name}
            </h3>
            {playlist.description && (
              <p className="text-gray-400 text-sm line-clamp-2 mb-3">
                {playlist.description}
              </p>
            )}
            <div className="flex items-center justify-between text-xs text-gray-500">
              <span>{playlist.trackCount} tracks</span>
              <span>by {playlist.owner}</span>
            </div>
          </div>

          {/* Spotify Link */}
          <motion.a
            href={playlist.playlistUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300 p-2 rounded-full bg-white/5 hover:bg-green-500/20 border border-white/10 hover:border-green-500/20"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.95 }}
          >
            <svg
              className="w-4 h-4 text-green-500"
              viewBox="0 0 24 24"
              fill="currentColor"
            >
              <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.299.421-1.02.599-1.559.3z" />
            </svg>
          </motion.a>
        </div>
      </div>
    </motion.div>
  );
}

export default function MusicClient() {
  const [selectedTab, setSelectedTab] = useState<
    "recent" | "top" | "playlists"
  >("recent");

  const { data: nowPlaying } = useSWR<NowPlayingTrack>(
    "/api/spotify/now-playing",
    fetcher,
    {
      refreshInterval: 30000,
    }
  );
  const { data: recentlyPlayed } = useSWR<{ tracks: SpotifyTrack[] }>(
    "/api/spotify/recently-played",
    fetcher,
    {
      refreshInterval: 60000,
    }
  );
  const { data: topTracks } = useSWR<{ tracks: SpotifyTrack[] }>(
    "/api/spotify/top-tracks",
    fetcher,
    {
      refreshInterval: 300000, // 5 minutes
    }
  );
  const { data: playlists } = useSWR<{ playlists: SpotifyPlaylist[] }>(
    "/api/spotify/playlists",
    fetcher,
    {
      refreshInterval: 600000, // 10 minutes
    }
  );

  const tabs = [
    {
      id: "recent" as const,
      label: "Recently Played",
      count: recentlyPlayed?.tracks.length || 0,
    },
    {
      id: "top" as const,
      label: "Top Tracks",
      count: topTracks?.tracks.length || 0,
    },
    {
      id: "playlists" as const,
      label: "Playlists",
      count: playlists?.playlists.length || 0,
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-void-black via-charcoal-black to-void-black">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(120,119,198,0.03),transparent_50%)]" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_80%_70%,rgba(255,107,61,0.02),transparent_50%)]" />

      <main className="relative z-10 min-h-screen">
        <Navigation />

        {/* Hero Section */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.25, 0.1, 0.25, 1] }}
          className="pt-20 pb-12 md:pt-32 md:pb-20"
        >
          <div className="max-w-7xl mx-auto px-6 md:px-8">
            <div className="text-center mb-12">
              <motion.h1
                className="text-4xl md:text-6xl lg:text-7xl font-extralight tracking-tight mb-6"
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 1,
                  delay: 0.2,
                  ease: [0.25, 0.1, 0.25, 1],
                }}
              >
                <span className="bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent">
                  music
                </span>
              </motion.h1>
              <motion.p
                className="text-xl md:text-2xl text-gray-400 font-light max-w-2xl mx-auto leading-relaxed"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{
                  duration: 0.8,
                  delay: 0.4,
                  ease: [0.25, 0.1, 0.25, 1],
                }}
              >
                a window into my world
              </motion.p>
            </div>

            {/* Now Playing Banner */}
            {nowPlaying && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.6 }}
                className="mb-12"
              >
                <div className="relative bg-gradient-to-br from-charcoal-black/90 via-charcoal-black/70 to-void-black/90 backdrop-blur-xl border border-white/5 rounded-3xl p-8 overflow-hidden">
                  {/* Ambient glow */}
                  <div className="absolute inset-0 bg-gradient-to-br from-accent-orange/10 via-transparent to-accent-purple/10 opacity-50" />

                  <div className="relative z-10 flex items-center gap-6">
                    {/* Album Art */}
                    {nowPlaying.albumImageUrl && (
                      <div className="relative w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0">
                        <Image
                          src={nowPlaying.albumImageUrl}
                          alt={nowPlaying.album}
                          fill
                          className="object-cover"
                          sizes="80px"
                        />
                        {nowPlaying.isPlaying && (
                          <div className="absolute inset-0 bg-gradient-to-tr from-accent-orange/30 to-transparent" />
                        )}
                      </div>
                    )}

                    {/* Track Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2">
                        <motion.div
                          className={`w-3 h-3 rounded-full ${
                            nowPlaying.isPlaying
                              ? "bg-green-500"
                              : "bg-gray-500"
                          }`}
                          animate={
                            nowPlaying.isPlaying ? { opacity: [1, 0.3, 1] } : {}
                          }
                          transition={{ duration: 2, repeat: Infinity }}
                        />
                        <span className="text-sm text-gray-400 font-light">
                          {nowPlaying.isPlaying ? "now playing" : "last played"}
                        </span>
                      </div>
                      <h2 className="text-2xl font-medium text-white mb-1 truncate">
                        {nowPlaying.title}
                      </h2>
                      <p className="text-lg text-gray-300 truncate mb-1">
                        by {nowPlaying.artist}
                      </p>
                      <p className="text-gray-500 truncate">
                        {nowPlaying.album}
                      </p>

                      {/* Progress bar for currently playing */}
                      {nowPlaying.isPlaying &&
                        nowPlaying.progress &&
                        nowPlaying.duration && (
                          <div className="mt-4 space-y-2">
                            <div className="relative h-1.5 bg-gray-800 rounded-full overflow-hidden">
                              <motion.div
                                className="absolute left-0 top-0 h-full bg-gradient-to-r from-accent-orange to-accent-purple rounded-full"
                                initial={{ width: "0%" }}
                                animate={{
                                  width: `${
                                    (nowPlaying.progress /
                                      nowPlaying.duration) *
                                    100
                                  }%`,
                                }}
                                transition={{ duration: 0.5 }}
                              />
                            </div>
                            <div className="flex justify-between text-sm text-gray-500">
                              <span>{formatTime(nowPlaying.progress)}</span>
                              <span>{formatTime(nowPlaying.duration)}</span>
                            </div>
                          </div>
                        )}
                    </div>

                    {/* Spotify Link */}
                    {nowPlaying.songUrl && (
                      <motion.a
                        href={nowPlaying.songUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="p-3 rounded-full bg-white/5 hover:bg-green-500/20 border border-white/10 hover:border-green-500/20 transition-all duration-300"
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.95 }}
                      >
                        <svg
                          className="w-6 h-6 text-green-500"
                          viewBox="0 0 24 24"
                          fill="currentColor"
                        >
                          <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.42 1.56-.299.421-1.02.599-1.559.3z" />
                        </svg>
                      </motion.a>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </motion.section>

        {/* Navigation Tabs */}
        <div className="max-w-7xl mx-auto px-6 md:px-8 mb-12">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
            className="flex flex-wrap gap-4 justify-center"
          >
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setSelectedTab(tab.id)}
                className={`relative px-6 py-3 rounded-full transition-all duration-300 ${
                  selectedTab === tab.id
                    ? "bg-white/10 text-white border border-white/20"
                    : "bg-white/5 text-gray-400 border border-white/5 hover:bg-white/10 hover:text-white"
                }`}
              >
                <span className="font-light">{tab.label}</span>
                {tab.count > 0 && (
                  <span className="ml-2 text-xs bg-accent-orange/20 text-accent-orange px-2 py-1 rounded-full">
                    {tab.count}
                  </span>
                )}
                {selectedTab === tab.id && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 bg-gradient-to-r from-accent-orange/20 to-accent-purple/20 rounded-full border border-accent-orange/30"
                    transition={{ duration: 0.3 }}
                  />
                )}
              </button>
            ))}
          </motion.div>
        </div>

        {/* Content */}
        <div className="max-w-7xl mx-auto px-6 md:px-8 pb-24">
          <AnimatePresence mode="wait">
            {selectedTab === "recent" && (
              <motion.div
                key="recent"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.5 }}
                className="space-y-4"
              >
                {recentlyPlayed?.tracks.map((track, index) => (
                  <TrackCard key={track.id} track={track} index={index} />
                ))}
                {(!recentlyPlayed || recentlyPlayed.tracks.length === 0) && (
                  <div className="text-center py-12 text-gray-500">
                    No recently played tracks found.
                  </div>
                )}
              </motion.div>
            )}

            {selectedTab === "top" && (
              <motion.div
                key="top"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.5 }}
                className="space-y-4"
              >
                {topTracks?.tracks.map((track, index) => (
                  <TrackCard
                    key={track.id}
                    track={track}
                    index={index}
                    isTopTrack={true}
                  />
                ))}
                {(!topTracks || topTracks.tracks.length === 0) && (
                  <div className="text-center py-12 text-gray-500">
                    No top tracks found.
                  </div>
                )}
              </motion.div>
            )}

            {selectedTab === "playlists" && (
              <motion.div
                key="playlists"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.5 }}
                className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
              >
                {playlists?.playlists.map((playlist, index) => (
                  <PlaylistCard
                    key={playlist.id}
                    playlist={playlist}
                    index={index}
                  />
                ))}
                {(!playlists || playlists.playlists.length === 0) && (
                  <div className="col-span-full text-center py-12 text-gray-500">
                    No playlists found.
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  );
}
