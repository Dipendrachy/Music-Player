/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Song, AppSettings } from '../types';
import { audioEngine } from '../services/audioEngine';
import { getArtworkColors } from '../data/defaultSongs';
import WavySeekBar from './WavySeekBar';
import SongCover from './SongCover';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Wifi, Bluetooth, Moon, Sun, Volume2, Battery, Check, Settings, 
  Play, Pause, SkipForward, SkipBack, ChevronDown, ChevronUp, Sliders, 
  Lock, Unlock, Heart, Sparkles, MessageSquare, Compass, Eye, VolumeX,
  Volume1, Laptop, Home, Radio, Bell, ArrowRight
} from 'lucide-react';

interface AndroidSystemSimulatorProps {
  currentSong: Song | null;
  playbackState: 'playing' | 'paused' | 'stopped';
  songs: Song[];
  onPlaySong: (song: Song, customQueue?: Song[]) => void;
  onRefresh: () => void;
  children: React.ReactNode; // The core Offline Music Player app to run inside
}

type OutputDevice = 'phone_speaker' | 'pixel_buds' | 'nest_audio' | 'car_bluetooth';

export default function AndroidSystemSimulator({
  currentSong,
  playbackState,
  songs,
  onPlaySong,
  onRefresh,
  children
}: AndroidSystemSimulatorProps) {
  // Simulator States
  const [isLocked, setIsLocked] = useState(true);
  const [isQsOpen, setIsQsOpen] = useState(false);
  const [isInApp, setIsInApp] = useState(false);
  
  // Custom camera view state
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [isMessagesActive, setIsMessagesActive] = useState(false);

  // Material You / Accent System Theme
  const [materialTheme, setMaterialTheme] = useState<'monochrome' | 'coral' | 'ocean' | 'sage' | 'orchid'>('ocean');
  const [isDarkMode, setIsDarkMode] = useState(true);

  // Quick Setting Tile States
  const [wifiOn, setWifiOn] = useState(true);
  const [bluetoothOn, setBluetoothOn] = useState(true);
  const [dndOn, setDndOn] = useState(false);
  const [flashlightOn, setFlashlightOn] = useState(false);
  const [batterySaverOn, setBatterySaverOn] = useState(false);

  // Output Switcher States
  const [isOutputOpen, setIsOutputOpen] = useState(false);
  const [activeOutput, setActiveOutput] = useState<OutputDevice>('phone_speaker');
  const [outputVolume, setOutputVolume] = useState<{ [key in OutputDevice]: number }>({
    phone_speaker: 75,
    pixel_buds: 60,
    nest_audio: 85,
    car_bluetooth: 50,
  });

  // Current time state for the emulated status bar and lockscreen clock
  const [systemTime, setSystemTime] = useState('');
  const [systemDate, setSystemDate] = useState('');

  // Audio Progress State
  const [currentTime, setCurrentTime] = useState(0);

  useEffect(() => {
    // Sync current time with the audio engine
    const unsubTime = audioEngine.onTimeUpdate((time) => {
      setCurrentTime(time);
    });

    // Update digital system clock
    const updateClock = () => {
      const now = new Date();
      let hours = now.getHours();
      const mins = now.getMinutes().toString().padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12;
      hours = hours ? hours : 12; // 0 should be 12
      setSystemTime(`${hours}:${mins}`);
      
      const options: Intl.DateTimeFormatOptions = { weekday: 'short', month: 'short', day: 'numeric' };
      setSystemDate(now.toLocaleDateString('en-US', options));
    };

    updateClock();
    const timer = setInterval(updateClock, 1000);

    return () => {
      unsubTime();
      clearInterval(timer);
    };
  }, []);

  const handlePlayPause = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (playbackState === 'playing') {
      audioEngine.pause();
    } else {
      // If no track is playing, play first indexed song
      if (!currentSong && songs.length > 0) {
        onPlaySong(songs[0], songs);
      } else {
        audioEngine.play();
      }
    }
  };

  const handlePrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    audioEngine.prev();
  };

  const handleNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    audioEngine.next();
  };

  const handleSeek = (time: number) => {
    audioEngine.seek(time);
    setCurrentTime(time);
  };

  const handleFavoriteToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentSong) return;
    const updated = { ...currentSong, isFavorite: !currentSong.isFavorite };
    const { offlineDb } = require('../services/db');
    offlineDb.updateSong(updated);
    audioEngine.updateSongInQueue(updated);
    onRefresh();
  };

  const handleVolumeChange = (device: OutputDevice, val: number) => {
    setOutputVolume(prev => ({ ...prev, [device]: val }));
    // If it's the currently active device, apply to HTML audio element volume
    if (device === activeOutput) {
      audioEngine.setVolume(val / 100);
    }
  };

  const handleSwitchOutput = (device: OutputDevice) => {
    setActiveOutput(device);
    audioEngine.setVolume(outputVolume[device] / 100);
    
    // Simulate connection hum/tone
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.setValueAtTime(device === 'phone_speaker' ? 440 : 587.33, ctx.currentTime);
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  };

  // Helper formatting for track duration
  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  // Get active song colors or default system colors
  const songColors = currentSong 
    ? getArtworkColors(currentSong.artworkSeed || currentSong.id) 
    : { from: '#3b82f6', to: '#1d4ed8', accent: '#60a5fa' };

  // Theme styling helpers based on active selection
  const themeMap = {
    monochrome: {
      accent: 'bg-zinc-200 text-zinc-950',
      accentText: 'text-zinc-200',
      accentBg: 'bg-zinc-800/40',
      border: 'border-zinc-700/60',
      pill: 'bg-zinc-100 text-zinc-950',
      pillActive: 'bg-zinc-100 text-zinc-950',
      sysColors: 'from-zinc-900 to-zinc-950',
    },
    coral: {
      accent: 'bg-orange-400 text-zinc-950',
      accentText: 'text-orange-400',
      accentBg: 'bg-orange-900/20',
      border: 'border-orange-900/30',
      pill: 'bg-orange-400 text-zinc-950',
      pillActive: 'bg-orange-400 text-zinc-950',
      sysColors: 'from-[#2e1d18] to-[#120b08]',
    },
    ocean: {
      accent: 'bg-sky-400 text-zinc-950',
      accentText: 'text-sky-400',
      accentBg: 'bg-sky-900/20',
      border: 'border-sky-900/30',
      pill: 'bg-sky-400 text-zinc-950',
      pillActive: 'bg-sky-400 text-zinc-950',
      sysColors: 'from-[#14233c] to-[#0a1120]',
    },
    sage: {
      accent: 'bg-emerald-400 text-zinc-950',
      accentText: 'text-emerald-400',
      accentBg: 'bg-emerald-900/20',
      border: 'border-emerald-900/30',
      pill: 'bg-emerald-400 text-zinc-950',
      pillActive: 'bg-emerald-400 text-zinc-950',
      sysColors: 'from-[#152a1e] to-[#09150e]',
    },
    orchid: {
      accent: 'bg-fuchsia-400 text-zinc-950',
      accentText: 'text-fuchsia-400',
      accentBg: 'bg-fuchsia-900/20',
      border: 'border-fuchsia-900/30',
      pill: 'bg-fuchsia-400 text-zinc-950',
      pillActive: 'bg-fuchsia-400 text-zinc-950',
      sysColors: 'from-[#2a1730] to-[#110814]',
    },
  };

  const sysTheme = themeMap[materialTheme];

  const getOutputName = (device: OutputDevice) => {
    switch (device) {
      case 'phone_speaker': return 'Phone Speaker';
      case 'pixel_buds': return 'Pixel Buds Pro';
      case 'nest_audio': return 'Nest Audio';
      case 'car_bluetooth': return 'Android Auto Bluetooth';
    }
  };

  return (
    <div className="w-full h-full relative select-none overflow-hidden font-sans">
      
      {/* Simulation wallpaper backdrop (blurred dynamic or static Material You gradient) */}
      <div className={`absolute inset-0 z-0 transition-all duration-1000 ease-out ${
        isDarkMode ? 'bg-[#060608]' : 'bg-[#f4f4f7]'
      }`}>
        {/* Dynamic ambient color flow from album art */}
        {currentSong && !isInApp && (
          <div 
            className="absolute inset-0 opacity-40 transition-opacity duration-1000 blur-[80px]"
            style={{
              background: `radial-gradient(circle at 50% 60%, ${songColors.from} 0%, transparent 60%),
                           radial-gradient(circle at 10% 20%, ${songColors.to} 0%, transparent 55%),
                           radial-gradient(circle at 80% 10%, ${songColors.accent} 0%, transparent 50%)`
            }}
          />
        )}

        {/* Wallpaper background overlay when not in dynamic mode */}
        {(!currentSong || isInApp) && (
          <div className={`absolute inset-0 opacity-25 bg-gradient-to-tr ${sysTheme.sysColors} transition-all duration-1000`} />
        )}

        {/* Dynamic Android 14 Material Design Wallpaper patterns */}
        <div className="absolute inset-0 pointer-events-none mix-blend-overlay opacity-30">
          <svg className="w-full h-full opacity-60">
            <defs>
              <radialGradient id="patternGlow1" cx="30%" cy="30%" r="60%">
                <stop offset="0%" stopColor="#fff" stopOpacity="0.15" />
                <stop offset="100%" stopColor="#000" stopOpacity="0" />
              </radialGradient>
            </defs>
            <circle cx="20%" cy="15%" r="45%" fill="url(#patternGlow1)" />
            <circle cx="85%" cy="80%" r="55%" fill="url(#patternGlow1)" />
          </svg>
        </div>
      </div>

      {/* Simulator Frame Glowing borders for flashlight */}
      {flashlightOn && (
        <div className="absolute inset-0 z-40 border-[3px] border-yellow-300 animate-pulse pointer-events-none shadow-[inset_0_0_40px_rgba(253,224,71,0.4)]" />
      )}

      {/* STATUS BAR (Dynamic Android 14 status bar) */}
      <div className={`absolute top-0 inset-x-0 h-9 z-50 flex items-center justify-between px-6 text-xs font-semibold ${
        isDarkMode ? 'text-white/90' : 'text-black/85'
      }`}>
        <div className="flex items-center gap-1">
          <span className="font-sans text-[11px] tracking-tight">{systemTime}</span>
          {dndOn && <div className="w-1.5 h-1.5 bg-red-500 rounded-full" title="DND active" />}
        </div>
        
        {/* Punch-hole camera overlay simulation */}
        <div className="absolute left-1/2 -translate-x-1/2 top-2 w-4 h-4 bg-black rounded-full border border-zinc-800 flex items-center justify-center shadow-inner">
          <div className="w-1 h-1 bg-indigo-950/40 rounded-full" />
        </div>

        <div className="flex items-center gap-2">
          {wifiOn ? <Wifi className="w-3.5 h-3.5" /> : <Wifi className="w-3.5 h-3.5 opacity-30" />}
          {bluetoothOn ? <Bluetooth className="w-3.5 h-3.5" /> : <Bluetooth className="w-3.5 h-3.5 opacity-30" />}
          <div className="flex items-center gap-0.5" title={`${batterySaverOn ? 'Battery Saver Active' : 'Battery Normal'}`}>
            <span className="text-[10px] font-mono leading-none font-bold">
              {batterySaverOn ? '14%' : '84%'}
            </span>
            <Battery className={`w-4 h-4 ${batterySaverOn ? 'text-orange-400 rotate-90' : 'rotate-90'}`} />
          </div>
        </div>
      </div>

      {/* SIMULATOR GESTURE NAVIGATION PILL (Bottom Home Bar) */}
      <div 
        onClick={() => {
          if (isInApp) {
            setIsInApp(false);
          } else if (isQsOpen) {
            setIsQsOpen(false);
          }
        }}
        className="absolute bottom-1.5 left-1/2 -translate-x-1/2 w-32 h-1 bg-white/40 hover:bg-white/70 active:bg-white rounded-full z-50 cursor-pointer transition-colors"
        title="Swipe or click to go Home"
      />

      {/* INNER VIEWS CONTAINER */}
      <div className="w-full h-full pt-9 pb-3 relative z-10 overflow-hidden">
        
        {/* ========================================================
            VIEW 1: LOCK SCREEN (Classic Material Lockscreen UI)
            ======================================================== */}
        <AnimatePresence>
          {isLocked && (
            <motion.div
              initial={{ opacity: 1 }}
              exit={{ opacity: 0, y: -200 }}
              transition={{ duration: 0.4, ease: 'easeInOut' }}
              className="absolute inset-0 bg-transparent z-40 flex flex-col justify-between px-6 py-8"
            >
              {/* Top Lock Icon and system notifications banner */}
              <div className="flex flex-col items-center space-y-1">
                <div className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center border border-white/5 shadow-md">
                  <Lock className="w-4 h-4 text-white/90" />
                </div>
                <span className="text-[10px] text-white/50 tracking-wider font-semibold uppercase">Tap lock or drag bottom to unlock</span>
              </div>

              {/* Huge double-line Material clock widget */}
              <div className="flex flex-col items-center justify-center select-none py-4">
                <motion.div 
                  layout
                  className={`font-display font-bold tracking-tighter leading-none flex flex-col items-center text-[#ffffff]`}
                >
                  <span className="text-[84px] drop-shadow-md">{systemTime.split(':')[0]}</span>
                  <span className={`text-[84px] drop-shadow-md -mt-4 ${sysTheme.accentText}`}>{systemTime.split(':')[1]}</span>
                </motion.div>
                <div className="text-white/70 font-display text-sm font-semibold tracking-tight mt-1">
                  {systemDate}
                </div>
              </div>

              {/* Android 14 Lock Screen Media Card */}
              <div className="flex-1 flex flex-col justify-end pb-8">
                {currentSong ? (
                  <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="w-full bg-[#1c1d22]/85 border border-white/5 rounded-[24px] p-4 shadow-2xl backdrop-blur-xl relative overflow-hidden"
                  >
                    {/* Blurred art underlay for card background dynamic theme */}
                    <div className="absolute inset-0 opacity-[0.08] pointer-events-none bg-gradient-to-br from-white/20 to-black/30" />

                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <SongCover song={currentSong} className="w-12 h-12 rounded-xl object-cover shrink-0 shadow-md border border-white/5" size="sm" />
                        <div className="truncate text-left">
                          <h4 className="font-display font-bold text-sm text-white truncate leading-snug">{currentSong.title}</h4>
                          <p className="text-xs text-zinc-400 font-medium truncate mt-0.5">{currentSong.artist}</p>
                        </div>
                      </div>

                      {/* Controls on the right */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button onClick={handlePrev} className="p-2 text-zinc-400 hover:text-white transition-colors">
                          <SkipBack className="w-4.5 h-4.5 fill-current" />
                        </button>
                        <button 
                          onClick={handlePlayPause}
                          className="w-10 h-10 bg-white text-zinc-950 rounded-full flex items-center justify-center shrink-0 shadow-md active:scale-95 transition-all"
                        >
                          {playbackState === 'playing' ? (
                            <Pause className="w-4.5 h-4.5 fill-current text-zinc-950" />
                          ) : (
                            <Play className="w-4.5 h-4.5 fill-current text-zinc-950 ml-0.5" />
                          )}
                        </button>
                        <button onClick={handleNext} className="p-2 text-zinc-400 hover:text-white transition-colors">
                          <SkipForward className="w-4.5 h-4.5 fill-current" />
                        </button>
                      </div>
                    </div>

                    {/* Compact Wavy seek bar on Lockscreen card */}
                    <div className="mt-2">
                      <WavySeekBar
                        currentTime={currentTime}
                        duration={currentSong.duration}
                        playbackState={playbackState}
                        onSeek={handleSeek}
                        color={sysTheme.accentText}
                      />
                      <div className="flex justify-between text-[9px] font-mono text-zinc-500 font-bold -mt-1.5">
                        <span>{formatTime(currentTime)}</span>
                        <span>{formatTime(currentSong.duration)}</span>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <div className="w-full bg-[#1c1d22]/50 border border-white/5 rounded-3xl p-4 text-center">
                    <p className="text-xs text-zinc-400 font-medium">No music loaded. Tap to unlock.</p>
                  </div>
                )}
              </div>

              {/* Bottom Unlock Trigger button */}
              <button 
                onClick={() => setIsLocked(false)}
                className="w-full py-3.5 bg-white/10 hover:bg-white/20 active:bg-white/30 text-white font-display font-bold text-sm rounded-full flex items-center justify-center gap-2 border border-white/10 transition-all cursor-pointer backdrop-blur-sm shadow-md"
              >
                <Unlock className="w-4 h-4 text-white" /> Unlock Phone
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ========================================================
            VIEW 2: HOME LAUNCHER / FULL SCREEN MODE (Main desktop)
            ======================================================== */}
        {!isLocked && (
          <div className="absolute inset-0 w-full h-full flex flex-col justify-between">
            
            {/* 1. Quick Settings Trigger / Status bar click area */}
            {!isQsOpen && (
              <div 
                onClick={() => setIsQsOpen(true)}
                className="w-full h-6 hover:bg-white/5 active:bg-white/10 flex items-center justify-center cursor-pointer transition-colors z-35 group"
                title="Pull down Quick Settings Shade"
              >
                <ChevronDown className="w-4 h-4 text-white/20 group-hover:text-white/60 transition-colors" />
              </div>
            )}

            {/* MAIN CONTENT AREA */}
            <div className="flex-1 relative w-full h-full overflow-hidden">
              
              {/* LAUNCHER HOME GRID (App icons) */}
              {!isInApp && !isQsOpen && (
                <div className="absolute inset-0 p-6 flex flex-col justify-between h-full select-none">
                  
                  {/* Grid of Launcher widgets / Search */}
                  <div className="space-y-6">
                    {/* Calendar / Clock Widget */}
                    <div className="p-4 bg-[#14233c]/35 border border-white/5 rounded-3xl backdrop-blur-md flex items-center justify-between shadow-lg">
                      <div className="text-left">
                        <span className="text-xs font-mono font-bold text-sky-400 uppercase tracking-widest">MON, JUL 20</span>
                        <h3 className="text-lg font-display font-bold text-white leading-tight">Android 14</h3>
                        <p className="text-[10px] text-zinc-400 font-medium">Media System Simulator</p>
                      </div>
                      <div className="w-12 h-12 rounded-2xl bg-sky-400 flex items-center justify-center text-zinc-950">
                        <Sparkles className="w-6 h-6 animate-pulse" />
                      </div>
                    </div>

                    {/* Standard Icon Grid */}
                    <div className="grid grid-cols-4 gap-x-4 gap-y-6 pt-4">
                      {/* App 1: Music Player App (Core) */}
                      <button 
                        onClick={() => setIsInApp(true)}
                        className="flex flex-col items-center space-y-1.5 focus:outline-none group active:scale-95 transition-all"
                      >
                        <div className="w-14 h-14 bg-emerald-500 rounded-[22px] flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:brightness-110 transition-all">
                          <Play className="w-6 h-6 text-zinc-950 fill-zinc-950 ml-0.5" />
                        </div>
                        <span className="text-[10px] text-white/90 font-semibold tracking-tight text-center drop-shadow truncate w-full">Audify</span>
                      </button>

                      {/* App 2: Simulated Camera */}
                      <button 
                        onClick={() => setIsCameraActive(true)}
                        className="flex flex-col items-center space-y-1.5 focus:outline-none group active:scale-95 transition-all"
                      >
                        <div className="w-14 h-14 bg-zinc-800 rounded-[22px] flex items-center justify-center border border-white/10 shadow-lg group-hover:brightness-110 transition-all">
                          <Eye className="w-6 h-6 text-sky-400" />
                        </div>
                        <span className="text-[10px] text-white/90 font-semibold tracking-tight text-center drop-shadow truncate w-full">Camera</span>
                      </button>

                      {/* App 3: Simulated Messages */}
                      <button 
                        onClick={() => setIsMessagesActive(true)}
                        className="flex flex-col items-center space-y-1.5 focus:outline-none group active:scale-95 transition-all"
                      >
                        <div className="w-14 h-14 bg-indigo-600 rounded-[22px] flex items-center justify-center shadow-lg shadow-indigo-600/20 group-hover:brightness-110 transition-all">
                          <MessageSquare className="w-6 h-6 text-white" />
                        </div>
                        <span className="text-[10px] text-white/90 font-semibold tracking-tight text-center drop-shadow truncate w-full">Messages</span>
                      </button>

                      {/* App 4: Android Settings */}
                      <button 
                        onClick={() => {
                          setIsInApp(true);
                          // We'll let the child navigation handle tab switching to Settings inside children
                        }}
                        className="flex flex-col items-center space-y-1.5 focus:outline-none group active:scale-95 transition-all"
                      >
                        <div className="w-14 h-14 bg-zinc-700/60 rounded-[22px] border border-white/10 flex items-center justify-center shadow-lg backdrop-blur-sm group-hover:brightness-110 transition-all">
                          <Settings className="w-6 h-6 text-zinc-300" />
                        </div>
                        <span className="text-[10px] text-white/90 font-semibold tracking-tight text-center drop-shadow truncate w-full">Settings</span>
                      </button>
                    </div>
                  </div>

                  {/* Lock Screen / Reset Shortcut Quick Launcher */}
                  <div className="flex flex-col items-center space-y-4">
                    <button 
                      onClick={() => setIsLocked(true)}
                      className="px-5 py-2.5 bg-zinc-950/80 border border-zinc-800 hover:bg-zinc-900 text-white font-semibold text-xs rounded-full flex items-center gap-1.5 shadow-lg backdrop-blur-md cursor-pointer transition-all"
                    >
                      <Lock className="w-3.5 h-3.5 text-zinc-400" /> Lock Simulated Phone
                    </button>
                  </div>
                </div>
              )}

              {/* CORE APP RUNTIME CONTAINER (If isInApp, render the Offline Music Player!) */}
              {isInApp && !isQsOpen && (
                <div className="absolute inset-0 w-full h-full bg-black z-10 animate-scale-up">
                  {/* Pull down handle on top of app view so users can pull the notification shade from inside the music player! */}
                  <div 
                    onClick={() => setIsQsOpen(true)}
                    className="absolute top-0 inset-x-0 h-4 hover:bg-white/5 active:bg-white/10 z-50 flex items-center justify-center cursor-pointer group"
                    title="Pull down notification shade"
                  >
                    <div className="w-12 h-1 bg-white/20 group-hover:bg-white/50 rounded-full transition-colors" />
                  </div>
                  {children}
                </div>
              )}

              {/* SIMULATED FULL SCREEN CAMERA VIEWER MODAL */}
              {isCameraActive && (
                <div className="absolute inset-0 bg-black z-30 flex flex-col justify-between p-6 animate-scale-up text-white">
                  <div className="flex justify-between items-center">
                    <span className="text-xs tracking-widest font-mono text-zinc-500 font-bold">EMULATED CAM 4K</span>
                    <button onClick={() => setIsCameraActive(false)} className="text-zinc-500 hover:text-white font-bold">X</button>
                  </div>
                  
                  {/* Simulated viewfinder */}
                  <div className="flex-1 bg-zinc-950/80 border border-zinc-900 rounded-3xl overflow-hidden flex flex-col items-center justify-center my-4 relative">
                    <div className="absolute inset-0 opacity-40 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-sky-950/20 via-[#030303] to-[#030303]" />
                    <Compass className="w-16 h-16 text-sky-400 animate-spin" style={{ animationDuration: '6s' }} />
                    <span className="text-xs font-mono font-bold text-zinc-500 mt-4">Simulated Android 14 Camera Frame</span>
                    <span className="text-[10px] text-zinc-600 font-mono mt-1">Camera Frame Permission requested in metadata.json</span>
                  </div>

                  <div className="flex justify-around items-center">
                    <div className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800" />
                    <button onClick={() => alert('Snapshot simulated!')} className="w-16 h-16 rounded-full bg-white border-4 border-zinc-300 flex items-center justify-center active:scale-95 transition-all shadow-md" />
                    <div className="w-10 h-10 rounded-full bg-zinc-900 border border-zinc-800" />
                  </div>
                </div>
              )}

              {/* SIMULATED MESSAGES FEED VIEWER MODAL */}
              {isMessagesActive && (
                <div className="absolute inset-0 bg-zinc-950 text-white z-30 flex flex-col animate-scale-up">
                  <div className="px-5 py-3 border-b border-zinc-900 flex justify-between items-center bg-zinc-900/40 shrink-0">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full" />
                      <h4 className="font-display font-bold text-sm">System Developers Chat</h4>
                    </div>
                    <button onClick={() => setIsMessagesActive(false)} className="text-zinc-500 hover:text-white font-bold text-sm">X</button>
                  </div>
                  <div className="flex-1 p-4 space-y-4 overflow-y-auto scrollbar-none text-xs text-left">
                    <div className="p-3 bg-zinc-900/60 border border-zinc-850 rounded-2xl max-w-[85%]">
                      <span className="font-bold text-orange-400 block mb-0.5">@AndroidSysDev</span>
                      Hey, have you seen the new Android 14 Media System Simulator? The squiggle seekbar looks so clean!
                    </div>
                    <div className="p-3 bg-indigo-950/50 border border-indigo-900/30 rounded-2xl max-w-[85%] ml-auto text-right">
                      <span className="font-bold text-sky-400 block mb-0.5">@You</span>
                      Yeah, I am playing with it now! The way the wave flattens out smoothly when paused is incredible!
                    </div>
                    <div className="p-3 bg-zinc-900/60 border border-zinc-850 rounded-2xl max-w-[85%]">
                      <span className="font-bold text-orange-400 block mb-0.5">@AndroidSysDev</span>
                      Awesome! The output switcher bottom sheet is also beautifully detailed. You can control independent device volume sliders.
                    </div>
                  </div>
                  <div className="p-3 border-t border-zinc-900 flex gap-2 shrink-0 bg-zinc-900/20">
                    <input type="text" placeholder="Type a message..." disabled className="flex-1 bg-zinc-900 border border-zinc-800 rounded-full px-4 py-2 text-xs focus:outline-none" />
                    <button className="px-4 py-2 bg-indigo-600 rounded-full text-xs font-semibold">Send</button>
                  </div>
                </div>
              )}

              {/* ========================================================
                  VIEW 3: QUICK SETTINGS PANEL / NOTIFICATION DRAWERS SHADE
                  ======================================================== */}
              <AnimatePresence>
                {isQsOpen && (
                  <motion.div
                    initial={{ y: -600, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: -600, opacity: 0 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 25 }}
                    className="absolute inset-0 bg-[#0c0d12]/98 text-zinc-300 z-50 flex flex-col justify-between p-6 pb-4"
                  >
                    {/* Header bar of shade */}
                    <div className="flex justify-between items-center text-xs text-zinc-400 font-semibold mb-4 shrink-0">
                      <span>Quick Settings</span>
                      <button 
                        onClick={() => setIsQsOpen(false)}
                        className="p-1 rounded-full bg-white/5 hover:bg-white/10 text-white"
                      >
                        <ChevronUp className="w-5 h-5" />
                      </button>
                    </div>

                    {/* Quick Setting Tiles Grid (8 beautiful Material pills) */}
                    <div className="grid grid-cols-2 gap-3 mb-6 shrink-0 text-left">
                      {/* Tile 1: Wi-Fi */}
                      <button
                        onClick={() => setWifiOn(!wifiOn)}
                        className={`p-3 rounded-[20px] flex items-center gap-3 transition-colors ${
                          wifiOn ? sysTheme.accent : 'bg-[#1e1f25]/85 text-zinc-350 hover:bg-zinc-800'
                        }`}
                      >
                        <Wifi className="w-4.5 h-4.5 shrink-0" />
                        <div className="truncate">
                          <span className="text-[11px] font-bold block leading-none">Wi-Fi</span>
                          <span className="text-[9px] opacity-75 font-medium truncate">{wifiOn ? 'Connected' : 'Offline'}</span>
                        </div>
                      </button>

                      {/* Tile 2: Bluetooth */}
                      <button
                        onClick={() => setBluetoothOn(!bluetoothOn)}
                        className={`p-3 rounded-[20px] flex items-center gap-3 transition-colors ${
                          bluetoothOn ? sysTheme.accent : 'bg-[#1e1f25]/85 text-zinc-350 hover:bg-zinc-800'
                        }`}
                      >
                        <Bluetooth className="w-4.5 h-4.5 shrink-0" />
                        <div className="truncate">
                          <span className="text-[11px] font-bold block leading-none">Bluetooth</span>
                          <span className="text-[9px] opacity-75 font-medium truncate">{bluetoothOn ? 'Pixel Buds Pro' : 'Disabled'}</span>
                        </div>
                      </button>

                      {/* Tile 3: Flashlight */}
                      <button
                        onClick={() => setFlashlightOn(!flashlightOn)}
                        className={`p-3 rounded-[20px] flex items-center gap-3 transition-colors ${
                          flashlightOn ? 'bg-yellow-300 text-zinc-950' : 'bg-[#1e1f25]/85 text-zinc-350 hover:bg-zinc-800'
                        }`}
                      >
                        <Sun className="w-4.5 h-4.5 shrink-0" />
                        <div className="truncate">
                          <span className="text-[11px] font-bold block leading-none">Flashlight</span>
                          <span className="text-[9px] opacity-75 font-medium truncate">{flashlightOn ? 'Glowing' : 'Off'}</span>
                        </div>
                      </button>

                      {/* Tile 4: Do Not Disturb */}
                      <button
                        onClick={() => setDndOn(!dndOn)}
                        className={`p-3 rounded-[20px] flex items-center gap-3 transition-colors ${
                          dndOn ? sysTheme.accent : 'bg-[#1e1f25]/85 text-zinc-350 hover:bg-zinc-800'
                        }`}
                      >
                        <Bell className="w-4.5 h-4.5 shrink-0" />
                        <div className="truncate">
                          <span className="text-[11px] font-bold block leading-none">DND Mode</span>
                          <span className="text-[9px] opacity-75 font-medium truncate">{dndOn ? 'Active' : 'Muted'}</span>
                        </div>
                      </button>

                      {/* Tile 5: Dark Mode Theme */}
                      <button
                        onClick={() => setIsDarkMode(!isDarkMode)}
                        className={`p-3 rounded-[20px] flex items-center gap-3 transition-colors ${
                          isDarkMode ? sysTheme.accent : 'bg-[#1e1f25]/85 text-zinc-350 hover:bg-zinc-800'
                        }`}
                      >
                        {isDarkMode ? <Moon className="w-4.5 h-4.5 shrink-0" /> : <Sun className="w-4.5 h-4.5 shrink-0" />}
                        <div className="truncate">
                          <span className="text-[11px] font-bold block leading-none">Dark Theme</span>
                          <span className="text-[9px] opacity-75 font-medium truncate">{isDarkMode ? 'Night' : 'Day'}</span>
                        </div>
                      </button>

                      {/* Tile 6: Material Wallpaper Themes */}
                      <div className="p-2.5 bg-[#1e1f25]/85 border border-zinc-800/50 rounded-[20px] flex flex-col justify-center space-y-1">
                        <span className="text-[9px] font-bold uppercase tracking-wider text-zinc-500 block leading-none">Material Accent</span>
                        <div className="flex gap-1">
                          {(['coral', 'ocean', 'sage', 'orchid'] as const).map((t) => (
                            <button
                              key={t}
                              onClick={() => setMaterialTheme(t)}
                              className={`w-4 h-4 rounded-full border transition-all ${
                                t === 'coral' ? 'bg-orange-400' :
                                t === 'ocean' ? 'bg-sky-400' :
                                t === 'sage' ? 'bg-emerald-400' : 'bg-fuchsia-400'
                              } ${
                                materialTheme === t ? 'scale-110 border-white ring-1 ring-white/20' : 'border-transparent'
                              }`}
                              title={`Theme: ${t}`}
                            />
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* DYNAMIC CARD: THE HIGH-FIDELITY ANDROID 14 SYSTEM MEDIA PLAYER WIDGET */}
                    <div className="flex-1 flex flex-col justify-center">
                      <div className="w-full bg-[#1b1c22] border border-zinc-800/80 rounded-[28px] p-4.5 shadow-2xl relative overflow-hidden">
                        
                        {/* Dynamic backdrop extracted and blended beautifully */}
                        {currentSong && (
                          <div className="absolute inset-0 pointer-events-none transition-all duration-1000 opacity-[0.06]">
                            <div 
                              className="absolute inset-0 scale-110"
                              style={{
                                background: `radial-gradient(circle at 10% 20%, ${songColors.from} 0%, transparent 60%),
                                             radial-gradient(circle at 90% 80%, ${songColors.to} 0%, transparent 65%)`,
                                filter: 'saturate(2.2) blur(30px)'
                              }}
                            />
                          </div>
                        )}

                        {/* Top App bar of Media card: Icon, Name & Device Output Switcher */}
                        <div className="flex items-center justify-between gap-2 select-none mb-3.5">
                          <div className="flex items-center gap-2">
                            <div className="w-5 h-5 bg-emerald-500 rounded-full flex items-center justify-center shadow-inner">
                              <Play className="w-2.5 h-2.5 text-black fill-current ml-0.5" />
                            </div>
                            <span className="text-[10px] font-bold tracking-wider text-zinc-450 uppercase opacity-90">Audify Media System</span>
                          </div>

                          {/* Sound Output switcher pill */}
                          <button
                            onClick={() => setIsOutputOpen(true)}
                            className={`px-3 py-1.5 rounded-full flex items-center gap-1.5 text-[10px] font-bold transition-all shadow-sm shrink-0 hover:scale-[1.02] ${sysTheme.accent}`}
                          >
                            <Volume2 className="w-3.5 h-3.5" /> {getOutputName(activeOutput)}
                          </button>
                        </div>

                        {/* Main track description info & rounded square album art */}
                        <div className="flex items-center justify-between gap-4 select-none mb-3">
                          {currentSong ? (
                            <div className="text-left space-y-0.5 min-w-0 flex-1">
                              <h3 className="font-display font-extrabold text-base text-white tracking-tight truncate leading-snug">
                                {currentSong.title}
                              </h3>
                              <p className="text-xs font-semibold text-zinc-400 truncate leading-snug">
                                {currentSong.artist} • <span className="text-[10px] text-zinc-500 font-normal">{currentSong.album}</span>
                              </p>
                            </div>
                          ) : (
                            <div className="text-left flex-1">
                              <h3 className="font-display font-extrabold text-sm text-zinc-400">Not playing</h3>
                              <p className="text-[10px] text-zinc-500 mt-1 font-medium">Select a track to launch media system simulation</p>
                            </div>
                          )}

                          {currentSong ? (
                            <SongCover 
                              song={currentSong} 
                              className="w-[72px] h-[72px] rounded-[22px] border border-white/5 shadow-md shrink-0 object-cover" 
                              size="md" 
                              noAmbient={true} 
                            />
                          ) : (
                            <div className="w-[72px] h-[72px] rounded-[22px] bg-zinc-800/40 border border-zinc-700/30 flex items-center justify-center shrink-0">
                              <VolumeX className="w-6 h-6 text-zinc-600" />
                            </div>
                          )}
                        </div>

                        {/* Interactive Squiggle Wavy progress seeker */}
                        {currentSong && (
                          <div className="mb-2">
                            <WavySeekBar
                              currentTime={currentTime}
                              duration={currentSong.duration}
                              playbackState={playbackState}
                              onSeek={handleSeek}
                              color={sysTheme.accentText}
                            />
                            <div className="flex justify-between text-[9px] font-mono font-bold text-zinc-500 -mt-1.5 px-0.5 select-none">
                              <span>{formatTime(currentTime)}</span>
                              <span>{formatTime(currentSong.duration)}</span>
                            </div>
                          </div>
                        )}

                        {/* Playback trigger buttons bottom row */}
                        <div className="flex items-center justify-between w-full pt-1.5">
                          <button 
                            onClick={handleFavoriteToggle} 
                            disabled={!currentSong}
                            className={`p-2.5 rounded-full hover:bg-white/5 transition-colors disabled:opacity-30 ${
                              currentSong?.isFavorite ? 'text-red-500' : 'text-zinc-500 hover:text-zinc-350'
                            }`}
                            title="Add to Favorites"
                          >
                            <Heart className={`w-4.5 h-4.5 ${currentSong?.isFavorite ? 'fill-current' : ''}`} />
                          </button>

                          <div className="flex items-center gap-1">
                            <button 
                              onClick={handlePrev} 
                              disabled={!currentSong}
                              className="p-2.5 text-zinc-400 hover:text-white transition-colors disabled:opacity-30"
                              title="Previous Track"
                            >
                              <SkipBack className="w-5 h-5 fill-current" />
                            </button>

                            {/* Large circle Play/Pause button */}
                            <button 
                              onClick={handlePlayPause}
                              className={`w-12 h-12 rounded-full flex items-center justify-center shadow-lg transition-all active:scale-95 hover:scale-[1.03] ${sysTheme.pill}`}
                              title="Play/Pause"
                            >
                              {playbackState === 'playing' ? (
                                <Pause className="w-5 h-5 fill-current text-zinc-950" />
                              ) : (
                                <Play className="w-5 h-5 fill-current text-zinc-950 ml-0.5" />
                              )}
                            </button>

                            <button 
                              onClick={handleNext} 
                              disabled={!currentSong}
                              className="p-2.5 text-zinc-400 hover:text-white transition-colors disabled:opacity-30"
                              title="Next Track"
                            >
                              <SkipForward className="w-5 h-5 fill-current" />
                            </button>
                          </div>

                          <button 
                            onClick={() => {
                              // Simulate a quick equalizer dialog trigger inside media card
                              alert('Quick EQ Sound Signature: ' + (materialTheme === 'ocean' ? 'Balanced Bass' : 'Vibrant Space'));
                            }}
                            className="p-2.5 text-zinc-500 hover:text-zinc-350 hover:bg-white/5 rounded-full transition-colors"
                            title="Quick Equalizer preset"
                          >
                            <Sparkles className="w-4.5 h-4.5" />
                          </button>
                        </div>

                      </div>
                    </div>

                    {/* Bottom Close bar */}
                    <button 
                      onClick={() => setIsQsOpen(false)}
                      className="w-full py-3 bg-[#1e1f25]/60 hover:bg-zinc-800 text-white font-display font-bold text-xs rounded-full flex items-center justify-center gap-1 transition-all mt-4 border border-zinc-800/40 cursor-pointer"
                    >
                      <ChevronUp className="w-4 h-4 text-zinc-400" /> Close Panel
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* SIMULATED ANDROID 14 SOUND OUTPUT SWITCHER BOTTOM SHEET */}
              <AnimatePresence>
                {isOutputOpen && (
                  <div className="absolute inset-0 bg-black/70 z-[60] flex items-end select-none">
                    {/* Click outside backdrop to close */}
                    <div className="absolute inset-0" onClick={() => setIsOutputOpen(false)} />

                    <motion.div
                      initial={{ y: 300 }}
                      animate={{ y: 0 }}
                      exit={{ y: 300 }}
                      transition={{ type: 'spring', damping: 24, stiffness: 220 }}
                      className="relative w-full bg-[#1b1c22] border-t border-zinc-800/80 rounded-t-[32px] p-6 z-10 flex flex-col space-y-4 shadow-3xl text-zinc-300 text-left"
                    >
                      {/* Drag handle pill */}
                      <div className="w-12 h-1 bg-zinc-700/50 rounded-full mx-auto -mt-2 mb-3 cursor-pointer" onClick={() => setIsOutputOpen(false)} />

                      <div className="flex justify-between items-center">
                        <div>
                          <h4 className="font-display font-extrabold text-sm text-white flex items-center gap-1.5">
                            <Volume2 className="w-4 h-4 text-sky-400" /> Audio Output Swapper
                          </h4>
                          <span className="text-[10px] text-zinc-500 font-medium">Select sound routing target device</span>
                        </div>
                        <button 
                          onClick={() => setIsOutputOpen(false)}
                          className="px-3.5 py-1 bg-zinc-800/60 hover:bg-zinc-800 text-zinc-300 font-bold text-[10px] rounded-full border border-zinc-700/40"
                        >
                          Done
                        </button>
                      </div>

                      {/* Device List with individual volume controls */}
                      <div className="space-y-3 pt-2">
                        {/* Option 1: Phone Speaker */}
                        <div className={`p-3 rounded-2xl border transition-all ${
                          activeOutput === 'phone_speaker' 
                            ? sysTheme.border + ' bg-zinc-900/35' 
                            : 'border-zinc-900 bg-zinc-900/10'
                        }`}>
                          <div className="flex items-center justify-between mb-2">
                            <button
                              onClick={() => handleSwitchOutput('phone_speaker')}
                              className="flex items-center gap-3 font-semibold text-[11px] text-white flex-1 text-left"
                            >
                              <Home className="w-4.5 h-4.5 text-zinc-400 shrink-0" />
                              📱 Phone Internal Speaker
                            </button>
                            {activeOutput === 'phone_speaker' && (
                              <span className="text-[9px] font-mono font-bold text-sky-400">ACTIVE</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <Volume1 className="w-3.5 h-3.5 text-zinc-500" />
                            <input
                              type="range"
                              min="0"
                              max="100"
                              value={outputVolume.phone_speaker}
                              onChange={(e) => handleVolumeChange('phone_speaker', Number(e.target.value))}
                              className="flex-1 accent-sky-400 cursor-pointer bg-zinc-800 h-1 rounded"
                            />
                            <span className="font-mono text-[9px] w-6 text-right font-semibold text-zinc-400">{outputVolume.phone_speaker}%</span>
                          </div>
                        </div>

                        {/* Option 2: Pixel Buds Pro */}
                        <div className={`p-3 rounded-2xl border transition-all ${
                          activeOutput === 'pixel_buds' 
                            ? sysTheme.border + ' bg-zinc-900/35' 
                            : 'border-zinc-900 bg-zinc-900/10 opacity-70 hover:opacity-100'
                        }`}>
                          <div className="flex items-center justify-between mb-2">
                            <button
                              onClick={() => handleSwitchOutput('pixel_buds')}
                              className="flex items-center gap-3 font-semibold text-[11px] text-white flex-1 text-left"
                            >
                              <Laptop className="w-4.5 h-4.5 text-zinc-400 shrink-0" />
                              🎧 Google Pixel Buds Pro
                            </button>
                            {activeOutput === 'pixel_buds' && (
                              <span className="text-[9px] font-mono font-bold text-sky-400">ACTIVE</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <Volume1 className="w-3.5 h-3.5 text-zinc-500" />
                            <input
                              type="range"
                              min="0"
                              max="100"
                              value={outputVolume.pixel_buds}
                              onChange={(e) => handleVolumeChange('pixel_buds', Number(e.target.value))}
                              className="flex-1 accent-sky-400 cursor-pointer bg-zinc-800 h-1 rounded"
                            />
                            <span className="font-mono text-[9px] w-6 text-right font-semibold text-zinc-400">{outputVolume.pixel_buds}%</span>
                          </div>
                        </div>

                        {/* Option 3: Nest Audio */}
                        <div className={`p-3 rounded-2xl border transition-all ${
                          activeOutput === 'nest_audio' 
                            ? sysTheme.border + ' bg-zinc-900/35' 
                            : 'border-zinc-900 bg-zinc-900/10 opacity-70 hover:opacity-100'
                        }`}>
                          <div className="flex items-center justify-between mb-2">
                            <button
                              onClick={() => handleSwitchOutput('nest_audio')}
                              className="flex items-center gap-3 font-semibold text-[11px] text-white flex-1 text-left"
                            >
                              <Radio className="w-4.5 h-4.5 text-zinc-400 shrink-0" />
                              🔊 Nest Audio (Smart Wi-Fi)
                            </button>
                            {activeOutput === 'nest_audio' && (
                              <span className="text-[9px] font-mono font-bold text-sky-400">ACTIVE</span>
                            )}
                          </div>
                          <div className="flex items-center gap-3">
                            <Volume1 className="w-3.5 h-3.5 text-zinc-500" />
                            <input
                              type="range"
                              min="0"
                              max="100"
                              value={outputVolume.nest_audio}
                              onChange={(e) => handleVolumeChange('nest_audio', Number(e.target.value))}
                              className="flex-1 accent-sky-400 cursor-pointer bg-zinc-800 h-1 rounded"
                            />
                            <span className="font-mono text-[9px] w-6 text-right font-semibold text-zinc-400">{outputVolume.nest_audio}%</span>
                          </div>
                        </div>
                      </div>

                      <p className="text-[8px] text-zinc-600 tracking-wide font-medium leading-normal text-center select-none pt-2 uppercase">
                        Android 14 Media System routing • Pure Client-Side Audio Context Driver
                      </p>
                    </motion.div>
                  </div>
                )}
              </AnimatePresence>

            </div>

          </div>
        )}

      </div>

    </div>
  );
}
