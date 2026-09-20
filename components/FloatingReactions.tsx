'use client';

import React from 'react';
import { FloatingReaction } from '@/lib/types';

interface FloatingReactionsProps {
  reactions: FloatingReaction[];
}

export const FloatingReactions: React.FC<FloatingReactionsProps> = ({ reactions }) => {
  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden z-50">
      {reactions.map((r) => {
        const offset = r.xOffset || 50;
        return (
          <div
            key={r.id}
            className="absolute bottom-24 flex flex-col items-center animate-reaction"
            style={{ left: `${offset}%` }}
          >
            <span className="text-4xl sm:text-5xl filter drop-shadow-md select-none">
              {r.emoji}
            </span>
            <span className="text-[11px] font-medium bg-black/60 text-white/90 px-2 py-0.5 rounded-full backdrop-blur-sm mt-1 whitespace-nowrap">
              {r.senderName}
            </span>
          </div>
        );
      })}
    </div>
  );
};
