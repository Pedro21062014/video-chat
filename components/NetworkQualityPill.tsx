'use client';

import React from 'react';
import { Wifi, WifiOff, AlertTriangle } from 'lucide-react';
import { NetworkStatsInfo } from '@/lib/types';

interface NetworkQualityPillProps {
  networkInfo: NetworkStatsInfo | null;
  onClick?: () => void;
}

export const NetworkQualityPill: React.FC<NetworkQualityPillProps> = ({
  networkInfo,
  onClick,
}) => {
  const status = networkInfo?.status ?? 'good';
  const rtt = networkInfo?.rtt ?? 0;

  if (status === 'good') {
    return (
      <div
        title={rtt > 0 ? `Sua conexão está excelente (${rtt}ms)` : 'Conexão estável e rápida'}
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#137333]/30 text-[#81c995] border border-[#81c995]/30 select-none cursor-default"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-[#81c995] animate-pulse" />
        <Wifi className="w-3.5 h-3.5" />
        <span className="hidden md:inline">Internet Estável</span>
      </div>
    );
  }

  if (status === 'fair') {
    return (
      <button
        type="button"
        onClick={onClick}
        title="Conexão oscilando. Clique para ver detalhes e dicas."
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#fbbc04]/20 text-[#fde293] border border-[#fbbc04]/40 hover:bg-[#fbbc04]/30 select-none cursor-pointer transition-colors"
      >
        <AlertTriangle className="w-3.5 h-3.5 text-[#fbbc04]" />
        <span>Sinal Médio</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      title="Sua internet está fraca ou caindo. Clique para ver como melhorar."
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#ea4335]/25 text-[#f28b82] border border-[#ea4335]/50 hover:bg-[#ea4335]/35 select-none cursor-pointer transition-all animate-pulse"
    >
      <WifiOff className="w-3.5 h-3.5 text-[#ea4335]" />
      <span className="font-semibold">Internet Fraca</span>
    </button>
  );
};
