/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { Song, EqualizerSettings, AppSettings } from '../types';
import { offlineDb, fileStorage } from './db';

type PlaybackState = 'playing' | 'paused' | 'stopped';
type RepeatMode = 'off' | 'all' | 'one';

class AudioEngine {
  private ctx: AudioContext | null = null;
  private audio: HTMLAudioElement | null = null;
  
  // Audio Nodes
  private sourceNode: MediaElementAudioSourceNode | null = null;
  private eqFilters: BiquadFilterNode[] = [];
  private bassBoostFilter: BiquadFilterNode | null = null;
  private pannerNode: StereoPannerNode | null = null;
  private analyserNode: AnalyserNode | null = null;
  private masterGain: GainNode | null = null;
  private virtualizerDelay: DelayNode | null = null;
  private virtualizerGain: GainNode | null = null;

  // Queue & State
  private queue: Song[] = [];
  private originalQueue: Song[] = []; // for undo-shuffle
  private currentIndex: number = -1;
  private state: PlaybackState = 'stopped';
  private shuffleMode: boolean = false;
  private repeatMode: RepeatMode = 'off';
  private currentTime: number = 0;
  private sleepTimerSeconds: number = 0;
  private sleepTimerId: any = null;
  private onStateChangeCallbacks: Set<() => void> = new Set();
  private onTimeUpdateCallbacks: Set<(time: number) => void> = new Set();
  
  // Procedural Synth State
  private synthIntervalId: any = null;
  private synthStep: number = 0;
  private synthActiveNodes: (OscillatorNode | GainNode)[] = [];
  private synthBpm: number = 85;

  constructor() {
    if (typeof window !== 'undefined') {
      this.audio = new Audio();
      this.audio.preload = 'auto';
      
      // Wire up standard audio element events
      this.audio.addEventListener('timeupdate', () => {
        if (this.currentIndex >= 0 && !this.queue[this.currentIndex].isProcedural) {
          this.currentTime = this.audio?.currentTime || 0;
          this.triggerTimeUpdate();
        }
      });

      this.audio.addEventListener('ended', () => {
        this.handleTrackEnded();
      });

      // Periodic timer for procedural songs progress tracking
      setInterval(() => {
        if (this.state === 'playing' && this.currentIndex >= 0) {
          const song = this.queue[this.currentIndex];
          if (song.isProcedural) {
            const stepDuration = (60 / this.synthBpm) / 4; // duration of a 16th note
            this.currentTime += stepDuration;
            if (this.currentTime >= song.duration) {
              this.currentTime = song.duration;
              this.handleTrackEnded();
            } else {
              this.triggerTimeUpdate();
            }
          }
        }
      }, 200);

      // Restore settings & queue on load if configured
      this.initFromDb();
    }
  }

  private initFromDb() {
    const settings = offlineDb.getSettings();
    this.shuffleMode = false; // start fresh or load
    this.repeatMode = 'off';
    
    // Load songs
    const songs = offlineDb.getSongs();
    if (settings.rememberQueue) {
      const savedQueue = localStorage.getItem('offline_player_saved_queue');
      const savedIndex = localStorage.getItem('offline_player_saved_index');
      if (savedQueue) {
        try {
          const parsed = JSON.parse(savedQueue) as Song[];
          // Match with fresh DB songs (to ensure favorite, playcount are up to date)
          this.queue = parsed.map(pq => songs.find(s => s.id === pq.id) || pq);
          this.originalQueue = [...this.queue];
          if (savedIndex) {
            this.currentIndex = parseInt(savedIndex);
            if (this.currentIndex >= 0 && this.currentIndex < this.queue.length) {
              const song = this.queue[this.currentIndex];
              this.prepareSongAudio(song, false);
            }
          }
        } catch (e) {
          console.error('Failed to restore queue:', e);
        }
      }
    }
  }

