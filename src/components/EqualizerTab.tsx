/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { EqualizerSettings } from '../types';
import { offlineDb } from '../services/db';
import { audioEngine } from '../services/audioEngine';
import { Sliders, Volume2, Sparkles, CheckCircle } from 'lucide-react';

interface VerticalBandProps {
  key?: React.Key;
  gain: number;
  label: string;
  desc: string;
  onChange: (val: number) => void;
  enabled: boolean;
}

function VerticalBand({ gain, label, desc, onChange, enabled }: VerticalBandProps) {
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!enabled) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const updateValue = (clientY: number) => {
      const height = rect.height;
      const y = Math.max(0, Math.min(height, clientY - rect.top));
      const percentage = (height - y) / height; // 0 to 1
      const rawVal = -12 + percentage * 24;
      const rounded = Math.round(rawVal);
      onChange(rounded);
    };
    
    updateValue(e.clientY);
    e.currentTarget.setPointerCapture(e.pointerId);
    
    const handlePointerMove = (moveEvent: PointerEvent) => {
      updateValue(moveEvent.clientY);
    };
    
    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
    
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  const percent = ((gain + 12) / 24) * 100;

  return (
    <div className="flex flex-col items-center flex-1 h-full select-none">
      {/* Numeric Indicator */}
      <span className={`font-mono text-xs font-bold tracking-tighter mb-2 tabular-nums transition-colors duration-300 ${
        enabled ? (gain !== 0 ? 'text-white' : 'text-zinc-400') : 'text-zinc-600'
      }`}>
        {gain > 0 ? `+${gain}` : gain}
      </span>
      
      {/* Vertical Track Area */}
      <div 
        onPointerDown={handlePointerDown}
        className={`flex-1 w-10 flex justify-center items-center relative touch-none ${
          enabled ? 'cursor-ns-resize group' : 'cursor-not-allowed'
        }`}
      >
        {/* Track Line */}
        <div className={`w-[3px] h-full rounded-full transition-colors relative ${
          enabled ? 'bg-zinc-800 group-hover:bg-zinc-700' : 'bg-zinc-900'
        }`}>
          {/* Subtle Zero Center-line tick */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-3.5 h-[1.5px] bg-zinc-600/60" />
          
          {/* Active Highlight Fill from Center */}
          {enabled && (
            <div 
              className="absolute left-0 right-0 bg-white rounded-full"
              style={{
                top: `${Math.min(50, 100 - percent)}%`,
                bottom: `${Math.min(50, percent)}%`
              }}
            />
          )}
          
          {/* Handle/Knob */}
          <div 
            className={`absolute left-1/2 -translate-x-1/2 w-4 h-4 rounded-full shadow-md border transition-all ${
              enabled 
                ? 'bg-white border-zinc-950 scale-100 group-hover:scale-110 active:scale-125 active:bg-white' 
                : 'bg-zinc-800 border-zinc-950 scale-90'
            }`}
            style={{ bottom: `calc(${percent}% - 8px)` }}
          />
        </div>
      </div>

      {/* Frequency Labels */}
      <span className={`font-sans font-bold text-xs mt-3 transition-colors duration-300 ${
        enabled ? 'text-zinc-200' : 'text-zinc-500'
      }`}>{label}</span>
      <span className={`text-[9px] text-center font-medium tracking-tight mt-0.5 transition-colors duration-300 ${
        enabled ? 'text-zinc-400' : 'text-zinc-600'
      }`}>{desc}</span>
    </div>
  );
}

interface HorizontalSliderProps {
  label: string;
  value: number;
  onChange: (val: number) => void;
  enabled: boolean;
  icon: React.ReactNode;
}

