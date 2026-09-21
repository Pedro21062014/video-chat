'use client';

import React, { useState, useEffect, useRef } from 'react';
import { WifiOff, Wifi, AlertTriangle, X, ChevronDown, ChevronUp, Signal } from 'lucide-react';
import { NetworkQualityStatus, NetworkStatsInfo } from '@/lib/types';

interface NetworkAlertBannerProps {
  networkInfo: NetworkStatsInfo | null;
  onDismiss?: () => void;
  isDismissed?: boolean;
}

export const NetworkAlertBanner: React.FC<NetworkAlertBannerProps> = ({
  networkInfo,
  onDismiss,
  isDismissed = false,
}) => {
  const [showTips, setShowTips] = useState(false);
  const [justRecovered, setJustRecovered] = useState(false);
  const prevStatusRef = useRef<NetworkQualityStatus>('good');

  const status = networkInfo?.status ?? 'good';
  const rtt = networkInfo?.rtt ?? 0;
  const packetLoss = networkInfo?.packetLoss ?? 0;

  useEffect(() => {
    let timer1: NodeJS.Timeout | null = null;
    let timer2: NodeJS.Timeout | null = null;

    if (prevStatusRef.current === 'poor' && status === 'good') {
      timer1 = setTimeout(() => setJustRecovered(true), 10);
      timer2 = setTimeout(() => setJustRecovered(false), 4000);
    }
    prevStatusRef.current = status;

    return () => {
      if (timer1) clearTimeout(timer1);
      if (timer2) clearTimeout(timer2);
    };
  }, [status]);

  // If connection recovered recently, show green confirmation pill
  if (justRecovered && status === 'good') {
    return (
      <aside
        aria-label="Status da conexão restabelecida"
        className="fixed top-16 left-1/2 -translate-x-1/2 z-40 max-w-md w-[92%] sm:w-auto animate-in fade-in slide-in-from-top-3 duration-300 pointer-events-auto"
      >
        <div className="flex items-center gap-2.5 px-4 py-2 rounded-full bg-[#137333]/90 text-white border border-[#81c995]/40 shadow-xl backdrop-blur-md text-xs font-medium">
          <Wifi className="w-4 h-4 text-[#81c995] shrink-0" />
          <span>Sua conexão de internet foi restabelecida e está estável.</span>
        </div>
      </aside>
    );
  }

  // If dismissed or network is good, don't show full banner
  if (isDismissed || status === 'good') {
    return null;
  }

  const isPoor = status === 'poor';

  return (
    <aside
      id="network-quality-alert-banner"
      aria-label="Aviso de conexão instável"
      className="fixed top-14 sm:top-16 left-1/2 -translate-x-1/2 z-40 max-w-lg w-[94%] sm:w-[480px] animate-in fade-in slide-in-from-top-4 duration-300 pointer-events-auto"
    >
      <div
        className={`rounded-2xl border p-3.5 sm:p-4 shadow-2xl backdrop-blur-xl transition-all ${
          isPoor
            ? 'bg-[#2d1a08]/95 border-[#f59e0b]/50 text-[#fef3c7]'
            : 'bg-[#262114]/95 border-[#fbbf24]/40 text-[#fef9c3]'
        }`}
      >
        <div className="flex items-start gap-3">
          {/* Animated warning icon */}
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-inner ${
              isPoor ? 'bg-[#f59e0b]/20 text-[#fbbf24]' : 'bg-[#eab308]/20 text-[#facc15]'
            }`}
          >
            {isPoor ? (
              <WifiOff className="w-5 h-5 animate-pulse" />
            ) : (
              <AlertTriangle className="w-5 h-5" />
            )}
          </div>

          {/* Text Content */}
          <div className="flex-1 min-w-0 pr-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h4 className="text-xs sm:text-sm font-semibold tracking-tight text-white">
                {isPoor ? 'Sua conexão de internet está instável' : 'Sinal de internet oscilando'}
              </h4>
              <span
                className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-medium ${
                  isPoor
                    ? 'bg-[#ea4335]/20 text-[#f28b82] border border-[#ea4335]/30'
                    : 'bg-[#fbbc04]/20 text-[#fde293] border border-[#fbbc04]/30'
                }`}
              >
                {isPoor ? 'Sinal Fraco' : 'Instável'}
              </span>
            </div>

            <p className="text-xs text-[#fed7aa] mt-1 leading-relaxed">
              Para evitar travamentos e manter sua chamada nítida,{' '}
              <strong className="text-white font-medium">
                procure um lugar com melhor sinal de Wi-Fi ou dados móveis.
              </strong>
            </p>

            {/* Live WebRTC Telemetry Stats if available */}
            {(rtt > 0 || packetLoss > 0) && (
              <div className="flex items-center gap-3 mt-2 text-[11px] text-[#fed7aa]/80 font-mono">
                {rtt > 0 && (
                  <span className="flex items-center gap-1">
                    <Signal className="w-3 h-3 text-[#fbbf24]" />
                    Latência: {rtt}ms
                  </span>
                )}
                {packetLoss > 0 && (
                  <span>
                    Perda de pacotes: {packetLoss}%
                  </span>
                )}
              </div>
            )}

            {/* Expandable Tips */}
            {showTips && (
              <div className="mt-2.5 pt-2.5 border-t border-white/10 text-xs text-[#fed7aa]/90 space-y-1.5 animate-in fade-in duration-200">
                <p className="font-medium text-white text-[11px]">Dicas rápidas para melhorar:</p>
                <ul className="list-disc list-inside space-y-1 text-[11px] text-[#fef3c7]">
                  <li>Aproxime-se do roteador Wi-Fi ou evite paredes grossas.</li>
                  <li>Se estiver no 4G/5G, vá para um ambiente mais aberto.</li>
                  <li>Feche outros downloads ou vídeos rodando na mesma rede.</li>
                </ul>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex items-center gap-2 mt-3 pt-1">
              <button
                type="button"
                onClick={() => setShowTips(!showTips)}
                className="text-[11px] font-medium text-[#fde68a] hover:text-white flex items-center gap-1 cursor-pointer transition-colors py-1 px-2 rounded-md hover:bg-white/5"
              >
                {showTips ? (
                  <>
                    <span>Ocultar dicas</span>
                    <ChevronUp className="w-3 h-3" />
                  </>
                ) : (
                  <>
                    <span>Ver como melhorar</span>
                    <ChevronDown className="w-3 h-3" />
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={onDismiss}
                className="ml-auto px-3 py-1 rounded-lg bg-[#f59e0b] hover:bg-[#d97706] text-[#2d1a08] font-semibold text-xs transition-colors cursor-pointer shadow-sm"
              >
                Entendi
              </button>
            </div>
          </div>

          {/* Dismiss (X) */}
          <button
            type="button"
            onClick={onDismiss}
            title="Fechar aviso"
            className="text-[#fed7aa]/60 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors cursor-pointer shrink-0 -mt-1 -mr-1"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
};
