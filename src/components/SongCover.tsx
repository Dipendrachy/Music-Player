/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Song } from '../types';
import { fileStorage } from '../services/db';
import { getArtworkColors } from '../data/defaultSongs';
import { Music } from 'lucide-react';

interface SongCoverProps {
  key?: string | number;
  song: Song | null;
  className?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  noAmbient?: boolean;
  isPlayerView?: boolean;
}

const coverCache = new Map<string, string>();

export function updateCoverCache(songId: string, url: string | null) {
  if (url) {
    coverCache.set(songId, url);
  } else {
    coverCache.set(songId, 'none');
  }
  window.dispatchEvent(new CustomEvent('song-cover-updated', { detail: { songId, url } }));
}

export default function SongCover({ 
  song, 
  className = '', 
  size = 'md', 
  noAmbient = false, 
  isPlayerView = false 
}: SongCoverProps) {
  const [coverUrl, setCoverUrl] = useState<string | null>(null);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    if (!song) return;
    const handleCoverUpdated = (e: Event) => {
      const customEvent = e as CustomEvent<{ songId: string; url: string | null }>;
      if (customEvent.detail.songId === song.id) {
        setImgError(false);
        setCoverUrl(customEvent.detail.url);
        (song as any).coverUrl = customEvent.detail.url || 'none';
      }
    };
    window.addEventListener('song-cover-updated', handleCoverUpdated);
    return () => {
      window.removeEventListener('song-cover-updated', handleCoverUpdated);
    };
  }, [song?.id]);

  useEffect(() => {
    setImgError(false);
    if (!song) {
      setCoverUrl(null);
      return;
    }
    if (song.isProcedural) {
      setCoverUrl(null);
      return;
    }
    
    // Check in-memory property
    const songWithCover = song as any;
    if (songWithCover.coverUrl) {
      if (songWithCover.coverUrl === 'none') {
        setCoverUrl(null);
      } else {
        setCoverUrl(songWithCover.coverUrl);
      }
      return;
    }
    if (coverCache.has(song.id)) {
      const cached = coverCache.get(song.id);
      setCoverUrl(cached || null);
      return;
    }

    let isMounted = true;
    async function loadCover() {
      try {
        const blob = await fileStorage.getFile(song.id + '-cover');
        if (blob) {
          const url = URL.createObjectURL(blob);
          // Cache in memory and cache map
          songWithCover.coverUrl = url;
          coverCache.set(song.id, url);
          if (isMounted) {
            setCoverUrl(url);
          }
        } else {
          songWithCover.coverUrl = 'none';
          coverCache.set(song.id, null);
          if (isMounted) {
            setCoverUrl(null);
          }
        }
      } catch (e) {
        console.error("Error loading cached cover art from IndexedDB:", e);
        songWithCover.coverUrl = 'none';
        coverCache.set(song.id, null);
        if (isMounted) {
          setCoverUrl(null);
        }
      }
    }
    loadCover();

    return () => {
      isMounted = false;
    };
  }, [song?.id, song?.isProcedural, (song as any)?.coverUrl]);

  if (!song) {
    return (
      <div className={`bg-zinc-900 border border-zinc-850 flex items-center justify-center text-zinc-650 ${className}`}>
        <Music className="w-1/3 h-1/3 stroke-[1.5]" />
      </div>
    );
  }

  // Use the gorgeous procedural gradient based on artworkSeed
  const colors = getArtworkColors(song.artworkSeed || song.id || 'default-art');
  const initials = song.title ? song.title.substring(0, 2).toUpperCase() : 'MU';

  return (
    <div
      className={`relative overflow-hidden flex flex-col items-center justify-center text-white/90 font-extrabold select-none border border-zinc-800/30 ${className}`}
      style={{
        background: '#101012'
      }}
    >
      {/* Decorative vinyl/waveform lines for a premium, music-related feel */}
      {isPlayerView && (
        <div className={`absolute inset-0 flex items-center justify-center pointer-events-none ${noAmbient ? 'opacity-5' : 'opacity-15'}`}>
          <div className="w-[85%] h-[85%] rounded-full border border-white" />
          <div className="w-[65%] h-[65%] rounded-full border border-white" />
          <div className="w-[45%] h-[45%] rounded-full border border-white" />
        </div>
      )}
      
      {/* Dynamic letter initials inside for visual identity matching the specific song */}
      {size === 'xl' ? (
        <div className="z-10 flex flex-col items-center text-center px-4 space-y-3.5">
          <div className="w-16 h-16 rounded-full bg-black/25 flex items-center justify-center backdrop-blur-sm border border-white/5 shadow-inner">
            <Music className="w-6.5 h-6.5 text-white/80" />
          </div>
          <div className="space-y-0.5">
            <span className="text-[28px] font-black tracking-tight drop-shadow-md text-white block">{initials}</span>
            {song.genre && song.genre !== 'Offline Media' && song.genre !== 'Offline' && (
              <span className="text-[9px] font-mono font-bold tracking-widest text-white/50 uppercase block">{song.genre}</span>
            )}
          </div>
        </div>
      ) : size === 'lg' ? (
        <span className="z-10 text-base tracking-tight drop-shadow">{initials}</span>
      ) : size === 'sm' ? (
        <span className="z-10 text-[9.5px] font-black tracking-tighter drop-shadow text-white/85">{initials}</span>
      ) : (
        <span className="z-10 text-xs tracking-tight drop-shadow text-white/90">{initials}</span>
      )}

      {/* Render cover image on top if available and no loading error */}
      {coverUrl && !imgError && (
        <img
          src={coverUrl}
          alt={song.title}
          className="absolute inset-0 w-full h-full object-cover z-20 animate-fade-in"
          referrerPolicy="no-referrer"
          onError={() => setImgError(true)}
        />
      )}
    </div>
  );
}
