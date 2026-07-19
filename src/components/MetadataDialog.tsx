/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Song } from '../types';
import { offlineDb, fileStorage } from '../services/db';
import { audioEngine } from '../services/audioEngine';
import { X, Save, FileEdit, HelpCircle } from 'lucide-react';

interface MetadataDialogProps {
  song: Song;
  onClose: () => void;
  onSave: () => void;
}

export default function MetadataDialog({ song, onClose, onSave }: MetadataDialogProps) {
  const [title, setTitle] = useState(song.title);
  const [artist, setArtist] = useState(song.artist);
  const [album, setAlbum] = useState(song.album);
  const [genre, setGenre] = useState(song.genre);
  const [year, setYear] = useState(song.year || 2026);
  const [trackNumber, setTrackNumber] = useState(song.trackNumber || 1);

  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string | null>(null);

  useEffect(() => {
    // Attempt to load current cover art
    let isMounted = true;
    fileStorage.getFile(song.id + '-cover').then((blob) => {
      if (blob && isMounted) {
        setCoverPreview(URL.createObjectURL(blob));
      }
    });
    return () => {
      isMounted = false;
    };
  }, [song.id]);

  const handleCoverChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setCoverFile(file);
      setCoverPreview(URL.createObjectURL(file));
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const updatedSong: Song = {
      ...song,
      title: title.trim() || 'Unknown Title',
      artist: artist.trim() || 'Unknown Artist',
      album: album.trim() || 'Unknown Album',
      genre: genre.trim() || 'Unknown Genre',
      year: Number(year) || undefined,
      trackNumber: Number(trackNumber) || undefined,
    };

    if (coverFile) {
      try {
        await fileStorage.saveFile(`${song.id}-cover`, coverFile);
        // Clear cached URL in memory
        const songWithCover = song as any;
        songWithCover.coverUrl = undefined;
      } catch (err) {
        console.error('Failed to save manual cover art:', err);
      }
    }

    offlineDb.updateSong(updatedSong);
    audioEngine.updateSongInQueue(updatedSong);
    onSave();
    onClose();
  };

  return (
    <div className="absolute inset-0 bg-black/80 flex items-center justify-center p-4 z-50 animate-fade-in backdrop-blur-sm">
      <div className="bg-zinc-950 border border-zinc-900 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-zinc-900 bg-zinc-950">
          <div className="flex items-center gap-2">
            <FileEdit className="w-4 h-4 text-zinc-400" />
            <span className="font-sans font-semibold text-xs text-zinc-100">Edit Song Metadata</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-zinc-900 text-zinc-500 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-5 space-y-3.5 text-xs">
          {/* Custom Cover Art Selector */}
          <div className="flex gap-4 items-center bg-zinc-900/30 p-2.5 rounded-xl border border-zinc-900/60 mb-2">
            <div className="w-14 h-14 rounded-lg border border-zinc-800 bg-zinc-900 overflow-hidden flex items-center justify-center shrink-0 relative group cursor-pointer">
              {coverPreview ? (
                <img src={coverPreview} className="w-full h-full object-cover" />
              ) : (
                <div className="text-zinc-650 text-[10px] text-center font-bold">No Image</div>
              )}
              <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center text-[9px] text-white font-bold transition-opacity">
                Upload
              </div>
              <input
                type="file"
                accept="image/*"
                onChange={handleCoverChange}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-[10px] text-zinc-500 font-mono block">COVER ART</span>
              <span className="text-[10px] text-zinc-400 block truncate">
                {coverFile ? coverFile.name : 'Using default visual'}
              </span>
              <span className="text-[9px] text-zinc-600 block mt-0.5">Click the box to upload custom image.</span>
            </div>
          </div>

          <div>
            <label className="block text-zinc-450 font-semibold mb-1">Title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-zinc-900 text-zinc-100 rounded-lg px-3 py-2 border border-zinc-850 focus:border-zinc-700 focus:outline-none transition-all"
              required
            />
          </div>

          <div>
            <label className="block text-zinc-450 font-semibold mb-1">Artist</label>
            <input
              type="text"
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
              className="w-full bg-zinc-900 text-zinc-100 rounded-lg px-3 py-2 border border-zinc-850 focus:border-zinc-700 focus:outline-none transition-all"
              required
            />
          </div>

          <div>
            <label className="block text-zinc-450 font-semibold mb-1">Album</label>
            <input
              type="text"
              value={album}
              onChange={(e) => setAlbum(e.target.value)}
              className="w-full bg-zinc-900 text-zinc-100 rounded-lg px-3 py-2 border border-zinc-850 focus:border-zinc-700 focus:outline-none transition-all"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-zinc-450 font-semibold mb-1">Genre</label>
              <input
                type="text"
                value={genre}
                onChange={(e) => setGenre(e.target.value)}
                className="w-full bg-zinc-900 text-zinc-100 rounded-lg px-3 py-2 border border-zinc-850 focus:border-zinc-700 focus:outline-none transition-all"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-zinc-450 font-semibold mb-1">Year</label>
                <input
                  type="number"
                  value={year}
                  onChange={(e) => setYear(Number(e.target.value))}
                  className="w-full bg-zinc-900 text-zinc-100 rounded-lg px-1.5 py-2 border border-zinc-850 focus:border-zinc-700 focus:outline-none transition-all text-center"
                />
              </div>
              <div>
                <label className="block text-zinc-450 font-semibold mb-1">Track</label>
                <input
                  type="number"
                  value={trackNumber}
                  onChange={(e) => setTrackNumber(Number(e.target.value))}
                  className="w-full bg-zinc-900 text-zinc-100 rounded-lg px-1.5 py-2 border border-zinc-850 focus:border-zinc-700 focus:outline-none transition-all text-center"
                />
              </div>
            </div>
          </div>

          <div className="pt-1.5 flex items-center justify-between text-[10px] text-zinc-500">
            <div className="flex items-center gap-1">
              <HelpCircle className="w-3.5 h-3.5" />
              <span>Offline edits modify local cache tags only.</span>
            </div>
          </div>

          <div className="pt-2 flex gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-zinc-900 hover:bg-zinc-850 text-zinc-300 font-semibold rounded-lg transition-colors border border-zinc-850"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 py-2.5 bg-white hover:bg-zinc-100 text-black font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors shadow"
            >
              <Save className="w-4 h-4" /> Save Tags
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
