/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { AppSettings, EqualizerSettings, ThemeType, AccentColor, IconShape } from '../types';
import { offlineDb } from '../services/db';
import { audioEngine } from '../services/audioEngine';
import ConfirmDialog from './ConfirmDialog';
import { 
  Settings, Shield, Monitor, Volume2, Database, Sliders, ChevronRight, 
  RotateCcw, Save, Upload, Trash2, CheckCircle2, AlertTriangle, AlertCircle, RefreshCw
} from 'lucide-react';

type SettingsCategory = 'root' | 'library' | 'playback' | 'display' | 'storage';

interface SettingsTabProps {
  onRefreshLibrary: () => void;
  onTriggerScan?: () => void;
  onTriggerImport?: () => void;
  onSettingsChange?: (settings: AppSettings) => void;
  activeCategory?: SettingsCategory;
  onCategoryChange?: (category: SettingsCategory) => void;
}

export default function SettingsTab({ 
  onRefreshLibrary, 
  onTriggerScan, 
  onTriggerImport, 
  onSettingsChange,
  activeCategory: propActiveCategory,
  onCategoryChange
}: SettingsTabProps) {
  const [settings, setSettings] = useState<AppSettings>(() => offlineDb.getSettings());
  const [localCategory, setLocalCategory] = useState<SettingsCategory>('root');
  
  const activeCategory = propActiveCategory !== undefined ? propActiveCategory : localCategory;
  const setActiveCategory = (cat: SettingsCategory | ((prev: SettingsCategory) => SettingsCategory)) => {
    const computed = typeof cat === 'function' ? cat(activeCategory) : cat;
    if (onCategoryChange) {
      onCategoryChange(computed);
    }
    setLocalCategory(computed);
  };

  const [backupString, setBackupString] = useState('');
  const [showStatus, setShowStatus] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [showConfirmRebuild, setShowConfirmRebuild] = useState(false);

  const isLight = settings.theme === 'light';

  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    const updated = { ...settings, [key]: value };
    setSettings(updated);
    offlineDb.saveSettings(updated);
    if (onSettingsChange) {
      onSettingsChange(updated);
    }
    
    // Propagate changes immediately to audio engine
    if (key === 'playbackSpeed' || key === 'channelBalance') {
      audioEngine.applySettingsFromDb();
    }
  };

  const handleBackupExport = () => {
    const backup = offlineDb.exportBackup();
    setBackupString(backup);
    
    // Copy to clipboard or trigger file download
    try {
      navigator.clipboard.writeText(backup);
      showTemporaryStatus('success', 'Backup JSON copied to clipboard!');
    } catch (e) {
      // Fallback
      showTemporaryStatus('success', 'Backup generated below. Copy the text box.');
    }
  };

  const handleBackupImport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!backupString.trim()) return;
    
    const success = offlineDb.importBackup(backupString);
    if (success) {
      setSettings(offlineDb.getSettings());
      audioEngine.applySettingsFromDb();
      showTemporaryStatus('success', 'Database successfully restored!');
      onRefreshLibrary();
    } else {
      showTemporaryStatus('error', 'Invalid backup format. Restore failed.');
    }
  };

  const handleRebuildLibrary = () => {
    setShowConfirmRebuild(true);
  };

  const handleConfirmRebuild = () => {
    offlineDb.rebuildLibrary();
    setSettings(offlineDb.getSettings());
    audioEngine.clearQueue();
    setShowConfirmRebuild(false);
    showTemporaryStatus('success', 'Library database completely rebuilt!');
    onRefreshLibrary();
  };

  const showTemporaryStatus = (type: 'success' | 'error', message: string) => {
    setShowStatus({ type, message });
    setTimeout(() => {
      setShowStatus(null);
    }, 4000);
  };

  const renderHeader = (title: string, backToRoot: boolean = true) => (
    <div className="flex items-center gap-3 mb-5">
      {backToRoot && (
        <button
          onClick={() => setActiveCategory('root')}
          className={`p-2 rounded-full ${isLight ? 'hover:bg-zinc-100 text-zinc-700 hover:text-zinc-900' : 'hover:bg-zinc-900 text-zinc-300 hover:text-white'} transition-colors`}
        >
          <ChevronRight className="w-6 h-6 rotate-180" />
        </button>
      )}
      <h2 className={`font-sans font-bold text-base ${isLight ? 'text-zinc-900' : 'text-zinc-100'}`}>{title}</h2>
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-[#030303] text-zinc-300 dynamic-bg dynamic-text overflow-y-auto px-5 py-4 scrollbar-none">
      {/* Alert banner */}
      {showStatus && (
        <div className={`p-3.5 rounded-xl mb-4 flex items-center gap-3 text-xs font-medium animate-fade-in ${
          showStatus.type === 'success' 
            ? 'bg-zinc-900 border border-zinc-800 text-zinc-100' 
            : 'bg-zinc-950 border border-zinc-800 text-zinc-300'
        }`}>
          {showStatus.type === 'success' ? <CheckCircle2 className="w-5 h-5 text-white shrink-0" /> : <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0" />}
          <span>{showStatus.message}</span>
        </div>
      )}

      {/* CATEGORY: ROOT (MENU LIST) */}
      {activeCategory === 'root' && (
        <div className="space-y-4">
          <div className="flex items-center gap-2.5 mb-5">
            <Settings className={`w-6 h-6 ${isLight ? 'text-zinc-700' : 'text-zinc-300'}`} />
            <h1 className={`font-sans font-bold text-base ${isLight ? 'text-zinc-900' : 'text-zinc-100'}`}>Settings</h1>
          </div>

          <div className="space-y-2">
            {/* Library Menu */}
            <button
              onClick={() => setActiveCategory('library')}
              className={`w-full flex items-center justify-between p-4 ${isLight ? 'bg-white border-zinc-200 hover:bg-zinc-100/60' : 'bg-zinc-950/40 hover:bg-zinc-900/40 border-zinc-900/60'} rounded-xl transition-all border`}
            >
              <div className="flex items-center gap-3.5">
                <div className={`p-2.5 ${isLight ? 'bg-zinc-100 text-zinc-700' : 'bg-zinc-900 text-zinc-300'} rounded-lg`}>
                  <Database className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <h3 className={`font-bold text-sm ${isLight ? 'text-zinc-900' : 'text-zinc-100'}`}>Library</h3>
                  <p className={`text-xs ${isLight ? 'text-zinc-600' : 'text-zinc-400'}`}>Auto scanning, ignored tracks</p>
                </div>
              </div>
              <ChevronRight className={`w-5 h-5 ${isLight ? 'text-zinc-400' : 'text-zinc-600'}`} />
            </button>

            {/* Playback Menu */}
            <button
              onClick={() => setActiveCategory('playback')}
              className={`w-full flex items-center justify-between p-4 ${isLight ? 'bg-white border-zinc-200 hover:bg-zinc-100/60' : 'bg-zinc-950/40 hover:bg-zinc-900/40 border-zinc-900/60'} rounded-xl transition-all border`}
            >
              <div className="flex items-center gap-3.5">
                <div className={`p-2.5 ${isLight ? 'bg-zinc-100 text-zinc-700' : 'bg-zinc-900 text-zinc-300'} rounded-lg`}>
                  <Volume2 className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <h3 className={`font-bold text-sm ${isLight ? 'text-zinc-900' : 'text-zinc-100'}`}>Playback</h3>
                  <p className={`text-xs ${isLight ? 'text-zinc-600' : 'text-zinc-400'}`}>Crossfade, balance, speed tuning</p>
                </div>
              </div>
              <ChevronRight className={`w-5 h-5 ${isLight ? 'text-zinc-400' : 'text-zinc-600'}`} />
            </button>

            {/* Display Menu */}
            <button
              onClick={() => setActiveCategory('display')}
              className={`w-full flex items-center justify-between p-4 ${isLight ? 'bg-white border-zinc-200 hover:bg-zinc-100/60' : 'bg-zinc-950/40 hover:bg-zinc-900/40 border-zinc-900/60'} rounded-xl transition-all border`}
            >
              <div className="flex items-center gap-3.5">
                <div className={`p-2.5 ${isLight ? 'bg-zinc-100 text-zinc-700' : 'bg-zinc-900 text-zinc-300'} rounded-lg`}>
                  <Monitor className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <h3 className={`font-bold text-sm ${isLight ? 'text-zinc-900' : 'text-zinc-100'}`}>Display</h3>
                  <p className={`text-xs ${isLight ? 'text-zinc-600' : 'text-zinc-400'}`}>Material You themes, icon shapes</p>
                </div>
              </div>
              <ChevronRight className={`w-5 h-5 ${isLight ? 'text-zinc-400' : 'text-zinc-600'}`} />
            </button>

            {/* Storage / Backup Menu */}
            <button
              onClick={() => setActiveCategory('storage')}
              className={`w-full flex items-center justify-between p-4 ${isLight ? 'bg-white border-zinc-200 hover:bg-zinc-100/60' : 'bg-zinc-950/40 hover:bg-zinc-900/40 border-zinc-900/60'} rounded-xl transition-all border`}
            >
              <div className="flex items-center gap-3.5">
                <div className={`p-2.5 ${isLight ? 'bg-zinc-100 text-zinc-700' : 'bg-zinc-900 text-zinc-300'} rounded-lg`}>
                  <Shield className="w-5 h-5" />
                </div>
                <div className="text-left">
                  <h3 className={`font-bold text-sm ${isLight ? 'text-zinc-900' : 'text-zinc-100'}`}>Storage &amp; Backup</h3>
                  <p className={`text-xs ${isLight ? 'text-zinc-600' : 'text-zinc-400'}`}>Database backup, rebuild cache</p>
                </div>
              </div>
              <ChevronRight className={`w-5 h-5 ${isLight ? 'text-zinc-400' : 'text-zinc-600'}`} />
            </button>
          </div>

          {/* Quick info card */}
          <div className={`p-4 ${isLight ? 'bg-zinc-50 border-zinc-200 text-zinc-700' : 'bg-zinc-950 border border-zinc-900 text-zinc-400'} rounded-xl text-xs space-y-2 leading-relaxed`}>
            <div className={`flex items-center gap-2 font-bold text-xs ${isLight ? 'text-zinc-800' : 'text-zinc-300'}`}>
              <AlertCircle className={`w-4 h-4 ${isLight ? 'text-zinc-600' : 'text-zinc-400'}`} />
              <span>Offline Isolation Rule</span>
            </div>
            <p>
              This app operates on zero external connections. All databases, playlists, custom equalizer presets, and uploaded files are saved strictly on your local browser engine.
            </p>
          </div>
        </div>
      )}

      {/* CATEGORY: LIBRARY SETTINGS */}
      {activeCategory === 'library' && (
        <div className="space-y-4">
          {renderHeader('Library Settings')}

          <div className="space-y-3.5">
            {/* Auto scan toggle */}
            <div className={`p-4 ${isLight ? 'bg-white border-zinc-200 text-zinc-900' : 'bg-zinc-950/40 border-zinc-900 text-zinc-200'} rounded-xl border flex items-center justify-between text-xs`}>
              <div className="pr-4">
                <h4 className={`font-bold text-sm ${isLight ? 'text-zinc-900' : 'text-zinc-100'}`}>Auto Scan Directories</h4>
                <p className={`text-xs mt-0.5 ${isLight ? 'text-zinc-600' : 'text-zinc-400'}`}>Automatically register new storage files</p>
              </div>
              <input
                type="checkbox"
                checked={settings.autoScan}
                onChange={(e) => updateSetting('autoScan', e.target.checked)}
                className={`w-5 h-5 ${isLight ? 'accent-zinc-900 text-zinc-950' : 'accent-white'} cursor-pointer shrink-0`}
              />
            </div>

            {/* Scan on Startup toggle */}
            <div className={`p-4 ${isLight ? 'bg-white border-zinc-200 text-zinc-900' : 'bg-zinc-950/40 border-zinc-900 text-zinc-200'} rounded-xl border flex items-center justify-between text-xs`}>
              <div className="pr-4">
                <h4 className={`font-bold text-sm ${isLight ? 'text-zinc-900' : 'text-zinc-100'}`}>Scan on Startup</h4>
                <p className={`text-xs mt-0.5 ${isLight ? 'text-zinc-600' : 'text-zinc-400'}`}>Quickly check directories on boot</p>
              </div>
              <input
                type="checkbox"
                checked={settings.scanOnStartup}
                onChange={(e) => updateSetting('scanOnStartup', e.target.checked)}
                className={`w-5 h-5 ${isLight ? 'accent-zinc-900 text-zinc-950' : 'accent-white'} cursor-pointer shrink-0`}
              />
            </div>

            {/* Ignore short tracks */}
            <div className={`p-4 ${isLight ? 'bg-white border-zinc-200 text-zinc-900' : 'bg-zinc-950/40 border-zinc-900 text-zinc-200'} rounded-xl border flex items-center justify-between text-xs`}>
              <div className="pr-4">
                <h4 className={`font-bold text-sm ${isLight ? 'text-zinc-900' : 'text-zinc-100'}`}>Ignore Short Ringtones</h4>
                <p className={`text-xs mt-0.5 ${isLight ? 'text-zinc-600' : 'text-zinc-400'}`}>Skip audio files shorter than 30 seconds</p>
              </div>
              <input
                type="checkbox"
                checked={settings.ignoreShortAudio}
                onChange={(e) => updateSetting('ignoreShortAudio', e.target.checked)}
                className={`w-5 h-5 ${isLight ? 'accent-zinc-900 text-zinc-950' : 'accent-white'} cursor-pointer shrink-0`}
              />
            </div>

            {/* Manual Media Scanner & Import actions */}
            <div className={`pt-4 ${isLight ? 'border-zinc-200' : 'border-zinc-900'} border-t space-y-3`}>
              <h4 className={`text-xs font-bold ${isLight ? 'text-zinc-600' : 'text-zinc-400'} uppercase tracking-wider`}>Manual Operations</h4>
              
              <button
                onClick={onTriggerScan}
                className={`w-full py-3 ${isLight ? 'bg-zinc-900 hover:bg-zinc-800 text-white' : 'bg-white text-black hover:bg-zinc-100'} rounded-xl text-xs font-bold shadow transition-all flex items-center justify-center gap-2.5`}
              >
                <RefreshCw className="w-4 h-4" /> Scan Device Storage Media
              </button>

              <button
                onClick={onTriggerImport}
                className={`w-full py-3 ${isLight ? 'bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border-zinc-300' : 'bg-zinc-900 hover:bg-zinc-850 text-zinc-200 border-zinc-800'} rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-2.5`}
              >
                <Upload className="w-4 h-4" /> Import Local Audio Files
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CATEGORY: PLAYBACK SETTINGS */}
      {activeCategory === 'playback' && (
        <div className="space-y-4">
          {renderHeader('Playback Settings')}

          <div className="space-y-4 text-xs">
            {/* Crossfade duration */}
            <div className={`p-4 ${isLight ? 'bg-white border-zinc-200 text-zinc-900' : 'bg-zinc-950/40 border-zinc-900 text-zinc-200'} rounded-xl border space-y-2.5`}>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className={`font-bold text-sm ${isLight ? 'text-zinc-900' : 'text-zinc-100'}`}>Crossfade Duration</h4>
                  <p className={`text-xs mt-0.5 ${isLight ? 'text-zinc-600' : 'text-zinc-400'}`}>Fades adjacent tracks smoothly</p>
                </div>
                <span className={`font-mono font-bold text-xs ${isLight ? 'text-zinc-800 bg-zinc-100' : 'text-zinc-100 bg-zinc-900'} px-2.5 py-1 rounded-md`}>{settings.crossfadeDuration}s</span>
              </div>
              <input
                type="range"
                min="0"
                max="10"
                step="1"
                value={settings.crossfadeDuration}
                onChange={(e) => updateSetting('crossfadeDuration', Number(e.target.value))}
                className={`w-full ${isLight ? 'accent-zinc-900 bg-zinc-200' : 'accent-white bg-zinc-800'} cursor-pointer h-2 rounded`}
              />
            </div>

            {/* Headphone unplug action */}
            <div className={`p-4 ${isLight ? 'bg-white border-zinc-200 text-zinc-900' : 'bg-zinc-950/40 border-zinc-900 text-zinc-200'} rounded-xl border flex items-center justify-between`}>
              <div>
                <h4 className={`font-bold text-sm ${isLight ? 'text-zinc-900' : 'text-zinc-100'}`}>Unplug Auto-Pause</h4>
                <p className={`text-xs mt-0.5 ${isLight ? 'text-zinc-600' : 'text-zinc-400'}`}>Pause playback when headphones unplug</p>
              </div>
              <input
                type="checkbox"
                checked={settings.headphoneUnplugPause}
                onChange={(e) => updateSetting('headphoneUnplugPause', e.target.checked)}
                className={`w-5 h-5 ${isLight ? 'accent-zinc-900 text-zinc-950' : 'accent-white'} cursor-pointer shrink-0`}
              />
            </div>

            {/* Mono mode toggle */}
            <div className={`p-4 ${isLight ? 'bg-white border-zinc-200 text-zinc-900' : 'bg-zinc-950/40 border-zinc-900 text-zinc-200'} rounded-xl border flex items-center justify-between`}>
              <div>
                <h4 className={`font-bold text-sm ${isLight ? 'text-zinc-900' : 'text-zinc-100'}`}>Mono Audio</h4>
                <p className={`text-xs mt-0.5 ${isLight ? 'text-zinc-600' : 'text-zinc-400'}`}>Combine left and right audio channels</p>
              </div>
              <input
                type="checkbox"
                checked={settings.monoMode}
                onChange={(e) => updateSetting('monoMode', e.target.checked)}
                className={`w-5 h-5 ${isLight ? 'accent-zinc-900 text-zinc-950' : 'accent-white'} cursor-pointer shrink-0`}
              />
            </div>

            {/* Channel Balance Slider */}
            <div className={`p-4 ${isLight ? 'bg-white border-zinc-200 text-zinc-900' : 'bg-zinc-950/40 border-zinc-900 text-zinc-200'} rounded-xl border space-y-2.5`}>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className={`font-bold text-sm ${isLight ? 'text-zinc-900' : 'text-zinc-100'}`}>Stereo Channel Balance</h4>
                  <p className={`text-xs mt-0.5 ${isLight ? 'text-zinc-600' : 'text-zinc-400'}`}>Balance sound output left/right</p>
                </div>
                <span className={`font-mono font-bold text-xs ${isLight ? 'text-zinc-800 bg-zinc-100' : 'text-zinc-100 bg-zinc-900'} px-2.5 py-1 rounded-md`}>
                  {settings.channelBalance === 0 ? 'Center' : settings.channelBalance < 0 ? 'L ' + Math.abs(settings.channelBalance * 100).toFixed(0) : 'R ' + (settings.channelBalance * 100).toFixed(0)}
                </span>
              </div>
              <input
                type="range"
                min="-1"
                max="1"
                step="0.1"
                value={settings.channelBalance}
                onChange={(e) => updateSetting('channelBalance', Number(e.target.value))}
                className={`w-full ${isLight ? 'accent-zinc-900 bg-zinc-200' : 'accent-white bg-zinc-800'} cursor-pointer h-2 rounded`}
              />
            </div>

            {/* Playback speed slider */}
            <div className={`p-4 ${isLight ? 'bg-white border-zinc-200 text-zinc-900' : 'bg-zinc-950/40 border-zinc-900 text-zinc-200'} rounded-xl border space-y-2.5`}>
              <div className="flex items-center justify-between">
                <div>
                  <h4 className={`font-bold text-sm ${isLight ? 'text-zinc-900' : 'text-zinc-100'}`}>Playback Speed</h4>
                  <p className={`text-xs mt-0.5 ${isLight ? 'text-zinc-600' : 'text-zinc-400'}`}>Tweak pitch/tempo speed</p>
                </div>
                <span className={`font-mono font-bold text-xs ${isLight ? 'text-zinc-800 bg-zinc-100' : 'text-zinc-100 bg-zinc-900'} px-2.5 py-1 rounded-md`}>{settings.playbackSpeed}x</span>
              </div>
              <input
                type="range"
                min="0.5"
                max="2.0"
                step="0.1"
                value={settings.playbackSpeed}
                onChange={(e) => updateSetting('playbackSpeed', Number(e.target.value))}
                className={`w-full ${isLight ? 'accent-zinc-900 bg-zinc-200' : 'accent-white bg-zinc-800'} cursor-pointer h-2 rounded`}
              />
            </div>
          </div>
        </div>
      )}

      {/* CATEGORY: DISPLAY SETTINGS */}
      {activeCategory === 'display' && (
        <div className="space-y-4">
          {renderHeader('Display Settings')}

          <div className="space-y-4 text-xs">
            {/* Theme selection */}
            <div className={`p-4 ${isLight ? 'bg-white border-zinc-200' : 'bg-zinc-950/40 border-zinc-900'} rounded-xl border space-y-3`}>
              <h4 className={`font-bold text-sm ${isLight ? 'text-zinc-900' : 'text-zinc-100'}`}>System Theme</h4>
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { id: 'dynamic', label: 'Material You' },
                  { id: 'dark', label: 'Twilight Dark' },
                  { id: 'amoled', label: 'AMOLED Black' },
                  { id: 'light', label: 'Classic Light' },
                ].map((th) => (
                  <button
                    key={th.id}
                    onClick={() => updateSetting('theme', th.id as ThemeType)}
                    className={`p-3 rounded-xl border text-center font-bold transition-all text-xs ${
                      settings.theme === th.id
                        ? (isLight ? 'bg-zinc-900 border-zinc-900 text-white shadow' : 'bg-white border-white text-black shadow')
                        : (isLight ? 'bg-zinc-50 border-zinc-200 text-zinc-700 hover:text-zinc-900 hover:bg-zinc-100' : 'bg-zinc-900/60 border-zinc-800 text-zinc-300 hover:text-white')
                    }`}
                  >
                    {th.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* CATEGORY: STORAGE & BACKUP */}
      {activeCategory === 'storage' && (
        <div className="space-y-4">
          {renderHeader('Storage & Backup')}

          <div className="space-y-4 text-xs">
            {/* Rebuild & Reset Section */}
            <div className={`p-4 ${isLight ? 'bg-white border-zinc-200' : 'bg-zinc-950/40 border-zinc-900'} rounded-xl border space-y-3`}>
              <div>
                <h4 className={`font-bold text-sm ${isLight ? 'text-zinc-900' : 'text-zinc-200'} flex items-center gap-2`}>
                  <AlertTriangle className="w-4.5 h-4.5 text-amber-500" />
                  <span>Maintenance Controls</span>
                </h4>
                <p className={`text-xs ${isLight ? 'text-zinc-600' : 'text-zinc-400'} mt-1 leading-relaxed`}>
                  Reset the database to pristine defaults, removing custom edits, history files, and re-initializing the 5 offline procedural tracks.
                </p>
              </div>

              <div className="flex gap-2 pt-1">
                <button
                  onClick={handleRebuildLibrary}
                  className={`w-full py-2.5 ${isLight ? 'bg-red-50 hover:bg-red-100 text-red-700 border-red-200' : 'bg-zinc-900/80 hover:bg-zinc-850 text-zinc-200 border-zinc-800'} rounded-xl border text-xs font-bold transition-all flex items-center justify-center gap-2`}
                >
                  <Trash2 className="w-4 h-4" /> Rebuild Library DB
                </button>
              </div>
            </div>

            {/* Backup & Import forms */}
            <div className={`p-4 ${isLight ? 'bg-white border-zinc-200' : 'bg-zinc-950/40 border-zinc-900'} rounded-xl border space-y-4`}>
              <div>
                <h4 className={`font-bold text-sm ${isLight ? 'text-zinc-900' : 'text-zinc-200'} flex items-center gap-2`}>
                  <Database className="w-4.5 h-4.5 text-zinc-400" />
                  <span>Durable Database Backup</span>
                </h4>
                <p className={`text-xs ${isLight ? 'text-zinc-600' : 'text-zinc-400'} mt-1 leading-relaxed`}>
                  Generate a JSON string of your entire offline config, playlist setups, and history to backup locally. Or paste a previous backup string below to restore.
                </p>
              </div>

              <button
                onClick={handleBackupExport}
                className={`w-full py-2.5 ${isLight ? 'bg-zinc-900 hover:bg-zinc-850 text-white' : 'bg-white hover:bg-zinc-100 text-black'} rounded-xl text-xs font-bold transition-all flex items-center justify-center gap-2 shadow`}
              >
                <Save className="w-4 h-4" /> Generate &amp; Copy Backup
              </button>

              <form onSubmit={handleBackupImport} className={`space-y-2.5 pt-2 border-t ${isLight ? 'border-zinc-200' : 'border-zinc-900'}`}>
                <label className={`block text-xs ${isLight ? 'text-zinc-700' : 'text-zinc-400'} font-bold`}>Paste Backup String</label>
                <textarea
                  value={backupString}
                  onChange={(e) => setBackupString(e.target.value)}
                  placeholder='{"songs":[], "playlists":[], ...}'
                  className={`w-full h-20 ${isLight ? 'bg-zinc-50 text-zinc-900 border-zinc-300 focus:border-zinc-400 placeholder-zinc-400' : 'bg-[#030303] text-zinc-200 border-zinc-800 focus:border-zinc-600'} font-mono text-xs rounded-xl p-2.5 border focus:outline-none`}
                />
                <button
                  type="submit"
                  className={`w-full py-2.5 ${isLight ? 'bg-zinc-100 hover:bg-zinc-200 text-zinc-800 border-zinc-300' : 'bg-zinc-900 hover:bg-zinc-850 text-zinc-200 border-zinc-800'} rounded-xl text-xs font-bold transition-all border flex items-center justify-center gap-2`}
                >
                  <Upload className="w-4 h-4" /> Restore Backup Config
                </button>
              </form>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={showConfirmRebuild}
        title="Rebuild Library Database"
        message="Are you sure you want to rebuild your music library? This will reset custom tags and clear your local storage audio files cache."
        onConfirm={handleConfirmRebuild}
        onCancel={() => setShowConfirmRebuild(false)}
      />
    </div>
  );
}
