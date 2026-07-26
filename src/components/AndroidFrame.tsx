/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface AndroidFrameProps {
  children: React.ReactNode;
  onSystemBack?: () => void;
  onSystemHome?: () => void;
  onSystemRecents?: () => void;
}

export default function AndroidFrame({ children }: AndroidFrameProps) {
  return (
    <div className="w-full h-[100dvh] bg-[#030303] flex flex-col font-sans text-white overflow-hidden relative">
      {children}
    </div>
  );
}


