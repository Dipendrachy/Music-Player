/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Song, Playlist, PlaybackHistory, AppSettings, EqualizerSettings } from '../types';
import { DEFAULT_SONGS } from '../data/defaultSongs';

const SONGS_KEY = 'offline_player_songs';
const PLAYLISTS_KEY = 'offline_player_playlists';
const HISTORY_KEY = 'offline_player_history';
const SETTINGS_KEY = 'offline_player_settings';
const EQ_KEY = 'offline_player_equalizer';

const DEFAULT_SETTINGS: AppSettings = {
  autoScan: true,
  scanOnStartup: true,
  ignoreShortAudio: true,
  excludedFolders: [],
  resumePlayback: true,
  rememberQueue: true,
  audioFocus: true,
  headphoneUnplugPause: true,
  crossfadeDuration: 2,
  monoMode: false,
  channelBalance: 0,
  playbackSpeed: 1.0,
  pitchAdjust: false,
  theme: 'dynamic',
  accentColor: 'blue',
  iconShape: 'round',
  fontScale: 1.0,
  artworkBlur: 24,
  animationsEnabled: true,
};

const DEFAULT_EQ: EqualizerSettings = {
  enabled: true,
  preset: 'Flat',
  bands: [0, 0, 0, 0, 0], // 60Hz, 230Hz, 910Hz, 4kHz, 14kHz
  bassBoost: 0,
  virtualizer: 0,
  loudness: 0,
};

// Simple helper to safely parse JSON
function safeParse<T>(key: string, defaultValue: T): T {
  try {
    const item = localStorage.getItem(key);
    return item ? JSON.parse(item) : defaultValue;
  } catch (e) {
    console.error(`Error parsing key "${key}" from localStorage:`, e);
    return defaultValue;
  }
}

// Simple IndexedDB service to store real audio file BLOBs offline
class FileStorageDB {
  private dbName = 'OfflineMusicPlayerFiles';
  private storeName = 'audioFiles';
  private dbPromise: Promise<IDBDatabase> | null = null;

  constructor() {
    if (typeof window !== 'undefined') {
      this.dbPromise = this.initDB();
    }
  }

