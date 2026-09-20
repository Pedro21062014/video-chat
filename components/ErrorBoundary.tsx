'use client';

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { RefreshCw, RotateCcw, AlertCircle } from 'lucide-react';
import Image from 'next/image';

interface Props {
  children: ReactNode;
  fallbackTitle?: string;
  fallbackDescription?: string;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary caught an error]:', error, errorInfo);
    this.setState({ error, errorInfo });
  }

  private handleReset = () => {
    // Clear potentially corrupted session state
    try {
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem('active_call_room');
        sessionStorage.removeItem('active_call_user');
      }
    } catch {
      // ignore
    }

    if (this.props.onReset) {
      try {
        this.props.onReset();
      } catch {
        // ignore
      }
    }

    this.setState({ hasError: false, error: null, errorInfo: null });
  };

  private handleFullReload = () => {
    try {
      if (typeof window !== 'undefined') {
        sessionStorage.clear();
        const url = new URL(window.location.href);
        url.search = '';
        window.location.href = url.pathname;
      }
    } catch {
      if (typeof window !== 'undefined') {
        window.location.reload();
      }
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div
          id="error-boundary-fallback"
          className="min-h-screen min-h-[100dvh] w-full bg-[#18191a] text-[#e8eaed] flex flex-col items-center justify-center p-4 sm:p-6 select-none"
        >
          <div className="w-full max-w-md bg-[#242526] border border-[#3c4043] rounded-2xl p-6 sm:p-8 shadow-2xl flex flex-col items-center text-center">
            {/* Logo */}
            <div className="relative w-12 h-12 rounded-xl overflow-hidden bg-[#2d2f31] border border-[#3c4043] flex items-center justify-center mb-4 shadow-md">
              <Image
                src="/logo_video_bonito.png"
                alt="VideoMeet"
                fill
                className="object-contain p-1"
                referrerPolicy="no-referrer"
              />
            </div>

            {/* Warning Icon Badge */}
            <div className="w-10 h-10 rounded-full bg-[#ea4335]/15 border border-[#ea4335]/30 flex items-center justify-center text-[#ea4335] mb-3">
              <AlertCircle className="w-5 h-5" />
            </div>

            <h2 className="text-lg sm:text-xl font-semibold text-white mb-2">
              {this.props.fallbackTitle || 'Recuperação Automática da Interface'}
            </h2>

            <p className="text-xs sm:text-sm text-[#9aa0a6] mb-6 leading-relaxed">
              {this.props.fallbackDescription ||
                'A interface detectou uma interrupção inesperada e foi protegida com segurança para evitar o travamento do aplicativo.'}
            </p>

            {/* Technical Error Summary (subtle) */}
            {this.state.error && (
              <div className="w-full bg-[#18191a] rounded-lg p-2.5 mb-6 text-left border border-[#3c4043]/60 overflow-hidden">
                <span className="text-[11px] font-mono text-[#f28b82] block truncate">
                  {this.state.error.name}: {this.state.error.message || 'Erro interno de renderização'}
                </span>
              </div>
            )}

            {/* Action buttons */}
            <div className="flex flex-col sm:flex-row gap-3 w-full">
              <button
                id="btn-recover-interface"
                onClick={this.handleReset}
                className="flex-1 py-2.5 px-4 rounded-xl bg-[#8ab4f8] hover:bg-[#aecbfa] text-[#202124] font-medium text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-md"
              >
                <RotateCcw className="w-4 h-4" />
                <span>Restaurar Tela</span>
              </button>

              <button
                id="btn-reload-app"
                onClick={this.handleFullReload}
                className="flex-1 py-2.5 px-4 rounded-xl bg-[#3c4043]/80 hover:bg-[#3c4043] text-white font-medium text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer border border-[#5f6368]"
              >
                <RefreshCw className="w-4 h-4" />
                <span>Reiniciar</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
