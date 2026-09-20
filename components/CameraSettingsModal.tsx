'use client';

import React, { useState, useEffect } from 'react';
import {
  X,
  Camera,
  Video,
  VideoOff,
  Check,
  ChevronDown,
  Loader2,
  Activity,
} from 'lucide-react';
import { VIDEO_QUALITIES, VideoQualityId } from '@/lib/types';

interface CameraSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentQuality: VideoQualityId;
  onChangeQuality: (quality: VideoQualityId) => Promise<void> | void;
  availableCameras: MediaDeviceInfo[];
  activeCameraId: string;
  onChangeCamera: (deviceId: string) => Promise<void> | void;
  isVideoMuted: boolean;
  onToggleVideo: () => void;
  localStream: MediaStream | null;
}

export const CameraSettingsModal: React.FC<CameraSettingsModalProps> = ({
  isOpen,
  onClose,
  currentQuality,
  onChangeQuality,
  availableCameras,
  activeCameraId,
  onChangeCamera,
  isVideoMuted,
  onToggleVideo,
  localStream,
}) => {
  const [isApplying, setIsApplying] = useState(false);
  const [actualResolution, setActualResolution] = useState<{
    width: number;
    height: number;
    frameRate?: number;
  } | null>(null);

  // Monitor live track settings
  useEffect(() => {
    if (!isOpen) return;

    const updateStats = () => {
      if (!localStream) {
        setActualResolution(null);
        return;
      }
      const videoTrack = localStream.getVideoTracks()[0];
      if (!videoTrack) {
        setActualResolution(null);
        return;
      }

      try {
        const settings = videoTrack.getSettings();
        if (settings.width && settings.height) {
          setActualResolution({
            width: settings.width,
            height: settings.height,
            frameRate: settings.frameRate ? Math.round(settings.frameRate) : undefined,
          });
        }
      } catch {
        // ignore
      }
    };

    const timer = setTimeout(updateStats, 0);
    const interval = setInterval(updateStats, 1000);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [localStream, currentQuality, isOpen]);

  if (!isOpen) return null;

  const handleSelectQuality = async (qualityId: VideoQualityId) => {
    if (qualityId === currentQuality || isApplying) return;
    setIsApplying(true);
    try {
      await onChangeQuality(qualityId);
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div
      id="modal-camera-settings-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fadeIn"
      onClick={onClose}
    >
      <div
        id="modal-camera-settings-dialog"
        className="relative w-full max-w-md bg-[#1e1f22] border border-[#33373b] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[88vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Minimalist Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2d3135]">
          <div className="flex items-center gap-2.5">
            <Camera className="w-4 h-4 text-[#8ab4f8]" />
            <h2 className="text-sm font-semibold tracking-tight text-[#e8eaed]">
              Configurações de Câmera
            </h2>
          </div>
          <button
            id="btn-close-camera-settings"
            onClick={onClose}
            className="w-7 h-7 rounded-lg flex items-center justify-center text-[#9aa0a6] hover:text-white hover:bg-[#2b2d31] transition-colors cursor-pointer"
            title="Fechar"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {/* Status & Toggle Bar */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-[#282a2e] border border-[#33373b]">
            <div className="flex items-center gap-2.5">
              <span
                className={`w-2 h-2 rounded-full shrink-0 ${
                  isVideoMuted ? 'bg-[#ea4335]' : 'bg-[#81c995] animate-pulse'
                }`}
              />
              <div className="flex flex-col">
                <span className="font-medium text-[#e8eaed] text-xs">
                  {isVideoMuted ? 'Câmera desativada' : 'Câmera ativa'}
                </span>
                {!isVideoMuted && actualResolution && (
                  <span className="text-[11px] text-[#9aa0a6] font-mono">
                    {actualResolution.width} × {actualResolution.height}
                    {actualResolution.frameRate ? ` @ ${actualResolution.frameRate}fps` : ''}
                  </span>
                )}
              </div>
            </div>

            <button
              id="btn-modal-toggle-video"
              type="button"
              onClick={onToggleVideo}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer flex items-center gap-1.5 ${
                isVideoMuted
                  ? 'bg-[#8ab4f8] text-[#041e49] hover:bg-[#a8c7fa]'
                  : 'bg-[#ea4335]/20 text-[#ea4335] hover:bg-[#ea4335]/30'
              }`}
            >
              {isVideoMuted ? (
                <>
                  <Video className="w-3.5 h-3.5" />
                  <span>Ativar</span>
                </>
              ) : (
                <>
                  <VideoOff className="w-3.5 h-3.5" />
                  <span>Desligar</span>
                </>
              )}
            </button>
          </div>

          {/* Camera Device Selector */}
          {availableCameras.length > 0 && (
            <div className="space-y-1.5">
              <label
                htmlFor="select-camera-device"
                className="text-[11px] font-medium text-[#9aa0a6] tracking-wide"
              >
                Dispositivo de câmera
              </label>
              <div className="relative">
                <select
                  id="select-camera-device"
                  value={activeCameraId}
                  onChange={(e) => onChangeCamera(e.target.value)}
                  className="w-full appearance-none bg-[#282a2e] border border-[#33373b] hover:border-[#4d5156] rounded-xl px-3.5 py-2 text-xs text-[#e8eaed] focus:border-[#8ab4f8] focus:outline-none transition-colors cursor-pointer pr-8"
                >
                  {availableCameras.map((device, idx) => (
                    <option
                      key={device.deviceId || idx}
                      value={device.deviceId}
                      className="bg-[#1e1f22] text-[#e8eaed]"
                    >
                      {device.label || `Câmera ${idx + 1}`}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3.5 h-3.5 text-[#9aa0a6] absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            </div>
          )}

          {/* Video Resolution Options */}
          <div className="space-y-1.5 pt-1">
            <div className="flex items-center justify-between pb-0.5">
              <label className="text-[11px] font-medium text-[#9aa0a6] tracking-wide">
                Resolução e Qualidade de envio
              </label>
              {isApplying && (
                <div className="flex items-center gap-1 text-[11px] text-[#8ab4f8]">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  <span>Aplicando...</span>
                </div>
              )}
            </div>

            <div className="space-y-1">
              {VIDEO_QUALITIES.map((opt) => {
                const isSelected = opt.id === currentQuality;
                return (
                  <button
                    key={opt.id}
                    id={`btn-quality-${opt.id}`}
                    type="button"
                    onClick={() => handleSelectQuality(opt.id)}
                    disabled={isApplying}
                    className={`w-full px-3.5 py-2 rounded-xl text-left flex items-center justify-between transition-all cursor-pointer border ${
                      isSelected
                        ? 'bg-[#8ab4f8]/10 border-[#8ab4f8]/60 text-[#e8eaed]'
                        : 'bg-[#282a2e]/50 border-transparent hover:border-[#3c4043] hover:bg-[#282a2e] text-[#9aa0a6] hover:text-[#e8eaed]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`font-mono text-xs font-semibold ${
                          isSelected ? 'text-[#8ab4f8]' : 'text-[#e8eaed]'
                        }`}
                      >
                        {opt.label}
                      </span>
                      <span className="text-[11px] font-mono text-[#80868b]">
                        {opt.resolution}
                      </span>
                      {opt.id === '720p' && (
                        <span className="text-[10px] text-[#81c995] bg-[#81c995]/10 px-1.5 py-0.5 rounded font-medium">
                          Padrão
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-[#80868b] font-mono">
                        {opt.bitrate >= 1000000
                          ? `${(opt.bitrate / 1000000).toFixed(1)} Mbps`
                          : `${Math.round(opt.bitrate / 1000)} kbps`}
                      </span>
                      {isSelected && (
                        <Check className="w-3.5 h-3.5 text-[#8ab4f8] stroke-[2.5]" />
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-2.5 rounded-lg bg-[#282a2e]/40 border border-[#33373b]/50 text-[11px] text-[#80868b] flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-[#8ab4f8] shrink-0" />
            <span>
              Resoluções menores como 144p e 240p reduzem o consumo de dados e internet em conexões lentas.
            </span>
          </div>
        </div>

        {/* Minimalist Footer */}
        <div className="px-5 py-3 border-t border-[#2d3135] bg-[#1e1f22] flex items-center justify-end">
          <button
            id="btn-done-camera-settings"
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#8ab4f8] hover:bg-[#a8c7fa] text-[#041e49] font-medium text-xs transition-colors cursor-pointer shadow-sm"
          >
            Concluir
          </button>
        </div>
      </div>
    </div>
  );
};