  private initDB(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(this.storeName)) {
          db.createObjectStore(this.storeName);
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  public async saveFile(songId: string, fileBlob: Blob): Promise<void> {
    const db = await this.dbPromise;
    if (!db) return;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.put(fileBlob, songId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  public async getFile(songId: string): Promise<Blob | null> {
    const db = await this.dbPromise;
    if (!db) return null;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readonly');
      const store = transaction.objectStore(this.storeName);
      const request = store.get(songId);
      request.onsuccess = () => resolve(request.result || null);
      request.onerror = () => reject(request.error);
    });
  }

  public async deleteFile(songId: string): Promise<void> {
    const db = await this.dbPromise;
    if (!db) return;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.delete(songId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  public async clear(): Promise<void> {
    const db = await this.dbPromise;
    if (!db) return;
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(this.storeName, 'readwrite');
      const store = transaction.objectStore(this.storeName);
      const request = store.clear();
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

export const fileStorage = new FileStorageDB();

export const offlineDb = {
  // Songs
  getSongs(): Song[] {
    const songs = safeParse<Song[]>(SONGS_KEY, []);
    if (songs.length === 0) {
      // First time initialization
      this.saveSongs(DEFAULT_SONGS);
      return DEFAULT_SONGS;
    }
    return songs;
  },

  saveSongs(songs: Song[]): void {
    localStorage.setItem(SONGS_KEY, JSON.stringify(songs));
  },

  addSong(song: Song): void {
    const songs = this.getSongs();
    songs.push(song);
    this.saveSongs(songs);
  },

  deleteSong(songId: string): void {
    const songs = this.getSongs().filter((s) => s.id !== songId);
    this.saveSongs(songs);
    fileStorage.deleteFile(songId).catch(console.error);
    
    // Also remove from playlists
    const playlists = this.getPlaylists();
    let updated = false;
    playlists.forEach((p) => {
      if (p.songIds.includes(songId)) {
        p.songIds = p.songIds.filter((id) => id !== songId);
        updated = true;
      }
    });
    if (updated) {
      this.savePlaylists(playlists);
    }
  },

  updateSong(updatedSong: Song): void {
    const songs = this.getSongs().map((s) => (s.id === updatedSong.id ? updatedSong : s));
    this.saveSongs(songs);
  },

  // Playlists
  getPlaylists(): Playlist[] {
    let playlists = safeParse<Playlist[]>(PLAYLISTS_KEY, []);
    playlists = playlists.filter((p) => (p.smartType as string) !== 'most-played');
    
    if (playlists.length === 0) {
      // Create default smart playlists
      playlists = [
        {
          id: 'smart-favorites',
          name: 'Favorites',
          description: 'Your favorite songs, automatically compiled',
          songIds: [],
          isSmart: true,
          smartType: 'favorites',
          dateCreated: Date.now(),
        },
        {
          id: 'smart-recently-played',
          name: 'Recently Played',
          description: 'Recently listened tracks',
          songIds: [],
          isSmart: true,
          smartType: 'recently-played',
          dateCreated: Date.now(),
        },
        {
          id: 'smart-recently-added',
          name: 'Recently Added',
          description: 'Freshly scanned additions to your collection',
          songIds: [],
          isSmart: true,
          smartType: 'recently-added',
          dateCreated: Date.now(),
        },
      ];
      this.savePlaylists(playlists);
    }
    return playlists;
  },

  savePlaylists(playlists: Playlist[]): void {
    localStorage.setItem(PLAYLISTS_KEY, JSON.stringify(playlists));
  },

  createPlaylist(name: string, description?: string): Playlist {
    const playlists = this.getPlaylists();
    const newPlaylist: Playlist = {
      id: `playlist-${Date.now()}`,
      name,
      description,
      songIds: [],
      isSmart: false,
      dateCreated: Date.now(),
    };
    playlists.push(newPlaylist);
    this.savePlaylists(playlists);
    return newPlaylist;
  },

  // History
  getHistory(): PlaybackHistory[] {
    return safeParse<PlaybackHistory[]>(HISTORY_KEY, []);
  },

  addHistoryEntry(songId: string): void {
    const history = this.getHistory();
    const entry: PlaybackHistory = {
      id: `history-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      songId,
      playedAt: Date.now(),
    };
    
    // Maintain maximum of 200 history records
    history.unshift(entry);
    if (history.length > 200) {
      history.pop();
    }
    localStorage.setItem(HISTORY_KEY, JSON.stringify(history));

    // Update song play count and last played
    const songs = this.getSongs();
    const index = songs.findIndex((s) => s.id === songId);
    if (index !== -1) {
      songs[index].playCount += 1;
      this.updateSong(songs[index]);
    }
  },

  clearHistory(): void {
    localStorage.setItem(HISTORY_KEY, '[]');
    // Reset play counts
    const songs = this.getSongs();
    songs.forEach((s) => (s.playCount = 0));
    this.saveSongs(songs);
  },

  // Settings
  getSettings(): AppSettings {
    return safeParse<AppSettings>(SETTINGS_KEY, DEFAULT_SETTINGS);
  },

  saveSettings(settings: AppSettings): void {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  },

  // Equalizer
  getEqualizer(): EqualizerSettings {
    return safeParse<EqualizerSettings>(EQ_KEY, DEFAULT_EQ);
  },

  saveEqualizer(eq: EqualizerSettings): void {
    localStorage.setItem(EQ_KEY, JSON.stringify(eq));
  },

  // Database actions
  rebuildLibrary(): void {
    // Keep user's custom playlists but reset songs to defaults
    this.saveSongs(DEFAULT_SONGS);
    localStorage.setItem(HISTORY_KEY, '[]');
    fileStorage.clear().catch(console.error);
    
    // Clear custom songs from playlists
    const playlists = this.getPlaylists();
    playlists.forEach((p) => {
      p.songIds = p.songIds.filter((id) => id.startsWith('procedural-'));
    });
    this.savePlaylists(playlists);
  },

  exportBackup(): string {
    const backup = {
      songs: this.getSongs().map(s => ({ ...s, audioUrl: undefined })), // strip temp object urls
      playlists: this.getPlaylists(),
      history: this.getHistory(),
      settings: this.getSettings(),
      eq: this.getEqualizer(),
      version: 1,
    };
    return JSON.stringify(backup);
  },

  importBackup(backupStr: string): boolean {
    try {
      const backup = JSON.parse(backupStr);
      if (backup.songs && Array.isArray(backup.songs)) {
        this.saveSongs(backup.songs);
      }
      if (backup.playlists && Array.isArray(backup.playlists)) {
        this.savePlaylists(backup.playlists);
      }
      if (backup.history && Array.isArray(backup.history)) {
        localStorage.setItem(HISTORY_KEY, JSON.stringify(backup.history));
      }
      if (backup.settings) {
        this.saveSettings({ ...DEFAULT_SETTINGS, ...backup.settings });
      }
      if (backup.eq) {
        this.saveEqualizer({ ...DEFAULT_EQ, ...backup.eq });
      }
      return true;
    } catch (e) {
      console.error('Error importing backup:', e);
      return false;
    }
  }
};
