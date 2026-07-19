/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Song, Playlist } from '../types';
import { offlineDb } from '../services/db';
import { X, Plus, FolderPlus, CheckCircle, ListMusic, Music, Search } from 'lucide-react';

interface AddToPlaylistDialogProps {
  song: Song;
  playlists: Playlist[];
  onClose: () => void;
  onSave: (message: string) => void;
}

export default function AddToPlaylistDialog({ song, playlists, onClose, onSave }: AddToPlaylistDialogProps) {
  const appSettings = offlineDb.getSettings();
  const isLight = appSettings.theme === 'light';

  const [searchQuery, setSearchQuery] = useState('');
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [newPlaylistDesc, setNewPlaylistDesc] = useState('');

  const customPlaylists = playlists.filter((p) => !p.isSmart);

  // Filter custom playlists by search query
  const filteredPlaylists = customPlaylists.filter((pl) =>
    pl.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddToPlaylist = (playlistId: string, playlistName: string) => {
    const allPlaylists = offlineDb.getPlaylists();
    const idx = allPlaylists.findIndex((p) => p.id === playlistId);
    if (idx !== -1) {
      if (allPlaylists[idx].songIds.includes(song.id)) {
        onSave(`"${song.title}" is already in "${playlistName}"`);
        onClose();
        return;
      }
      allPlaylists[idx].songIds.push(song.id);
      offlineDb.savePlaylists(allPlaylists);
      onSave(`Added "${song.title}" to playlist "${playlistName}"!`);
      onClose();
    }
  };

  const handleCreateAndAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPlaylistName.trim()) return;

    // Create the playlist
    const newPl = offlineDb.createPlaylist(newPlaylistName.trim(), newPlaylistDesc.trim());
    
    // Add the song to the new playlist
    const allPlaylists = offlineDb.getPlaylists();
    const idx = allPlaylists.findIndex((p) => p.id === newPl.id);
    if (idx !== -1) {
      allPlaylists[idx].songIds.push(song.id);
      offlineDb.savePlaylists(allPlaylists);
    }

    onSave(`Created playlist "${newPl.name}" and added "${song.title}"!`);
    onClose();
  };

  return (
    <div className="absolute inset-0 bg-black/80 flex items-center justify-center p-4 z-50 animate-fade-in backdrop-blur-sm">
      <div className={`border rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl ${
        isLight ? 'bg-white border-zinc-200 text-zinc-800' : 'bg-zinc-950 border-zinc-900 text-zinc-300'
      }`}>
        {/* Header */}
        <div className={`flex items-center justify-between px-5 py-3.5 border-b ${
          isLight ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-950 border-zinc-900'
        }`}>
          <div className="flex items-center gap-2">
            <ListMusic className="w-4 h-4 text-red-500 animate-pulse" />
            <span className={`font-sans font-semibold text-xs ${isLight ? 'text-zinc-900' : 'text-zinc-100'}`}>
              Add Track to Playlist
            </span>
          </div>
          <button
            onClick={onClose}
            className={`p-1 rounded-full transition-colors ${
              isLight ? 'hover:bg-zinc-200 text-zinc-500 hover:text-zinc-900' : 'hover:bg-zinc-900 text-zinc-500 hover:text-white'
            }`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Selected Song Preview Banner */}
        <div className={`px-5 py-3 flex items-center gap-3 border-b ${
          isLight ? 'bg-zinc-50/50 border-zinc-100' : 'bg-zinc-900/10 border-zinc-900/50'
        }`}>
          <div className="w-9 h-9 rounded-md bg-red-950/20 border border-red-900/10 flex items-center justify-center text-red-400 shrink-0">
            <Music className="w-4.5 h-4.5" />
          </div>
          <div className="min-w-0">
            <p className={`text-xs font-bold truncate ${isLight ? 'text-zinc-900' : 'text-zinc-100'}`}>{song.title}</p>
            <p className={`text-[10px] truncate ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`}>{song.artist}</p>
          </div>
        </div>

        <div className="p-5 text-xs">
          {showCreateForm ? (
            /* Create new playlist custom form */
            <form onSubmit={handleCreateAndAdd} className="space-y-3.5 animate-fade-in">
              <h4 className={`font-semibold ${isLight ? 'text-zinc-900' : 'text-zinc-200'}`}>Create New Playlist</h4>
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Playlist Name"
                  value={newPlaylistName}
                  onChange={(e) => setNewPlaylistName(e.target.value)}
                  className={`w-full rounded-xl px-3 py-2 border text-xs focus:outline-none transition-all ${
                    isLight 
                      ? 'bg-zinc-100 text-zinc-900 border-zinc-300 focus:border-zinc-500 placeholder-zinc-500' 
                      : 'bg-zinc-900 text-white border-zinc-850 focus:border-zinc-500 placeholder-zinc-650'
                  }`}
                  required
                  autoFocus
                />
                <input
                  type="text"
                  placeholder="Description (optional)"
                  value={newPlaylistDesc}
                  onChange={(e) => setNewPlaylistDesc(e.target.value)}
                  className={`w-full rounded-xl px-3 py-2 border text-xs focus:outline-none transition-all ${
                    isLight 
                      ? 'bg-zinc-100 text-zinc-900 border-zinc-300 focus:border-zinc-500 placeholder-zinc-500' 
                      : 'bg-zinc-900 text-white border-zinc-850 focus:border-zinc-500 placeholder-zinc-650'
                  }`}
                />
              </div>
              <div className="flex gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={() => setShowCreateForm(false)}
                  className={`flex-1 py-2 rounded-lg border font-semibold ${
                    isLight ? 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border-zinc-300' : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-300 border-zinc-800'
                  }`}
                >
                  Back
                </button>
                <button
                  type="submit"
                  className={`flex-1 py-2 rounded-lg font-semibold ${
                    isLight ? 'bg-zinc-900 hover:bg-zinc-850 text-white' : 'bg-white hover:bg-zinc-100 text-black'
                  }`}
                >
                  Create & Add
                </button>
              </div>
            </form>
          ) : (
            /* Select existing playlist */
            <div className="space-y-3">
              {customPlaylists.length > 0 && (
                <div className={`flex items-center gap-2 rounded-xl px-3 py-1.5 border ${
                  isLight ? 'bg-zinc-100/50 border-zinc-200' : 'bg-zinc-900/40 border-zinc-900/60'
                }`}>
                  <Search className="w-3.5 h-3.5 text-zinc-500 shrink-0" />
                  <input
                    type="text"
                    placeholder="Search playlists..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="bg-transparent text-xs text-white focus:outline-none w-full placeholder-zinc-600 font-medium"
                    style={{ color: isLight ? '#18181b' : '#f4f4f5' }}
                  />
                </div>
              )}

              {/* Playlist row selections */}
              <div className="max-h-[180px] overflow-y-auto space-y-1.5 scrollbar-none pr-0.5">
                {filteredPlaylists.map((pl) => {
                  const alreadyContains = pl.songIds.includes(song.id);
                  return (
                    <button
                      key={pl.id}
                      onClick={() => handleAddToPlaylist(pl.id, pl.name)}
                      className={`w-full text-left p-2.5 rounded-xl border flex items-center justify-between transition-all group ${
                        isLight
                          ? 'bg-white hover:bg-zinc-50 border-zinc-200 hover:border-zinc-300'
                          : 'bg-zinc-950/40 hover:bg-zinc-900/50 border-zinc-900/40 hover:border-zinc-850'
                      }`}
                    >
                      <div className="min-w-0 flex items-center gap-2.5">
                        <span className="text-sm shrink-0">💿</span>
                        <div className="truncate">
                          <p className={`font-semibold text-xs ${isLight ? 'text-zinc-900' : 'text-zinc-200'} truncate`}>
                            {pl.name}
                          </p>
                          <p className={`text-[9px] ${isLight ? 'text-zinc-500' : 'text-zinc-500'} truncate`}>
                            {pl.songIds.length} tracks
                          </p>
                        </div>
                      </div>
                      {alreadyContains ? (
                        <span className="text-[9px] font-semibold text-zinc-500 bg-zinc-900 px-2 py-0.5 rounded-full border border-zinc-850">
                          Added
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-red-500 bg-red-500/10 hover:bg-red-500/20 px-2 py-1 rounded-lg border border-red-500/20 transition-all">
                          + Add
                        </span>
                      )}
                    </button>
                  );
                })}

                {filteredPlaylists.length === 0 && searchQuery && (
                  <p className="text-center text-zinc-500 text-[10px] py-4">No matching playlists</p>
                )}
              </div>

              {/* Quick action to create a playlist */}
              <button
                onClick={() => setShowCreateForm(true)}
                className={`w-full py-2.5 border border-dashed rounded-xl flex items-center justify-center gap-1.5 font-semibold text-[11px] transition-all ${
                  isLight 
                    ? 'hover:bg-zinc-50 border-zinc-300 text-zinc-800' 
                    : 'hover:bg-zinc-900/50 border-zinc-800 text-zinc-200'
                }`}
              >
                <FolderPlus className="w-4 h-4 text-red-500" />
                <span>Create Custom Playlist</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
