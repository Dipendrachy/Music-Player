/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Song, Playlist } from '../types';
import { offlineDb } from '../services/db';
import { audioEngine } from '../services/audioEngine';
import { getArtworkColors } from '../data/defaultSongs';
import SongCover from './SongCover';
import { motion } from 'motion/react';
import { 
  Play, Shuffle, Clock, Star, Flame, Calendar, Music, Sparkles, Folder, 
  Settings, Sliders, ChevronRight, ChevronLeft, User, Disc, Heart, Search, X 
} from 'lucide-react';

interface DashboardProps {
  songs: Song[];
  playlists?: Playlist[];
  onPlaySong: (song: Song, customQueue?: Song[]) => void;
  onNavigateToTab: (tab: 'home' | 'library' | 'folders' | 'equalizer' | 'settings') => void;
  onSelectPlaylist: (playlist: Playlist) => void;
  onPlayAll?: () => void;
}

function getSongAmbientHex(song: Song | null, isLight: boolean): string {
  if (!song) {
    return isLight ? 'rgba(16, 185, 129, 0.14)' : 'rgba(16, 185, 129, 0.10)'; // Elegant Emerald teal glow
  }

  const str = (song.title + song.artist).toLowerCase();
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }

  // Curated list of premium music glows
  const colors = [
    'rgba(239, 68, 68, 0.16)',   // Crimson Red
    'rgba(99, 102, 241, 0.16)',  // Deep Indigo
    'rgba(168, 85, 247, 0.16)',  // Fuchsia Purple
    'rgba(16, 185, 129, 0.16)',  // Emerald Green
    'rgba(6, 182, 212, 0.16)',   // Electric Cyan
    'rgba(245, 158, 11, 0.14)',  // Amber Sunrise
    'rgba(236, 72, 153, 0.16)',  // Pink Rose
  ];

  const index = Math.abs(hash) % colors.length;
  return colors[index];
}

