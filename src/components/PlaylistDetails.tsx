/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Playlist, Song } from '../types';
import { offlineDb } from '../services/db';
import { audioEngine } from '../services/audioEngine';
import SongCover from './SongCover';
import ConfirmDialog from './ConfirmDialog';
import { 
  Play, Shuffle, Trash2, Edit2, ChevronLeft, Save, X, Plus, 
  Trash, ArrowUp, ArrowDown, Share2, Download, Upload, CheckCircle2,
  Search, Check
} from 'lucide-react';

interface PlaylistDetailsProps {
  playlist: Playlist;
  songs: Song[];
  onBack: () => void;
  onPlaySong: (song: Song, customQueue?: Song[]) => void;
  onRefresh: () => void;
  hasActiveTrack?: boolean;
}

export default function PlaylistDetails({ playlist, songs, onBack, onPlaySong, onRefresh, hasActiveTrack = false }: PlaylistDetailsProps) {
  const [playlistSongs, setPlaylistSongs] = useState<Song[]>([]);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState(playlist.name);
  const [showNotification, setShowNotification] = useState<string | null>(null);
  const [showConfirmDelete, setShowConfirmDelete] = useState(false);

  // New features: add music into playlist
  const [showAddMusicModal, setShowAddMusicModal] = useState(false);
  const [musicSearchQuery, setMusicSearchQuery] = useState('');
  const [localSongIds, setLocalSongIds] = useState<string[]>(playlist.songIds || []);

  const appSettings = offlineDb.getSettings();
  const isLight = appSettings.theme === 'light';

  useEffect(() => {
    setLocalSongIds(playlist.songIds || []);
  }, [playlist.songIds]);

  useEffect(() => {
    loadPlaylistSongs();
  }, [playlist, songs, localSongIds]);

  const handleAddSongToPlaylistDirectly = (songId: string, songTitle: string) => {
    const playlists = offlineDb.getPlaylists();
    const idx = playlists.findIndex((p) => p.id === playlist.id);
    if (idx !== -1) {
      if (!playlists[idx].songIds.includes(songId)) {
        playlists[idx].songIds.push(songId);
        offlineDb.savePlaylists(playlists);
        setLocalSongIds([...playlists[idx].songIds]);
        triggerAlert(`Added "${songTitle}" to playlist!`);
        onRefresh();
      }
    }
  };

  const loadPlaylistSongs = () => {
    if (playlist.isSmart) {
      if (playlist.smartType === 'favorites') {
        const favs = songs.filter((s) => s.isFavorite);
        setPlaylistSongs(favs);
      } else if (playlist.smartType === 'recently-played') {
        const history = offlineDb.getHistory();
        // map history to song objects, maintaining chronological duplicate entries if they played it multiple times
        const mapped = history
          .map((h) => songs.find((s) => s.id === h.songId))
          .filter((s): s is Song => !!s);
        setPlaylistSongs(mapped.slice(0, 10)); // limit to top 10 recently played
      } else if (playlist.smartType === 'recently-added') {
        const additions = [...songs].sort((a, b) => b.dateAdded - a.dateAdded);
        setPlaylistSongs(additions.slice(0, 30));
      }
    } else {
      // Custom playlist
      const mapped = localSongIds
        .map((id) => songs.find((s) => s.id === id))
        .filter((s): s is Song => !!s);
      setPlaylistSongs(mapped);
    }
  };

  const handlePlayAll = (shuffle: boolean = false) => {
    if (playlistSongs.length === 0) return;
    audioEngine.setQueue(playlistSongs, shuffle ? Math.floor(Math.random() * playlistSongs.length) : 0, true);
  };

  const handleRename = () => {
    if (!editedName.trim()) return;
    const playlists = offlineDb.getPlaylists();
    const idx = playlists.findIndex((p) => p.id === playlist.id);
    if (idx !== -1) {
      playlists[idx].name = editedName.trim();
      offlineDb.savePlaylists(playlists);
      setIsEditingName(false);
      onRefresh();
    }
  };

  const handleDelete = () => {
    setShowConfirmDelete(true);
  };

  const handleConfirmDelete = () => {
    const playlists = offlineDb.getPlaylists().filter((p) => p.id !== playlist.id);
    offlineDb.savePlaylists(playlists);
    setShowConfirmDelete(false);
    onBack();
    onRefresh();
  };

  const handleRemoveSong = (songId: string, indexToRemove?: number) => {
    if (playlist.isSmart) {
      if (playlist.smartType === 'favorites') {
        // Toggle favorite off
        const songsDb = offlineDb.getSongs();
        const idx = songsDb.findIndex((s) => s.id === songId);
        if (idx !== -1) {
          songsDb[idx].isFavorite = false;
          offlineDb.saveSongs(songsDb);
          onRefresh();
        }
      }
      return;
    }

    const playlists = offlineDb.getPlaylists();
    const idx = playlists.findIndex((p) => p.id === playlist.id);
    if (idx !== -1) {
      if (indexToRemove !== undefined) {
        playlists[idx].songIds.splice(indexToRemove, 1);
      } else {
        playlists[idx].songIds = playlists[idx].songIds.filter((id) => id !== songId);
      }
      offlineDb.savePlaylists(playlists);
      setLocalSongIds([...playlists[idx].songIds]);
      onRefresh();
    }
  };

  const handleMoveSong = (index: number, direction: 'up' | 'down') => {
    if (playlist.isSmart) return;
    const newSongs = [...playlistSongs];
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= newSongs.length) return;

    // Swap elements
    [newSongs[index], newSongs[targetIndex]] = [newSongs[targetIndex], newSongs[index]];
    
    // Save new order to DB
    const playlists = offlineDb.getPlaylists();
    const idx = playlists.findIndex((p) => p.id === playlist.id);
    if (idx !== -1) {
      playlists[idx].songIds = newSongs.map((s) => s.id);
      offlineDb.savePlaylists(playlists);
      onRefresh();
    }
  };

  const handleExportPlaylist = () => {
    try {
      const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(playlist));
      const downloadAnchor = document.createElement('a');
      downloadAnchor.setAttribute("href", dataStr);
      downloadAnchor.setAttribute("download", `Playlist_${playlist.name.replace(/\s+/g, '_')}.json`);
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      triggerAlert('Playlist exported successfully!');
    } catch (e) {
      console.error(e);
    }
  };

  const triggerAlert = (msg: string) => {
    setShowNotification(msg);
    setTimeout(() => setShowNotification(null), 3000);
  };

  return (
    <div className={`h-full flex flex-col ${isLight ? 'bg-zinc-50 text-zinc-800' : 'bg-[#030303] text-zinc-300'} overflow-hidden`}>
      
      {/* Dynamic Pop notification banner */}
      {showNotification && (
        <div className={`absolute top-14 left-1/2 -translate-x-1/2 ${isLight ? 'bg-white border-zinc-200 text-zinc-900 shadow-xl' : 'bg-zinc-900 border-zinc-800 text-zinc-100'} text-[10px] px-4 py-2.5 border rounded-full z-50 flex items-center gap-2 animate-fade-in`}>
          <CheckCircle2 className={`w-4 h-4 ${isLight ? 'text-zinc-900' : 'text-white'}`} />
          <span>{showNotification}</span>
        </div>
      )}

      {/* Playlist Top Toolbar */}
      <div className={`px-4 py-3 ${isLight ? 'bg-white border-zinc-200' : 'bg-zinc-950 border-zinc-900'} border-b flex items-center justify-between`}>
        <button
          onClick={onBack}
          className={`p-1.5 rounded-full ${isLight ? 'hover:bg-zinc-100 text-zinc-600 hover:text-zinc-900' : 'p-1.5 rounded-full hover:bg-zinc-900 text-zinc-400 hover:text-white'} transition-colors`}
        >
          <ChevronLeft className="w-5 h-5" />
        </button>

        {isEditingName ? (
          <div className="flex-1 flex items-center gap-2 mx-3">
            <input
              type="text"
              value={editedName}
              onChange={(e) => setEditedName(e.target.value)}
              className={`flex-1 ${isLight ? 'bg-zinc-100 text-zinc-900 border-zinc-300 focus:border-zinc-500' : 'bg-zinc-900 text-white border-zinc-800 focus:border-zinc-700'} rounded-xl px-3 py-1.5 text-xs border focus:outline-none`}
              autoFocus
            />
            <button onClick={handleRename} className={`p-1.5 ${isLight ? 'text-zinc-800 hover:bg-zinc-100' : 'text-zinc-200 hover:bg-zinc-900'} rounded-lg`}>
              <Save className="w-4 h-4" />
            </button>
            <button onClick={() => setIsEditingName(false)} className={`p-1.5 ${isLight ? 'text-zinc-500 hover:bg-zinc-100' : 'text-zinc-500 hover:bg-zinc-900'} rounded-lg`}>
              <X className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex-1 mx-3 truncate">
            <h2 className={`font-sans font-semibold text-xs ${isLight ? 'text-zinc-900' : 'text-zinc-200'} truncate`}>{playlist.name}</h2>
            <p className={`text-[9px] ${isLight ? 'text-zinc-500' : 'text-zinc-500'} font-medium`}>
              {playlist.isSmart ? 'Automated Smart List' : 'Offline Custom List'} • {playlistSongs.length} songs
            </p>
          </div>
        )}

        <div className="flex items-center gap-1.5 shrink-0">
          {!playlist.isSmart && (
            <>
              <button
                onClick={() => setIsEditingName(true)}
                className={`p-1.5 rounded-full ${isLight ? 'text-zinc-500 hover:text-zinc-950 hover:bg-zinc-100' : 'text-zinc-500 hover:text-white hover:bg-zinc-900'}`}
                title="Rename playlist"
              >
                <Edit2 className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleDelete}
                className={`p-1.5 rounded-full ${isLight ? 'text-zinc-500 hover:text-red-600 hover:bg-red-50' : 'text-zinc-550 hover:text-red-400 hover:bg-zinc-900'}`}
                title="Delete playlist"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}
          <button
            onClick={handleExportPlaylist}
            className={`p-1.5 rounded-full ${isLight ? 'text-zinc-500 hover:text-zinc-950 hover:bg-zinc-100' : 'text-zinc-500 hover:text-white hover:bg-zinc-900'}`}
            title="Export playlist file"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Playlist Hero Control Dashboard */}
      <div className={`p-5 bg-gradient-to-b ${isLight ? 'from-white to-zinc-50 border-zinc-200' : 'from-zinc-950 to-[#030303] border-zinc-900/60'} border-b flex flex-col items-center select-none`}>
        
        {/* Dynamic Art Stack */}
        <div className={`w-24 h-24 ${isLight ? 'bg-zinc-100 border-zinc-200' : 'bg-zinc-900 border-zinc-800'} border rounded-sm flex items-center justify-center relative overflow-hidden group mb-4`}>
          {playlistSongs.length > 0 ? (
            <div className="grid grid-cols-2 w-full h-full">
              {playlistSongs.slice(0, 4).map((song, i) => (
                <SongCover
                  key={`${song.id}-stack-${i}`}
                  song={song}
                  className="w-full h-full border-none"
                  size="sm"
                />
              ))}
            </div>
          ) : (
            <span className="text-3xl select-none opacity-20">💿</span>
          )}
        </div>

        <h3 className={`font-sans font-bold text-sm ${isLight ? 'text-zinc-900' : 'text-zinc-100'} text-center truncate w-full mb-1`}>{playlist.name}</h3>
        {playlist.description && (
          <p className={`text-[10px] ${isLight ? 'text-zinc-600' : 'text-zinc-500'} text-center max-w-[280px] truncate mb-4`}>{playlist.description}</p>
        )}

        {/* Dynamic playback actions */}
        <div className="flex gap-2.5 w-full max-w-[320px]">
          <button
            onClick={() => handlePlayAll(false)}
            disabled={playlistSongs.length === 0}
            className={`flex-1 py-2 ${isLight ? 'bg-zinc-900 hover:bg-zinc-850 text-white disabled:bg-zinc-100 disabled:text-zinc-300' : 'bg-white hover:bg-zinc-100 disabled:bg-zinc-900 disabled:text-zinc-650 text-black'} text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors shadow`}
          >
            <Play className={`w-3.5 h-3.5 ${isLight ? 'fill-white text-white' : 'fill-black text-black'}`} /> Play
          </button>
          <button
            onClick={() => handlePlayAll(true)}
            disabled={playlistSongs.length === 0}
            className={`flex-1 py-2 ${isLight ? 'bg-white hover:bg-zinc-100 text-zinc-800 border-zinc-200 disabled:bg-zinc-100 disabled:text-zinc-300' : 'bg-zinc-900 hover:bg-zinc-850 disabled:bg-zinc-900 disabled:text-zinc-650 text-zinc-200 border border-zinc-800'} border text-xs font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors`}
          >
            <Shuffle className="w-3.5 h-3.5" /> Shuffle
          </button>
        </div>

        {!playlist.isSmart && (
          <button
            onClick={() => {
              setMusicSearchQuery('');
              setShowAddMusicModal(true);
            }}
            className={`mt-3 w-full max-w-[320px] py-1.5 border border-dashed rounded-lg text-center font-bold text-[10px] flex items-center justify-center gap-1.5 transition-colors ${
              isLight 
                ? 'border-zinc-300 hover:bg-zinc-100 text-zinc-800 bg-white shadow-sm' 
                : 'border-zinc-800 hover:bg-zinc-900 text-zinc-200 bg-zinc-950/20'
            }`}
          >
            <Plus className="w-3.5 h-3.5 text-red-500 animate-pulse" /> Add Songs to Playlist
          </button>
        )}
      </div>

      {/* Playlist Tracks Scroll Body */}
      <div className={`flex-1 overflow-y-auto px-4 py-2 space-y-1.5 scrollbar-none ${hasActiveTrack ? 'pb-40' : 'pb-24'}`}>
        {playlistSongs.map((song, index) => (
          <div
            key={`${song.id}-${index}`}
            className={`flex items-center justify-between p-2 ${isLight ? 'bg-white hover:bg-zinc-100/80 border-zinc-200 hover:border-zinc-300' : 'bg-zinc-950/40 hover:bg-zinc-900/50 border-zinc-900/40 hover:border-zinc-800'} rounded-xl border group transition-all`}
          >
            <button
              onClick={() => onPlaySong(song, playlistSongs)}
              className="flex-1 flex items-center gap-3 text-left overflow-hidden mr-4"
            >
              <span className={`font-mono text-[9px] font-bold ${isLight ? 'text-zinc-500' : 'text-zinc-600'} w-4 block text-center shrink-0`}>
                {index + 1}
              </span>
              <SongCover song={song} className="w-8 h-8 rounded-sm shrink-0" size="sm" />
              <div className="truncate">
                <h4 className={`font-semibold text-xs ${isLight ? 'text-zinc-900 group-hover:text-zinc-800' : 'text-zinc-200 group-hover:text-white'} transition-colors truncate`}>{song.title}</h4>
                <p className={`text-[9px] ${isLight ? 'text-zinc-600' : 'text-zinc-500'} truncate mt-0.5`}>
                  {song.artist} • <span className="font-mono">{Math.floor(song.duration / 60)}:{(song.duration % 60).toString().padStart(2, '0')}</span>
                </p>
              </div>
            </button>

            {/* Song action triggers */}
            <div className="flex items-center gap-1 shrink-0">
              {!playlist.isSmart && (
                <>
                  <button
                    onClick={() => handleMoveSong(index, 'up')}
                    disabled={index === 0}
                    className={`p-1 ${isLight ? 'text-zinc-400 hover:text-zinc-800' : 'text-zinc-500 hover:text-white'} disabled:opacity-20 transition-opacity`}
                    title="Move song up"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    onClick={() => handleMoveSong(index, 'down')}
                    disabled={index === playlistSongs.length - 1}
                    className={`p-1 ${isLight ? 'text-zinc-400 hover:text-zinc-800' : 'text-zinc-500 hover:text-white'} disabled:opacity-20 transition-opacity`}
                    title="Move song down"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
              <button
                onClick={() => handleRemoveSong(song.id, playlist.isSmart ? undefined : index)}
                className={`p-1.5 ${isLight ? 'text-zinc-400 hover:text-red-600 hover:bg-red-50' : 'text-zinc-500 hover:text-white hover:bg-zinc-900'} rounded-lg transition-colors`}
                title={playlist.isSmart ? 'Unfavorite song' : 'Remove song from playlist'}
              >
                <Trash className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        ))}

        {playlistSongs.length === 0 && (
          <div className="py-20 text-center select-none text-zinc-500">
            <span className="text-4xl select-none opacity-20 block mb-3">💿</span>
            <p className={`text-xs font-semibold ${isLight ? 'text-zinc-800' : 'text-zinc-400'}`}>No tracks in this playlist yet</p>
            <p className={`${isLight ? 'text-zinc-500' : 'text-zinc-500'} text-[9px] mt-1`}>Navigate to the Library tab and tap Add to Playlist</p>
          </div>
        )}
      </div>

      {showAddMusicModal && (
        <div className="absolute inset-0 bg-black/80 flex items-center justify-center p-4 z-50 animate-fade-in backdrop-blur-sm">
          <div className={`border rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col h-[400px] ${
            isLight ? 'bg-white border-zinc-200 text-zinc-800' : 'bg-zinc-950 border-zinc-900 text-zinc-300'
          }`}>
            {/* Modal Header */}
            <div className={`flex items-center justify-between px-5 py-3.5 border-b shrink-0 ${
              isLight ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-950 border-zinc-900'
            }`}>
              <div className="flex items-center gap-2">
                <Plus className="w-4 h-4 text-red-500" />
                <span className={`font-sans font-semibold text-xs ${isLight ? 'text-zinc-900' : 'text-zinc-100'}`}>
                  Add Songs to {playlist.name}
                </span>
              </div>
              <button
                onClick={() => setShowAddMusicModal(false)}
                className={`p-1 rounded-full transition-colors ${
                  isLight ? 'hover:bg-zinc-200 text-zinc-500 hover:text-zinc-900' : 'hover:bg-zinc-900 text-zinc-500 hover:text-white'
                }`}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Search Bar */}
            <div className={`p-4 border-b shrink-0 ${isLight ? 'bg-white border-zinc-100' : 'bg-zinc-950 border-zinc-900/60'}`}>
              <div className={`flex items-center gap-2 rounded-xl px-3 py-1.5 border ${
                isLight ? 'bg-zinc-100/50 border-zinc-200' : 'bg-zinc-900/40 border-zinc-900/60'
              }`}>
                <Search className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                <input
                  type="text"
                  placeholder="Search tracks to add..."
                  value={musicSearchQuery}
                  onChange={(e) => setMusicSearchQuery(e.target.value)}
                  className="bg-transparent text-xs text-white focus:outline-none w-full placeholder-zinc-600 font-medium"
                  style={{ color: isLight ? '#18181b' : '#f4f4f5' }}
                />
              </div>
            </div>

            {/* Scrollable Songs List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-1.5 scrollbar-none">
              {(() => {
                const availableSongsToAdd = songs.filter((s) => !localSongIds.includes(s.id));
                const filteredAvailableSongs = availableSongsToAdd.filter((s) => {
                  const q = musicSearchQuery.toLowerCase();
                  return s.title.toLowerCase().includes(q) || 
                         s.artist.toLowerCase().includes(q) || 
                         (s.album && s.album.toLowerCase().includes(q));
                });

                if (filteredAvailableSongs.length === 0) {
                  return (
                    <div className="py-12 text-center text-zinc-500 font-medium text-[11px]">
                      {availableSongsToAdd.length === 0 ? 'All library songs are already in this playlist!' : 'No matching songs found.'}
                    </div>
                  );
                }

                return filteredAvailableSongs.map((song) => (
                  <div
                    key={song.id}
                    className={`p-2 rounded-xl border flex items-center justify-between transition-all ${
                      isLight
                        ? 'bg-zinc-50/50 hover:bg-zinc-100 border-zinc-200'
                        : 'bg-zinc-900/20 hover:bg-zinc-900/40 border-zinc-900/40'
                    }`}
                  >
                    <div className="flex items-center gap-2.5 min-w-0 mr-2">
                      <SongCover song={song} className="w-8 h-8 rounded-sm shrink-0" size="sm" />
                      <div className="min-w-0 truncate">
                        <p className={`font-semibold text-xs ${isLight ? 'text-zinc-900' : 'text-zinc-200'} truncate`}>
                          {song.title}
                        </p>
                        <p className={`text-[9px] ${isLight ? 'text-zinc-600' : 'text-zinc-400'} truncate`}>
                          {song.artist}
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleAddSongToPlaylistDirectly(song.id, song.title)}
                      className="px-2.5 py-1 bg-red-600 hover:bg-red-500 text-white text-[9.5px] font-bold rounded-lg flex items-center gap-1 transition-all"
                    >
                      <Plus className="w-3 h-3" /> Add
                    </button>
                  </div>
                ));
              })()}
            </div>

            {/* Footer with Close/Done Button */}
            <div className={`p-4 border-t text-center shrink-0 ${
              isLight ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-950 border-zinc-900'
            }`}>
              <button
                onClick={() => setShowAddMusicModal(false)}
                className={`w-full py-2 rounded-lg text-xs font-semibold ${
                  isLight ? 'bg-zinc-900 hover:bg-zinc-850 text-white' : 'bg-white hover:bg-zinc-100 text-black'
                }`}
              >
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={showConfirmDelete}
        title="Delete Playlist"
        message={`Are you sure you want to delete the playlist "${playlist.name}"?`}
        onConfirm={handleConfirmDelete}
        onCancel={() => setShowConfirmDelete(false)}
      />
    </div>
  );
}