  // Set up the Web Audio graph (must be triggered by user gesture)
  private ensureAudioContext() {
    if (!this.ctx) {
      // @ts-ignore
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      this.ctx = new AudioContextClass();
      this.setupAudioGraph();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  private setupAudioGraph() {
    if (!this.ctx || !this.audio) return;

    // Create source from audio element
    this.sourceNode = this.ctx.createMediaElementSource(this.audio);

    // Create Equalizer filters (5 bands: 60Hz, 230Hz, 910Hz, 4kHz, 14kHz)
    const frequencies = [60, 230, 910, 4000, 14000];
    this.eqFilters = frequencies.map((freq, i) => {
      const filter = this.ctx!.createBiquadFilter();
      if (i === 0) {
        filter.type = 'lowshelf';
      } else if (i === frequencies.length - 1) {
        filter.type = 'highshelf';
      } else {
        filter.type = 'peaking';
      }
      filter.frequency.value = freq;
      filter.Q.value = 1.0;
      filter.gain.value = 0;
      return filter;
    });

    // Create Bass Boost Filter (Lowshelf at 80Hz)
    this.bassBoostFilter = this.ctx.createBiquadFilter();
    this.bassBoostFilter.type = 'lowshelf';
    this.bassBoostFilter.frequency.value = 80;
    this.bassBoostFilter.gain.value = 0;

    // Create Panner (Left/Right balance)
    this.pannerNode = this.ctx.createStereoPanner();
    this.pannerNode.pan.value = 0;

    // Create Stereo Virtualizer (Delay + feedback mix)
    this.virtualizerDelay = this.ctx.createDelay();
    this.virtualizerDelay.delayTime.value = 0.025; // 25ms delay for Haas effect
    this.virtualizerGain = this.ctx.createGain();
    this.virtualizerGain.gain.value = 0;

    // Create Analyser
    this.analyserNode = this.ctx.createAnalyser();
    this.analyserNode.fftSize = 128; // small size for snappy fluid visualizer

    // Create Master Gain Node
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = 1.0;

    // Connect Node Pipeline
    // Source -> BassBoost -> EQ Filters Chain -> Virtualizer -> Panner -> Analyser -> Master Gain -> Destination
    let lastNode: AudioNode = this.sourceNode;
    
    // Connect EQ Filters chain
    lastNode.connect(this.bassBoostFilter);
    lastNode = this.bassBoostFilter;

    this.eqFilters.forEach((filter) => {
      lastNode.connect(filter);
      lastNode = filter;
    });

    // Simple delay feedback virtualizer node connection
    // Splitting stereo or feeding a delay mixed back
    const splitter = this.ctx.createChannelSplitter(2);
    const merger = this.ctx.createChannelMerger(2);
    
    lastNode.connect(splitter);
    
    // Left channel goes directly to merger
    splitter.connect(merger, 0, 0);
    
    // Right channel goes through delay node to create spatial width
    splitter.connect(this.virtualizerDelay, 1);
    this.virtualizerDelay.connect(this.virtualizerGain);
    this.virtualizerGain.connect(merger, 0, 1);

    // Recombine and connect to panner
    merger.connect(this.pannerNode);
    this.pannerNode.connect(this.analyserNode);
    this.analyserNode.connect(this.masterGain);
    this.masterGain.connect(this.ctx.destination);

    // Apply active EQ/settings
    this.applyEqualizerFromDb();
    this.applySettingsFromDb();
  }

  public applyEqualizerFromDb() {
    const eq = offlineDb.getEqualizer();
    if (!eq.enabled) {
      this.eqFilters.forEach(f => f.gain.value = 0);
      if (this.bassBoostFilter) this.bassBoostFilter.gain.value = 0;
      if (this.virtualizerGain) this.virtualizerGain.gain.value = 0;
      return;
    }

    // Apply bands
    this.eqFilters.forEach((filter, i) => {
      if (filter && eq.bands[i] !== undefined) {
        filter.gain.value = eq.bands[i];
      }
    });

    // Bass boost maps 0-100 to 0-12 dB
    if (this.bassBoostFilter) {
      this.bassBoostFilter.gain.value = (eq.bassBoost / 100) * 12;
    }

    // Virtualizer delay mix level
    if (this.virtualizerGain) {
      this.virtualizerGain.gain.value = (eq.virtualizer / 100) * 0.8;
    }
  }

  public applySettingsFromDb() {
    const settings = offlineDb.getSettings();
    
    // Set Playback rate
    if (this.audio) {
      this.audio.playbackRate = settings.playbackSpeed;
    }
    
    // Set balance pan
    if (this.pannerNode) {
      this.pannerNode.pan.value = settings.channelBalance;
    }

    // Adjust synthesizers speed
    this.synthBpm = 85 * settings.playbackSpeed;
  }

  // Visualizer Analyser Node exporter
  public getAnalyserData(): Uint8Array {
    if (!this.analyserNode) return new Uint8Array(0);
    const bufferLength = this.analyserNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    this.analyserNode.getByteFrequencyData(dataArray);
    return dataArray;
  }

  // State Callbacks
  public onStateChange(callback: () => void) {
    this.onStateChangeCallbacks.add(callback);
    return () => this.onStateChangeCallbacks.delete(callback);
  }

  public onTimeUpdate(callback: (time: number) => void) {
    this.onTimeUpdateCallbacks.add(callback);
    return () => this.onTimeUpdateCallbacks.delete(callback);
  }

  private triggerStateChange() {
    this.onStateChangeCallbacks.forEach((cb) => cb());
    
    // Persist queue index
    if (this.currentIndex >= 0) {
      localStorage.setItem('offline_player_saved_index', this.currentIndex.toString());
      localStorage.setItem('offline_player_saved_queue', JSON.stringify(this.queue));
    }
  }

  private triggerTimeUpdate() {
    this.onTimeUpdateCallbacks.forEach((cb) => cb(this.currentTime));
  }

  // Player Operations
  public setQueue(songs: Song[], startIndex: number = 0, startPlaying: boolean = true) {
    this.ensureAudioContext();
    this.originalQueue = [...songs];
    
    if (this.shuffleMode) {
      const selectedSong = songs[startIndex];
      const remainingSongs = songs.filter((_, i) => i !== startIndex);
      // Knuth shuffle remaining
      for (let i = remainingSongs.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [remainingSongs[i], remainingSongs[j]] = [remainingSongs[j], remainingSongs[i]];
      }
      this.queue = [selectedSong, ...remainingSongs];
      this.currentIndex = 0;
    } else {
      this.queue = [...songs];
      this.currentIndex = startIndex;
    }

    if (this.queue.length > 0) {
      this.playTrackAtIndex(this.currentIndex, startPlaying);
    }
  }

  public toggleShuffle() {
    this.shuffleMode = !this.shuffleMode;
    const currentSong = this.getCurrentSong();

    if (this.shuffleMode) {
      // Shuffle the queue, keeping current song as index 0
      if (currentSong) {
        const remaining = this.queue.filter(s => s.id !== currentSong.id);
        for (let i = remaining.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [remaining[i], remaining[j]] = [remaining[j], remaining[i]];
        }
        this.queue = [currentSong, ...remaining];
        this.currentIndex = 0;
      }
    } else {
      // Revert to original queue order
      this.queue = [...this.originalQueue];
      if (currentSong) {
        this.currentIndex = this.queue.findIndex(s => s.id === currentSong.id);
      }
    }
    this.triggerStateChange();
  }

  public toggleRepeat() {
    if (this.repeatMode === 'off') {
      this.repeatMode = 'all';
    } else if (this.repeatMode === 'all') {
      this.repeatMode = 'one';
    } else {
      this.repeatMode = 'off';
    }
    this.triggerStateChange();
  }

  public play() {
    this.ensureAudioContext();
    if (this.currentIndex < 0 && this.queue.length > 0) {
      this.currentIndex = 0;
    }
    if (this.currentIndex >= 0) {
      this.playTrackAtIndex(this.currentIndex, true);
    }
  }

  public pause() {
    this.state = 'paused';
    if (this.audio) {
      this.audio.pause();
    }
    this.stopProceduralSynth();
    this.triggerStateChange();
  }

  public stop() {
    this.state = 'stopped';
    if (this.audio) {
      this.audio.pause();
      this.audio.currentTime = 0;
    }
    this.currentTime = 0;
    this.stopProceduralSynth();
    this.triggerStateChange();
  }

  public next() {
    if (this.queue.length === 0) return;
    
    let nextIndex = this.currentIndex + 1;
    if (nextIndex >= this.queue.length) {
      if (this.repeatMode === 'all') {
        nextIndex = 0;
      } else {
        return; // stop playback at end of list
      }
    }
    this.playTrackAtIndex(nextIndex);
  }

  public prev() {
    if (this.queue.length === 0) return;

    // If song is more than 3 seconds in, restart it instead of going previous
    if (this.currentTime > 3) {
      this.seek(0);
      return;
    }

    let prevIndex = this.currentIndex - 1;
    if (prevIndex < 0) {
      if (this.repeatMode === 'all') {
        prevIndex = this.queue.length - 1;
      } else {
        prevIndex = 0; // stay on first track
      }
    }
    this.playTrackAtIndex(prevIndex);
  }

  public seek(seconds: number) {
    this.currentTime = seconds;
    const song = this.getCurrentSong();
    if (song && !song.isProcedural && this.audio) {
      this.audio.currentTime = seconds;
    }
    this.triggerTimeUpdate();
  }

  public playTrackAtIndex(index: number, autoPlay: boolean = true) {
    if (index < 0 || index >= this.queue.length) return;
    
    this.currentIndex = index;
    const song = this.queue[this.currentIndex];
    
    this.prepareSongAudio(song, autoPlay);
    
    if (autoPlay) {
      // Add to playback history
      offlineDb.addHistoryEntry(song.id);
    }
  }

  private async prepareSongAudio(song: Song, autoPlay: boolean) {
    this.stopProceduralSynth();
    if (this.audio) {
      this.audio.pause();
    }
    this.currentTime = 0;

    if (song.isProcedural) {
      if (this.currentIndex < 0 || this.queue[this.currentIndex]?.id !== song.id) {
        return;
      }
      this.currentTime = 0;
      if (autoPlay) {
        this.state = 'playing';
        this.startProceduralSynth(song.proceduralType || 'lofi');
      } else {
        this.state = 'paused';
      }
      this.triggerStateChange();
    } else {
      // Uploaded standard file or offline MP3
      if (this.audio) {
        let url = song.audioUrl || '';
        if (!url) {
          // If no active object URL in-memory, fetch the BLOB from IndexedDB storage
          try {
            const blob = await fileStorage.getFile(song.id);
            if (this.currentIndex < 0 || this.queue[this.currentIndex]?.id !== song.id) {
              return;
            }
            if (blob) {
              url = URL.createObjectURL(blob);
              song.audioUrl = url; // cache in memory
            }
          } catch (e) {
            console.error('Failed to load file blob from db:', e);
          }
        }

        if (this.currentIndex < 0 || this.queue[this.currentIndex]?.id !== song.id) {
          return;
        }

        if (url) {
          this.audio.src = url;
          this.audio.load();
          this.applySettingsFromDb();
          
          if (autoPlay) {
            this.state = 'playing';
            this.audio.play().catch((err) => {
              console.log('Audio autoplay blocked or failed, pausing:', err);
              this.state = 'paused';
              this.triggerStateChange();
            });
          } else {
            this.state = 'paused';
          }
        } else {
          console.error('Audio track file content not found for offline playback!');
          this.audio.src = '';
          this.state = 'stopped';
        }
        this.triggerStateChange();
      }
    }
  }

  private handleTrackEnded() {
    if (this.repeatMode === 'one') {
      this.seek(0);
      if (this.state === 'playing') {
        const song = this.getCurrentSong();
        if (song) this.prepareSongAudio(song, true);
      }
    } else {
      this.next();
    }
  }

  // Queue Operations
  public getQueue(): Song[] {
    return this.queue;
  }

  public getCurrentIndex(): number {
    return this.currentIndex;
  }

  public getCurrentSong(): Song | null {
    if (this.currentIndex >= 0 && this.currentIndex < this.queue.length) {
      return this.queue[this.currentIndex];
    }
    return null;
  }

  public updateSongInQueue(updatedSong: Song) {
    this.queue = this.queue.map(s => s.id === updatedSong.id ? { ...s, ...updatedSong } : s);
    this.originalQueue = this.originalQueue.map(s => s.id === updatedSong.id ? { ...s, ...updatedSong } : s);
    this.triggerStateChange();
  }

  public getPlaybackState(): PlaybackState {
    return this.state;
  }

  public setVolume(volume: number) {
    if (this.masterGain) {
      this.masterGain.gain.value = volume;
    }
    if (this.audio) {
      this.audio.volume = volume;
    }
  }

  public getShuffle(): boolean {
    return this.shuffleMode;
  }

  public getRepeat(): RepeatMode {
    return this.repeatMode;
  }

  public addToQueue(song: Song) {
    if (this.queue.some(s => s.id === song.id)) return;
    this.queue.push(song);
    this.originalQueue.push(song);
    this.triggerStateChange();
  }

  public playNext(song: Song) {
    // Remove if already in queue
    this.queue = this.queue.filter(s => s.id !== song.id);
    this.originalQueue = this.originalQueue.filter(s => s.id !== song.id);

    const insertIndex = this.currentIndex + 1;
    this.queue.splice(insertIndex, 0, song);
    this.originalQueue.push(song); // add to original tracking
    this.triggerStateChange();
  }

  public removeFromQueue(songId: string) {
    const songIndex = this.queue.findIndex(s => s.id === songId);
    if (songIndex === -1) return;

    this.queue = this.queue.filter(s => s.id !== songId);
    this.originalQueue = this.originalQueue.filter(s => s.id !== songId);

    if (this.currentIndex === songIndex) {
      if (this.queue.length === 0) {
        this.stop();
        this.currentIndex = -1;
      } else {
        this.next();
      }
    } else if (this.currentIndex > songIndex) {
      this.currentIndex -= 1;
    }
    this.triggerStateChange();
  }

  public reorderQueue(fromIndex: number, toIndex: number) {
    if (fromIndex < 0 || fromIndex >= this.queue.length || toIndex < 0 || toIndex >= this.queue.length) return;
    const item = this.queue.splice(fromIndex, 1)[0];
    this.queue.splice(toIndex, 0, item);
    
    // adjust current playing index
    if (this.currentIndex === fromIndex) {
      this.currentIndex = toIndex;
    } else if (this.currentIndex > fromIndex && this.currentIndex <= toIndex) {
      this.currentIndex -= 1;
    } else if (this.currentIndex < fromIndex && this.currentIndex >= toIndex) {
      this.currentIndex += 1;
    }
    this.triggerStateChange();
  }

  public clearQueue() {
    this.stop();
    this.queue = [];
    this.originalQueue = [];
    this.currentIndex = -1;
    this.triggerStateChange();
  }

  // Sleep Timer
  public setSleepTimer(minutes: number | 'end-of-song') {
    if (this.sleepTimerId) {
      clearTimeout(this.sleepTimerId);
      this.sleepTimerId = null;
    }

    if (minutes === 'end-of-song') {
      this.sleepTimerSeconds = -2; // flag for end of current song
      this.triggerStateChange();
      return;
    }

    if (minutes === 0) {
      this.sleepTimerSeconds = 0;
      this.triggerStateChange();
      return;
    }

    this.sleepTimerSeconds = minutes * 60;
    this.triggerStateChange();

    const tick = () => {
      if (this.sleepTimerSeconds > 0) {
        this.sleepTimerSeconds -= 1;
        this.triggerStateChange();
        this.sleepTimerId = setTimeout(tick, 1000);
      } else if (this.sleepTimerSeconds === 0) {
        this.pause();
        this.sleepTimerId = null;
      }
    };
    this.sleepTimerId = setTimeout(tick, 1000);
  }

  public getSleepTimerRemaining(): number {
    return this.sleepTimerSeconds;
  }

  // ==========================================
  // PROCEDURAL AUDIO SYNTHESIZERS (WEB AUDIO)
  // ==========================================
  private startProceduralSynth(type: 'lofi' | 'synthwave' | 'ambient' | 'piano' | 'electro') {
    if (!this.ctx) return;
    this.synthStep = 0;
    this.synthActiveNodes = [];

    // Master volume node for synthesized tracks inside our master graph
    const synthGain = this.ctx.createGain();
    synthGain.gain.setValueAtTime(0.5, this.ctx.currentTime);
    synthGain.connect(this.bassBoostFilter || this.ctx.destination);
    this.synthActiveNodes.push(synthGain);

    const stepTime = () => (60 / this.synthBpm) / 4; // duration of a 16th note

    const scheduleNextStep = () => {
      if (this.state !== 'playing' || !this.ctx) return;
      const now = this.ctx.currentTime;
      const duration = stepTime();

      this.playSynthStep(type, this.synthStep, now, duration, synthGain);

      this.synthStep = (this.synthStep + 1) % 16;
      this.synthIntervalId = setTimeout(scheduleNextStep, duration * 1000);
    };

    scheduleNextStep();
  }

  private playSynthStep(
    type: string,
    step: number,
    time: number,
    duration: number,
    outputNode: AudioNode
  ) {
    if (!this.ctx) return;

    // --- DRUMS / BEATS (Lofi, Synthwave, Electro) ---
    const isLofi = type === 'lofi';
    const isSynthwave = type === 'synthwave';
    const isElectro = type === 'electro';
    const isAmbient = type === 'ambient';
    const isPiano = type === 'piano';

    // Kick: Step 0, 8 (standard) or 4, 12 in high-energy electro
    const hasKick = (isElectro && (step % 4 === 0)) ||
                    (isLofi && (step === 0 || step === 10)) ||
                    (isSynthwave && (step === 0 || step === 8));

    // Snare / Clap: Step 4, 12
    const hasSnare = (isElectro && (step === 4 || step === 12)) ||
                     (isLofi && (step === 4 || step === 12)) ||
                     (isSynthwave && (step === 4 || step === 12));

    // Hi-hat: off-beats
    const hasHat = (isElectro && step % 2 === 2) ||
                   (isLofi && step % 4 !== 0 && Math.random() > 0.4) ||
                   (isSynthwave && step % 2 === 1);

    if (hasKick) {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.connect(gain);
      gain.connect(outputNode);

      osc.frequency.setValueAtTime(isLofi ? 55 : 65, time);
      osc.frequency.exponentialRampToValueAtTime(0.01, time + 0.15);
      
      gain.gain.setValueAtTime(isLofi ? 0.35 : 0.5, time);
      gain.gain.exponentialRampToValueAtTime(0.01, time + 0.15);

      osc.start(time);
      osc.stop(time + 0.2);
    }

    if (hasSnare) {
      // Synthesized noise snare
      const bufferSize = this.ctx.sampleRate * 0.15;
      const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }

      const noise = this.ctx.createBufferSource();
      noise.buffer = buffer;

      const filter = this.ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(isLofi ? 800 : 1000, time);

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(isLofi ? 0.12 : 0.2, time);
      gain.gain.exponentialRampToValueAtTime(0.01, time + 0.12);

      noise.connect(filter);
      filter.connect(gain);
      gain.connect(outputNode);

      noise.start(time);
      noise.stop(time + 0.15);
    }

    if (hasHat) {
      // High-passed metal-sound
      const osc = this.ctx.createOscillator();
      const filter = this.ctx.createBiquadFilter();
      const gain = this.ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(10000, time);

      filter.type = 'highpass';
      filter.frequency.setValueAtTime(7000, time);

      gain.gain.setValueAtTime(isLofi ? 0.05 : 0.08, time);
      gain.gain.exponentialRampToValueAtTime(0.001, time + 0.05);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(outputNode);

      osc.start(time);
      osc.stop(time + 0.06);
    }

    // --- MELODY / CHORDS / BASSLINES ---
    // Lofi Chords Progression: Cmaj7 (steps 0-3), Am7 (4-7), Dm7 (8-11), G7 (12-15)
    // Ambient: Infinite sparkling pentatonic (slow chimes)
    // Piano: Delicately plucked major/minor progression
    // Synthwave: Pumping 1/8 note bass + arpeggiator

    const chordsLofi = [
      [261.63, 329.63, 392.00, 493.88], // Cmaj7
      [220.00, 261.63, 329.63, 392.00], // Am7
      [293.66, 349.23, 440.00, 587.33], // Dm7
      [196.00, 246.94, 293.66, 349.23], // G7
    ];

    const bassSynthwave = [110.0, 110.0, 110.0, 110.0, 130.81, 130.81, 146.83, 164.81]; // A, C, D, E in bass octaves

    if (isLofi) {
      // Gentle chord pad on Step 0, 4, 8, 12
      if (step % 4 === 0) {
        const chordIndex = Math.floor(step / 4);
        const notes = chordsLofi[chordIndex];
        
        notes.forEach((freq) => {
          const osc = this.ctx!.createOscillator();
          const filter = this.ctx!.createBiquadFilter();
          const gain = this.ctx!.createGain();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, time);

          filter.type = 'lowpass';
          filter.frequency.setValueAtTime(450, time); // warm and muted

          gain.gain.setValueAtTime(0, time);
          gain.gain.linearRampToValueAtTime(0.08, time + 0.5); // slow swell
          gain.gain.exponentialRampToValueAtTime(0.001, time + duration * 3.5);

          osc.connect(filter);
          filter.connect(gain);
          gain.connect(outputNode);

          osc.start(time);
          osc.stop(time + duration * 4);
        });
      }

      // Cozy bass line on Step 0, 6, 10
      if (step === 0 || step === 6 || step === 10) {
        const notes = [65.41, 55.0, 73.42, 49.0]; // C, A, D, G bass notes
        const freq = notes[Math.floor(step / 4)] || 55.0;
        
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, time);

        gain.gain.setValueAtTime(0.18, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration * 2.5);

        osc.connect(gain);
        gain.connect(outputNode);

        osc.start(time);
        osc.stop(time + duration * 3);
      }
    }