export default function Dashboard({ songs, playlists = [], onPlaySong, onNavigateToTab, onSelectPlaylist, onPlayAll }: DashboardProps) {
  const [recentlyPlayed, setRecentlyPlayed] = useState<Song[]>([]);
  const [quickPicks, setQuickPicks] = useState<Song[]>([]);
  const [recentlyAdded, setRecentlyAdded] = useState<Song[]>([]);
  const [favoriteSongs, setFavoriteSongs] = useState<Song[]>([]);
  const [lastPlayedSong, setLastPlayedSong] = useState<Song | null>(null);
  const [currentSong, setCurrentSong] = useState<Song | null>(audioEngine.getCurrentSong());

  const [isSearching, setIsSearching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [recentlyAddedPage, setRecentlyAddedPage] = useState(0);

  const appSettings = offlineDb.getSettings();
  const isLight = appSettings.theme === 'light';

  useEffect(() => {
    loadDashboardData();
  }, [songs]);

  useEffect(() => {
    const unsub = audioEngine.onStateChange(() => {
      setCurrentSong(audioEngine.getCurrentSong());
    });
    return () => {
      unsub();
    };
  }, []);

  const loadDashboardData = () => {
    // 1. Recently Played (from playback history, unique songs)
    const history = offlineDb.getHistory();
    const uniqueIds = Array.from(new Set(history.map(h => h.songId)));
    const recent = uniqueIds
      .map(id => songs.find(s => s.id === id))
      .filter((s): s is Song => !!s)
      .slice(0, 10);
    setRecentlyPlayed(recent);

    // Continue Listening is the absolute latest song played
    if (history.length > 0) {
      const latest = songs.find(s => s.id === history[0].songId);
      if (latest) setLastPlayedSong(latest);
    } else if (songs.length > 0) {
      // fallback to first song if no history
      setLastPlayedSong(songs[0]);
    }

    // 2. Quick Picks (Random songs from playlist, minimum 5 and maximum 7)
    setQuickPicks(prev => {
      if (songs.length === 0) return [];
      
      const hasMissingSongs = prev.some(ps => !songs.some(s => s.id === ps.id));
      if (prev.length === 0 || hasMissingSongs) {
        const shuffled = [...songs].sort(() => 0.5 - Math.random());
        const count = Math.min(songs.length, Math.floor(Math.random() * 3) + 5); // 5, 6, or 7
        return shuffled.slice(0, count);
      }
      
      return prev.map(pSong => {
        const updated = songs.find(s => s.id === pSong.id);
        return updated || pSong;
      });
    });

    // 3. Recently Added (sorted by added timestamp)
    const added = [...songs]
      .sort((a, b) => b.dateAdded - a.dateAdded)
      .slice(0, 18);
    setRecentlyAdded(added);
    setRecentlyAddedPage(0);

    // 4. Favorites
    const favs = songs.filter(s => s.isFavorite).slice(0, 10);
    setFavoriteSongs(favs);
  };

  const handleShuffleAll = () => {
    if (songs.length === 0) return;
    audioEngine.setQueue(songs, Math.floor(Math.random() * songs.length), true);
  };

  const handlePlayAll = () => {
    if (songs.length === 0) return;
    if (onPlayAll) {
      onPlayAll();
    } else {
      audioEngine.setQueue(songs, 0, true);
    }
  };

  const renderHorizontalRow = (
    title: string, 
    items: Song[], 
    icon: React.ReactNode | null | undefined, 
    fallbackText: string,
    smartType?: 'favorites' | 'recently-played' | 'recently-added'
  ) => {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between border-b border-transparent">
          <div className="flex items-center gap-2">
            {icon && <span className={isLight ? 'text-zinc-600' : 'text-zinc-400'}>{icon}</span>}
            <h2 className={`font-display font-bold text-base ${isLight ? 'text-zinc-900' : 'text-zinc-100'} tracking-tight`}>{title}</h2>
          </div>
          {smartType && smartType !== 'recently-played' && items.length > 0 && (
            <button
              onClick={() => {
                const playlistMap: { [key: string]: string } = {
                  'favorites': 'Favorites',
                  'recently-played': 'Recently Played',
                  'recently-added': 'Recently Added'
                };
                onSelectPlaylist({
                  id: `smart-${smartType}`,
                  name: playlistMap[smartType] || title,
                  description: `Your ${title.toLowerCase()}, compiled dynamically`,
                  songIds: [],
                  isSmart: true,
                  smartType,
                  dateCreated: Date.now()
                });
              }}
              className={`text-[11px] ${isLight ? 'text-zinc-500 hover:text-zinc-900' : 'text-zinc-400 hover:text-white'} font-medium flex items-center gap-0.5 transition-colors`}
            >
              See All <ChevronRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {items.length === 0 ? (
          <div className={`py-6 px-4 ${isLight ? 'bg-zinc-100/60 border-zinc-200' : 'bg-zinc-900/20 border-zinc-800/40'} border rounded-xl text-center`}>
            <p className="text-[10.5px] text-zinc-500 font-medium">{fallbackText}</p>
          </div>
        ) : smartType === 'recently-played' ? (
          <div className="grid grid-cols-3 gap-3">
            {items.slice(0, 10).map((song) => (
              <button
                key={song.id}
                onClick={() => onPlaySong(song, items)}
                className="w-full text-left snap-start group select-none relative"
              >
                <div className="aspect-square w-full rounded-sm relative overflow-hidden group-hover:scale-[0.97] transition-all duration-350">
                  <SongCover song={song} className="absolute inset-0 w-full h-full" size="md" />
                  {/* Overlay inside the rectangle at the bottom containing title & artist */}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/55 to-transparent p-2 pt-4 flex flex-col justify-end z-10">
                    <h4 className="font-semibold text-[10px] text-white transition-colors truncate w-full leading-tight">
                      {song.title}
                    </h4>
                    <p className="text-[8.5px] text-zinc-300 truncate w-full mt-0.5 leading-tight">{song.artist}</p>
                  </div>
                  {/* Play overlay on hover */}
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/35 transition-all flex items-center justify-center z-20">
                    <Play className="w-7 h-7 fill-zinc-100 text-zinc-100 opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-3 overflow-x-auto pb-1 scrollbar-none snap-x snap-mandatory">
            {items.map((song) => (
              <button
                key={song.id}
                onClick={() => onPlaySong(song, items)}
                className="w-28 shrink-0 text-left snap-start group select-none"
              >
                <div className="w-28 h-28 rounded-sm relative overflow-hidden group-hover:scale-[0.97] transition-all duration-350 mb-2">
                  <SongCover song={song} className="absolute inset-0 w-full h-full" size="md" />
                  <div className="absolute inset-0 bg-black/10 group-hover:bg-black/40 transition-all flex items-center justify-center z-10">
                    <Play className="w-8 h-8 fill-zinc-100 text-zinc-100 opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100" />
                  </div>
                </div>
                <h4 className={`font-semibold text-[11px] ${isLight ? 'text-zinc-900 group-hover:text-zinc-800' : 'text-zinc-200 group-hover:text-white'} transition-colors truncate w-full`}>
                  {song.title}
                </h4>
                <p className={`text-[9.5px] ${isLight ? 'text-zinc-600' : 'text-zinc-400'} truncate w-full mt-0.5`}>{song.artist}</p>
              </button>
            ))}
          </div>
        )}
      </div>
    );
  };

  const filteredSongs = songs.filter(song => {
    const query = searchQuery.toLowerCase();
    return (
      song.title.toLowerCase().includes(query) ||
      song.artist.toLowerCase().includes(query) ||
      (song.album && song.album.toLowerCase().includes(query)) ||
      (song.genre && song.genre.toLowerCase().includes(query))
    );
  });

  return (
    <div className={`h-full flex flex-col bg-[#030303] text-zinc-300 dynamic-bg dynamic-text overflow-y-auto px-5 py-5 space-y-8 scrollbar-none relative ${currentSong ? 'pb-40' : 'pb-24'}`}>
      
      {/* Dynamic Ambient Background Glow at the Top */}
      <div 
        className="absolute top-0 left-0 right-0 h-96 pointer-events-none transition-all duration-1000 ease-in-out z-0"
        style={{
          background: isLight
            ? 'radial-gradient(circle at 50% 0%, rgba(165, 0, 255, 0.15) 0%, transparent 70%)'
            : 'radial-gradient(circle at 50% 0%, rgba(165, 0, 255, 0.22) 0%, transparent 70%)'
        }}
      />

      {/* Visual greeting brand bar */}
      <div className="flex items-center justify-between select-none relative z-10 gap-3">
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="w-7 h-7 bg-emerald-500 rounded-full flex items-center justify-center shadow-md shadow-emerald-500/20">
            <Play className="w-3.5 h-3.5 text-black fill-black ml-0.5" />
          </div>
          <span className={`text-xl font-bold tracking-tight ${isLight ? 'text-zinc-900' : 'text-white'} dynamic-text-title`}>Music</span>
        </div>
        
        {/* Search bar styled same as from Library page */}
        <div className={`flex-1 max-w-[130px] sm:max-w-[170px] bg-transparent ${isLight ? 'border-zinc-300 focus-within:border-zinc-500' : 'border-zinc-800/80 focus-within:border-zinc-600'} rounded-xl px-3 py-1.5 flex items-center gap-2 border transition-all`}>
          <Search className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
          <input
            type="text"
            placeholder="Search..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              if (e.target.value) {
                setIsSearching(true);
              } else {
                setIsSearching(false);
              }
            }}
            className={`bg-transparent text-xs ${isLight ? 'text-zinc-900 placeholder-zinc-400' : 'text-white placeholder-zinc-600'} focus:outline-none w-full`}
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery('');
                setIsSearching(false);
              }}
              className={`p-0.5 ${isLight ? 'text-zinc-500 hover:text-zinc-900' : 'text-zinc-500 hover:text-white'} transition-colors`}
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {isSearching ? (
        <div className="space-y-4 flex-1 flex flex-col min-h-0 select-none relative z-10">
          <div className={`flex items-center justify-between border-b ${isLight ? 'border-zinc-200' : 'border-zinc-900'} pb-2`}>
            <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500 font-bold">
              {searchQuery ? `Search Results (${filteredSongs.length})` : 'Search'}
            </span>
          </div>

          {searchQuery ? (
            filteredSongs.length === 0 ? (
              <div className={`py-12 px-4 ${isLight ? 'bg-zinc-100/40 border-zinc-200' : 'bg-zinc-950/20 border-zinc-900/40'} border rounded-2xl text-center`}>
                <Search className="w-8 h-8 text-zinc-400 mx-auto mb-3" />
                <h3 className={`font-semibold text-xs ${isLight ? 'text-zinc-800' : 'text-zinc-300'}`}>No matches found</h3>
                <p className={`text-[10px] ${isLight ? 'text-zinc-500' : 'text-zinc-500'} mt-1 max-w-[220px] mx-auto leading-normal`}>
                  Try checking your spelling or search for another track or artist.
                </p>
              </div>
            ) : (
              <div className="space-y-2 overflow-y-auto max-h-[420px] pr-1 scrollbar-none">
                {filteredSongs.map((song) => (
                  <button
                    key={song.id}
                    onClick={() => onPlaySong(song, filteredSongs)}
                    className={`w-full p-2 ${isLight ? 'hover:bg-zinc-100 hover:border-zinc-200' : 'hover:bg-zinc-900/55 hover:border-zinc-850/40'} rounded-xl border border-transparent transition-all flex items-center gap-3 group text-left`}
                  >
                    <div className="w-10 h-10 rounded-sm relative overflow-hidden shrink-0 select-none">
                      <SongCover song={song} className="absolute inset-0 w-full h-full" size="sm" />
                      <div className="absolute inset-0 bg-black/15 group-hover:bg-black/40 flex items-center justify-center transition-all z-10">
                        <Play className="w-3.5 h-3.5 fill-white text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </div>
                    <div className="truncate flex-1 min-w-0">
                      <h4 className={`font-semibold text-xs ${isLight ? 'text-zinc-900 group-hover:text-zinc-800' : 'text-zinc-200 group-hover:text-white'} transition-colors truncate`}>
                        {song.title}
                      </h4>
                      <p className={`text-[10px] ${isLight ? 'text-zinc-600' : 'text-zinc-400'} truncate mt-0.5`}>{song.artist}</p>
                    </div>
                    {song.album && (
                      <span className="text-[9.5px] text-zinc-500 truncate max-w-[90px] hidden sm:inline">
                        {song.album}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )
          ) : (
            <div className="py-12 px-4 text-center select-none">
              <Search className="w-8 h-8 text-zinc-800 mx-auto mb-3" />
              <p className="text-[10.5px] text-zinc-500 leading-normal max-w-[200px] mx-auto">
                Find songs, artists, albums, or genres across your scanned audio files.
              </p>
            </div>
          )}
        </div>
      ) : (
        <div className="relative z-10 flex flex-col space-y-8">
          {/* PLAY ALL WIDGET */}
          {(() => {
            const playAllSong = currentSong || lastPlayedSong || (songs.length > 0 ? songs[0] : null);
            const playAllColors = playAllSong ? getArtworkColors(playAllSong.artworkSeed || playAllSong.id || 'default-art') : null;
            return (
              <div 
                id="home-play-all-widget" 
                onClick={() => onNavigateToTab('library')}
                className="w-full rounded-xl p-4 flex items-center justify-between select-none cursor-pointer transition-all duration-500 hover:scale-[1.01]"
                style={{
                  background: playAllColors
                    ? (isLight
                      ? `linear-gradient(135deg, ${playAllColors.from.replace('hsl', 'hsla').replace(')', ', 0.16)')}, ${playAllColors.to.replace('hsl', 'hsla').replace(')', ', 0.26)')}), #f4f4f5`
                      : `linear-gradient(135deg, ${playAllColors.from.replace('hsl', 'hsla').replace(')', ', 0.24)')}, ${playAllColors.to.replace('hsl', 'hsla').replace(')', ', 0.36)')}), #090a0e`)
                    : undefined
                }}
              >
                <div className="space-y-1 pr-4 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3 className={`font-sans font-bold text-xs tracking-tight ${isLight ? 'text-zinc-900' : 'text-white'}`}>Play All</h3>
                  </div>
                  <p className={`text-[10px] font-medium truncate ${isLight ? 'text-zinc-600' : 'text-zinc-400'}`}>
                    {currentSong 
                      ? `Now Playing: ${currentSong.title} • ${currentSong.artist}`
                      : (songs.length > 0 ? `Play all ${songs.length} indexed songs` : 'Import audio files to play')
                    }
                  </p>
                </div>
                <button
                  id="home-play-all-btn"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onPlayAll) {
                      onPlayAll();
                    } else {
                      // fallback to playing first song if onPlayAll is not passed
                      if (songs.length > 0) onPlaySong(songs[0], songs);
                    }
                  }}
                  disabled={songs.length === 0}
                  className={`w-9 h-9 rounded-full flex items-center justify-center transition-all shrink-0 active:scale-95 shadow-md hover:scale-105 ${
                    isLight 
                      ? 'bg-zinc-900 hover:bg-zinc-800 text-white' 
                      : 'bg-white hover:bg-zinc-100 text-zinc-900'
                  }`}
                  style={{
                    opacity: songs.length === 0 ? 0.4 : 1,
                    cursor: songs.length === 0 ? 'not-allowed' : 'pointer'
                  }}
                  title="Play all tracks"
                >
                  <Play className={`w-3.5 h-3.5 fill-current ml-0.5 ${isLight ? 'text-white' : 'text-zinc-900'}`} />
                </button>
              </div>
            );
          })()}

          {/* PLAYLISTS 2x2 GRID */}
          <div className="space-y-3">
            {playlists.filter(p => p.smartType !== 'recently-played' && p.smartType !== 'recently-added').length === 0 ? (
              <div className={`py-6 px-4 ${isLight ? 'bg-zinc-100/60 border-zinc-200' : 'bg-zinc-900/20 border-zinc-800/40'} border rounded-xl text-center`}>
                <p className="text-[10.5px] text-zinc-500 font-medium">Create custom playlists in the Library tab.</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3">
                {[...playlists]
                  .filter(p => p.smartType !== 'recently-played' && p.smartType !== 'recently-added')
                  .sort((a, b) => {
                    // Put custom playlists before smart ones
                    if (a.isSmart && !b.isSmart) return 1;
                    if (!a.isSmart && b.isSmart) return -1;
                    // Sort by dateCreated descending
                    return b.dateCreated - a.dateCreated;
                  })
                  .slice(0, 6)
                  .map((pl) => {
                    // Get first song to extract its cover art
                    let firstSong: Song | null = null;
                    if (pl.isSmart) {
                      if (pl.smartType === 'favorites') {
                        firstSong = songs.find(s => s.isFavorite) || null;
                      } else if (pl.smartType === 'recently-played') {
                        const history = offlineDb.getHistory();
                        if (history.length > 0) {
                          firstSong = songs.find(s => s.id === history[0].songId) || null;
                        }
                      } else if (pl.smartType === 'recently-added') {
                        const sorted = [...songs].sort((a, b) => b.dateAdded - a.dateAdded);
                        firstSong = sorted[0] || null;
                      }
                    } else if (pl.songIds && pl.songIds.length > 0) {
                      firstSong = songs.find(s => s.id === pl.songIds[0]) || null;
                    }
                    return (
                      <div
                        key={pl.id}
                        onClick={() => onSelectPlaylist(pl)}
                        className="flex items-center justify-between pl-0 py-0 pr-2.5 h-11 rounded-[2px] border transition-all cursor-pointer shadow-sm group overflow-hidden bg-[#D3D3D3] hover:bg-[#c2c2c2] border-[#c2c2c2] hover:border-[#b2b2b2]"
                      >
                        <div className="flex items-center gap-2.5 overflow-hidden mr-4 flex-1 h-full pl-2">
                          <div className="w-8 h-8 shrink-0 flex-shrink-0 relative overflow-hidden flex items-center justify-center rounded-full bg-[#072024]/10">
                            {firstSong ? (
                              <SongCover song={firstSong} className="absolute inset-0 w-full h-full !border-0 !border-none !rounded-full object-cover" size="sm" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center bg-[#072024]/5 rounded-full">
                                <Music className="w-3.5 h-3.5 text-[#082124]/40" />
                              </div>
                            )}
                          </div>
                          <div className="truncate py-1">
                            <h4 className="font-bold text-xs transition-colors truncate text-[#082124] group-hover:text-black">
                              {pl.name}
                            </h4>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>

          {/* DYNAMIC ROW: QUICK PICKS */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-transparent">
              <div className="flex items-center gap-2">
                <h2 className={`font-display font-bold text-base ${isLight ? 'text-zinc-900' : 'text-zinc-100'} tracking-tight`}>Quick picks</h2>
              </div>
              {quickPicks.length > 0 && (
                <button
                  onClick={() => {
                    audioEngine.setQueue(quickPicks, 0, true);
                  }}
                  className={`text-[11px] ${isLight ? 'text-zinc-500 hover:text-zinc-900' : 'text-zinc-400 hover:text-white'} font-medium flex items-center gap-1 transition-colors`}
                >
                  <Shuffle className="w-3.5 h-3.5" /> Play Shuffle
                </button>
              )}
            </div>

            {quickPicks.length === 0 ? (
              <div className={`py-6 px-4 ${isLight ? 'bg-zinc-100/60 border-zinc-200' : 'bg-zinc-900/20 border-zinc-800/40'} border rounded-xl text-center`}>
                <p className="text-[10.5px] text-zinc-500 font-medium">Import audio files to generate quick picks.</p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {quickPicks.map((song) => (
                  <div
                    key={song.id}
                    onClick={() => onPlaySong(song, quickPicks)}
                    className={`flex items-center justify-between pl-0 py-0 pr-2.5 rounded-[2px] transition-all cursor-pointer shadow-sm group overflow-hidden ${
                      isLight 
                        ? 'bg-white hover:bg-zinc-50/80 border-b border-zinc-100/80' 
                        : 'bg-zinc-950/40 hover:bg-zinc-900/60'
                    }`}
                  >
                    <div className="flex items-center gap-3 overflow-hidden mr-4 flex-1 h-11">
                      <div className={`w-11 h-11 shrink-0 relative overflow-hidden ${isLight ? 'bg-zinc-100' : 'bg-zinc-900'} flex items-center justify-center rounded-l-[2px]`}>
                        <SongCover song={song} className="absolute inset-0 w-full h-full !border-0 !rounded-none" size="sm" />
                        {song.isFavorite && (
                          <div className={`absolute top-0 left-0 ${isLight ? 'bg-zinc-900' : 'bg-white'} w-2 h-2 rounded-br z-10`} />
                        )}
                      </div>
                      <div className="truncate py-1">
                        <h4 className={`font-semibold text-xs ${isLight ? 'text-zinc-900 group-hover:text-zinc-800' : 'text-zinc-200 group-hover:text-white'} transition-colors truncate`}>{song.title}</h4>
                        <p className={`text-[9.5px] ${isLight ? 'text-zinc-500' : 'text-zinc-400'} truncate mt-0.5`}>
                          {song.artist}{song.album && song.album !== 'Local Downloads' ? ` • ${song.album}` : ''} • <span className="font-mono text-[9px]">{Math.floor(song.duration / 60)}:{(song.duration % 60).toString().padStart(2, '0')}</span>
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={() => onPlaySong(song, quickPicks)}
                        className={`p-2 rounded-full ${isLight ? 'hover:bg-zinc-100 text-zinc-700 hover:text-zinc-900' : 'hover:bg-zinc-800/40 text-zinc-400 hover:text-white'} transition-colors`}
                        title="Play Song"
                      >
                        <Play className="w-3.5 h-3.5 fill-current text-current" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* DYNAMIC ROW: RECENTLY PLAYED */}
          {renderHorizontalRow(
            'Recently Played', 
            recentlyPlayed, 
            null, 
            'Your recently played tracks will appear here.',
            'recently-played'
          )}

          {/* CUSTOM ROW: RECENTLY ADDED (3x2 Slidable Grid) */}
          {(() => {
            const recentlyAddedPages = Array.from(
              { length: Math.ceil(recentlyAdded.length / 6) },
              (_, i) => recentlyAdded.slice(i * 6, (i + 1) * 6)
            );

            return (
              <div className="space-y-3">
                <div className="flex items-center justify-between border-b border-transparent">
                  <div className="flex items-center gap-2">
                    <h2 className={`font-display font-bold text-base ${isLight ? 'text-zinc-900' : 'text-zinc-100'} tracking-tight`}>Recently Added</h2>
                  </div>
                </div>

                {recentlyAdded.length === 0 ? (
                  <div className={`py-6 px-4 ${isLight ? 'bg-zinc-100/60 border-zinc-200' : 'bg-zinc-900/20 border-zinc-800/40'} border rounded-xl text-center`}>
                    <p className="text-[10.5px] text-zinc-500 font-medium">Scanned or uploaded tracks will list here.</p>
                  </div>
                ) : (
                  <div className="relative overflow-hidden w-full">
                    {/* Slidable container */}
                    <motion.div
                      className="flex w-full touch-pan-y"
                      animate={{ x: `-${recentlyAddedPage * 100}%` }}
                      transition={{ type: "spring", stiffness: 260, damping: 28 }}
                    >
                      {recentlyAddedPages.map((pageSongs, pageIdx) => (
                        <div key={pageIdx} className="w-full shrink-0 grid grid-cols-3 gap-3">
                          {pageSongs.map((song) => (
                            <button
                              key={song.id}
                              onClick={() => onPlaySong(song, recentlyAdded)}
                              className="w-full text-left group select-none relative"
                            >
                              <div className="aspect-square w-full rounded-sm relative overflow-hidden group-hover:scale-[0.97] transition-all duration-350">
                                <SongCover song={song} className="absolute inset-0 w-full h-full" size="md" />
                                {/* Overlay inside the rectangle at the bottom containing title */}
                                <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-2 pt-4 flex flex-col justify-end z-10">
                                  <h4 className="font-semibold text-[10px] text-white transition-colors truncate w-full leading-tight">
                                    {song.title}
                                  </h4>
                                  <p className="text-[8.5px] text-zinc-300 truncate w-full mt-0.5 leading-tight">{song.artist}</p>
                                </div>
                                {/* Play overlay on hover */}
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/35 transition-all flex items-center justify-center z-20">
                                  <Play className="w-6 h-6 fill-zinc-100 text-zinc-100 opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100" />
                                </div>
                              </div>
                            </button>
                          ))}
                        </div>
                      ))}
                    </motion.div>

                    {/* Dot Indicators */}
                    {recentlyAddedPages.length > 1 && (
                      <div className="flex justify-center items-center gap-1.5 mt-3">
                        {recentlyAddedPages.map((_, idx) => (
                          <button
                            key={idx}
                            onClick={() => setRecentlyAddedPage(idx)}
                            className={`w-1.5 h-1.5 rounded-full transition-all ${
                              recentlyAddedPage === idx 
                                ? 'bg-emerald-500 w-3' 
                                : isLight ? 'bg-zinc-300 hover:bg-zinc-400' : 'bg-zinc-800 hover:bg-zinc-700'
                            }`}
                            title={`Go to page ${idx + 1}`}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

    </div>
  );
}