function HorizontalSlider({ label, value, onChange, enabled, icon }: HorizontalSliderProps) {
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!enabled) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const updateValue = (clientX: number) => {
      const width = rect.width;
      const x = Math.max(0, Math.min(width, clientX - rect.left));
      const percentage = x / width; // 0 to 1
      const rawVal = percentage * 100;
      const rounded = Math.round(rawVal / 5) * 5; // step 5
      onChange(rounded);
    };
    
    updateValue(e.clientX);
    e.currentTarget.setPointerCapture(e.pointerId);
    
    const handlePointerMove = (moveEvent: PointerEvent) => {
      updateValue(moveEvent.clientX);
    };
    
    const handlePointerUp = () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
    
    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);
  };

  return (
    <div className={`p-3.5 bg-zinc-950/40 rounded-xl border border-zinc-900/60 transition-opacity duration-300 ${
      enabled ? 'opacity-100' : 'opacity-45'
    }`}>
      <div className="flex items-center justify-between mb-2">
        <h4 className="text-[9px] font-bold tracking-wider uppercase text-zinc-400 flex items-center gap-1.5">
          {icon}
          {label}
        </h4>
        <span className="font-mono text-[9px] font-bold text-zinc-300 tabular-nums">{value}%</span>
      </div>
      <div 
        onPointerDown={handlePointerDown}
        className={`h-5 flex items-center touch-none relative ${enabled ? 'cursor-ew-resize' : 'cursor-not-allowed'}`}
      >
        <div className="w-full h-[2px] bg-zinc-900 rounded-full relative">
          {enabled && (
            <div 
              className="absolute left-0 top-0 h-full bg-white rounded-full" 
              style={{ width: `${value}%` }}
            />
          )}
          <div 
            className={`absolute top-1/2 w-2.5 h-2.5 rounded-full -translate-y-1/2 -translate-x-1/2 shadow-md transition-transform ${
              enabled ? 'bg-white hover:scale-110 active:scale-125' : 'bg-zinc-800'
            }`} 
            style={{ left: `${value}%` }}
          />
        </div>
      </div>
    </div>
  );
}

