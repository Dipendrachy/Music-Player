/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Song, Playlist } from '../types';
import { offlineDb } from '../services/db';
import { audioEngine } from '../services/audioEngine';
import SongCover from './SongCover';
import { 
  Folder, FileAudio, ChevronRight, Play, Shuffle, FolderPlus, 
  ChevronDown, HardDrive, Plus, CornerDownRight, CheckCircle2 
} from 'lucide-react';

interface FolderTabProps {
  songs: Song[];
  onPlaySong: (song: Song) => void;
  onAddToPlaylist: (song: Song) => void;
  hasActiveTrack?: boolean;
  currentPath?: string[];
  onPathChange?: (path: string[]) => void;
}

interface DirectoryNode {
  name: string;
  fullPath: string;
  subfolders: { [key: string]: DirectoryNode };
  songs: Song[];
}

export default function FolderTab({ 
  songs, 
  onPlaySong, 
  onAddToPlaylist, 
  hasActiveTrack = false,
  currentPath: propCurrentPath,
  onPathChange
}: FolderTabProps) {
  const [localCurrentPath, setLocalCurrentPath] = useState<string[]>([]); // empty represents root (Internal Storage + SD Card)
  
  const currentPath = propCurrentPath !== undefined ? propCurrentPath : localCurrentPath;
  const setCurrentPath = (newPath: string[] | ((prev: string[]) => string[])) => {
    const computed = typeof newPath === 'function' ? newPath(currentPath) : newPath;
    if (onPathChange) {
      onPathChange(computed);
    }
    setLocalCurrentPath(computed);
  };

  const [showPlaylistSelector, setShowPlaylistSelector] = useState<string | null>(null); // path being added to playlist
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [searchFilter, setSearchFilter] = useState('');

  const appSettings = offlineDb.getSettings();
  const isLight = appSettings?.theme === 'light';

  useEffect(() => {
    setPlaylists(offlineDb.getPlaylists().filter(p => !p.isSmart));
  }, []);

  // Build simulated File Tree from current DB songs
  const buildTree = (): DirectoryNode => {
    const root: DirectoryNode = {
      name: 'Storage Root',
      fullPath: '',
      subfolders: {
        'Internal Storage': { name: 'Internal Storage', fullPath: 'Internal Storage', subfolders: {}, songs: [] },
        'SD Card': { name: 'SD Card', fullPath: 'SD Card', subfolders: {}, songs: [] }
      },
      songs: []
    };

    songs.forEach((song) => {
      const parts = song.path.split('/');
      let current = root;

      // Navigate or build folders matching path parts
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!current.subfolders[part]) {
          const parentPath = current.fullPath;
          const fullPath = parentPath ? `${parentPath}/${part}` : part;
          current.subfolders[part] = {
            name: part,
            fullPath,
            subfolders: {},
            songs: []
          };
        }
        current = current.subfolders[part];
      }
      
      // Add song to final folder node
      current.songs.push(song);
    });

    return root;
  };

  const tree = buildTree();

  // Helper to get active folder node based on current path array
  const getActiveNode = (): DirectoryNode => {
    let current = tree;
    for (const part of currentPath) {
      if (current.subfolders[part]) {
        current = current.subfolders[part];
      }
    }
    return current;
  };

  const activeNode = getActiveNode();

  // Collect all songs in folder and subfolders recursively
  const getAllSongsRecursively = (node: DirectoryNode): Song[] => {
    let result = [...node.songs];
    Object.values(node.subfolders).forEach((sub) => {
      result = [...result, ...getAllSongsRecursively(sub)];
    });
    return result;
  };

  const handlePlayFolder = (node: DirectoryNode, shuffle: boolean = false) => {
    const folderSongs = getAllSongsRecursively(node);
    if (folderSongs.length === 0) return;
    
    if (shuffle) {
      audioEngine.setQueue(folderSongs, Math.floor(Math.random() * folderSongs.length), true);
    } else {
      audioEngine.setQueue(folderSongs, 0, true);
    }
  };

  const handleAddFolderToPlaylist = (node: DirectoryNode, playlistId: string) => {
    const folderSongs = getAllSongsRecursively(node);
    if (folderSongs.length === 0) return;

    const playlistsDb = offlineDb.getPlaylists();
    const idx = playlistsDb.findIndex(p => p.id === playlistId);
    if (idx !== -1) {
      const existing = new Set(playlistsDb[idx].songIds);
      folderSongs.forEach(s => existing.add(s.id));
      playlistsDb[idx].songIds = Array.from(existing);
      offlineDb.savePlaylists(playlistsDb);
    }
    setShowPlaylistSelector(null);
  };

  const handleNavigateUp = () => {
    if (currentPath.length > 0) {
      setCurrentPath(currentPath.slice(0, -1));
    }
  };

  // List folders & files at current level
  const foldersAtLevel = Object.values(activeNode.subfolders);
  const filesAtLevel = activeNode.songs.filter(
    (s) => !searchFilter || s.title.toLowerCase().includes(searchFilter.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col bg-[#030303] text-zinc-300 dynamic-bg dynamic-text overflow-hidden">
      
      {/* Folder Header */}
      <div className="px-5 py-4 border-b border-zinc-900 bg-zinc-950 dynamic-card dynamic-border">
        <div className="flex items-center justify-between mb-3.5">
          <div className="flex items-center gap-2.5">
            <HardDrive className="w-6 h-6 text-zinc-300" />
            <h1 className="font-sans font-bold text-base text-zinc-100">Folder Browser</h1>
          </div>
          {currentPath.length > 0 && (
            <div className="flex gap-2 text-xs">
              <button
                onClick={() => handlePlayFolder(activeNode, false)}
                className="px-3 py-1.5 bg-white hover:bg-zinc-100 text-black text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all shadow"
                title="Play folder sequentially"
              >
                <Play className="w-3.5 h-3.5 fill-black text-black" /> Play All
              </button>
              <button
                onClick={() => handlePlayFolder(activeNode, true)}
                className="px-3 py-1.5 bg-zinc-900 hover:bg-zinc-850 text-zinc-200 border border-zinc-800 text-xs font-bold rounded-lg flex items-center gap-1.5 transition-all"
                title="Shuffle folder"
              >
                <Shuffle className="w-3.5 h-3.5" /> Shuffle
              </button>
            </div>
          )}
        </div>

        {/* Path breadcrumbs */}
        <div className="flex items-center gap-2 overflow-x-auto text-xs font-mono py-1 scrollbar-none text-zinc-400">
          <button 
            onClick={() => setCurrentPath([])} 
            className={`hover:text-white transition-colors shrink-0 ${currentPath.length === 0 ? 'text-white font-bold' : ''}`}
          >
            Storage Root
          </button>
          {currentPath.map((part, index) => (
            <React.Fragment key={index}>
              <span className="text-zinc-700">/</span>
              <button
                onClick={() => setCurrentPath(currentPath.slice(0, index + 1))}
                className={`hover:text-white transition-colors shrink-0 ${
                  index === currentPath.length - 1 ? 'text-white font-bold' : ''
                }`}
              >
                {part}
              </button>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* Directory Browser Body */}
      <div className={`flex-1 overflow-y-auto px-4 py-2 space-y-2 scrollbar-none ${hasActiveTrack ? 'pb-40' : 'pb-24'}`}>
        {/* Navigation Up Row */}
        {currentPath.length > 0 && (
          <button
            onClick={handleNavigateUp}
            className="w-full flex items-center gap-3.5 p-3.5 hover:bg-zinc-900/40 rounded-xl transition-colors text-left"
          >
            <Folder className="w-6 h-6 text-zinc-500 fill-zinc-900" />
            <div>
              <h3 className="font-bold text-sm text-zinc-400">..</h3>
              <p className="text-xs text-zinc-500 font-medium">Go to parent folder</p>
            </div>
          </button>
        )}

        {/* Listed Folders */}
        {foldersAtLevel.map((fold) => {
          const count = getAllSongsRecursively(fold).length;
          return (
            <div
              key={fold.fullPath}
              className="flex items-center justify-between p-3.5 bg-zinc-950/40 hover:bg-zinc-900/50 rounded-xl transition-all border border-zinc-900/40 hover:border-zinc-800 group"
            >
              <button
                onClick={() => setCurrentPath(fold.fullPath.split('/'))}
                className="flex-1 flex items-center gap-4 text-left"
              >
                <div className="p-2.5 bg-zinc-900 text-zinc-300 rounded-lg group-hover:bg-zinc-850 transition-colors">
                  <Folder className="w-5 h-5 fill-current" />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-zinc-100 group-hover:text-white transition-colors">{fold.name}</h3>
                  <p className="text-xs text-zinc-400 font-medium">{count} {count === 1 ? 'song' : 'songs'}</p>
                </div>
              </button>

              {/* Folder Quick Action Bar */}
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handlePlayFolder(fold, true)}
                  className="p-2 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all"
                  title="Shuffle folder"
                >
                  <Shuffle className="w-4 h-4" />
                </button>
                <div className="relative">
                  <button
                    onClick={() => setShowPlaylistSelector(showPlaylistSelector === fold.fullPath ? null : fold.fullPath)}
                    className="p-2 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition-all"
                    title="Add folder to playlist"
                  >
                    <FolderPlus className="w-4 h-4" />
                  </button>

                  {/* Playlist Selector Popover */}
                  {showPlaylistSelector === fold.fullPath && (
                    <div className={`absolute right-0 mt-2 w-52 rounded-xl p-2 z-40 shadow-2xl animate-fade-in text-xs border ${
                      isLight 
                        ? 'bg-white border-zinc-200 text-zinc-800' 
                        : 'bg-zinc-900 border-zinc-800 text-zinc-200'
                    }`}>
                      <span className={`block px-2.5 py-1 font-bold uppercase text-[9px] border-b mb-1.5 ${
                        isLight ? 'text-zinc-500 border-zinc-100' : 'text-zinc-500 border-zinc-800'
                      }`}>
                        Add to playlist
                      </span>
                      {playlists.length === 0 ? (
                        <span className={`block p-2 text-center ${isLight ? 'text-zinc-400' : 'text-zinc-500'}`}>No custom playlists created</span>
                      ) : (
                        playlists.map((pl) => (
                          <button
                            key={pl.id}
                            onClick={() => handleAddFolderToPlaylist(fold, pl.id)}
                            className={`w-full text-left px-2.5 py-2 rounded-lg transition-colors truncate block font-medium ${
                              isLight 
                                ? 'hover:bg-zinc-100 text-zinc-800' 
                                : 'hover:bg-zinc-800 text-zinc-200'
                            }`}
                          >
                            {pl.name}
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {/* Listed Audio Files */}
        {filesAtLevel.map((file) => (
          <div
            key={file.id}
            className="flex items-center justify-between p-3.5 bg-zinc-950/40 hover:bg-zinc-900/50 rounded-xl transition-all border border-zinc-900/40 hover:border-zinc-800 group"
          >
            <button
              onClick={() => onPlaySong(file)}
              className="flex-1 flex items-center gap-3.5 text-left overflow-hidden mr-4"
            >
              <SongCover song={file} className="w-11 h-11 rounded-md shrink-0 shadow-sm" size="sm" />
              <div className="truncate">
                <h4 className="font-bold text-sm text-zinc-100 group-hover:text-white transition-colors truncate">{file.title}</h4>
                <p className="text-xs text-zinc-400 truncate mt-0.5 font-medium">
                  {file.artist} • <span className="font-mono">{Math.floor(file.duration / 60)}:{(file.duration % 60).toString().padStart(2, '0')}</span> • {file.fileSize ? `${file.fileSize} MB` : 'Offline Link'}
                </p>
              </div>
            </button>

            {/* Quick single song add to playlist */}
            <button
              onClick={() => onAddToPlaylist(file)}
              className="p-2 rounded-full text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors shrink-0"
              title="Add song to playlist"
            >
              <Plus className="w-5 h-5" />
            </button>
          </div>
        ))}

        {foldersAtLevel.length === 0 && filesAtLevel.length === 0 && (
          <div className="py-16 text-center text-zinc-500">
            <Folder className="w-10 h-10 stroke-1 mx-auto text-zinc-700" />
            <p className="text-zinc-400 text-xs mt-3 font-semibold">This folder is empty</p>
            <p className="text-zinc-650 text-[10px] mt-1">Upload music files or rebuild database settings</p>
          </div>
        )}
      </div>

      {/* Storage Specs footer info */}
      <div className="p-3 bg-black border-t border-zinc-900 flex items-center justify-between text-[10px] text-zinc-500">
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className="w-3.5 h-3.5 text-zinc-450" />
          <span>Device storage mounted successfully</span>
        </div>
        <span className="font-mono uppercase text-gray-600">EMULATED SD-CARD</span>
      </div>

    </div>
  );
}
