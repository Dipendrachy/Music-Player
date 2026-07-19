/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDestructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export default function ConfirmDialog({
  isOpen,
  title,
  message,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  isDestructive = true,
  onConfirm,
  onCancel
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
        onClick={onCancel}
      />
      
      {/* Dialog card */}
      <div className="bg-zinc-950 border border-zinc-900 rounded-2xl w-full max-w-sm overflow-hidden shadow-2xl relative z-10 animate-fade-in flex flex-col">
        {/* Header accent for destructive actions */}
        {isDestructive && (
          <div className="h-1 w-full bg-gradient-to-r from-red-500 to-rose-600" />
        )}
        
        <div className="p-5 flex-1 space-y-4">
          <div className="flex items-start gap-3">
            {isDestructive ? (
              <div className="p-2 bg-red-950/40 border border-red-900/40 text-red-400 rounded-xl shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
            ) : (
              <div className="p-2 bg-zinc-900 border border-zinc-800 text-zinc-300 rounded-xl shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
            )}
            <div className="space-y-1">
              <h3 className="font-bold text-sm text-zinc-100 tracking-tight">{title}</h3>
              <p className="text-[11.5px] leading-relaxed text-zinc-400 font-medium">
                {message}
              </p>
            </div>
          </div>
        </div>

        {/* Actions footer */}
        <div className="p-3.5 bg-zinc-900/40 border-t border-zinc-900/60 flex items-center justify-end gap-2 shrink-0">
          <button
            onClick={onCancel}
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold text-zinc-400 hover:text-white hover:bg-zinc-900 transition-all"
          >
            {cancelText}
          </button>
          <button
            onClick={() => {
              onConfirm();
            }}
            className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm ${
              isDestructive
                ? 'bg-gradient-to-r from-red-600 to-rose-600 hover:from-red-500 hover:to-rose-500 text-white shadow-red-950/20'
                : 'bg-white hover:bg-zinc-100 text-black'
            }`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
}
