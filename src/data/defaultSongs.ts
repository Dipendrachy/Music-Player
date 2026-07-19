/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Song } from '../types';

export const DEFAULT_SONGS: Song[] = [
  {
    id: 'procedural-lofi',
    title: 'Autumn Afternoons (Lofi Loop)',
    artist: 'The Offline Project',
    album: 'Ambient Escapes',
    genre: 'Lofi Hip-Hop',
    year: 2026,
    trackNumber: 1,
    duration: 180,
    fileSize: 4.1,
    path: 'Internal Storage/Music/Lofi/Autumn_Afternoons.mp3',
    isFavorite: true,
    playCount: 12,
    dateAdded: Date.now() - 15 * 24 * 3600 * 1000, // 15 days ago
    isProcedural: true,
    proceduralType: 'lofi',
    artworkSeed: 'autumn-lofi',
  },
  {
    id: 'procedural-synthwave',
    title: 'Neon Horizon (Synthwave)',
    artist: 'Vector Runner',
    album: 'Cybernetic Streets',
    genre: 'Synthwave',
    year: 2025,
    trackNumber: 3,
    duration: 210,
    fileSize: 4.8,
    path: 'Internal Storage/Music/Synthwave/Neon_Horizon.mp3',
    isFavorite: false,
    playCount: 28,
    dateAdded: Date.now() - 30 * 24 * 3600 * 1000, // 30 days ago
    isProcedural: true,
    proceduralType: 'synthwave',
    artworkSeed: 'neon-synth',
  },
  {
    id: 'procedural-ambient',
    title: 'Ethereal Space (Dreamscape)',
    artist: 'Cosmic Drift',
    album: 'Deep Sleep Drones',
    genre: 'Ambient',
    year: 2026,
    trackNumber: 12,
    duration: 300,
    fileSize: 6.8,
    path: 'Internal Storage/Music/Ambient/Ethereal_Space.mp3',
    isFavorite: false,
    playCount: 5,
    dateAdded: Date.now() - 5 * 24 * 3600 * 1000, // 5 days ago
    isProcedural: true,
    proceduralType: 'ambient',
    artworkSeed: 'ethereal-dream',
  },
  {
    id: 'procedural-piano',
    title: 'Melancholy Keys (Solo Piano)',
    artist: 'Clara Moreau',
    album: 'Nocturnes in the Dark',
    genre: 'Neo-Classical',
    year: 2024,
    trackNumber: 5,
    duration: 150,
    fileSize: 3.4,
    path: 'Internal Storage/Music/Classical/Melancholy_Keys.mp3',
    isFavorite: true,
    playCount: 19,
    dateAdded: Date.now() - 2 * 24 * 3600 * 1000, // 2 days ago
    isProcedural: true,
    proceduralType: 'piano',
    artworkSeed: 'melancholy-piano',
  },
  {
    id: 'procedural-electro',
    title: 'Pulse Generator (Electro)',
    artist: 'Frequency Modulator',
    album: 'Underground Beats',
    genre: 'Electronic',
    year: 2026,
    trackNumber: 8,
    duration: 160,
    fileSize: 3.7,
    path: 'SD Card/Music/Electronic/Pulse_Generator.wav',
    isFavorite: false,
    playCount: 3,
    dateAdded: Date.now() - 1 * 24 * 3600 * 1000, // 1 day ago
    isProcedural: true,
    proceduralType: 'electro',
    artworkSeed: 'pulse-electro',
  }
];

/**
 * Simple hash function to generate clean procedural colors from artworkSeed
 */
export function getArtworkColors(seed: string): { from: string; to: string; accent: string } {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  // Create 3 primary hue values based on the seed
  const hue1 = Math.abs(hash % 360);
  const hue2 = (hue1 + 40) % 360;
  const hueAccent = (hue1 + 180) % 360;
  
  return {
    from: `hsl(${hue1}, 65%, 40%)`,
    to: `hsl(${hue2}, 70%, 20%)`,
    accent: `hsl(${hueAccent}, 85%, 55%)`
  };
}
