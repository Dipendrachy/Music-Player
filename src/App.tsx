/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Song, Playlist, ThemeType, AppSettings } from './types';
import { offlineDb, fileStorage } from './services/db';
import { audioEngine } from './services/audioEngine';

// Subcomponents
import AndroidFrame from './components/AndroidFrame';
import Dashboard from './components/Dashboard';
import LibraryTab from './components/LibraryTab';
import FolderTab from './components/FolderTab';
import EqualizerTab from './components/EqualizerTab';
import SettingsTab from './components/SettingsTab';
import PlaylistDetails from './components/PlaylistDetails';
import PlayerView from './components/PlayerView';
import MiniPlayer from './components/MiniPlayer';
import MetadataDialog from './components/MetadataDialog';

// Icons
import { Play, FolderSync, Plus, FileAudio, ShieldAlert, CheckCircle, UploadCloud, X, Sliders, Home, Library, Folder, FolderOpen, Settings, Disc, Music } from 'lucide-react';

export default function App() {
  const [songs, setSongs] = useState<Song[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [settings, setSettings] = useState<AppSettings>(() => offlineDb.getSettings());
  
  // Startup Loading states
  const [appLoading, setAppLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingStatus, setLoadingStatus] = useState('Initializing offline database...');
  
  const isLight = settings.theme === 'light';
  
  // Navigation & View States
  const [activeTab, setActiveTab] = useState<'home' | 'library' | 'folders' | 'equalizer' | 'settings'>('home');
  const [activePlaylist, setActivePlaylist] = useState<Playlist | null>(null);
  const [isPlayerExpanded, setIsPlayerExpanded] = useState(false);
  const [editingMetadataSong, setEditingMetadataSong] = useState<Song | null>(null);

  // Active Playback states (synced with AudioEngine)
  const [currentSong, setCurrentSong] = useState<Song | null>(null);
  const [playbackState, setPlaybackState] = useState<'playing' | 'paused' | 'stopped'>('stopped');

  // Scanning Animation Overlay
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [scanLabel, setScanLabel] = useState('');

  // File Upload Dropzone
  const [showUploader, setShowUploader] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ active: boolean; current: number; total: number; label: string }>({
    active: false,
    current: 0,
    total: 0,
    label: ''
  });

  useEffect(() => {
    // Progress loader for first open
    const startTime = Date.now();
    const duration = 2200; // 2.2 seconds loading
    
    const loadingInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const rawProgress = Math.min((elapsed / duration) * 100, 100);
      setLoadingProgress(rawProgress);

      if (rawProgress < 20) {
        setLoadingStatus('Initializing offline database...');
      } else if (rawProgress < 45) {
        setLoadingStatus('Loading high-fidelity audio engine...');
      } else if (rawProgress < 70) {
        setLoadingStatus('Scanning internal storage tracks...');
      } else if (rawProgress < 90) {
        setLoadingStatus('Configuring 10-band equalizer presets...');
      } else if (rawProgress < 100) {
        setLoadingStatus('Finalizing local workspace...');
      } else {
        setLoadingStatus('Ready to play!');
        clearInterval(loadingInterval);
        setTimeout(() => {
          setAppLoading(false);
        }, 400);
      }
    }, 40);

    return () => clearInterval(loadingInterval);
  }, []);

  useEffect(() => {
    // Initial DB loads
    refreshCollection();

    // Wire up listeners from Audio Engine
    const unsubState = audioEngine.onStateChange(() => {
      setCurrentSong(audioEngine.getCurrentSong());
      setPlaybackState(audioEngine.getPlaybackState());
    });

    // Auto scan simulation on first boot
    const firstBoot = !localStorage.getItem('offline_player_booted_before');
    if (firstBoot) {
      triggerStorageScan();
      localStorage.setItem('offline_player_booted_before', 'true');
    }

    return () => unsubState();
  }, []);

  const refreshCollection = () => {
    let dbSongs = offlineDb.getSongs();
    let hasUpdates = false;

    const repairedSongs = dbSongs.map(song => {
      let isUpdated = false;
      let title = song.title;
      let artist = song.artist;
      let album = song.album;

      // Repair cut/split titles from the original filename stored in path
      let fullFilename = '';
      if (!song.isProcedural && song.path) {
        const lastSlash = song.path.lastIndexOf('/');
        if (lastSlash !== -1) {
          const filename = song.path.substring(lastSlash + 1);
          fullFilename = filename.replace(/\.[^/.]+$/, ""); // strip extension
          if (song.title !== fullFilename && fullFilename.trim().length > 0) {
            title = fullFilename;
            isUpdated = true;
          }
        }
      }

      // Extract real artist name from filename if artist is generic
      if (song.artist === 'Local' || song.artist === 'Local Storage Artist' || song.artist === 'Unknown Artist') {
        let parsedArtist = '';
        const targetFilename = fullFilename || (song.title || '');
        if (targetFilename.includes(' - ')) {
          parsedArtist = targetFilename.split(' - ')[0].trim();
        } else if (targetFilename.includes(' -')) {
          parsedArtist = targetFilename.split(' -')[0].trim();
        } else if (targetFilename.includes('- ')) {
          parsedArtist = targetFilename.split('- ')[0].trim();
        } else if (targetFilename.includes('-')) {
          parsedArtist = targetFilename.split('-')[0].trim();
        } else if (targetFilename.includes('_')) {
          parsedArtist = targetFilename.split('_')[0].trim();
        }

        if (parsedArtist && parsedArtist !== 'Unknown Artist') {
          artist = parsedArtist;
          isUpdated = true;
        } else if (song.artist === 'Local' || song.artist === 'Local Storage Artist') {
          artist = 'Unknown Artist';
          isUpdated = true;
        }
      }

      // Remove "Local Downloads" as album name
      if (song.album === 'Local Downloads') {
        album = '';
        isUpdated = true;
      }

      let genre = song.genre;
      if (song.genre === 'Offline Media') {
        genre = '';
        isUpdated = true;
      }

      if (isUpdated) {
        hasUpdates = true;
        return { ...song, title, artist, album, genre };
      }
      return song;
    });

    if (hasUpdates) {
      offlineDb.saveSongs(rerepairedSongsOnly(repairedSongs));
      dbSongs = repairedSongs;
    }

    setSongs(dbSongs);
    const updatedPlaylists = offlineDb.getPlaylists();
    setPlaylists(updatedPlaylists);
    
    // Also sync the active playlist so the displayed tracks update instantly
    if (activePlaylist) {
      const latestPl = updatedPlaylists.find(p => p.id === activePlaylist.id);
      if (latestPl) {
        setActivePlaylist(latestPl);
      }
    }
  };

  // Helper helper to avoid nested naming conflicts
  function rerepairedSongsOnly(songsList: Song[]) {
    return songsList;
  }

  const triggerStorageScan = () => {
    setIsScanning(true);
    setScanProgress(0);
    
    const paths = [
      'Internal Storage/Music/Lofi/',
      'Internal Storage/Music/Synthwave/',
      'Internal Storage/Music/Ambient/',
      'Internal Storage/Music/Classical/',
      'SD Card/Music/Electronic/',
      'Internal Storage/Downloads/',
      'Internal Storage/Recordings/'
    ];

    let currentPathIdx = 0;
    const interval = setInterval(() => {
      setScanProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setTimeout(() => {
            setIsScanning(false);
            refreshCollection();
          }, 600);
          return 100;
        }

        // Cycle scan paths visually
        if (prev % 15 === 0 && currentPathIdx < paths.length) {
          setScanLabel(`Scanning directory: ${paths[currentPathIdx]}`);
          currentPathIdx++;
        }

        return prev + 4;
      });
    }, 80);
  };

  // Pure-TypeScript ID3/M4A cover art extractor (client-side, robust, no external deps)
  const extractEmbeddedCover = async (file: Blob): Promise<Blob | null> => {
    try {
      const buffer = await file.slice(0, 10 * 1024 * 1024).arrayBuffer(); // slice first 10MB
      const view = new DataView(buffer);
      if (view.byteLength < 10) return null;

      // Helper to find image format signatures
      const findImageStart = (dataView: DataView, start: number, maxBytes: number) => {
        const limit = Math.min(dataView.byteLength - 4, start + maxBytes);
        for (let i = start; i < limit; i++) {
          // JPEG: FF D8 FF
          if (dataView.getUint8(i) === 0xFF && dataView.getUint8(i + 1) === 0xD8 && dataView.getUint8(i + 2) === 0xFF) {
            return { offset: i, mime: 'image/jpeg' };
          }
          // PNG: 89 50 4E 47
          if (
            dataView.getUint8(i) === 0x89 &&
            dataView.getUint8(i + 1) === 0x50 &&
            dataView.getUint8(i + 2) === 0x4E &&
            dataView.getUint8(i + 3) === 0x47
          ) {
            return { offset: i, mime: 'image/png' };
          }
          // WEBP: RIFF .... WEBP
          if (
            dataView.getUint8(i) === 0x52 &&
            dataView.getUint8(i + 1) === 0x49 &&
            dataView.getUint8(i + 2) === 0x46 &&
            dataView.getUint8(i + 3) === 0x46 &&
            i + 11 < dataView.byteLength &&
            dataView.getUint8(i + 8) === 0x57 &&
            dataView.getUint8(i + 9) === 0x45 &&
            dataView.getUint8(i + 10) === 0x42 &&
            dataView.getUint8(i + 11) === 0x50
          ) {
            return { offset: i, mime: 'image/webp' };
          }
          // GIF: 47 49 46 38 ("GIF8")
          if (
            dataView.getUint8(i) === 0x47 &&
            dataView.getUint8(i + 1) === 0x49 &&
            dataView.getUint8(i + 2) === 0x46 &&
            dataView.getUint8(i + 3) === 0x38
          ) {
            return { offset: i, mime: 'image/gif' };
          }
          // BMP: 42 4D ("BM")
          if (
            dataView.getUint8(i) === 0x42 &&
            dataView.getUint8(i + 1) === 0x4D
          ) {
            return { offset: i, mime: 'image/bmp' };
          }
        }
        return null;
      };

      // Check for ID3v2 (MP3)
      const isID3 = view.getUint8(0) === 0x49 && view.getUint8(1) === 0x44 && view.getUint8(2) === 0x33;
      if (isID3) {
        // Find "APIC" frame (ID3v2.3/v2.4) or "PIC" frame (ID3v2.2)
        let offset = 10;
        const limit = Math.min(view.byteLength - 10, 5 * 1024 * 1024);
        let apicOffset = -1;
        let isPic = false;
        while (offset < limit) {
          if (
            view.getUint8(offset) === 0x41 && // 'A'
            view.getUint8(offset + 1) === 0x50 && // 'P'
            view.getUint8(offset + 2) === 0x49 && // 'I'
            view.getUint8(offset + 3) === 0x43    // 'C'
          ) {
            apicOffset = offset;
            break;
          }
          offset++;
        }

        if (apicOffset === -1) {
          // Check for ID3v2.2 "PIC"
          offset = 10;
          while (offset < limit) {
            if (
              view.getUint8(offset) === 0x50 && // 'P'
              view.getUint8(offset + 1) === 0x49 && // 'I'
              view.getUint8(offset + 2) === 0x43    // 'C'
            ) {
              apicOffset = offset;
              isPic = true;
              break;
            }
            offset++;
          }
        }

        if (apicOffset !== -1) {
          let frameSize = 0;
          let payloadStart = 0;
          
          if (isPic) {
            // ID3v2.2 PIC size is 3 bytes
            const b1 = view.getUint8(apicOffset + 3);
            const b2 = view.getUint8(apicOffset + 4);
            const b3 = view.getUint8(apicOffset + 5);
            frameSize = (b1 << 16) | (b2 << 8) | b3;
            payloadStart = apicOffset + 6;
          } else {
            frameSize = view.getUint32(apicOffset + 4);
            const majorVersion = view.getUint8(3);
            if (majorVersion === 4) {
              // synchsafe size decode for ID3v2.4
              const b1 = (frameSize >> 24) & 0xFF;
              const b2 = (frameSize >> 16) & 0xFF;
              const b3 = (frameSize >> 8) & 0xFF;
              const b4 = frameSize & 0xFF;
              frameSize = (b1 << 21) | (b2 << 14) | (b3 << 7) | b4;
            }
            payloadStart = apicOffset + 10;
          }

          // Scan generously up to 2048 bytes of frame payload for standard image headers
          const imgInfo = findImageStart(view, payloadStart, Math.min(frameSize > 0 ? frameSize : 5000, 2048));
          if (imgInfo) {
            const frameEnd = payloadStart + (frameSize > 0 ? frameSize : 5000);
            let imageSize = frameEnd - imgInfo.offset;
            if (imageSize <= 0 || imgInfo.offset + imageSize > view.byteLength) {
              imageSize = view.byteLength - imgInfo.offset;
            }
            if (imageSize > 0) {
              const imgBuffer = buffer.slice(imgInfo.offset, imgInfo.offset + imageSize);
              return new Blob([imgBuffer], { type: imgInfo.mime });
            }
          }
        }
      }

      // Check for MP4/M4A "covr" box
      let offset = 0;
      const limit = Math.min(view.byteLength - 8, 5 * 1024 * 1024);
      let covrOffset = -1;
      while (offset < limit) {
        if (
          view.getUint8(offset) === 0x63 && // 'c'
          view.getUint8(offset + 1) === 0x6F && // 'o'
          view.getUint8(offset + 2) === 0x76 && // 'v'
          view.getUint8(offset + 3) === 0x72    // 'r'
        ) {
          covrOffset = offset;
          break;
        }
        offset++;
      }

      if (covrOffset !== -1) {
        let dataOffset = covrOffset + 4;
        const dataLimit = Math.min(covrOffset + 100, view.byteLength - 8);
        let foundData = -1;
        while (dataOffset < dataLimit) {
          if (
            view.getUint8(dataOffset) === 0x64 && // 'd'
            view.getUint8(dataOffset + 1) === 0x61 && // 'a'
            view.getUint8(dataOffset + 2) === 0x74 && // 't'
            view.getUint8(dataOffset + 3) === 0x61    // 'a'
          ) {
            foundData = dataOffset;
            break;
          }
          dataOffset++;
        }

        if (foundData !== -1) {
          const dataBoxSize = view.getUint32(foundData - 4);
          // Scan generously up to 512 bytes inside the data box payload for standard image headers
          const imgInfo = findImageStart(view, foundData + 8, Math.min(dataBoxSize > 0 ? dataBoxSize : 5000, 512));
          if (imgInfo) {
            const dataBoxEnd = foundData - 4 + (dataBoxSize > 0 ? dataBoxSize : 5000);
            let imageSize = dataBoxEnd - imgInfo.offset;
            if (imageSize <= 0 || imgInfo.offset + imageSize > view.byteLength) {
              imageSize = view.byteLength - imgInfo.offset;
            }
            if (imageSize > 0) {
              const imgBuffer = buffer.slice(imgInfo.offset, imgInfo.offset + imageSize);
              return new Blob([imgBuffer], { type: imgInfo.mime });
            }
          }
        }
      }
    } catch (err) {
      console.error("Error extracting embedded cover:", err);
    }
    return null;
  };

  // HTML5 Audio File Uploader API
  const handleLocalAudioUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadProgress({
      active: true,
      current: 0,
      total: files.length,
      label: 'Initializing file parser...'
    });

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      setUploadProgress(prev => ({
        ...prev,
        current: i + 1,
        label: `Parsing "${file.name}" tags...`
      }));

      // A simple tag guesser from filename
      const fullFilename = file.name.replace(/\.[^/.]+$/, ""); // strip extension
      const title = fullFilename;
      let artist = 'Unknown Artist';
      if (fullFilename.includes(' - ')) {
        artist = fullFilename.split(' - ')[0].trim();
      } else if (fullFilename.includes(' -')) {
        artist = fullFilename.split(' -')[0].trim();
      } else if (fullFilename.includes('- ')) {
        artist = fullFilename.split('- ')[0].trim();
      } else if (fullFilename.includes('-')) {
        artist = fullFilename.split('-')[0].trim();
      } else if (fullFilename.includes('_')) {
        artist = fullFilename.split('_')[0].trim();
      }

      // Read real audio file duration via dynamic audio tag elements
      const duration: number = await new Promise((resolve) => {
        const tempAudio = new Audio();
        const objectUrl = URL.createObjectURL(file);
        tempAudio.src = objectUrl;
        tempAudio.addEventListener('loadedmetadata', () => {
          resolve(tempAudio.duration);
          URL.revokeObjectURL(objectUrl);
        });
        tempAudio.addEventListener('error', () => {
          resolve(180); // default fallback
          URL.revokeObjectURL(objectUrl);
        });
      });

      const songId = `user-song-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const newSong: Song = {
        id: songId,
        title,
        artist,
        album: '',
        genre: '',
        year: new Date().getFullYear(),
        duration: Math.round(duration),
        fileSize: Number((file.size / (1024 * 1024)).toFixed(1)),
        path: `Internal Storage/Downloads/${file.name}`,
        isFavorite: false,
        playCount: 0,
        dateAdded: Date.now(),
        isProcedural: false,
        artworkSeed: file.name,
      };

      // Save file binary blob and cover art in IndexedDB
      try {
        await fileStorage.saveFile(songId, file);
        
        // Extract embedded cover art
        const coverBlob = await extractEmbeddedCover(file);
        if (coverBlob) {
          await fileStorage.saveFile(`${songId}-cover`, coverBlob);
        }

        // Save song metadata record in local storage
        offlineDb.addSong(newSong);
      } catch (err) {
        console.error('Failed to index file in local IndexedDB:', err);
      }
    }

    setUploadProgress({ active: false, current: 0, total: 0, label: '' });
    setShowUploader(false);
    refreshCollection();
  };

  const handlePlaySong = (song: Song, customQueue?: Song[]) => {
    if (customQueue && customQueue.length > 0) {
      const idx = customQueue.findIndex(s => s.id === song.id);
      audioEngine.setQueue(customQueue, idx !== -1 ? idx : 0, true);
    } else {
      audioEngine.setQueue([song], 0, true);
    }
    setIsPlayerExpanded(true);
  };

  const handlePlayAll = () => {
    if (songs.length === 0) return;
    audioEngine.setQueue(songs, 0, true);
    setIsPlayerExpanded(true);
  };

  const handleQuickAddSongToPlaylist = (song: Song) => {
    const customPlaylists = playlists.filter(p => !p.isSmart);
    if (customPlaylists.length === 0) {
      // Auto create one if none exist
      const newPl = offlineDb.createPlaylist('My Offline Jam List', 'Quick capture playlist');
      const allPls = offlineDb.getPlaylists();
      allPls.forEach(p => {
        if (p.id === newPl.id) p.songIds.push(song.id);
      });
      offlineDb.savePlaylists(allPls);
      refreshCollection();
      alert(`Song added to new playlist "${newPl.name}"!`);
    } else {
      // Pick first one
      const target = customPlaylists[0];
      const allPls = offlineDb.getPlaylists();
      const idx = allPls.findIndex(p => p.id === target.id);
      if (idx !== -1 && !allPls[idx].songIds.includes(song.id)) {
        allPls[idx].songIds.push(song.id);
        offlineDb.savePlaylists(allPls);
        refreshCollection();
        alert(`Song added to playlist "${target.name}"!`);
      }
    }
  };

  // SYSTEM EMULATOR BACK NAVIGATION CONTROLLER
  const handleSystemBack = () => {
    if (isPlayerExpanded) {
      setIsPlayerExpanded(false);
    } else if (activePlaylist) {
      setActivePlaylist(null);
    } else if (activeTab !== 'home') {
      setActiveTab('home');
    }
  };

  const handleSystemHome = () => {
    setIsPlayerExpanded(false);
    setActivePlaylist(null);
    setActiveTab('home');
  };

  const handleSystemRecents = () => {
    // Show a quick storage status feedback
    alert(`Emulated Offline Storage Info:\n• Indexed tracks: ${songs.length}\n• Playlists: ${playlists.length}\n• History size: ${offlineDb.getHistory().length}`);
  };

  const activeSettings = settings;

  // Convert settings theme selection into visual class selectors
  const getThemeClass = (): string => {
    const th = activeSettings.theme;
    if (th === 'amoled') return 'theme-amoled bg-black text-white';
    if (th === 'light') return 'theme-light bg-gray-50 text-gray-900 border-gray-200';
    return 'theme-dark bg-[#0f0f10] text-gray-300'; // dark or dynamic dark fallback
  };

  return (
    <AndroidFrame
      onSystemBack={handleSystemBack}
      onSystemHome={handleSystemHome}
      onSystemRecents={handleSystemRecents}
    >
      <div className={`w-full h-full flex flex-col overflow-hidden relative ${getThemeClass()}`}>
        
        {/* Startup Cinematic Loading Screen */}
        <AnimatePresence>
          {appLoading && (
            <motion.div
              initial={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6, ease: 'easeInOut' }}
              className="absolute inset-0 bg-[#070708] z-50 flex flex-col items-center justify-center p-12 select-none"
            >
              {/* Dynamic Ambient Color Glows */}
              <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {/* Emerald ambient light */}
                <motion.div
                  animate={{
                    scale: [1, 1.25, 0.95, 1.15, 1],
                    x: [0, 25, -15, 20, 0],
                    y: [0, -20, 25, -15, 0],
                    opacity: [0.12, 0.22, 0.14, 0.26, 0.12],
                  }}
                  transition={{
                    repeat: Infinity,
                    duration: 8,
                    ease: "easeInOut",
                  }}
                  className="absolute -top-1/4 -left-1/4 w-[150%] h-[150%] rounded-full bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.18)_0%,transparent_60%)]"
                />
                {/* Teal ambient light */}
                <motion.div
                  animate={{
                    scale: [1, 0.9, 1.2, 0.95, 1],
                    x: [0, -20, 30, -25, 0],
                    y: [0, 25, -20, 20, 0],
                    opacity: [0.08, 0.18, 0.11, 0.22, 0.08],
                  }}
                  transition={{
                    repeat: Infinity,
                    duration: 10,
                    ease: "easeInOut",
                    delay: 1,
                  }}
                  className="absolute -bottom-1/4 -right-1/4 w-[150%] h-[150%] rounded-full bg-[radial-gradient(circle_at_center,rgba(20,184,166,0.18)_0%,transparent_60%)]"
                />
                {/* Green dynamic highlights */}
                <motion.div
                  animate={{
                    scale: [1, 1.35, 0.8, 1.15, 1],
                    x: [0, 35, -30, 15, 0],
                    y: [0, 30, -25, 30, 0],
                    opacity: [0.06, 0.14, 0.08, 0.18, 0.06],
                  }}
                  transition={{
                    repeat: Infinity,
                    duration: 12,
                    ease: "easeInOut",
                    delay: 2,
                  }}
                  className="absolute top-1/4 left-1/4 w-[100%] h-[100%] rounded-full bg-[radial-gradient(circle_at_center,rgba(34,197,94,0.12)_0%,transparent_50%)]"
                />
              </div>

              {/* Center Spinning / Pulsing Music Icon Container */}
              <div className="relative flex items-center justify-center z-10">
                {/* Outer pulsing ripple 3 */}
                <motion.div
                  animate={{ scale: [1, 1.45, 1], opacity: [0.12, 0, 0.12] }}
                  transition={{ repeat: Infinity, duration: 3.2, ease: "easeInOut" }}
                  className="absolute w-56 h-56 rounded-full border border-emerald-500/15"
                />
                {/* Outer pulsing ripple 2 */}
                <motion.div
                  animate={{ scale: [1, 1.28, 1], opacity: [0.18, 0.02, 0.18] }}
                  transition={{ repeat: Infinity, duration: 2.6, ease: "easeInOut", delay: 0.4 }}
                  className="absolute w-44 h-44 rounded-full border border-teal-500/20"
                />
                {/* Outer pulsing ripple 1 */}
                <motion.div
                  animate={{ scale: [1, 1.15, 1], opacity: [0.25, 0.05, 0.25] }}
                  transition={{ repeat: Infinity, duration: 2, ease: "easeInOut", delay: 0.8 }}
                  className="absolute w-36 h-36 rounded-full border border-green-500/25"
                />

                {/* Rotating Inner Disc with glowing rings */}
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 20, ease: "linear" }}
                  className="w-28 h-28 rounded-full bg-gradient-to-tr from-zinc-950 via-zinc-900 to-zinc-950 border border-zinc-800/80 shadow-[0_0_40px_rgba(16,185,129,0.25)] flex items-center justify-center relative"
                >
                  {/* Circular design rings */}
                  <div className="absolute inset-1.5 rounded-full border border-zinc-800/40" />
                  <div className="absolute inset-3.5 rounded-full border border-zinc-800/60" />
                  <div className="absolute inset-6 rounded-full border border-zinc-800/80" />
                  <div className="absolute inset-8 rounded-full border border-zinc-800" />
                </motion.div>

                {/* Green color logo from homepage (Emerald circle with black filled play icon) in the absolute center, pulsing */}
                <motion.div
                  animate={{
                    scale: [0.95, 1.12, 0.95],
                  }}
                  transition={{
                    repeat: Infinity,
                    duration: 2,
                    ease: "easeInOut"
                  }}
                  className="absolute z-20 flex items-center justify-center w-14 h-14 rounded-full bg-emerald-500 shadow-[0_0_25px_rgba(16,185,129,0.45)]"
                >
                  <Play className="w-6.5 h-6.5 text-black fill-black ml-1" />
                </motion.div>

                {/* Floating Micro Music Particles */}
                <motion.div
                  animate={{ y: [-4, 4, -4], x: [-2, 2, -2] }}
                  transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
                  className="absolute -top-6 -right-6 text-emerald-500/40"
                >
                  <Music className="w-4 h-4" />
                </motion.div>
                <motion.div
                  animate={{ y: [3, -3, 3], x: [1, -1, 1] }}
                  transition={{ repeat: Infinity, duration: 2.5, ease: "easeInOut" }}
                  className="absolute -bottom-6 -left-6 text-teal-500/35"
                >
                  <Disc className="w-4 h-4" />
                </motion.div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Main top context toolbar (Import / Refresh scanner trigger) */}
        {activeTab !== 'home' && activeTab !== 'equalizer' && activeTab !== 'settings' && activeTab !== 'library' && !activePlaylist && (
          <div className="px-5 py-3.5 bg-black flex items-center justify-between z-10 select-none border-b border-gray-900/40">
            <span className="text-[10px] font-mono tracking-widest text-gray-500 uppercase flex items-center gap-1">
              <FolderSync className="w-3.5 h-3.5" /> Media Scanner Active
            </span>
            <div className="flex gap-2">
              <button
                onClick={() => setShowUploader(!showUploader)}
                className="px-3 py-1 bg-red-600 hover:bg-red-500 text-white font-bold text-[10px] rounded-full flex items-center gap-1 transition-all"
                title="Import local MP3 / WAV files"
              >
                <Plus className="w-3 h-3" /> Import Audio
              </button>
              <button
                onClick={triggerStorageScan}
                className="p-1 text-gray-500 hover:text-white transition-colors"
                title="Rescan directories"
              >
                <FolderSync className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}

        {/* Dynamic File Uploader Modal Dropzone */}
        {showUploader && (
          <div className="absolute inset-x-0 top-14 bg-[#16161a] border-b border-gray-800 p-5 z-40 animate-slide-down flex flex-col space-y-3.5 text-xs shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-gray-200 flex items-center gap-1.5">
                <UploadCloud className="w-4 h-4 text-red-500" /> Import Offline Tracks
              </h3>
              <button onClick={() => setShowUploader(false)} className="text-gray-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-[10px] text-gray-500 leading-normal">
              Drag-and-drop or click to import files (MP3, WAV, FLAC, AAC, M4A, OGG) from your device. Files will be saved strictly inside the browser's sandbox database.
            </p>

            <div className="border border-dashed border-gray-800 rounded-xl p-6 text-center hover:border-red-500/50 transition-colors relative cursor-pointer group">
              <input
                type="file"
                multiple
                accept="audio/*"
                onChange={handleLocalAudioUpload}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <FileAudio className="w-8 h-8 text-gray-600 group-hover:text-red-400 transition-colors mx-auto mb-2" />
              <span className="text-gray-400 font-medium">Select audio files from disk</span>
            </div>
          </div>
        )}

        {/* Global Loading / Scanner Animation Overlay */}
        {isScanning && (
          <div className="absolute inset-0 bg-[#0f0f10]/95 z-50 flex flex-col items-center justify-center p-8 select-none font-display">
            <div className="w-16 h-16 rounded-full border-4 border-red-500/20 border-t-red-600 animate-spin mb-6" />
            <h2 className="font-semibold text-base text-gray-100 mb-1.5">Device Media Store Scan</h2>
            <p className="text-[11px] text-gray-500 font-mono tracking-tight text-center max-w-[280px] h-8 truncate">
              {scanLabel}
            </p>
            <div className="w-52 h-1 bg-gray-900 rounded-full mt-4 overflow-hidden relative">
              <div 
                className="h-full bg-red-600 transition-all duration-300"
                style={{ width: `${scanProgress}%` }}
              />
            </div>
            <span className="font-mono text-[10px] text-gray-600 mt-2 font-bold">{scanProgress}%</span>
          </div>
        )}

        {/* Upload progress state indicator overlay */}
        {uploadProgress.active && (
          <div className="absolute inset-0 bg-black/80 z-50 flex flex-col items-center justify-center p-8">
            <div className="w-12 h-12 bg-red-950/40 text-red-400 rounded-2xl flex items-center justify-center mb-4 border border-red-900/30">
              <UploadCloud className="w-6 h-6 animate-bounce" />
            </div>
            <h3 className="font-semibold text-sm text-gray-200">Writing file to local IndexedDB</h3>
            <p className="text-[10px] text-gray-500 font-mono mt-1 text-center truncate max-w-[280px]">{uploadProgress.label}</p>
            <span className="text-[11px] font-mono text-red-400 font-bold mt-3">
              File {uploadProgress.current} of {uploadProgress.total}
            </span>
          </div>
        )}

        {/* Active main view rendering layout */}
        <div className="flex-1 overflow-hidden relative">
          {activePlaylist ? (
            <PlaylistDetails
              playlist={activePlaylist}
              songs={songs}
              onBack={() => setActivePlaylist(null)}
              onPlaySong={handlePlaySong}
              onRefresh={refreshCollection}
              hasActiveTrack={!!currentSong}
            />
          ) : (
            <>
              {activeTab === 'home' && (
                <Dashboard
                  songs={songs}
                  playlists={playlists}
                  onPlaySong={handlePlaySong}
                  onNavigateToTab={(tab) => setActiveTab(tab)}
                  onSelectPlaylist={(pl) => setActivePlaylist(pl)}
                  onPlayAll={handlePlayAll}
                />
              )}
              {activeTab === 'library' && (
                <LibraryTab
                  songs={songs}
                  playlists={playlists}
                  onPlaySong={handlePlaySong}
                  onSelectPlaylist={(pl) => setActivePlaylist(pl)}
                  onRefresh={refreshCollection}
                  onEditMetadata={(song) => setEditingMetadataSong(song)}
                  hasActiveTrack={!!currentSong}
                />
              )}
              {activeTab === 'folders' && (
                <FolderTab
                  songs={songs}
                  onPlaySong={handlePlaySong}
                  onAddToPlaylist={handleQuickAddSongToPlaylist}
                  hasActiveTrack={!!currentSong}
                />
              )}
              {activeTab === 'equalizer' && <EqualizerTab />}
              {activeTab === 'settings' && (
                <SettingsTab
                  onRefreshLibrary={refreshCollection}
                  onTriggerScan={triggerStorageScan}
                  onTriggerImport={() => setShowUploader(true)}
                  onSettingsChange={setSettings}
                />
              )}
            </>
          )}
        </div>

        {/* Persistent bottom Mini player card */}
        {currentSong && !isPlayerExpanded && (
          <MiniPlayer
            currentSong={currentSong}
            playbackState={playbackState}
            onExpand={() => setIsPlayerExpanded(true)}
            onRefresh={refreshCollection}
            isLight={isLight}
          />
        )}

        {/* Slide-Up Full screen Player Drawer */}
        {isPlayerExpanded && currentSong && (
          <PlayerView
            currentSong={currentSong}
            playbackState={playbackState}
            onCollapse={() => setIsPlayerExpanded(false)}
            onRefresh={refreshCollection}
          />
        )}

        {/* Modal Metadata Dialog Tag editor */}
        {editingMetadataSong && (
          <MetadataDialog
            song={editingMetadataSong}
            onClose={() => setEditingMetadataSong(null)}
            onSave={refreshCollection}
          />
        )}

        {/* Sleek bottom Tab navigation bar */}
        {!isPlayerExpanded && (
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-black/75 flex justify-around select-none py-1 z-20">

            {[
              { id: 'home', label: 'Home', icon: Home, activeIcon: Home },
              { id: 'library', label: 'Library', icon: Library, activeIcon: Library },
              { id: 'folders', label: 'Folders', icon: Folder, activeIcon: FolderOpen },
              { id: 'settings', label: 'Settings', icon: Settings, activeIcon: Settings },
            ].map((tab) => {
              const isActive = activeTab === tab.id && !activePlaylist;
              const IconComponent = isActive ? tab.activeIcon : tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => {
                    setActiveTab(tab.id as any);
                    setActivePlaylist(null);
                  }}
                  className="flex flex-col items-center justify-center flex-1 h-full font-semibold relative"
                >
                  <div className={`w-12 h-7 flex items-center justify-center transition-all duration-300 ${
                    isActive ? 'text-white scale-105' : 'text-zinc-400 hover:text-zinc-200'
                  }`}>
                    <IconComponent 
                      className={`w-4.5 h-4.5 transition-all duration-300 ${
                        isActive ? 'text-white' : 'text-zinc-400 hover:text-zinc-200'
                      }`} 
                      fill={isActive && tab.id !== 'settings' ? 'currentColor' : 'none'}
                    />
                  </div>
                  <span className={`text-[9px] mt-0.5 transition-colors duration-200 ${
                    isActive ? 'text-white font-extrabold' : 'text-zinc-400 font-medium'
                  }`}>
                    {tab.label}
                  </span>
                </button>
              );
            })}
          </div>
        )}

      </div>
    </AndroidFrame>
  );
}
