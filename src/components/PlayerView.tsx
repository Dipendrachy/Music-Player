/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef } from 'react';
import { Song, AppSettings, EqualizerSettings } from '../types';
import { audioEngine } from '../services/audioEngine';
import { getArtworkColors } from '../data/defaultSongs';
import { offlineDb } from '../services/db';
import SongCover, { updateCoverCache } from './SongCover';
import WavySeekBar from './WavySeekBar';
import { 
  ChevronDown, Heart, Play, Pause, SkipBack, SkipForward, Shuffle, Repeat, 
  ListMusic, Moon, Gauge, VolumeX, Trash, RefreshCw, Layers, ArrowUp, ArrowDown, Sparkles, Music,
  Settings, X, Check, ToggleLeft, ToggleRight, Sliders, Volume2, Image
} from 'lucide-react';

interface PlayerViewProps {
  currentSong: Song;
  playbackState: 'playing' | 'paused' | 'stopped';
  onCollapse: () => void;
  onRefresh: () => void;
}

type PlayerBottomTab = 'queue' | 'lyrics' | 'fx';

export default function PlayerView({ currentSong, playbackState, onCollapse, onRefresh }: PlayerViewProps) {
  const [currentTime, setCurrentTime] = useState(0);
  const [isFav, setIsFav] = useState(currentSong.isFavorite);
  const [activeTab, setActiveTab] = useState<PlayerBottomTab>('queue');
  const [queue, setQueue] = useState<Song[]>([]);
  const [currentIndex, setCurrentIndex] = useState(-1);
  const [shuffleMode, setShuffleMode] = useState(false);
  const [repeatMode, setRepeatMode] = useState<'off' | 'all' | 'one'>('off');
  
  // Timer & FX settings
  const [sleepTimerRemaining, setSleepTimerRemaining] = useState(0);
  const [playbackSpeed, setPlaybackSpeed] = useState(1.0);
  const [pitchAdjust, setPitchAdjust] = useState(false);

  const [showSettingsOverlay, setShowSettingsOverlay] = useState(false);
  const [eq, setEq] = useState<EqualizerSettings>(() => offlineDb.getEqualizer());
  const [appSettingsState, setAppSettingsState] = useState<AppSettings>(() => offlineDb.getSettings());
  const [ambientCoverUrl, setAmbientCoverUrl] = useState<string | null>(null);

  // References
  const visualizerCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameIdRef = useRef<number | null>(null);
  const imageInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!currentSong) {
      setAmbientCoverUrl(null);
      return;
    }
    if (currentSong.isProcedural) {
      setAmbientCoverUrl(null);
      return;
    }
    const songWithCover = currentSong as any;
    if (songWithCover.coverUrl) {
      if (songWithCover.coverUrl === 'none') {
        setAmbientCoverUrl(null);
      } else {
        setAmbientCoverUrl(songWithCover.coverUrl);
      }
      return;
    }

    let isMounted = true;
    async function loadAmbientCover() {
      try {
        const { fileStorage: fs } = await import('../services/db');
        const blob = await fs.getFile(currentSong.id + '-cover');
        if (blob && isMounted) {
          const url = URL.createObjectURL(blob);
          songWithCover.coverUrl = url;
          setAmbientCoverUrl(url);
        } else {
          songWithCover.coverUrl = 'none';
          if (isMounted) {
            setAmbientCoverUrl(null);
          }
        }
      } catch (err) {
        console.error("Error loading ambient cover:", err);
        songWithCover.coverUrl = 'none';
        if (isMounted) setAmbientCoverUrl(null);
      }
    }
    loadAmbientCover();
    return () => {
      isMounted = false;
    };
  }, [currentSong?.id]);

  useEffect(() => {
    setIsFav(currentSong.isFavorite);
    setQueue(audioEngine.getQueue());
    setCurrentIndex(audioEngine.getCurrentIndex());
    setShuffleMode(audioEngine.getShuffle());
    setRepeatMode(audioEngine.getRepeat());
    
    const settings = offlineDb.getSettings();
    setPlaybackSpeed(settings.playbackSpeed);
    setPitchAdjust(settings.pitchAdjust);
    setAppSettingsState(settings);
    setEq(offlineDb.getEqualizer());

    // Subscribe to progress changes
    const unsubTime = audioEngine.onTimeUpdate((time) => {
      setCurrentTime(time);
    });

    // Subscribe to state change
    const unsubState = audioEngine.onStateChange(() => {
      setQueue(audioEngine.getQueue());
      setCurrentIndex(audioEngine.getCurrentIndex());
      setShuffleMode(audioEngine.getShuffle());
      setRepeatMode(audioEngine.getRepeat());
      setSleepTimerRemaining(audioEngine.getSleepTimerRemaining());
    });

    // Start Real-Time Sound visualizer rendering loop
    startVisualizer();

    return () => {
      unsubTime();
      unsubState();
      stopVisualizer();
    };
  }, [currentSong]);

  // Audio Visualizer loop using Canvas & Analyser
  const startVisualizer = () => {
    stopVisualizer();
    const canvas = visualizerCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const colors = getArtworkColors(currentSong.artworkSeed || currentSong.id || 'default-art');

    const render = () => {
      const data = audioEngine.getAnalyserData();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      
      if (data.length === 0) {
        // Draw static wave placeholder if stopped or no context active
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(0, canvas.height / 2);
        ctx.lineTo(canvas.width, canvas.height / 2);
        ctx.stroke();
        animationFrameIdRef.current = requestAnimationFrame(render);
        return;
      }

      const barWidth = (canvas.width / data.length) * 1.5;
      let barHeight;
      let x = 0;

      for (let i = 0; i < data.length; i++) {
        barHeight = (data[i] / 255) * canvas.height * 0.9;

        // Gradient based on monochrome white
        const grad = ctx.createLinearGradient(0, canvas.height, 0, canvas.height - barHeight);
        grad.addColorStop(0, 'rgba(255, 255, 255, 0.15)');
        grad.addColorStop(1, 'rgba(255, 255, 255, 0.85)');

        ctx.fillStyle = grad;
        // rounded bar rectangle
        ctx.fillRect(x, canvas.height - barHeight, barWidth - 1.5, barHeight);

        x += barWidth;
      }

      animationFrameIdRef.current = requestAnimationFrame(render);
    };

    render();
  };

  const stopVisualizer = () => {
    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
      animationFrameIdRef.current = null;
    }
  };

  const handlePlayPause = () => {
    if (playbackState === 'playing') {
      audioEngine.pause();
    } else {
      audioEngine.play();
    }
  };

  const handleSeekChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    audioEngine.seek(Number(e.target.value));
  };

  const handleFavoriteToggle = () => {
    const updated = { ...currentSong, isFavorite: !currentSong.isFavorite };
    offlineDb.updateSong(updated);
    audioEngine.updateSongInQueue(updated);
    setIsFav(updated.isFavorite);
    onRefresh();
  };

  const handleImageUploadClick = () => {
    imageInputRef.current?.click();
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const { fileStorage: fs } = await import('../services/db');
      // Save file to IndexedDB
      await fs.saveFile(currentSong.id + '-cover', file);

      // Create object URL for immediate display
      const newUrl = URL.createObjectURL(file);
      
      // Update in-memory property so SongCover updates immediately
      const songWithCover = currentSong as any;
      songWithCover.coverUrl = newUrl;

      // Update the global cover cache and trigger components re-render
      updateCoverCache(currentSong.id, newUrl);

      // Update local state for ambient cover
      setAmbientCoverUrl(newUrl);

      // Refresh parent to propagate the new cover image
      onRefresh();
    } catch (err) {
      console.error("Error saving song cover:", err);
    }
  };

  const handleSpeedChange = (speed: number) => {
    setPlaybackSpeed(speed);
    handleAppSettingChange('playbackSpeed', speed);
  };

  const handleSleepTimerSelect = (mins: number | 'end-of-song') => {
    audioEngine.setSleepTimer(mins);
  };

  const handleAppSettingChange = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    const settings = offlineDb.getSettings();
    settings[key] = value;
    offlineDb.saveSettings(settings);
    setAppSettingsState(settings);
    audioEngine.applySettingsFromDb();
  };

  const handleEqChange = (updated: EqualizerSettings) => {
    setEq(updated);
    offlineDb.saveEqualizer(updated);
    audioEngine.applyEqualizerFromDb();
  };

  const handleRemoveFromQueue = (songId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    audioEngine.removeFromQueue(songId);
  };

  const handleMoveQueueItem = (index: number, direction: 'up' | 'down') => {
    audioEngine.reorderQueue(index, direction === 'up' ? index - 1 : index + 1);
  };

  const handleSaveQueueAsPlaylist = () => {
    if (queue.length === 0) return;
    const name = prompt('Enter name for the new Playlist:');
    if (!name?.trim()) return;

    const pl = offlineDb.createPlaylist(name.trim(), 'Saved queue snapshot');
    const playlists = offlineDb.getPlaylists();
    const idx = playlists.findIndex(p => p.id === pl.id);
    if (idx !== -1) {
      playlists[idx].songIds = queue.map(s => s.id);
      offlineDb.savePlaylists(playlists);
      onRefresh();
      alert('Queue saved as custom playlist successfully!');
    }
  };

  // Format seconds to MM:SS
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const colors = getArtworkColors(currentSong.artworkSeed || currentSong.id || 'default-art');
  const appSettings = offlineDb.getSettings();
  const isLight = appSettings.theme === 'light';

  // Setup artwork corner class based on settings
  const getIconShapeCss = () => {
    if (appSettings.iconShape === 'squircle') return 'rounded-[32px]';
    if (appSettings.iconShape === 'teardrop') return 'rounded-tr-[80px] rounded-bl-[80px] rounded-tl-2xl rounded-br-2xl';
    if (appSettings.iconShape === 'leaf') return 'rounded-tl-[80px] rounded-br-[80px] rounded-tr-xl rounded-bl-xl';
    return 'rounded-full'; // round
  };

  return (
    <div className={`absolute inset-0 ${isLight ? 'bg-white text-zinc-900' : 'bg-[#030303] text-zinc-300'} z-50 flex flex-col justify-between overflow-hidden animate-slide-up select-none`}>
      
      {/* High-fidelity dynamic ambient background underlay (only rendered in dark/amoled mode to prevent light mode blur and oversaturation) */}
      {!isLight && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 select-none bg-[#030303]">
          <div className="absolute inset-0 transition-all duration-1000 ease-out scale-150 transform">
            {/* Animated dynamic gradient clouds blending dominant hues */}
            <div 
              className="absolute inset-0 opacity-[0.60] animate-pulse-glow"
              style={{
                background: `radial-gradient(circle at 25% 25%, ${colors.from} 0%, transparent 70%),
                             radial-gradient(circle at 75% 75%, ${colors.to} 0%, transparent 75%),
                             radial-gradient(circle at 50% 50%, ${colors.accent || colors.from} 0%, transparent 65%)`,
                filter: `blur(${appSettings.artworkBlur || 90}px) saturate(1.8) brightness(0.85)`,
              }}
            />

            {/* Seamless blending of actual album artwork for direct color accuracy */}
            {ambientCoverUrl && (
              <div className="absolute inset-0 transition-opacity duration-1000 opacity-[0.42]">
                <img
                  src={ambientCoverUrl}
                  alt=""
                  className="w-full h-full object-cover select-none pointer-events-none"
                  style={{
                    filter: `blur(${appSettings.artworkBlur || 90}px) saturate(1.7) brightness(0.8)`,
                  }}
                />
              </div>
            )}
          </div>

          {/* Soft elegant gradient overlays at bottom/top for legibility without darkening the center artwork area */}
          <div className="absolute inset-0 bg-gradient-to-t from-[#030303] via-transparent to-transparent opacity-95 z-1" />
          <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-transparent opacity-80 z-1" />
        </div>
      )}

      {/* Header bar */}
      <div className={`w-full px-5 py-3.5 flex items-center justify-between z-10 bg-gradient-to-b ${isLight ? 'from-white/80 to-transparent' : 'from-black/80 to-transparent'}`}>
        <button
          onClick={onCollapse}
          className={`p-1.5 rounded-full hover:${isLight ? 'bg-zinc-100' : 'bg-zinc-900'} ${isLight ? 'text-zinc-600 hover:text-zinc-900' : 'text-zinc-400 hover:text-white'} transition-colors`}
          title="Minimize player"
        >
          <ChevronDown className="w-6 h-6" />
        </button>
        <span className={`font-sans font-bold text-xs tracking-wider ${isLight ? 'text-zinc-500' : 'text-zinc-400'} uppercase`}>
          Now Playing
        </span>
        <button
          onClick={() => setShowSettingsOverlay(true)}
          className={`p-1.5 rounded-full hover:${isLight ? 'bg-zinc-100' : 'bg-zinc-900'} ${isLight ? 'text-zinc-600 hover:text-zinc-900' : 'text-zinc-400 hover:text-white'} transition-colors`}
          title="Playback & DSP Settings"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>

      {/* Middle Scrollable Section: Album Artwork + Metadata */}
      <div className="flex-1 flex flex-col items-center justify-center px-5 py-4 z-10 space-y-6 w-full">
        
        {/* Dynamic Album Artwork Container (Modern Square Thumbnail) */}
        <SongCover 
          song={currentSong} 
          className="w-full aspect-square rounded-lg border border-white/5" 
          size="xl" 
          noAmbient={true}
          isPlayerView={true}
        />

        {/* Song Info (Title, Artist) & Favorite Button */}
        <div className="w-full flex items-center justify-between gap-4 select-none">
          <div className="text-left space-y-0.5 min-w-0 flex-1 overflow-hidden">
            {currentSong.title.length > 22 ? (
              <div className="w-full overflow-hidden relative" style={{ maskImage: 'linear-gradient(to right, #000 88%, transparent)', WebkitMaskImage: 'linear-gradient(to right, #000 88%, transparent)' }}>
                <div className="flex w-max animate-marquee-smooth whitespace-nowrap">
                  <span className={`font-sans font-bold text-base ${isLight ? 'text-zinc-900' : 'text-zinc-100'} tracking-tight leading-snug pr-12`}>
                    {currentSong.title}
                  </span>
                  <span className={`font-sans font-bold text-base ${isLight ? 'text-zinc-900' : 'text-zinc-100'} tracking-tight leading-snug pr-12`}>
                    {currentSong.title}
                  </span>
                </div>
              </div>
            ) : (
              <h1 className={`font-sans font-bold text-base ${isLight ? 'text-zinc-900' : 'text-zinc-100'} tracking-tight leading-snug`}>
                {currentSong.title}
              </h1>
            )}
            <p className={`font-sans text-xs ${isLight ? 'text-zinc-600' : 'text-zinc-400'} font-medium truncate`}>
              {currentSong.artist} • <span className={`${isLight ? 'text-zinc-500' : 'text-zinc-500'} text-[11px] font-normal`}>{currentSong.album}</span>
            </p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {/* Add Image/Cover Art Button */}
            <button
              onClick={handleImageUploadClick}
              className={`p-2 rounded-full hover:${isLight ? 'bg-zinc-100' : 'bg-zinc-900'} ${isLight ? 'text-zinc-700 hover:text-zinc-900' : 'text-zinc-400 hover:text-white'} transition-colors`}
              title="Add image / Change cover art"
            >
              <Image className="w-5.5 h-5.5" />
            </button>
            <input 
              type="file"
              ref={imageInputRef}
              accept="image/*"
              className="hidden"
              onChange={handleImageChange}
            />

            {/* Favorite Button */}
            <button
              onClick={handleFavoriteToggle}
              className={`p-2 rounded-full hover:${isLight ? 'bg-zinc-100' : 'bg-zinc-900'} ${isLight ? 'text-zinc-700 hover:text-zinc-900' : 'text-zinc-400 hover:text-white'} transition-colors`}
              title={isFav ? "Remove from Favorites" : "Add to Favorites"}
            >
              <Heart className={`w-5.5 h-5.5 ${isFav ? (isLight ? 'fill-zinc-900 text-zinc-900' : 'fill-white text-white') : (isLight ? 'text-zinc-400 hover:text-zinc-900' : 'text-zinc-400 hover:text-white')}`} />
            </button>
          </div>
        </div>

        {/* Seeking Progress timeline slider (Android 14 Wavy SeekBar) */}
        <div className="w-full space-y-1 select-none">
          <WavySeekBar
            currentTime={currentTime}
            duration={currentSong.duration || 100}
            playbackState={playbackState}
            onSeek={(time) => audioEngine.seek(time)}
            color={isLight ? '#18181b' : '#ffffff'}
          />
          <div className={`flex justify-between text-[10px] font-mono font-bold ${isLight ? 'text-zinc-600' : 'text-zinc-500'} px-0.5 -mt-1`}>
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(currentSong.duration)}</span>
          </div>
        </div>

        {/* Core Media playback triggers */}
        <div className="flex items-center justify-between w-full max-w-[280px]">
          <button
            onClick={() => audioEngine.toggleShuffle()}
            className={`p-2 rounded-full transition-all ${
              shuffleMode ? 'scale-110' : (isLight ? 'text-zinc-600 hover:text-zinc-900' : 'text-zinc-400 hover:text-white')
            }`}
            style={shuffleMode ? { color: colors.accent, filter: `drop-shadow(0 0 8px ${colors.accent})` } : {}}
            title="Shuffle"
          >
            <Shuffle className="w-4.5 h-4.5" />
          </button>

          <button
            onClick={() => audioEngine.prev()}
            className={`p-2 ${isLight ? 'text-zinc-700 hover:text-zinc-900' : 'text-zinc-350 hover:text-white'} rounded-full transition-all active:scale-90`}
            title="Previous"
          >
            <SkipBack className="w-5 h-5 fill-current" />
          </button>

          {/* Large main play trigger */}
          <button
            onClick={handlePlayPause}
            className={`w-16 h-16 ${isLight ? 'bg-zinc-900 hover:bg-zinc-800 text-white shadow-md' : 'bg-white hover:bg-zinc-100 text-black'} rounded-full flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 transition-all`}
            title="Play/Pause"
          >
            {playbackState === 'playing' ? (
              <Pause className={`w-6 h-6 ${isLight ? 'fill-white text-white' : 'fill-black text-black'}`} />
            ) : (
              <Play className={`w-6 h-6 ${isLight ? 'fill-white text-white' : 'fill-black text-black'} ml-1`} />
            )}
          </button>

          <button
            onClick={() => audioEngine.next()}
            className={`p-2 ${isLight ? 'text-zinc-700 hover:text-zinc-900' : 'text-zinc-350 hover:text-white'} rounded-full transition-all active:scale-90`}
            title="Next"
          >
            <SkipForward className="w-5 h-5 fill-current" />
          </button>

          <button
            onClick={() => audioEngine.toggleRepeat()}
            className={`p-2 rounded-full transition-all relative ${
              repeatMode !== 'off' ? 'scale-110' : (isLight ? 'text-zinc-600 hover:text-zinc-900' : 'text-zinc-400 hover:text-white')
            }`}
            style={repeatMode !== 'off' ? { color: colors.accent, filter: `drop-shadow(0 0 8px ${colors.accent})` } : {}}
            title={`Repeat: ${repeatMode}`}
          >
            <Repeat className="w-4.5 h-4.5" />
            {repeatMode === 'one' && (
              <span className={`absolute -top-1 -right-1 text-[8px] ${isLight ? 'bg-zinc-900 text-white' : 'bg-white text-black'} rounded-full w-3.5 h-3.5 flex items-center justify-center font-mono font-extrabold shadow-sm`}>1</span>
            )}
          </button>
        </div>

      </div>

      {showSettingsOverlay && (
        <div className={`absolute inset-0 ${isLight ? 'bg-white text-zinc-800' : 'bg-black/95 text-zinc-300'} z-[60] flex flex-col overflow-hidden animate-slide-up`}>
          {/* Overlay Header */}
          <div className={`w-full px-5 py-4 flex items-center justify-between border-b ${isLight ? 'border-zinc-200 bg-zinc-50/50' : 'border-zinc-900'} shrink-0`}>
            <div className="flex items-center gap-2">
              <Sliders className={`w-4 h-4 ${isLight ? 'text-zinc-800' : 'text-white'}`} />
              <h2 className={`font-sans font-bold text-xs ${isLight ? 'text-zinc-800' : 'text-white'} tracking-wide`}>Playback &amp; DSP Settings</h2>
            </div>
            <button
              onClick={() => setShowSettingsOverlay(false)}
              className={`p-1.5 rounded-full ${isLight ? 'bg-zinc-100 hover:bg-zinc-200 text-zinc-600 hover:text-zinc-900' : 'bg-zinc-900 hover:bg-zinc-800 text-zinc-400 hover:text-white'} transition-colors`}
              title="Close Settings"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Overlay Content (Scrollable) */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-6 scrollbar-none pb-12">
            
            {/* SECTION 1: TIMERS & SPEED */}
            <div className="space-y-3">
              <h3 className={`text-[10px] font-mono font-bold tracking-widest ${isLight ? 'text-zinc-550' : 'text-zinc-500'} uppercase`}>Timing &amp; Playback Speed</h3>
              
              <div className="space-y-2.5">
                {/* Playback speed */}
                <div className={`p-3 ${isLight ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-900/30 border-zinc-900'} border rounded-xl space-y-2`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-semibold ${isLight ? 'text-zinc-800' : 'text-zinc-200'} flex items-center gap-1.5`}>
                      <Gauge className={`w-3.5 h-3.5 ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`} /> Playback Speed
                    </span>
                    <span className={`font-mono text-[11px] font-bold ${isLight ? 'text-zinc-800 bg-zinc-100 border-zinc-200' : 'text-white bg-zinc-900 border-zinc-800'} px-2 py-0.5 rounded border`}>
                      {playbackSpeed}x
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0.5"
                    max="2.0"
                    step="0.1"
                    value={playbackSpeed}
                    onChange={(e) => handleSpeedChange(Number(e.target.value))}
                    className={`w-full ${isLight ? 'accent-zinc-800' : 'accent-white'} cursor-pointer ${isLight ? 'bg-zinc-200' : 'bg-zinc-850'} h-1 rounded`}
                  />
                </div>

                {/* Pitch Lock toggle */}
                <div className={`p-3 ${isLight ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-900/30 border-zinc-900'} border rounded-xl flex items-center justify-between`}>
                  <div>
                    <span className={`text-xs font-semibold ${isLight ? 'text-zinc-800' : 'text-zinc-200'} block`}>Lock Pitch (Tempo Lock)</span>
                    <span className="text-[9.5px] text-zinc-500">Keep original voice tone when speed changes</span>
                  </div>
                  <button
                    onClick={() => handleAppSettingChange('pitchAdjust', !appSettingsState.pitchAdjust)}
                    className={`${isLight ? 'text-zinc-600' : 'text-zinc-400'} hover:text-zinc-900 transition-colors`}
                  >
                    {appSettingsState.pitchAdjust ? (
                      <ToggleRight className={`w-9 h-9 ${isLight ? 'text-zinc-800' : 'text-white'}`} />
                    ) : (
                      <ToggleLeft className={`w-9 h-9 ${isLight ? 'text-zinc-300' : 'text-zinc-600'}`} />
                    )}
                  </button>
                </div>

                {/* Sleep Timer */}
                <div className={`p-3 ${isLight ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-900/30 border-zinc-900'} border rounded-xl flex items-center justify-between`}>
                  <div className="space-y-0.5">
                    <span className={`text-xs font-semibold ${isLight ? 'text-zinc-800' : 'text-zinc-200'} flex items-center gap-1.5`}>
                      <Moon className={`w-3.5 h-3.5 ${isLight ? 'text-zinc-500' : 'text-zinc-400'}`} /> Sleep Timer
                    </span>
                    <span className="text-[9px] font-mono text-zinc-500 block">
                      {sleepTimerRemaining > 0 
                        ? `Remaining: ${Math.floor(sleepTimerRemaining / 60)}m ${sleepTimerRemaining % 60}s` 
                        : sleepTimerRemaining === -2 ? 'Active (End of Song)' : 'Inactive'}
                    </span>
                  </div>
                  <select
                    value={sleepTimerRemaining > 0 ? 'custom' : sleepTimerRemaining === -2 ? 'end' : 'off'}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === 'off') handleSleepTimerSelect(0);
                      else if (val === 'end') handleSleepTimerSelect('end-of-song');
                      else handleSleepTimerSelect(Number(val));
                    }}
                    className={`bg-transparent ${isLight ? 'border-zinc-300 text-zinc-800' : 'border-zinc-800 text-zinc-300'} border rounded-lg p-1.5 text-[11px] focus:outline-none focus:border-zinc-500`}
                  >
                    <option value="off" className={isLight ? 'text-zinc-900 bg-white' : 'text-white bg-black'}>Off</option>
                    <option value="end" className={isLight ? 'text-zinc-900 bg-white' : 'text-white bg-black'}>End of Song</option>
                    <option value="5" className={isLight ? 'text-zinc-900 bg-white' : 'text-white bg-black'}>5 Mins</option>
                    <option value="15" className={isLight ? 'text-zinc-900 bg-white' : 'text-white bg-black'}>15 Mins</option>
                    <option value="30" className={isLight ? 'text-zinc-900 bg-white' : 'text-white bg-black'}>30 Mins</option>
                    <option value="45" className={isLight ? 'text-zinc-900 bg-white' : 'text-white bg-black'}>45 Mins</option>
                    <option value="60" className={isLight ? 'text-zinc-900 bg-white' : 'text-white bg-black'}>1 Hour</option>
                    <option value="custom" disabled hidden>Active</option>
                  </select>
                </div>
              </div>
            </div>

            {/* SECTION 2: EQUALIZER & DSP EFFECT */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className={`text-[10px] font-mono font-bold tracking-widest ${isLight ? 'text-zinc-600' : 'text-zinc-500'} uppercase`}>Equalizer &amp; DSP Effects</h3>
                <button
                  onClick={() => {
                    const updated = { ...eq, enabled: !eq.enabled };
                    handleEqChange(updated);
                  }}
                  className={`px-2.5 py-0.5 rounded-full text-[8.5px] font-bold tracking-wider border transition-all ${
                    eq.enabled 
                      ? (isLight ? 'bg-zinc-900 border-zinc-900 text-white font-semibold' : 'bg-white border-white text-black') 
                      : (isLight ? 'bg-zinc-100 border-zinc-300 text-zinc-400 hover:text-zinc-800' : 'bg-zinc-950 border-zinc-850 text-zinc-500')
                  }`}
                >
                  {eq.enabled ? 'ACTIVE' : 'BYPASS'}
                </button>
              </div>

              <div className={`space-y-3 transition-all duration-300 ${eq.enabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                {/* Presets Chips */}
                <div className="space-y-1.5">
                  <span className={`text-[9px] ${isLight ? 'text-zinc-500' : 'text-zinc-500'} font-bold uppercase tracking-wider block`}>Sound Signature</span>
                  <div className="flex flex-wrap gap-1.5">
                    {['Flat', 'Rock', 'Pop', 'Jazz', 'Classical', 'Dance', 'Hip-Hop', 'Acoustic'].map((p) => {
                      const presetsMap: { [key: string]: number[] } = {
                        Flat: [0, 0, 0, 0, 0],
                        Rock: [5, 3, -1, 3, 5],
                        Pop: [-2, -1, 3, 2, -1],
                        Jazz: [3, 2, 1, 2, 4],
                        Classical: [4, 2, 0, 2, 3],
                        Dance: [6, 0, 2, 4, 1],
                        'Hip-Hop': [6, 4, 1, 2, 3],
                        Acoustic: [3, 1, 2, 3, 4],
                      };
                      const isSelected = eq.preset === p;
                      return (
                        <button
                          key={p}
                          onClick={() => {
                            const updated = {
                              ...eq,
                              preset: p,
                              bands: [...presetsMap[p]]
                            };
                            handleEqChange(updated);
                          }}
                          className={`px-2 py-1 rounded text-[9px] font-semibold transition-all ${
                            isSelected 
                              ? (isLight ? 'bg-zinc-900 text-white font-bold' : 'bg-white text-black font-bold') 
                              : (isLight ? 'bg-zinc-100 hover:bg-zinc-200 text-zinc-700 border border-zinc-200' : 'bg-zinc-900/60 hover:bg-zinc-800 text-zinc-400 border border-zinc-900/80')
                          }`}
                        >
                          {p}
                        </button>
                      );
                    })}
                  </div>
                </div>                {/* EQ Bands Sliders */}
                <div className={`p-3 ${isLight ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-900/30 border-zinc-900'} border rounded-xl space-y-2.5`}>
                  <span className={`text-[9px] ${isLight ? 'text-zinc-600' : 'text-zinc-500'} font-bold uppercase tracking-wider block`}>Manual Frequency Tuning</span>
                  
                  {['60Hz', '230Hz', '910Hz', '4kHz', '14kHz'].map((label, index) => {
                    const currentGain = eq.bands[index] || 0;
                    return (
                      <div key={label} className="flex items-center gap-3">
                        <span className={`font-mono text-[9px] ${isLight ? 'text-zinc-600' : 'text-zinc-400'} w-10 shrink-0`}>{label}</span>
                        <input
                          type="range"
                          min="-12"
                          max="12"
                          step="1"
                          value={currentGain}
                          onChange={(e) => {
                            const updatedBands = [...eq.bands];
                            updatedBands[index] = Number(e.target.value);
                            const updated = {
                              ...eq,
                              bands: updatedBands,
                              preset: 'Custom'
                            };
                            handleEqChange(updated);
                          }}
                          className={`flex-1 ${isLight ? 'accent-zinc-800 bg-zinc-200' : 'accent-white bg-zinc-850'} h-1 rounded cursor-pointer`}
                        />
                        <span className={`font-mono text-[9px] ${isLight ? 'text-zinc-600' : 'text-zinc-400'} w-8 text-right shrink-0 tabular-nums`}>
                          {currentGain > 0 ? `+${currentGain}` : currentGain}dB
                        </span>
                      </div>
                    );
                  })}
                </div>

                {/* Bass Boost & Spatializer Sliders */}
                <div className="grid grid-cols-2 gap-2.5">
                  {/* Bass Boost */}
                  <div className={`p-3 ${isLight ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-900/30 border-zinc-900'} border rounded-xl space-y-1.5`}>
                    <div className={`flex items-center justify-between text-[9.5px] font-bold uppercase ${isLight ? 'text-zinc-600' : 'text-zinc-400'}`}>
                      <span className="flex items-center gap-1"><Volume2 className="w-3 h-3" /> Bass Boost</span>
                      <span className="font-mono">{eq.bassBoost}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={eq.bassBoost}
                      onChange={(e) => {
                        const updated = { ...eq, bassBoost: Number(e.target.value) };
                        handleEqChange(updated);
                      }}
                      className={`w-full ${isLight ? 'accent-zinc-800 bg-zinc-200' : 'accent-white bg-zinc-850'} h-1 rounded cursor-pointer`}
                    />
                  </div>

                  {/* Spatializer */}
                  <div className={`p-3 ${isLight ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-900/30 border-zinc-900'} border rounded-xl space-y-1.5`}>
                    <div className={`flex items-center justify-between text-[9.5px] font-bold uppercase ${isLight ? 'text-zinc-600' : 'text-zinc-400'}`}>
                      <span className="flex items-center gap-1"><Sparkles className="w-3 h-3" /> Spatializer</span>
                      <span className="font-mono">{eq.virtualizer}%</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="5"
                      value={eq.virtualizer}
                      onChange={(e) => {
                        const updated = { ...eq, virtualizer: Number(e.target.value) };
                        handleEqChange(updated);
                      }}
                      className={`w-full ${isLight ? 'accent-zinc-800 bg-zinc-200' : 'accent-white bg-zinc-850'} h-1 rounded cursor-pointer`}
                    />
                  </div>
                </div>

              </div>
            </div>

            {/* SECTION 3: ADVANCED AUDIO ENGINE CONFIGS */}
            <div className="space-y-3">
              <h3 className={`text-[10px] font-mono font-bold tracking-widest ${isLight ? 'text-zinc-600' : 'text-zinc-500'} uppercase`}>Advanced Engine Settings</h3>
              
              <div className="space-y-2.5">
                {/* Crossfade duration */}
                <div className={`p-3 ${isLight ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-900/30 border-zinc-900'} border rounded-xl space-y-2`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-semibold ${isLight ? 'text-zinc-800' : 'text-zinc-200'}`}>Crossfade Duration</span>
                    <span className={`font-mono text-[10px] font-bold ${isLight ? 'text-zinc-800 bg-zinc-100 border-zinc-200' : 'text-white bg-zinc-900 border-zinc-800'} px-1.5 py-0.5 rounded border`}>
                      {appSettingsState.crossfadeDuration}s
                    </span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="10"
                    step="1"
                    value={appSettingsState.crossfadeDuration}
                    onChange={(e) => handleAppSettingChange('crossfadeDuration', Number(e.target.value))}
                    className={`w-full ${isLight ? 'accent-zinc-800 bg-zinc-200' : 'accent-white bg-zinc-850'} cursor-pointer h-1 rounded`}
                  />
                  <p className={`text-[8.5px] ${isLight ? 'text-zinc-500' : 'text-zinc-600'} leading-tight`}>Smooth overlay crossfade transition between audio tracks.</p>
                </div>

                {/* Channel Balance */}
                <div className={`p-3 ${isLight ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-900/30 border-zinc-900'} border rounded-xl space-y-2`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-semibold ${isLight ? 'text-zinc-800' : 'text-zinc-200'}`}>Stereo Balance</span>
                    <span className={`font-mono text-[10px] font-bold ${isLight ? 'text-zinc-600' : 'text-zinc-400'}`}>
                      {appSettingsState.channelBalance === 0 
                        ? 'Center' 
                        : appSettingsState.channelBalance < 0 
                          ? `L ${Math.abs(Math.round(appSettingsState.channelBalance * 100))}%` 
                          : `R ${Math.abs(Math.round(appSettingsState.channelBalance * 100))}%`}
                    </span>
                  </div>
                  <input
                    type="range"
                    min="-1"
                    max="1"
                    step="0.1"
                    value={appSettingsState.channelBalance}
                    onChange={(e) => handleAppSettingChange('channelBalance', Number(e.target.value))}
                    className={`w-full ${isLight ? 'accent-zinc-800 bg-zinc-200' : 'accent-white bg-zinc-850'} cursor-pointer h-1 rounded`}
                  />
                </div>

                {/* Mono Mode Switch */}
                <div className={`p-3 ${isLight ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-900/30 border-zinc-900'} border rounded-xl flex items-center justify-between`}>
                  <div>
                    <span className={`text-xs font-semibold ${isLight ? 'text-zinc-800' : 'text-zinc-200'} block`}>Mono Mode Output</span>
                    <span className="text-[9.5px] text-zinc-500">Combine left and right channels to a single mono feed</span>
                  </div>
                  <button
                    onClick={() => handleAppSettingChange('monoMode', !appSettingsState.monoMode)}
                    className={`${isLight ? 'text-zinc-600' : 'text-zinc-400'} hover:text-zinc-950 transition-colors`}
                  >
                    {appSettingsState.monoMode ? (
                      <ToggleRight className={`w-9 h-9 ${isLight ? 'text-zinc-800' : 'text-white'}`} />
                    ) : (
                      <ToggleLeft className={`w-9 h-9 ${isLight ? 'text-zinc-300' : 'text-zinc-600'}`} />
                    )}
                  </button>
                </div>

                {/* Artwork Ambient Blur */}
                <div className={`p-3 ${isLight ? 'bg-zinc-50 border-zinc-200' : 'bg-zinc-900/30 border-zinc-900'} border rounded-xl space-y-2`}>
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-semibold ${isLight ? 'text-zinc-800' : 'text-zinc-200'}`}>Ambient Underlay Blur</span>
                    <span className={`font-mono text-[10px] ${isLight ? 'text-zinc-600' : 'text-zinc-400'}`}>{appSettingsState.artworkBlur}px</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="40"
                    step="5"
                    value={appSettingsState.artworkBlur}
                    onChange={(e) => handleAppSettingChange('artworkBlur', Number(e.target.value))}
                    className={`w-full ${isLight ? 'accent-zinc-800 bg-zinc-200' : 'accent-white bg-zinc-850'} cursor-pointer h-1 rounded`}
                  />
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
}
