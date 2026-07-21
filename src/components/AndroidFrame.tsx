/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Smartphone, Maximize2, Minimize2 } from 'lucide-react';

interface AndroidFrameProps {
  children: React.ReactNode;
  onSystemBack?: () => void;
  onSystemHome?: () => void;
  onSystemRecents?: () => void;
}

export default function AndroidFrame({
  children,
}: AndroidFrameProps) {
  const [isCompactFrame, setIsCompactFrame] = useState(true);

  return (
    <div className="h-[100dvh] md:min-h-screen bg-[#030303] flex flex-col items-center justify-center p-0 md:p-4 font-sans text-white overflow-hidden transition-all duration-300">
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
            ? 'w-full max-w-[420px] h-[100dvh] md:h-[860px] md:rounded-[44px] md:border-[10px] md:border-zinc-900'
            : 'w-full max-w-[1200px] h-[90vh] md:rounded-3xl border-2 border-zinc-800'
        }`}
      >
        {/* Content Region */}
        <div className="flex-1 relative overflow-hidden bg-[#030303]">
          {children}
        </div>
      </div>
    </div>
  );
}

