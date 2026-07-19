/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Song {
  id: string;
  title: string;
  artist: string;
  album: string;
  genre: string;
  year?: number;
  trackNumber?: number;
  duration: number; // in seconds
  fileSize?: number; // in MB
  path: string; // e.g., "Internal Storage/Music/Song.mp3"
  isFavorite: boolean;
  playCount: number;
  dateAdded: number; // timestamp
  isProcedural: boolean; // if generated via Web Audio API
  proceduralType?: 'lofi' | 'synthwave' | 'ambient' | 'piano' | 'electro';
  artworkSeed: string; // seed for generating gorgeous dynamic visual cover
  audioUrl?: string; // object URL for uploaded files
  coverUrl?: string; // object URL for loaded cover arts
}

export interface Playlist {
  id: string;
  name: string;
  description?: string;
  songIds: string[];
  isSmart: boolean;
  smartType?: 'favorites' | 'recently-played' | 'recently-added';
  dateCreated: number;
}

export interface PlaybackHistory {
  id: string;
  songId: string;
  playedAt: number; // timestamp
}

export interface EqualizerSettings {
  enabled: boolean;
  preset: string; // "Flat", "Rock", "Pop", "Jazz", etc.
  bands: number[]; // gain values in dB for frequencies e.g. 60Hz, 230Hz, 910Hz, 4kHz, 14kHz
  bassBoost: number; // 0 to 100
  virtualizer: number; // 0 to 100
  loudness: number; // 0 to 100
}

export type ThemeType = 'light' | 'dark' | 'amoled' | 'dynamic';
export type AccentColor = 'blue' | 'green' | 'peach' | 'violet' | 'gold';
export type IconShape = 'round' | 'squircle' | 'teardrop' | 'leaf';

export interface AppSettings {
  // Library settings
  autoScan: boolean;
  scanOnStartup: boolean;
  ignoreShortAudio: boolean; // ignore files < 30 seconds
  excludedFolders: string[];
  
  // Playback settings
  resumePlayback: boolean;
  rememberQueue: boolean;
  audioFocus: boolean;
  headphoneUnplugPause: boolean;
  crossfadeDuration: number; // in seconds (0 to 10)
  monoMode: boolean;
  channelBalance: number; // -1 (Left) to +1 (Right)
  playbackSpeed: number; // 0.5 to 2.0
  pitchAdjust: boolean;
  
  // Display settings
  theme: ThemeType;
  accentColor: AccentColor;
  iconShape: IconShape;
  fontScale: number; // 0.8 to 1.4
  artworkBlur: number; // 0 to 40 px
  animationsEnabled: boolean;
}

export interface FolderNode {
  name: string;
  path: string;
  type: 'folder' | 'file';
  children?: FolderNode[];
  songId?: string; // if it's an audio file and scanned
}
