/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Wifi, Battery, Smartphone, Maximize2, Minimize2, Radio } from 'lucide-react';

interface AndroidFrameProps {
  children: React.ReactNode;
  onSystemBack?: () => void;
  onSystemHome?: () => void;
  onSystemRecents?: () => void;
}

export default function AndroidFrame({
  children,
  onSystemBack,
  onSystemHome,
  onSystemRecents,
}: AndroidFrameProps) {
  const [currentTime, setCurrentTime] = useState('');
  const [batteryLevel, setBatteryLevel] = useState(88);
  const [isCompactFrame, setIsCompactFrame] = useState(true);

  useEffect(() => {
    // Update local clock matching current simulated date/time
    const updateTime = () => {
      const now = new Date();
      let hours = now.getHours();
      const minutes = now.getMinutes().toString().padStart(2, '0');
      const ampm = hours >= 12 ? 'PM' : 'AM';
      hours = hours % 12 || 12;
      setCurrentTime(`${hours}:${minutes} ${ampm}`);
    };
    
    updateTime();
    const interval = setInterval(updateTime, 10000);
    
    // Simulate natural battery drain/charge cycle
    const batteryInterval = setInterval(() => {
      setBatteryLevel((prev) => {
        if (prev <= 5) return 99; // recharge simulation
        return prev - 1;
      });
    }, 60000 * 5);

    return () => {
      clearInterval(interval);
      clearInterval(batteryInterval);
    };
  }, []);

  return (
    <div className="min-h-screen bg-[#030303] flex flex-col items-center justify-center p-0 md:p-4 font-sans text-white overflow-hidden transition-all duration-300">
      {/* Frame Controls Toggle Bar (Only visible on desktop) */}
      <div className="hidden md:flex items-center gap-3 mb-3 text-xs text-zinc-400 bg-zinc-950 border border-zinc-800/60 px-4 py-2 rounded-full shadow-lg z-50">
        <Smartphone className="w-3.5 h-3.5 text-zinc-500" />
        <span className="font-mono tracking-tight text-zinc-300">Android 14 Media System Simulator</span>
        <div className="w-px h-3.5 bg-zinc-800 mx-1" />
        <button
          onClick={() => setIsCompactFrame(!isCompactFrame)}
          className="flex items-center gap-1.5 px-2 py-1 rounded bg-zinc-900 hover:bg-zinc-800 hover:text-white transition-all font-medium border border-zinc-800/60"
        >
          {isCompactFrame ? (
            <>
              <Maximize2 className="w-3 h-3" /> Full Screen Mode
            </>
          ) : (
            <>
              <Minimize2 className="w-3 h-3" /> Android Phone Mode
            </>
          )}
        </button>
      </div>

      {/* Main Container */}
      <div
        id="android_device_shell"
        className={`relative flex flex-col bg-[#030303] shadow-[0_24px_50px_-12px_rgba(0,0,0,0.8)] border border-zinc-900 overflow-hidden transition-all duration-500 ease-out ${
          isCompactFrame
            ? 'w-full max-w-[420px] h-[860px] md:rounded-[44px] md:border-[10px] md:border-zinc-900'
            : 'w-full max-w-[1200px] h-[90vh] md:rounded-3xl border-2 border-zinc-800'
        }`}
      >
        {/* Dynamic Notch / Camera Cutout (Compact Phone view only) */}
        {isCompactFrame && (
          <div className="hidden md:block absolute left-1/2 top-3 -translate-x-1/2 w-32 h-6 bg-black rounded-full z-50 shadow-inner flex items-center justify-center">
            <div className="w-3 h-3 bg-zinc-950 border border-zinc-900 rounded-full mr-12" />
            <div className="w-2 h-2 bg-[#040405] rounded-full" />
          </div>
        )}

        {/* System Status Bar */}
        <div className="w-full h-11 bg-black flex items-center justify-between px-6 z-40 select-none text-xs font-semibold tracking-wide text-zinc-300">
          <div className="flex items-center gap-1">
            <span className="font-display font-medium text-[13px]">{currentTime}</span>
          </div>
          <div className="flex items-center gap-2">
            <Radio className="w-3.5 h-3.5 text-zinc-500" title="Offline Internal Media Player active" />
            <span className="text-[10px] font-mono font-normal tracking-wide text-zinc-400 bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800/40">
              OFFLINE
            </span>
            <Wifi className="w-3.5 h-3.5 text-zinc-500" />
            <div className="flex items-center gap-1">
              <span className="text-[11px] font-mono text-zinc-500">{batteryLevel}%</span>
              <Battery className="w-4 h-4 text-zinc-450 rotate-90" />
            </div>
          </div>
        </div>

        {/* Content Region */}
        <div className="flex-1 relative overflow-hidden bg-[#030303]">
          {children}
        </div>

        {/* Virtual Android Bottom Navigation Bar */}
        <div className="w-full h-12 bg-black flex items-center justify-around px-12 z-40 border-t border-zinc-900/30 select-none">
          {/* Back button */}
          <button
            id="android_nav_back"
            onClick={onSystemBack}
            className="w-12 h-12 flex items-center justify-center group focus:outline-none"
            aria-label="Back Button"
          >
            <div className="w-3 h-3 border-t-2 border-l-2 border-zinc-600 group-hover:border-white transform -rotate-45 transition-colors duration-200" />
          </button>

          {/* Home pill */}
          <button
            id="android_nav_home"
            onClick={onSystemHome}
            className="w-16 h-12 flex items-center justify-center group focus:outline-none"
            aria-label="Home Button"
          >
            <div className="w-14 h-1 bg-zinc-600 group-hover:bg-white rounded-full transition-colors duration-200" />
          </button>

          {/* Recents button */}
          <button
            id="android_nav_recents"
            onClick={onSystemRecents}
            className="w-12 h-12 flex items-center justify-center group focus:outline-none"
            aria-label="Recents Button"
          >
            <div className="w-3 h-3 border-2 border-zinc-650 group-hover:border-white rounded-sm transition-colors duration-200" />
          </button>
        </div>
      </div>
    </div>
  );
}
