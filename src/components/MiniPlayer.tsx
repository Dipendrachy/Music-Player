/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState } from 'react';
import { Song } from '../types';
import { audioEngine } from '../services/audioEngine';
import { Play, Pause, SkipForward, Heart } from 'lucide-react';
import { offlineDb } from '../services/db';
import { getArtworkColors } from '../data/defaultSongs';
import SongCover from './SongCover';

interface MiniPlayerProps {
  currentSong: Song;
  playbackState: 'playing' | 'paused' | 'stopped';
  onExpand: () => void;
  onRefresh: () => void;
  isLight?: boolean;
}

export default function MiniPlayer({ currentSong, playbackState, onExpand, onRefresh, isLight }: MiniPlayerProps) {
  const [progressPercent, setProgressPercent] = useState(0);
  const [isFav, setIsFav] = useState(currentSong.isFavorite);

  useEffect(() => {
    setIsFav(currentSong.isFavorite);
    
    // Subscribe to time updates to refresh the mini timeline bar
    const unsubscribe = audioEngine.onTimeUpdate((time) => {
      if (currentSong.duration > 0) {
        setProgressPercent((time / currentSong.duration) * 100);
      }
    });

    return () => unsubscribe();
  }, [currentSong]);

  const handlePlayPause = (e: React.MouseEvent) => {
    e.stopPropagation(); // prevent expanding the player
    if (playbackState === 'playing') {
      audioEngine.pause();
    } else {
      audioEngine.play();
    }
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    audioEngine.next();
  };

  const handleFavoriteToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = { ...currentSong, isFavorite: !currentSong.isFavorite };
    offlineDb.updateSong(updated);
    audioEngine.updateSongInQueue(updated);
    setIsFav(updated.isFavorite);
    onRefresh();
  };

  const colors = getArtworkColors(currentSong.artworkSeed || currentSong.id || 'default-art');

  return (
    <div
       onClick={onExpand}
      className="absolute bottom-16 left-1 right-1 h-[64px] flex flex-col justify-between overflow-hidden cursor-pointer select-none z-30 rounded-md"
      style={{
        background: isLight
          ? `linear-gradient(135deg, ${colors.from.replace('hsl', 'hsla').replace(')', ', 0.16)')}, ${colors.to.replace('hsl', 'hsla').replace(')', ', 0.26)')}), #f4f4f5`
          : `linear-gradient(135deg, ${colors.from.replace('hsl', 'hsla').replace(')', ', 0.24)')}, ${colors.to.replace('hsl', 'hsla').replace(')', ', 0.36)')}), #090a0e`
      }}
    >
      <div className="flex-1 flex items-center justify-between px-3.5">
        
        {/* Left: Artwork and title */}
        <div className="flex items-center gap-3 overflow-hidden flex-1 min-w-0 mr-2">
          <SongCover 
            song={currentSong} 
            className="w-10 h-10 rounded-sm shrink-0" 
            size="sm" 
          />
          <div className="truncate flex-1 min-w-0">
            <h4 className="font-semibold text-xs truncate pr-1 dynamic-text-title">
              {currentSong.title}
            </h4>
            <p className="text-[10px] truncate mt-0.5 dynamic-text-artist">
              {currentSong.artist}
            </p>
          </div>
        </div>

        {/* Right: Quick media control triggers */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={handleFavoriteToggle}
            className={`p-2 rounded-full transition-colors ${
              isLight 
                ? 'hover:bg-zinc-200/50 text-zinc-500 hover:text-zinc-800' 
                : 'hover:bg-zinc-800/50 text-zinc-400 hover:text-zinc-200'
            } ${isFav ? (isLight ? 'text-zinc-900' : 'text-white') : ''}`}
          >
            <Heart className={`w-4 h-4 ${isFav ? (isLight ? 'fill-zinc-900 text-zinc-900' : 'fill-white text-white') : ''}`} />
          </button>
          
          <button
            onClick={handlePlayPause}
            className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 shadow-md hover:scale-105 active:scale-95 transition-all ${
              isLight 
                ? 'bg-zinc-900 hover:bg-zinc-800 text-white' 
                : 'bg-white hover:bg-zinc-100 text-zinc-900'
            }`}
          >
            {playbackState === 'playing' ? (
              <Pause className={`w-4 h-4 fill-current ${isLight ? 'text-white' : 'text-zinc-900'}`} />
            ) : (
              <Play className={`w-4 h-4 ml-0.5 fill-current ${isLight ? 'text-white' : 'text-zinc-900'}`} />
            )}
          </button>

          <button
            onClick={handleNext}
            className={`p-2 rounded-full transition-colors shrink-0 ${
              isLight 
                ? 'text-zinc-500 hover:text-zinc-800 hover:bg-zinc-200/50' 
                : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50'
            }`}
          >
            <SkipForward className="w-4 h-4 fill-current" />
          </button>
        </div>
      </div>

      {/* Progress Line bar with clean margins */}
      <div className="px-3.5">
        <div className={`w-full h-[2px] ${isLight ? 'bg-zinc-300/60' : 'bg-zinc-800/50'} relative rounded-full overflow-hidden`}>
          <div
            className="h-full transition-all duration-300"
            style={{ 
              width: `${progressPercent}%`,
              backgroundColor: isLight ? '#18181b' : '#FFFFFF'
            }}
          />
        </div>
      </div>

    </div>
  );
}
