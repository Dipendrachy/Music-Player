/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';

interface WavySeekBarProps {
  currentTime: number;
  duration: number;
  playbackState: 'playing' | 'paused' | 'stopped';
  onSeek: (time: number) => void;
  color?: string;
}

export default function WavySeekBar({
  currentTime,
  duration,
  playbackState,
  onSeek,
  color = 'currentColor'
}: WavySeekBarProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState(0);
  const [width, setWidth] = useState(300);
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const requestRef = useRef<number | null>(null);

  // Measure container width
  useEffect(() => {
    if (!containerRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setWidth(entry.contentRect.width || 300);
      }
    });
    resizeObserver.observe(containerRef.current);
    setWidth(containerRef.current.getBoundingClientRect().width || 300);
    return () => resizeObserver.disconnect();
  }, []);

  // Animate phase when playing
  useEffect(() => {
    if (playbackState !== 'playing') {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
        requestRef.current = null;
      }
      return;
    }

    const animate = () => {
      setPhase((prev) => (prev + 0.1) % (Math.PI * 2));
      requestRef.current = requestAnimationFrame(animate);
    };

    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [playbackState]);

  const progressPercent = duration > 0 ? currentTime / duration : 0;
  const playedWidth = progressPercent * width;
  const centerY = 16; // vertical center of SVG container

  // Wave configurations
  const amplitude = playbackState === 'playing' ? 3.5 : 0; // flattens when paused
  const wavelength = 24;

  // Detect if color is a CSS/Tailwind class instead of a raw hex string
  const isClass = color.startsWith('text-') || color.includes('-') || color === 'currentColor';
  const resolvedColor = isClass ? 'currentColor' : color;
  const svgClass = `w-full h-8 overflow-visible select-none pointer-events-none ${isClass && color !== 'currentColor' ? color : ''}`;

  // Generate SVG path for played portion (straight flat line)
  const getPlayedPath = () => {
    if (playedWidth <= 0) return '';
    return `M 0 ${centerY} L ${playedWidth} ${centerY}`;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!containerRef.current) return;
    setIsDragging(true);
    e.currentTarget.setPointerCapture(e.pointerId);
    handleSeek(e);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDragging) return;
    handleSeek(e);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    setIsDragging(false);
    e.currentTarget.releasePointerCapture(e.pointerId);
  };

  const handleSeek = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!containerRef.current || duration <= 0) return;
    const rect = containerRef.current.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const percentage = Math.max(0, Math.min(1, clickX / rect.width));
    onSeek(percentage * duration);
  };

  return (
    <div
      ref={containerRef}
      className="relative w-full h-8 flex items-center cursor-pointer select-none touch-none"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => {
        setIsHovered(false);
        if (!isDragging) setIsDragging(false);
      }}
    >
      <svg className={svgClass}>
        {/* Unplayed Portion (Straight Flat Line) */}
        <line
          x1={playedWidth}
          y1={centerY}
          x2={width}
          y2={centerY}
          stroke={resolvedColor}
          strokeWidth="3.5"
          className="opacity-25"
          strokeLinecap="round"
        />

        {/* Played Portion (Wavy Sine Wave or Flat) */}
        <path
          d={getPlayedPath() || `M 0 ${centerY} L ${playedWidth} ${centerY}`}
          fill="none"
          stroke={resolvedColor}
          strokeWidth="3.5"
          className="transition-all duration-300"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Playhead dot (Thumb) */}
        <circle
          cx={playedWidth}
          cy={centerY}
          r={isHovered || isDragging ? 6.5 : 5}
          fill={resolvedColor}
          className="transition-all duration-150 shadow-md"
        />
      </svg>
    </div>
  );
}
