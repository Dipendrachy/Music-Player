/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Song, Playlist } from '../types';
import { offlineDb } from '../services/db';
import { audioEngine } from '../services/audioEngine';
import SongCover from './SongCover';
import ConfirmDialog from './ConfirmDialog';
import AddToPlaylistDialog from './AddToPlaylistDialog';
import { 
  Search, ArrowUpDown, Plus, MoreVertical, ListPlus, Play, CheckSquare, Square,
  FolderOpen, Calendar, Clock, HardDrive, Music, User, Disc, Trash, PlaySquare, ChevronRight,
  CheckCircle2, ListMusic
} from 'lucide-react';

interface LibraryTabProps {
  songs: Song[];
  playlists: Playlist[];
  onPlaySong: (song: Song, customQueue?: Song[]) => void;
  onSelectPlaylist: (playlist: Playlist) => void;
  onRefresh: () => void;
  onEditMetadata: (song: Song) => void;
  hasActiveTrack?: boolean;
}

type LibrarySubTab = 'songs' | 'albums' | 'artists' | 'genres' | 'playlists';
type SortField = 'title' | 'artist' | 'album' | 'dateAdded' | 'duration' | 'fileSize';

export default function LibraryTab({ 
  songs, 
  playlists, 
  onPlaySong, 
  onSelectPlaylist, 
  onRefresh,
  onEditMetadata,
  hasActiveTrack = false
}: LibraryTabProps) {
  const [activeTab, setActiveTab] = useState<LibrarySubTab>('songs');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('title');
  const [sortAscending, setSortAscending] = useState(true);
  
  // Multi-select state
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedSongIds, setSelectedSongIds] = useState<Set<string>>(new Set());
  
  // Custom playlist creation popover
  const [showCreatePlaylist, setShowCreatePlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [newPlaylistDesc, setNewPlaylistDesc] = useState('');

  // Active contextual action menu for a song
  const [activeActionMenuId, setActiveActionMenuId] = useState<string | null>(null);

  // Bulk actions target playlist popover
  const [showBulkPlaylistDropdown, setShowBulkPlaylistDropdown] = useState(false);

  // Single song add to playlist state
  const [addToPlaylistSong, setAddToPlaylistSong] = useState<Song | null>(null);
  const [notification, setNotification] = useState<string | null>(null);

  const appSettings = offlineDb.getSettings();
  const isLight = appSettings.theme === 'light';

  // Custom confirmation dialog state
  const [confirmDeleteState, setConfirmDeleteState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  // Close menus on click away
  useEffect(() => {
    const handleOutsideClick = () => {
      setActiveActionMenuId(null);
    };
    window.addEventListener('click', handleOutsideClick);
    return () => window.removeEventListener('click', handleOutsideClick);
  }, []);

  const handleToggleSelectSong = (songId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = new Set(selectedSongIds);
    if (updated.has(songId)) {
      updated.delete(songId);
    } else {
      updated.add(songId);
    }
    setSelectedSongIds(updated);
  };

  const handleToggleMultiSelectMode = () => {
    setIsMultiSelectMode(!isMultiSelectMode);
    setSelectedSongIds(new Set());
  };

  const handleSelectAllFilteredSongs = (filtered: Song[]) => {
    if (selectedSongIds.size === filtered.length) {
      setSelectedSongIds(new Set());
    } else {
      setSelectedSongIds(new Set(filtered.map(s => s.id)));
    }
  };

  // Bulk execution actions
  const getSelectedSongs = (): Song[] => {
    return songs.filter(s => selectedSongIds.has(s.id));
  };

  const handleBulkPlay = () => {
    const bulk = getSelectedSongs();
    if (bulk.length === 0) return;
    audioEngine.setQueue(bulk, 0, true);
    setIsMultiSelectMode(false);
  };

  const handleBulkAddToQueue = () => {
    const bulk = getSelectedSongs();
    bulk.forEach(s => audioEngine.addToQueue(s));
    setIsMultiSelectMode(false);
  };

  const handleBulkAddToPlaylist = (playlistId: string) => {
    const bulk = getSelectedSongs();
    const allPlaylists = offlineDb.getPlaylists();
    const plIdx = allPlaylists.findIndex(p => p.id === playlistId);
    if (plIdx !== -1) {
      const existing = new Set(allPlaylists[plIdx].songIds);
      bulk.forEach(s => existing.add(s.id));
      allPlaylists[plIdx].songIds = Array.from(existing);
      offlineDb.savePlaylists(allPlaylists);
    }
    setIsMultiSelectMode(false);
    setShowBulkPlaylistDropdown(false);
    onRefresh();
  };

  const handleBulkDelete = () => {
    setConfirmDeleteState({
      isOpen: true,
      title: 'Bulk Delete Songs',
      message: `Are you sure you want to delete ${selectedSongIds.size} songs from your library permanently?`,
      onConfirm: () => {
        const bulk = getSelectedSongs();
        bulk.forEach(s => offlineDb.deleteSong(s.id));
        setIsMultiSelectMode(false);
        onRefresh();
        setConfirmDeleteState(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  const handleCreatePlaylist = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistName.trim()) return;
    offlineDb.createPlaylist(newPlaylistName.trim(), newPlaylistDesc.trim());
    setNewPlaylistName('');
    setNewPlaylistDesc('');
    setShowCreatePlaylist(false);
    onRefresh();
  };

  const handleSingleSongFavoriteToggle = (song: Song, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = { ...song, isFavorite: !song.isFavorite };
    offlineDb.updateSong(updated);
    audioEngine.updateSongInQueue(updated);
    onRefresh();
  };

  // Processing Songs lists (Searching, Filtering, Sorting)
  const getFilteredAndSortedSongs = (): Song[] => {
    let filtered = [...songs];

    // Search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (s) =>
          s.title.toLowerCase().includes(query) ||
          s.artist.toLowerCase().includes(query) ||
          s.album.toLowerCase().includes(query) ||
          s.genre.toLowerCase().includes(query)
      );
    }

    // Sorting
    filtered.sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      // fallback defaults for sorting
      if (valA === undefined) valA = sortField === 'fileSize' ? 0 : '';
      if (valB === undefined) valB = sortField === 'fileSize' ? 0 : '';

      const isAsc = sortField === 'title' 
        ? true 
        : sortField === 'dateAdded' 
          ? false 
          : sortAscending;

      if (typeof valA === 'string') {
        return isAsc 
          ? valA.localeCompare(valB) 
          : valB.localeCompare(valA);
      } else {
        return isAsc 
          ? (valA as number) - (valB as number) 
          : (valB as number) - (valA as number);
      }
    });

    return filtered;
  };

  const filteredSongs = getFilteredAndSortedSongs();

  // Aggregate Albums, Artists, and Genres list from songs list
  const getAggregates = (type: 'album' | 'artist' | 'genre') => {
    const map = new Map<string, Song[]>();
    songs.forEach((song) => {
      const key = song[type] || `Unknown ${type.charAt(0).toUpperCase() + type.slice(1)}`;
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key)!.push(song);
    });
    return Array.from(map.entries()).map(([name, songList]) => ({
      name,
      songs: songList,
      artworkSeed: songList[0]?.artworkSeed || 'default-art'
    })).filter((item) => !searchQuery || item.name.toLowerCase().includes(searchQuery.toLowerCase()));
  };

  const albumsList = getAggregates('album').filter(alb => alb.name !== 'Local Downloads' && alb.name.trim() !== '');
  const artistsList = getAggregates('artist').filter(art => art.name.trim() !== '' && art.name !== 'Unknown Artist');
  const genresList = getAggregates('genre').filter(gen => gen.name !== 'Offline Media' && gen.name.trim() !== '' && gen.name !== 'Unknown Genre');

  const triggerSort = (field: SortField) => {
    if (sortField === field) {
      if (field !== 'title' && field !== 'dateAdded') {
        setSortAscending(!sortAscending);
      }
    } else {
      setSortField(field);
      if (field === 'dateAdded') {
        setSortAscending(false);
      } else {
        setSortAscending(true);
      }
    }
  };

  return (
    <div className="h-full flex flex-col bg-[#030303] text-zinc-300 dynamic-bg dynamic-text overflow-hidden">
      
      {/* Search Header and Main Subtabs */}
      <div className="px-5 pt-4 pb-2.5 border-b border-zinc-900 bg-black dynamic-header dynamic-border space-y-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex-1 bg-zinc-900/60 rounded-xl px-4 py-2.5 flex items-center gap-2.5 border border-zinc-800 focus-within:border-zinc-500 transition-all dynamic-item">
            <Search className="w-5 h-5 text-zinc-400 shrink-0" />
            <input
              type="text"
              placeholder={`Search ${activeTab}...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-transparent text-sm font-medium text-white dynamic-text placeholder-zinc-500 focus:outline-none w-full"
            />
          </div>
          {activeTab === 'songs' && (
            <button
              onClick={handleToggleMultiSelectMode}
              className={`p-2.5 rounded-xl border transition-all ${
                isMultiSelectMode
                  ? 'bg-zinc-100 border-zinc-200 text-black font-semibold shadow-sm'
                  : 'bg-zinc-900 border-zinc-800 text-zinc-300 hover:text-white'
              }`}
              title="Multi-select batch mode"
            >
              <CheckSquare className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Categories Tab selector */}
        <div className="flex items-center gap-1.5 overflow-x-auto py-1 scrollbar-none select-none text-xs font-bold">
          {[
            { id: 'songs', label: 'Songs' },
            { id: 'albums', label: 'Albums' },
            { id: 'artists', label: 'Artists' },
            { id: 'genres', label: 'Genres' },
            { id: 'playlists', label: 'Playlists' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as LibrarySubTab);
                setIsMultiSelectMode(false);
              }}
              className={`px-4 py-2.5 rounded-xl shrink-0 transition-all ${
                activeTab === tab.id
                  ? 'bg-zinc-100 text-black shadow-sm font-extrabold'
                  : 'bg-zinc-900 text-zinc-300 hover:text-white border border-zinc-800/60'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Sorting / Contextual Actions bar */}
      {activeTab === 'songs' && (
        <div className="px-5 py-2.5 bg-zinc-950 border-b border-zinc-900 flex items-center justify-between text-xs select-none text-zinc-400 font-medium">
          {isMultiSelectMode ? (
            <div className="flex items-center justify-between w-full">
              <button 
                onClick={() => handleSelectAllFilteredSongs(filteredSongs)} 
                className="hover:text-white transition-colors font-semibold"
              >
                Selected ({selectedSongIds.size})
              </button>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleBulkPlay}
                  disabled={selectedSongIds.size === 0}
                  className="px-3 py-1.5 bg-white hover:bg-zinc-200 disabled:opacity-30 disabled:pointer-events-none text-black font-bold rounded-lg flex items-center gap-1.5 transition-all text-xs"
                >
                  <Play className="w-3.5 h-3.5 fill-black text-black" /> Play
                </button>
                <button
                  onClick={handleBulkAddToQueue}
                  disabled={selectedSongIds.size === 0}
                  className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 disabled:opacity-30 disabled:pointer-events-none text-zinc-200 font-semibold rounded-lg text-xs"
                >
                  + Queue
                </button>

                {/* Bulk playlist dropdown trigger */}
                <div className="relative">
                  <button
                    onClick={() => setShowBulkPlaylistDropdown(!showBulkPlaylistDropdown)}
                    disabled={selectedSongIds.size === 0}
                    className="px-3 py-1.5 bg-zinc-900 border border-zinc-800 hover:bg-zinc-800 disabled:opacity-30 disabled:pointer-events-none text-zinc-200 font-semibold rounded-lg text-xs"
                  >
                    + Playlist
                  </button>
                  {showBulkPlaylistDropdown && (
                    <div className={`absolute right-0 mt-2 w-48 rounded-xl p-2 z-50 shadow-2xl animate-fade-in text-xs border ${
                      isLight 
                        ? 'bg-white border-zinc-200 text-zinc-800' 
                        : 'bg-zinc-900 border-zinc-800 text-zinc-200'
                    }`}>
                      <span className={`block px-2 py-1 font-bold uppercase text-[9px] border-b mb-1.5 ${
                        isLight ? 'text-zinc-500 border-zinc-100' : 'text-zinc-500 border-zinc-800'
                      }`}>Select custom playlist</span>
                      {playlists.filter(p => !p.isSmart).map(pl => (
                        <button
                          key={pl.id}
                          onClick={() => handleBulkAddToPlaylist(pl.id)}
                          className={`w-full text-left px-2.5 py-2 rounded-lg transition-colors truncate block font-medium ${
                            isLight 
                              ? 'hover:bg-zinc-100 text-zinc-800' 
                              : 'hover:bg-zinc-800 text-zinc-200'
                          }`}
                        >
                          {pl.name}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <button
                  onClick={handleBulkDelete}
                  disabled={selectedSongIds.size === 0}
                  className="p-1.5 text-zinc-400 hover:text-white disabled:opacity-20 transition-all"
                  title="Bulk Delete"
                >
                  <Trash className="w-5 h-5" />
                </button>
              </div>
            </div>
          ) : (
            <>
              <div className="flex items-center gap-2 text-zinc-300">
                <ArrowUpDown className="w-4 h-4 text-zinc-400" />
                <span className="font-medium">Sort:</span>
                <button onClick={() => triggerSort('title')} className={`hover:text-white transition-colors ${sortField === 'title' ? 'text-white font-bold' : ''}`}>Title</button>
                <span>•</span>
                <button onClick={() => triggerSort('artist')} className={`hover:text-white transition-colors ${sortField === 'artist' ? 'text-white font-bold' : ''}`}>Artist</button>
                <span>•</span>
                <button onClick={() => triggerSort('dateAdded')} className={`hover:text-white transition-colors ${sortField === 'dateAdded' ? 'text-white font-bold' : ''}`}>Added</button>
                <span>•</span>
                <button onClick={() => triggerSort('duration')} className={`hover:text-white transition-colors ${sortField === 'duration' ? 'text-white font-bold' : ''}`}>Duration</button>
              </div>
              <span className="font-mono text-xs uppercase text-zinc-500 font-semibold">{filteredSongs.length} items</span>
            </>
          )}
        </div>
      )}

      {/* RENDER LIST CONTENT */}
      <div className={`flex-1 overflow-y-auto px-4 py-2 space-y-1 scrollbar-none ${hasActiveTrack ? 'pb-40' : 'pb-24'}`}>
        
        {/* TAB: SONGS LIST */}
        {activeTab === 'songs' && (
          <>
            {filteredSongs.map((song) => {
              const isSelected = selectedSongIds.has(song.id);
              return (
                <div
                  key={song.id}
                  onClick={() => isMultiSelectMode ? null : onPlaySong(song, filteredSongs)}
                  className={`flex items-center justify-between p-3 rounded-xl border transition-all ${
                    isMultiSelectMode 
                      ? isSelected 
                        ? (isLight ? 'bg-zinc-100 border-zinc-300' : 'bg-zinc-900 border-zinc-700') 
                        : (isLight ? 'bg-white hover:bg-zinc-50 border-zinc-200' : 'bg-zinc-950/40 border-zinc-900/10 hover:bg-zinc-900/40')
                      : (isLight ? 'bg-white hover:bg-zinc-50 border-zinc-200' : 'bg-zinc-950/40 border-zinc-900/10 hover:bg-zinc-900/60')
                  } ${isLight ? '' : 'cursor-pointer'} group`}
                >
                  <div className="flex items-center gap-3.5 overflow-hidden mr-4 flex-1">
                    {/* Checkbox for multiselect */}
                    {isMultiSelectMode ? (
                      <button 
                        onClick={(e) => handleToggleSelectSong(song.id, e)} 
                        className={`p-1 rounded-lg ${isLight ? 'text-zinc-400 hover:text-zinc-800' : 'text-zinc-500 hover:text-white'} transition-all shrink-0`}
                      >
                        {isSelected ? <CheckSquare className={`w-6 h-6 ${isLight ? 'text-zinc-900' : 'text-white'}`} /> : <Square className="w-6 h-6" />}
                      </button>
                    ) : (
                      <div className="w-12 h-12 rounded-md shrink-0 relative overflow-hidden shadow-sm">
                        <SongCover song={song} className="absolute inset-0 w-full h-full" size="sm" />
                        {song.isFavorite && (
                          <div className={`absolute top-0 left-0 ${isLight ? 'bg-zinc-900' : 'bg-white'} w-2.5 h-2.5 rounded-br-lg z-10`} />
                        )}
                      </div>
                    )}
                    <div className="truncate">
                      <h4 className={`font-bold text-sm ${isLight ? 'text-zinc-900 group-hover:text-zinc-800' : 'text-zinc-100 group-hover:text-white'} transition-colors truncate`}>{song.title}</h4>
                      <p className={`text-xs ${isLight ? 'text-zinc-650' : 'text-zinc-400'} truncate mt-0.5 font-medium`}>
                        {song.artist}{song.album && song.album !== 'Local Downloads' ? ` • ${song.album}` : ''} • <span className="font-mono text-xs opacity-80">{Math.floor(song.duration / 60)}:{(song.duration % 60).toString().padStart(2, '0')}</span>
                      </p>
                    </div>
                  </div>

                  {/* Context menu triggers / Fav heart */}
                  {!isMultiSelectMode && (
                    <div className="flex items-center gap-2 shrink-0 relative" onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={(e) => handleSingleSongFavoriteToggle(song, e)}
                        className={`p-2 rounded-full ${isLight ? 'hover:bg-zinc-100' : 'hover:bg-zinc-800/40'} transition-colors`}
                      >
                        <HeartIcon filled={song.isFavorite} isLight={isLight} />
                      </button>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveActionMenuId(activeActionMenuId === song.id ? null : song.id);
                        }}
                        className={`p-2 rounded-full ${isLight ? 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100' : 'text-zinc-400 hover:text-white hover:bg-zinc-800/40'} transition-colors`}
                      >
                        <MoreVertical className="w-5 h-5" />
                      </button>

                      {/* Floating context popover for a single song */}
                      {activeActionMenuId === song.id && (
                        <div className={`absolute right-0 top-10 w-48 rounded-xl p-2 z-40 shadow-2xl animate-fade-in text-xs font-semibold space-y-1 border ${
                          isLight 
                            ? 'bg-white border-zinc-200 text-zinc-800' 
                            : 'bg-zinc-900 border-zinc-800 text-zinc-200'
                        }`}>
                          <button
                            onClick={() => {
                              audioEngine.addToQueue(song);
                              setActiveActionMenuId(null);
                            }}
                            className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors flex items-center gap-2.5 ${
                              isLight 
                                ? 'hover:bg-zinc-100 text-zinc-800' 
                                : 'hover:bg-zinc-800 text-zinc-200'
                            }`}
                          >
                            <ListPlus className="w-4.5 h-4.5" /> Add to Queue
                          </button>
                          <button
                            onClick={() => {
                              audioEngine.playNext(song);
                              setActiveActionMenuId(null);
                            }}
                            className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors flex items-center gap-2.5 ${
                              isLight 
                                ? 'hover:bg-zinc-100 text-zinc-800' 
                                : 'hover:bg-zinc-800 text-zinc-200'
                            }`}
                          >
                            <PlaySquare className="w-4.5 h-4.5" /> Play Next
                          </button>
                          <button
                            onClick={() => {
                              setAddToPlaylistSong(song);
                              setActiveActionMenuId(null);
                            }}
                            className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors flex items-center gap-2.5 ${
                              isLight 
                                ? 'hover:bg-zinc-100 text-zinc-800' 
                                : 'hover:bg-zinc-800 text-zinc-200'
                            }`}
                          >
                            <ListMusic className="w-4.5 h-4.5" /> Add to Playlist
                          </button>
                          <button
                            onClick={() => {
                              onEditMetadata(song);
                              setActiveActionMenuId(null);
                            }}
                            className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors flex items-center gap-2.5 ${
                              isLight 
                                ? 'hover:bg-zinc-100 text-zinc-800' 
                                : 'hover:bg-zinc-800 text-zinc-200'
                            }`}
                          >
                            <Plus className="w-4.5 h-4.5" /> Edit Metadata Tags
                          </button>
                          <button
                            onClick={() => {
                              setConfirmDeleteState({
                                isOpen: true,
                                title: 'Delete Song File',
                                message: `Permanently delete offline track "${song.title}"?`,
                                onConfirm: () => {
                                  offlineDb.deleteSong(song.id);
                                  onRefresh();
                                  setConfirmDeleteState(prev => ({ ...prev, isOpen: false }));
                                }
                              });
                              setActiveActionMenuId(null);
                            }}
                            className={`w-full text-left px-3 py-2.5 rounded-lg transition-colors flex items-center gap-2.5 ${
                              isLight 
                                ? 'hover:bg-red-50 text-red-600' 
                                : 'hover:bg-red-950/30 text-red-400'
                            }`}
                          >
                            <Trash className="w-4.5 h-4.5" /> Delete Song File
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}

        {/* TAB: ALBUMS */}
        {activeTab === 'albums' && (
          <div className="grid grid-cols-2 gap-4 pt-2">
            {albumsList.map((alb) => (
              <div
                key={alb.name}
                onClick={() => {
                  // Simulate as a filtered list playlist
                  onSelectPlaylist({
                    id: `temp-album-${alb.name}`,
                    name: alb.name,
                    description: `Album tracks of ${alb.songs[0]?.artist || 'Unknown Artist'}`,
                    songIds: alb.songs.map((s) => s.id),
                    isSmart: false,
                    dateCreated: Date.now(),
                  });
                }}
                className={`border ${isLight ? 'bg-white border-zinc-200 hover:border-zinc-300' : 'bg-zinc-900/40 border-zinc-800/50 hover:border-zinc-700'} rounded-xl p-3.5 text-center cursor-pointer group transition-all animate-fade-in shadow-sm`}
              >
                <SongCover 
                  song={alb.songs[0] || null} 
                  className="w-full aspect-square rounded-lg mb-3 shadow-sm" 
                  size="md" 
                />
                <h4 className={`font-bold text-sm ${isLight ? 'text-zinc-900 group-hover:text-zinc-800' : 'text-zinc-100 group-hover:text-white'} transition-colors truncate`}>{alb.name}</h4>
                <p className={`text-xs ${isLight ? 'text-zinc-600' : 'text-zinc-400'} truncate mt-1 font-medium`}>{alb.songs[0]?.artist || 'Various Artists'}</p>
                <span className={`inline-block mt-2 px-3 py-1 ${isLight ? 'bg-zinc-100 text-zinc-700 border-zinc-200' : 'bg-zinc-950 text-zinc-400 border-zinc-800'} text-xs font-mono rounded-full border font-semibold`}>{alb.songs.length} tracks</span>
              </div>
            ))}
          </div>
        )}

        {/* TAB: ARTISTS */}
        {activeTab === 'artists' && (
          <div className="space-y-2 pt-1">
            {artistsList.map((art) => (
              <div
                key={art.name}
                onClick={() => {
                  onSelectPlaylist({
                    id: `temp-artist-${art.name}`,
                    name: art.name,
                    description: `Artist discography offline catalog`,
                    songIds: art.songs.map((s) => s.id),
                    isSmart: false,
                    dateCreated: Date.now(),
                  });
                }}
                className={`flex items-center justify-between p-3.5 ${isLight ? 'bg-white border-zinc-200 hover:bg-zinc-100/60 hover:border-zinc-300' : 'bg-zinc-950/40 hover:bg-zinc-900/50 border-zinc-900/40 hover:border-zinc-800'} border rounded-xl transition-all cursor-pointer group`}
              >
                <div className="flex items-center gap-4">
                  <SongCover 
                    song={art.songs[0] || null} 
                    className={`w-12 h-12 rounded-lg border ${isLight ? 'border-zinc-200' : 'border-zinc-800'}`} 
                    size="sm" 
                  />
                  <div>
                    <h4 className={`font-bold text-sm ${isLight ? 'text-zinc-900 group-hover:text-zinc-800' : 'text-zinc-100 group-hover:text-white'} transition-colors`}>{art.name}</h4>
                    <p className={`text-xs ${isLight ? 'text-zinc-600' : 'text-zinc-400'} font-medium mt-0.5`}>{art.songs.length} {art.songs.length === 1 ? 'track' : 'tracks'} indexed</p>
                  </div>
                </div>
                <ChevronRight className={`w-5 h-5 ${isLight ? 'text-zinc-400 group-hover:text-zinc-700' : 'text-zinc-400 group-hover:text-zinc-200'} transition-colors`} />
              </div>
            ))}
          </div>
        )}

        {/* TAB: GENRES */}
        {activeTab === 'genres' && (
          <div className="space-y-2 pt-1">
            {genresList.map((gen) => (
              <div
                key={gen.name}
                onClick={() => {
                  onSelectPlaylist({
                    id: `temp-genre-${gen.name}`,
                    name: gen.name,
                    description: `Genre compilation playlist`,
                    songIds: gen.songs.map((s) => s.id),
                    isSmart: false,
                    dateCreated: Date.now(),
                  });
                }}
                className={`flex items-center justify-between p-3.5 ${isLight ? 'bg-white border-zinc-200 hover:bg-zinc-100/60 hover:border-zinc-300' : 'bg-zinc-950/40 hover:bg-zinc-900/50 border-zinc-900/40 hover:border-zinc-800'} border rounded-xl transition-all cursor-pointer group`}
              >
                <div className="flex items-center gap-3.5">
                  <div className={`p-3 ${isLight ? 'bg-zinc-100 border-zinc-200 text-zinc-700' : 'bg-zinc-900 border-zinc-800 text-zinc-300'} border rounded-xl`}>
                    <Music className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className={`font-bold text-sm ${isLight ? 'text-zinc-900 group-hover:text-zinc-800' : 'text-zinc-100 group-hover:text-white'} transition-colors`}>{gen.name}</h4>
                    <p className={`text-xs ${isLight ? 'text-zinc-600' : 'text-zinc-400'} font-medium mt-0.5`}>{gen.songs.length} audio tracks</p>
                  </div>
                </div>
                <ChevronRight className={`w-5 h-5 ${isLight ? 'text-zinc-400 group-hover:text-zinc-700' : 'text-zinc-500 group-hover:text-zinc-300'}`} />
              </div>
            ))}
          </div>
        )}

        {/* TAB: PLAYLISTS */}
        {activeTab === 'playlists' && (
          <div className="space-y-3 pt-1">
            {/* Create playlist banner button */}
            <button
              onClick={() => setShowCreatePlaylist(!showCreatePlaylist)}
              className={`w-full py-3 ${isLight ? 'bg-zinc-100 hover:bg-zinc-200 text-zinc-900 border-zinc-300' : 'bg-zinc-900 hover:bg-zinc-850 border border-zinc-800 text-zinc-100'} border text-sm font-bold rounded-xl flex items-center justify-center gap-2 transition-all shadow-sm`}
            >
              <Plus className="w-5 h-5" /> Create Custom Playlist
            </button>

            {/* Custom Playlist Creator form */}
            {showCreatePlaylist && (
              <form onSubmit={handleCreatePlaylist} className={`p-4 ${isLight ? 'bg-white border-zinc-300 text-zinc-900' : 'bg-zinc-950 border-zinc-800 text-zinc-100'} border rounded-xl space-y-3.5 text-xs animate-fade-in shadow-xl`}>
                <h4 className={`font-bold text-sm ${isLight ? 'text-zinc-900' : 'text-zinc-100'}`}>New Playlist Config</h4>
                <div className="space-y-2">
                  <input
                    type="text"
                    placeholder="Playlist Name"
                    value={newPlaylistName}
                    onChange={(e) => setNewPlaylistName(e.target.value)}
                    className={`w-full ${isLight ? 'bg-zinc-100 text-zinc-900 border-zinc-300 focus:border-zinc-400 placeholder-zinc-500' : 'bg-zinc-900 text-white border-zinc-800 focus:border-zinc-500'} rounded-xl px-3.5 py-2.5 border focus:outline-none text-sm font-medium`}
                    required
                  />
                  <input
                    type="text"
                    placeholder="Description (optional)"
                    value={newPlaylistDesc}
                    onChange={(e) => setNewPlaylistDesc(e.target.value)}
                    className={`w-full ${isLight ? 'bg-zinc-100 text-zinc-900 border-zinc-300 focus:border-zinc-400 placeholder-zinc-500' : 'bg-zinc-900 text-white border-zinc-800 focus:border-zinc-500'} rounded-xl px-3.5 py-2.5 border focus:outline-none text-sm font-medium`}
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCreatePlaylist(false)}
                    className={`flex-1 py-2.5 ${isLight ? 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border-zinc-300' : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-zinc-800'} rounded-lg border text-xs font-semibold`}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className={`flex-1 py-2.5 ${isLight ? 'bg-zinc-900 hover:bg-zinc-850 text-white font-bold' : 'bg-white hover:bg-zinc-100 text-black font-bold'} rounded-lg text-xs`}
                  >
                    Create
                  </button>
                </div>
              </form>
            )}

            {/* Render playlist options */}
            <div className="space-y-2">
              {playlists
                .filter(p => p.smartType !== 'recently-played' && p.smartType !== 'recently-added')
                .map((pl) => {
                // calculate count
                let count = pl.songIds.length;
                if (pl.isSmart) {
                  if (pl.smartType === 'favorites') count = songs.filter(s => s.isFavorite).length;
                  if (pl.smartType === 'recently-played') count = Math.min(50, offlineDb.getHistory().length);
                  if (pl.smartType === 'recently-added') count = songs.length;
                }

                // Get the cover song for image representation
                let coverSong: Song | null = null;
                if (pl.isSmart) {
                  if (pl.smartType === 'favorites') {
                    coverSong = songs.find(s => s.isFavorite) || null;
                  } else if (pl.smartType === 'recently-played') {
                    const history = offlineDb.getHistory();
                    if (history.length > 0) {
                      coverSong = songs.find(s => s.id === history[0].songId) || null;
                    }
                  } else if (pl.smartType === 'recently-added') {
                    const sorted = [...songs].sort((a, b) => b.dateAdded - a.dateAdded);
                    coverSong = sorted[0] || null;
                  }
                } else if (pl.songIds.length > 0) {
                  coverSong = songs.find(s => s.id === pl.songIds[0]) || null;
                }
                
                return (
                  <div
                    key={pl.id}
                    onClick={() => onSelectPlaylist(pl)}
                    className={`flex items-center justify-between p-3.5 ${isLight ? 'bg-white border-zinc-200 hover:bg-zinc-100/60 hover:border-zinc-300' : 'bg-zinc-950/40 hover:bg-zinc-900/50 border-zinc-900/40 hover:border-zinc-800'} border rounded-xl transition-all cursor-pointer group`}
                  >
                    <div className="flex items-center gap-3.5">
                      <div className="w-12 h-12 rounded-full shrink-0 relative overflow-hidden border border-zinc-200/10 shadow-sm">
                        <SongCover song={coverSong} className="absolute inset-0 w-full h-full object-cover" size="sm" />
                      </div>
                      <div>
                        <h4 className={`font-bold text-sm ${isLight ? 'text-zinc-900 group-hover:text-zinc-800' : 'text-zinc-100 group-hover:text-white'} transition-colors`}>{pl.name}</h4>
                        <p className={`text-xs ${isLight ? 'text-zinc-600' : 'text-zinc-400'} truncate max-w-[200px] mt-0.5 font-medium`}>
                          {pl.isSmart ? 'Smart Playlist' : pl.description || 'Playlist'} • {count} songs
                        </p>
                      </div>
                    </div>
                    <ChevronRight className={`w-5 h-5 ${isLight ? 'text-zinc-400 group-hover:text-zinc-700' : 'text-zinc-500 group-hover:text-zinc-300'} transition-colors`} />
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {filteredSongs.length === 0 && searchQuery.trim() && (
          <div className="py-20 text-center select-none text-zinc-500">
            <Search className="w-10 h-10 stroke-1 mx-auto text-zinc-750 mb-2" />
            <p className="text-xs font-semibold">No matches found for "{searchQuery}"</p>
            <p className="text-[10px] text-zinc-600 mt-1">Refine your filters or search keywords</p>
          </div>
        )}

      </div>

      <ConfirmDialog
        isOpen={confirmDeleteState.isOpen}
        title={confirmDeleteState.title}
        message={confirmDeleteState.message}
        onConfirm={confirmDeleteState.onConfirm}
        onCancel={() => setConfirmDeleteState(prev => ({ ...prev, isOpen: false }))}
      />

      {/* Beautiful dynamic notification toast */}
      {notification && (
        <div className={`absolute top-14 left-1/2 -translate-x-1/2 ${isLight ? 'bg-white border-zinc-200 text-zinc-900 shadow-xl' : 'bg-zinc-900 border-zinc-800 text-zinc-100'} text-[10px] px-4 py-2.5 border rounded-full z-50 flex items-center gap-2 animate-fade-in`}>
          <CheckCircle2 className="w-4 h-4 text-red-500 shrink-0" />
          <span>{notification}</span>
        </div>
      )}

      {/* Add To Playlist modal dialog */}
      {addToPlaylistSong && (
        <AddToPlaylistDialog
          song={addToPlaylistSong}
          playlists={playlists}
          onClose={() => setAddToPlaylistSong(null)}
          onSave={(msg) => {
            setNotification(msg);
            setTimeout(() => setNotification(null), 3000);
            onRefresh();
          }}
        />
      )}
    </div>
  );
}

// Simple custom heart SVG to bypass custom import restrictions and match design rules
function HeartIcon({ filled, isLight }: { filled: boolean; isLight?: boolean }) {
  return (
    <svg 
      className={`w-4 h-4 ${filled ? `fill-current ${isLight ? 'text-zinc-900' : 'text-white'}` : `text-zinc-500 ${isLight ? 'hover:text-zinc-800' : 'hover:text-white'}`}`} 
      fill={filled ? "currentColor" : "none"} 
      stroke="currentColor" 
      viewBox="0 0 24 24"
    >
      <path 
        strokeLinecap="round" 
        strokeLinejoin="round" 
        strokeWidth="2.5" 
        d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" 
      />
    </svg>
  );
}