export default function EqualizerTab() {
  const [eq, setEq] = useState<EqualizerSettings>(() => offlineDb.getEqualizer());

  const presets: { [key: string]: number[] } = {
    Flat: [0, 0, 0, 0, 0],
    Rock: [5, 3, -1, 3, 5],
    Pop: [-2, -1, 3, 2, -1],
    Jazz: [3, 2, 1, 2, 4],
    Classical: [4, 2, 0, 2, 3],
    Dance: [6, 0, 2, 4, 1],
    'Hip-Hop': [6, 4, 1, 2, 3],
    Acoustic: [3, 1, 2, 3, 4],
  };

  const handleEnabledToggle = () => {
    const updated = { ...eq, enabled: !eq.enabled };
    saveEqSettings(updated);
  };

  const handlePresetChange = (presetName: string) => {
    const updated = {
      ...eq,
      preset: presetName,
      bands: presetName === 'Custom' ? eq.bands : [...presets[presetName]],
    };
    saveEqSettings(updated);
  };

  const handleBandChange = (index: number, val: number) => {
    const updatedBands = [...eq.bands];
    updatedBands[index] = val;
    const updated = {
      ...eq,
      bands: updatedBands,
      preset: 'Custom',
    };
    saveEqSettings(updated);
  };

  const handleControlChange = (field: 'bassBoost' | 'virtualizer' | 'loudness', val: number) => {
    const updated = {
      ...eq,
      [field]: val,
    };
    saveEqSettings(updated);
  };

  const saveEqSettings = (updated: EqualizerSettings) => {
    setEq(updated);
    offlineDb.saveEqualizer(updated);
    audioEngine.applyEqualizerFromDb();
  };

  const bandLabels = ['60Hz', '230Hz', '910Hz', '4kHz', '14kHz'];
  const bandDescriptions = ['Sub-Bass', 'Low-Mid', 'Mid', 'Presence', 'Brilliance'];

  return (
    <div className="h-full flex flex-col bg-black text-zinc-300 dynamic-bg dynamic-text overflow-y-auto px-5 py-4 scrollbar-none">
      
      {/* Title Header */}
      <div className="flex items-center justify-between mb-5 select-none">
        <div className="flex items-center gap-2.5">
          <Sliders className="w-5 h-5 text-zinc-300" />
          <h1 className="font-sans font-bold text-sm tracking-wide text-zinc-100">Equalizer &amp; DSP</h1>
        </div>
        
        {/* Toggle master */}
        <button
          onClick={handleEnabledToggle}
          className={`px-3.5 py-1.5 rounded-full text-xs font-bold tracking-wider border transition-all ${
            eq.enabled 
              ? 'bg-white border-white text-black shadow-sm' 
              : 'bg-zinc-950 border-zinc-900 text-zinc-500'
          }`}
        >
          {eq.enabled ? 'ACTIVE' : 'BYPASS'}
        </button>
      </div>

      <div className="space-y-4">
        
        {/* Modern Minimalistic Preset Chip Row */}
        <div className={`space-y-2 select-none transition-opacity duration-300 ${eq.enabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
          <span className="text-xs text-zinc-400 font-bold uppercase tracking-wider block">Sound Signature</span>
          <div className="flex flex-wrap gap-2">
            {Object.keys(presets).map((p) => {
              const isSelected = eq.preset === p;
              return (
                <button
                  key={p}
                  onClick={() => handlePresetChange(p)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${
                    isSelected 
                      ? 'bg-white text-black font-extrabold scale-[1.02]' 
                      : 'bg-zinc-950 hover:bg-zinc-900 text-zinc-300 border border-zinc-800 hover:text-zinc-100'
                  }`}
                >
                  {p}
                </button>
              );
            })}
            <button
              onClick={() => handlePresetChange('Custom')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold tracking-wide transition-all ${
                eq.preset === 'Custom' 
                  ? 'bg-white text-black font-extrabold scale-[1.02]' 
                  : 'bg-zinc-950 hover:bg-zinc-900 text-zinc-300 border border-zinc-800 hover:text-zinc-100'
              }`}
            >
              Custom
            </button>
          </div>
        </div>

        {/* Vertical Soundboard Bands Grid */}
        <div className={`p-4 bg-zinc-950/40 rounded-2xl border border-zinc-900/60 flex justify-between gap-1 h-56 transition-opacity duration-300 ${
          eq.enabled ? 'opacity-100' : 'opacity-40 pointer-events-none'
        }`}>
          {eq.bands.map((gain, i) => (
            <VerticalBand
              key={i}
              gain={gain}
              label={bandLabels[i]}
              desc={bandDescriptions[i]}
              onChange={(val) => handleBandChange(i, val)}
              enabled={eq.enabled}
            />
          ))}
        </div>

        {/* Minimalist Horizontal Sliders (Bass Boost & Virtualizer Space) */}
        <div className="grid grid-cols-2 gap-3">
          <HorizontalSlider
            label="Bass Boost"
            value={eq.bassBoost}
            onChange={(val) => handleControlChange('bassBoost', val)}
            enabled={eq.enabled}
            icon={<Volume2 className="w-3 h-3 text-zinc-400" />}
          />
          <HorizontalSlider
            label="Spatializer"
            value={eq.virtualizer}
            onChange={(val) => handleControlChange('virtualizer', val)}
            enabled={eq.enabled}
            icon={<Sparkles className="w-3 h-3 text-zinc-400" />}
          />
        </div>

        {/* Fine Acoustic Tip Card */}
        <div className="p-3 bg-zinc-950/40 border border-zinc-900/40 rounded-xl flex items-start gap-2 text-[9px] text-zinc-550 leading-normal select-none">
          <CheckCircle className="w-3 h-3 text-zinc-500 shrink-0 mt-0.5" />
          <span>
            Hardware audio nodes are wired to native HTML5 context filters for zero latency processing.
          </span>
        </div>

      </div>
    </div>
  );
}