    else if (isSynthwave) {
      // 1/8 note pumping bass
      if (step % 2 === 0) {
        const noteIndex = Math.floor(step / 2) % bassSynthwave.length;
        const freq = bassSynthwave[noteIndex] / 2; // drop octave

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, time);

        // Lowpass filter cutoff envelope
        const filter = this.ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(120, time);
        filter.frequency.exponentialRampToValueAtTime(250, time + 0.1);

        gain.gain.setValueAtTime(0.18, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + duration * 1.8);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(outputNode);

        osc.start(time);
        osc.stop(time + duration * 1.9);
      }

      // Retro Arpeggiator: fast notes
      if (step % 2 === 1) {
        const arpeggios = [220.0, 261.63, 329.63, 392.0, 440.0, 523.25, 659.25, 783.99];
        const noteIndex = (step * 3 + Math.floor(step / 4)) % arpeggios.length;
        const freq = arpeggios[noteIndex];

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, time);

        const filter = this.ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(800 + Math.sin(time) * 300, time);

        gain.gain.setValueAtTime(0.05, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration * 0.95);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(outputNode);

        osc.start(time);
        osc.stop(time + duration);
      }
    }

    else if (isAmbient) {
      // Extremely slow swells, random bells
      if (step === 0 || step === 8) {
        const rootNotes = [196.00, 220.00, 261.63, 329.63]; // G3, A3, C4, E4
        const freq = rootNotes[Math.floor(Math.random() * rootNotes.length)];
        
        // Dynamic swelling drone
        const osc1 = this.ctx.createOscillator();
        const osc2 = this.ctx.createOscillator();
        const gain = this.ctx.createGain();

        osc1.type = 'triangle';
        osc1.frequency.setValueAtTime(freq / 2, time); // low drone

        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(freq / 2 + 1.5, time); // detuned sine

        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.12, time + duration * 6);
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration * 15);

        osc1.connect(gain);
        osc2.connect(gain);
        gain.connect(outputNode);

        osc1.start(time);
        osc2.start(time);
        osc1.stop(time + duration * 16);
        osc2.stop(time + duration * 16);
      }

      // Ambient chimes / bells - randomized pentatonic high notes
      if (step % 4 === 2 && Math.random() > 0.4) {
        const pentatonic = [523.25, 587.33, 659.25, 783.99, 880.00, 1046.50]; // C5 to C6 pentatonic
        const freq = pentatonic[Math.floor(Math.random() * pentatonic.length)];

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, time);

        gain.gain.setValueAtTime(0.04, time);
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration * 4);

        // Connect to a delay line automatically present in the app virtualizer
        osc.connect(gain);
        gain.connect(outputNode);

        osc.start(time);
        osc.stop(time + duration * 5);
      }
    }

    else if (isPiano) {
      // Solo elegant neo-classical piano notes on steps 0, 3, 6, 9, 12
      const pianoPattern = [0, 3, 6, 9, 12, 14];
      if (pianoPattern.includes(step)) {
        const melodies = [
          [220.00, 329.63, 440.00, 523.25], // Am chords arps
          [261.63, 329.63, 392.00, 523.25], // C Major
          [196.00, 293.66, 392.00, 493.88], // G Major
          [174.61, 261.63, 349.23, 440.00], // F Major
        ];
        
        const phrase = melodies[Math.floor(time / 5) % melodies.length];
        const noteIndex = (step * 2) % phrase.length;
        const freq = phrase[noteIndex];

        // Synthesize a piano strike
        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        
        // Triangle is slightly warmer than square and has rich physical wood harmonics
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, time);
        
        // Attack/decay simulation of piano hammer
        gain.gain.setValueAtTime(0, time);
        gain.gain.linearRampToValueAtTime(0.18, time + 0.015); // sharp strike
        gain.gain.exponentialRampToValueAtTime(0.001, time + duration * 3.5); // long sustain decay

        osc.connect(gain);
        gain.connect(outputNode);

        osc.start(time);
        osc.stop(time + duration * 4);
      }
    }

    else if (isElectro) {
      // High speed rolling bass
      if (step % 2 === 0) {
        const basslines = [73.42, 73.42, 65.41, 65.41, 87.31, 87.31, 98.0, 110.0]; // D, C, F, G, A bass
        const noteIdx = Math.floor(step / 2) % basslines.length;
        const freq = basslines[noteIdx];

        const osc = this.ctx.createOscillator();
        const filter = this.ctx.createBiquadFilter();
        const gain = this.ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freq, time);

        // Electro sweeping acid resonance
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(300 + Math.sin(time * 2) * 200, time);
        filter.Q.value = 4; // resonance peaks

        gain.gain.setValueAtTime(0.12, time);
        gain.gain.exponentialRampToValueAtTime(0.01, time + duration * 1.5);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(outputNode);

        osc.start(time);
        osc.stop(time + duration * 1.7);
      }
    }
  }

  private stopProceduralSynth() {
    if (this.synthIntervalId) {
      clearTimeout(this.synthIntervalId);
      this.synthIntervalId = null;
    }
    // Clean up active generated oscillators/gains immediately to silence playback
    this.synthActiveNodes.forEach((node) => {
      try {
        // @ts-ignore
        node.disconnect();
      } catch (e) {}
    });
    this.synthActiveNodes = [];
  }
}

export const audioEngine = new AudioEngine();
