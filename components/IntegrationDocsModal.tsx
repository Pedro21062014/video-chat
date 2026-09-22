'use client';

import React, { useState } from 'react';
import {
  X,
  Code2,
  Tv,
  Video,
  Copy,
  Check,
  ExternalLink,
  Layers,
  Radio,
  Sliders,
  RotateCcw,
  FileText,
  Download,
  Terminal,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';

interface IntegrationDocsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentRoomId?: string;
}

type TabKey = 'stream' | 'meeting' | 'params' | 'ai_txt' | 'free_architecture';

export const IntegrationDocsModal: React.FC<IntegrationDocsModalProps> = ({
  isOpen,
  onClose,
  currentRoomId,
}) => {
  const [activeTab, setActiveTab] = useState<TabKey>('stream');
  const [customCode, setCustomCode] = useState(currentRoomId || 'meu-codigo-123');
  const [copiedIndex, setCopiedIndex] = useState<string | null>(null);

  if (!isOpen) return null;

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://videomeet.app';
  const cleanCode = (customCode || 'canal-teste').toLowerCase().trim();

  const senderUrl = `${baseUrl}/?mode=stream&role=sender&room=${cleanCode}&embed=true`;
  const viewerUrl = `${baseUrl}/?mode=stream&role=viewer&room=${cleanCode}&embed=true`;
  const meetingUrl = `${baseUrl}/?room=${cleanCode}&embed=true`;

  const copyToClipboard = (text: string, id: string) => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(text);
      setCopiedIndex(id);
      setTimeout(() => setCopiedIndex(null), 2000);
    }
  };

  const generateNewCode = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyz';
    const seg = (len: number) =>
      Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
    const newCode = `${seg(3)}-${seg(4)}-${seg(3)}`;
    setCustomCode(newCode);
  };

  const RAW_AI_TXT = `# VIDEOMEET - DOCUMENTAÇÃO TÉCNICA E GUIA DE INTEGRAÇÃO (LLMS & DEVELOPERS)
Protocolo: WebRTC P2P (Sem servidor de mídia pago / 100% Gratuito)
Format: Plaintext Markdown

## MODOS DE OPERAÇÃO
1. Modo Transmissão (Stream): Pareamento por código entre Transmissor (Sender) e Receptor (Viewer).
2. Modo Reunião (Meeting): Videoconferência completa em grupo com chat, reações, apresentação de tela e múltiplos participantes.

## FORMATO DE URLS DE EMBED (IFRAME)
- Transmissor de Câmera/Tela: ${baseUrl}/?mode=stream&role=sender&room={CODIGO}&embed=true
- Receptor de Transmissão: ${baseUrl}/?mode=stream&role=viewer&room={CODIGO}&embed=true
- Reunião Completa: ${baseUrl}/?room={CODIGO}&name={NOME}&embed=true

## PARÂMETROS SUPORTADOS
- mode: 'stream' | 'meeting' (padrão: 'meeting')
- role: 'sender' | 'viewer' (apenas em mode=stream)
- room: string (código da sala)
- name: string (nome do participante)
- embed: 'true' | 'false' (layout limpo sem header)
- audio: 'true' | 'false' (microfone inicial)
- video: 'true' | 'false' (câmera inicial)
- quality: '360p' | '720p' | '1080p'

## PERMISSÕES OBRIGATÓRIAS NO IFRAME
allow="camera; microphone; display-capture; autoplay"`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="relative w-full max-w-4xl max-h-[92vh] bg-[#17181c] text-[#e8eaed] rounded-2xl border border-[#2c3038] shadow-2xl flex flex-col overflow-hidden">
        {/* Header - Minimalist & Modern */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-[#2c3038] bg-[#1d1f24]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-[#272a32] border border-[#383d47] flex items-center justify-center text-[#8ab4f8]">
              <Code2 className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold text-white tracking-tight">
                  Guia de Integração & SDK
                </h2>
                <span className="bg-emerald-500/15 text-emerald-300 text-[10px] font-semibold px-2 py-0.5 rounded-full border border-emerald-500/30">
                  WebRTC P2P Grátis
                </span>
              </div>
              <p className="text-xs text-[#9aa0a6]">
                Transmita sua câmera ou incorpore chamadas de vídeo em qualquer site ou aplicativo.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href="/docs"
              target="_blank"
              className="hidden sm:flex items-center gap-1.5 text-xs text-[#8ab4f8] hover:text-[#aecbfa] bg-[#272a32] px-3 py-1.5 rounded-lg border border-[#383d47] transition-colors"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Ver em TXT (IA)</span>
            </Link>

            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-[#2c3038] text-[#9aa0a6] hover:text-white transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Live Code Tester Bar */}
        <div className="px-5 sm:px-6 py-2.5 bg-[#141518] border-b border-[#2c3038] flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="text-[#9aa0a6] font-medium">Canal de Teste:</span>
            <div className="flex items-center gap-1.5 bg-[#1f2127] px-2.5 py-1 rounded-lg border border-[#313540]">
              <input
                type="text"
                value={customCode}
                onChange={(e) => setCustomCode(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
                placeholder="ex: cam-01"
                className="bg-transparent text-[#8ab4f8] font-mono font-bold text-xs focus:outline-none w-32 sm:w-40"
              />
              <button
                onClick={generateNewCode}
                title="Gerar outro código aleatório"
                className="text-[#9aa0a6] hover:text-white transition-colors cursor-pointer p-0.5"
              >
                <RotateCcw className="w-3 h-3" />
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => window.open(senderUrl.replace('&embed=true', ''), '_blank')}
              className="flex items-center gap-1.5 bg-[#252830] hover:bg-[#30343f] text-white text-xs px-3 py-1.5 rounded-lg border border-[#383d47] transition-colors cursor-pointer"
            >
              <Video className="w-3.5 h-3.5 text-[#8ab4f8]" />
              <span>Testar Transmissor</span>
              <ExternalLink className="w-3 h-3 text-[#9aa0a6]" />
            </button>

            <button
              onClick={() => window.open(viewerUrl.replace('&embed=true', ''), '_blank')}
              className="flex items-center gap-1.5 bg-[#252830] hover:bg-[#30343f] text-white text-xs px-3 py-1.5 rounded-lg border border-[#383d47] transition-colors cursor-pointer"
            >
              <Tv className="w-3.5 h-3.5 text-emerald-400" />
              <span>Testar Receptor</span>
              <ExternalLink className="w-3 h-3 text-[#9aa0a6]" />
            </button>
          </div>
        </div>

        {/* Minimalist Tabs Header */}
        <div className="flex border-b border-[#2c3038] bg-[#191a1f] px-5 sm:px-6 gap-1.5 overflow-x-auto">
          <button
            onClick={() => setActiveTab('stream')}
            className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-medium rounded-t-lg transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'stream'
                ? 'bg-[#252830] text-[#8ab4f8] border-b-2 border-[#8ab4f8]'
                : 'text-[#9aa0a6] hover:text-[#e8eaed]'
            }`}
          >
            <Radio className="w-3.5 h-3.5" />
            <span>1. Só Transmissão (Pareamento)</span>
          </button>

          <button
            onClick={() => setActiveTab('meeting')}
            className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-medium rounded-t-lg transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'meeting'
                ? 'bg-[#252830] text-[#8ab4f8] border-b-2 border-[#8ab4f8]'
                : 'text-[#9aa0a6] hover:text-[#e8eaed]'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>2. Reunião Completa</span>
          </button>

          <button
            onClick={() => setActiveTab('params')}
            className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-medium rounded-t-lg transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'params'
                ? 'bg-[#252830] text-[#8ab4f8] border-b-2 border-[#8ab4f8]'
                : 'text-[#9aa0a6] hover:text-[#e8eaed]'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>3. Parâmetros de URL</span>
          </button>

          <button
            onClick={() => setActiveTab('ai_txt')}
            className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-medium rounded-t-lg transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'ai_txt'
                ? 'bg-[#252830] text-purple-300 border-b-2 border-purple-400'
                : 'text-[#9aa0a6] hover:text-[#e8eaed]'
            }`}
          >
            <FileText className="w-3.5 h-3.5 text-purple-400" />
            <span>4. TXT para IA (llms.txt)</span>
          </button>

          <button
            onClick={() => setActiveTab('free_architecture')}
            className={`flex items-center gap-2 px-3.5 py-2.5 text-xs font-medium rounded-t-lg transition-all whitespace-nowrap cursor-pointer ${
              activeTab === 'free_architecture'
                ? 'bg-[#252830] text-emerald-300 border-b-2 border-emerald-400'
                : 'text-[#9aa0a6] hover:text-[#e8eaed]'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>5. Por que é Grátis?</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5 text-xs">
          {/* TAB 1: SÓ TRANSMISSÃO VIA CÓDIGO */}
          {activeTab === 'stream' && (
            <div className="space-y-5">
              <div className="bg-[#1e2026] p-4 rounded-xl border border-[#2d313a]">
                <p className="text-[#9aa0a6] leading-relaxed">
                  Permite transmitir apenas a câmera ou tela de um dispositivo (ex: smartphone, webcam ou PC) para outro lugar (dashboard, outro monitor, site externo ou OBS Studio) usando apenas o código de pareamento.
                </p>
              </div>

              {/* Snippet Iframe */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5 text-[#8ab4f8]" />
                    Opção A: Iframe HTML (Receptor / Assistir)
                  </span>
                  <button
                    onClick={() =>
                      copyToClipboard(
                        `<iframe\n  src="${viewerUrl}"\n  width="100%"\n  height="480"\n  allow="camera; microphone; display-capture; autoplay"\n  allowfullscreen\n  style="border: none; border-radius: 12px; background: #111;">\n</iframe>`,
                        'iframe_stream'
                      )
                    }
                    className="flex items-center gap-1 text-[11px] text-[#9aa0a6] hover:text-white bg-[#252830] px-2.5 py-1 rounded border border-[#333742] transition-colors cursor-pointer"
                  >
                    {copiedIndex === 'iframe_stream' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedIndex === 'iframe_stream' ? 'Copiado!' : 'Copiar Iframe'}</span>
                  </button>
                </div>

                <div className="bg-[#121316] p-3.5 rounded-xl border border-[#2c3038] font-mono text-[11px] text-[#e8eaed] overflow-x-auto">
                  <pre className="leading-relaxed">
{`<iframe
  src="${viewerUrl}"
  width="100%"
  height="480"
  allow="camera; microphone; display-capture; autoplay"
  allowfullscreen
  style="border: none; border-radius: 12px; background: #111;">
</iframe>`}
                  </pre>
                </div>
              </div>

              {/* Snippet SDK */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white flex items-center gap-1.5">
                    <Code2 className="w-3.5 h-3.5 text-[#8ab4f8]" />
                    Opção B: JavaScript SDK (`videomeet-sdk.js`)
                  </span>
                  <button
                    onClick={() =>
                      copyToClipboard(
                        `<!-- Inclua o SDK no seu site -->\n<script src="${baseUrl}/videomeet-sdk.js"></script>\n\n<div id="camera-stream" style="width: 100%; height: 450px;"></div>\n\n<script>\n  // Gera e inicializa o receptor pareado instantaneamente\n  VideoMeet.embed({\n    container: '#camera-stream',\n    mode: 'stream',\n    role: 'viewer',\n    room: '${cleanCode}',\n    baseUrl: '${baseUrl}'\n  });\n</script>`,
                        'js_sdk'
                      )
                    }
                    className="flex items-center gap-1 text-[11px] text-[#9aa0a6] hover:text-white bg-[#252830] px-2.5 py-1 rounded border border-[#333742] transition-colors cursor-pointer"
                  >
                    {copiedIndex === 'js_sdk' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedIndex === 'js_sdk' ? 'Copiado!' : 'Copiar SDK'}</span>
                  </button>
                </div>

                <div className="bg-[#121316] p-3.5 rounded-xl border border-[#2c3038] font-mono text-[11px] text-[#e8eaed] overflow-x-auto">
                  <pre className="leading-relaxed">
{`<!-- 1. Inclua o SDK no seu site -->
<script src="${baseUrl}/videomeet-sdk.js"></script>

<!-- 2. Container HTML onde o vídeo será exibido -->
<div id="camera-stream" style="width: 100%; height: 450px;"></div>

<script>
  VideoMeet.embed({
    container: '#camera-stream',
    mode: 'stream',
    role: 'viewer',
    room: '${cleanCode}',
    baseUrl: '${baseUrl}'
  });
</script>`}
                  </pre>
                </div>
              </div>

              {/* Snippet OBS Studio */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white flex items-center gap-1.5">
                    <Tv className="w-3.5 h-3.5 text-emerald-400" />
                    Opção C: OBS Studio / Streamlabs (Browser Source)
                  </span>
                  <button
                    onClick={() => copyToClipboard(viewerUrl, 'obs_url')}
                    className="flex items-center gap-1 text-[11px] text-[#9aa0a6] hover:text-white bg-[#252830] px-2.5 py-1 rounded border border-[#333742] transition-colors cursor-pointer"
                  >
                    {copiedIndex === 'obs_url' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedIndex === 'obs_url' ? 'Copiado!' : 'Copiar URL'}</span>
                  </button>
                </div>

                <div className="bg-[#121316] p-3 rounded-xl border border-[#2c3038] font-mono text-emerald-300 break-all">
                  {viewerUrl}
                </div>
                <p className="text-[11px] text-[#9aa0a6]">
                  No OBS Studio: Adicione a fonte <strong>Navegador (Browser Source)</strong> com 1920x1080.
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: REUNIÃO COMPLETA */}
          {activeTab === 'meeting' && (
            <div className="space-y-5">
              <div className="bg-[#1e2026] p-4 rounded-xl border border-[#2d313a]">
                <p className="text-[#9aa0a6] leading-relaxed">
                  Adicione uma sala de videoconferência completa com áudio bidirecional, chat, reações de emoji, apresentação de tela e layout adaptativo em qualquer página.
                </p>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">Iframe de Reunião:</span>
                  <button
                    onClick={() =>
                      copyToClipboard(
                        `<iframe\n  src="${meetingUrl}"\n  width="100%"\n  height="600"\n  allow="camera; microphone; display-capture; autoplay"\n  allowfullscreen\n  style="border: none; border-radius: 16px; background: #111;">\n</iframe>`,
                        'iframe_meeting'
                      )
                    }
                    className="flex items-center gap-1 text-[11px] text-[#9aa0a6] hover:text-white bg-[#252830] px-2.5 py-1 rounded border border-[#333742] transition-colors cursor-pointer"
                  >
                    {copiedIndex === 'iframe_meeting' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedIndex === 'iframe_meeting' ? 'Copiado!' : 'Copiar Iframe'}</span>
                  </button>
                </div>

                <div className="bg-[#121316] p-3.5 rounded-xl border border-[#2c3038] font-mono text-[11px] text-[#e8eaed] overflow-x-auto">
                  <pre className="leading-relaxed">
{`<iframe
  src="${meetingUrl}"
  width="100%"
  height="600"
  allow="camera; microphone; display-capture; autoplay"
  allowfullscreen
  style="border: none; border-radius: 16px; background: #111;">
</iframe>`}
                  </pre>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-white">Componente React / Next.js:</span>
                  <button
                    onClick={() =>
                      copyToClipboard(
                        `export function VideoCallWidget({ roomCode }: { roomCode: string }) {\n  return (\n    <iframe\n      src={\`${baseUrl}/?room=\${encodeURIComponent(roomCode)}&embed=true\`}\n      className="w-full h-[600px] rounded-2xl border-0 bg-[#111]"\n      allow="camera; microphone; display-capture; autoplay"\n      allowFullScreen\n    />\n  );\n}`,
                        'react_meeting'
                      )
                    }
                    className="flex items-center gap-1 text-[11px] text-[#9aa0a6] hover:text-white bg-[#252830] px-2.5 py-1 rounded border border-[#333742] transition-colors cursor-pointer"
                  >
                    {copiedIndex === 'react_meeting' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedIndex === 'react_meeting' ? 'Copiado!' : 'Copiar React'}</span>
                  </button>
                </div>

                <div className="bg-[#121316] p-3.5 rounded-xl border border-[#2c3038] font-mono text-[11px] text-[#e8eaed] overflow-x-auto">
                  <pre className="leading-relaxed">
{`export function VideoCallWidget({ roomCode }: { roomCode: string }) {
  return (
    <iframe
      src={\`${baseUrl}/?room=\${encodeURIComponent(roomCode)}&embed=true\`}
      className="w-full h-[600px] rounded-2xl border-0 bg-[#111]"
      allow="camera; microphone; display-capture; autoplay"
      allowFullScreen
    />
  );
}`}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PARÂMETROS DE URL */}
          {activeTab === 'params' && (
            <div className="space-y-4">
              <div className="bg-[#1e2026] p-4 rounded-xl border border-[#2d313a]">
                <p className="text-[#9aa0a6] leading-relaxed">
                  Personalize a inicialização configurando os parâmetros na query string da URL:
                </p>
              </div>

              <div className="overflow-x-auto rounded-xl border border-[#2c3038]">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-[#20232a] text-[#9aa0a6] border-b border-[#2c3038] text-[11px]">
                      <th className="py-2.5 px-3 font-semibold">Parâmetro</th>
                      <th className="py-2.5 px-3 font-semibold">Valores Possíveis</th>
                      <th className="py-2.5 px-3 font-semibold">Descrição</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2c3038] font-mono text-[11px]">
                    <tr className="hover:bg-[#1a1b20]">
                      <td className="py-2.5 px-3 text-[#8ab4f8] font-bold">room</td>
                      <td className="py-2.5 px-3 text-white">string (ex: sala-102)</td>
                      <td className="py-2.5 px-3 text-[#9aa0a6] font-sans">Código do canal de pareamento</td>
                    </tr>
                    <tr className="hover:bg-[#1a1b20]">
                      <td className="py-2.5 px-3 text-[#8ab4f8] font-bold">mode</td>
                      <td className="py-2.5 px-3 text-white">stream | meeting</td>
                      <td className="py-2.5 px-3 text-[#9aa0a6] font-sans">Só transmissão ou reunião completa</td>
                    </tr>
                    <tr className="hover:bg-[#1a1b20]">
                      <td className="py-2.5 px-3 text-[#8ab4f8] font-bold">role</td>
                      <td className="py-2.5 px-3 text-white">sender | viewer</td>
                      <td className="py-2.5 px-3 text-[#9aa0a6] font-sans">Se é transmissor ou receptor (no modo stream)</td>
                    </tr>
                    <tr className="hover:bg-[#1a1b20]">
                      <td className="py-2.5 px-3 text-[#8ab4f8] font-bold">embed</td>
                      <td className="py-2.5 px-3 text-white">true | false</td>
                      <td className="py-2.5 px-3 text-[#9aa0a6] font-sans">Oculta barras externas para iframes</td>
                    </tr>
                    <tr className="hover:bg-[#1a1b20]">
                      <td className="py-2.5 px-3 text-[#8ab4f8] font-bold">audio</td>
                      <td className="py-2.5 px-3 text-white">true | false</td>
                      <td className="py-2.5 px-3 text-[#9aa0a6] font-sans">Microfone inicial (true = ligado, false = mudo)</td>
                    </tr>
                    <tr className="hover:bg-[#1a1b20]">
                      <td className="py-2.5 px-3 text-[#8ab4f8] font-bold">video</td>
                      <td className="py-2.5 px-3 text-white">true | false</td>
                      <td className="py-2.5 px-3 text-[#9aa0a6] font-sans">Câmera inicial (true = ligada, false = desligada)</td>
                    </tr>
                    <tr className="hover:bg-[#1a1b20]">
                      <td className="py-2.5 px-3 text-[#8ab4f8] font-bold">quality</td>
                      <td className="py-2.5 px-3 text-white">360p | 720p | 1080p</td>
                      <td className="py-2.5 px-3 text-[#9aa0a6] font-sans">Resolução alvo da transmissão</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: TXT PURO PARA IA (LLMS.TXT) */}
          {activeTab === 'ai_txt' && (
            <div className="space-y-4">
              <div className="bg-[#1e1c26] p-4 rounded-xl border border-purple-500/20 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <div className="text-purple-300 font-semibold flex items-center gap-1.5">
                    <FileText className="w-4 h-4" />
                    <span>Documentação em Formato Texto Puro para Agentes & IAs</span>
                  </div>
                  <p className="text-[#9aa0a6] text-[11px] mt-1">
                    Pronto para copiar como contexto para <strong>ChatGPT, Claude, Gemini ou Cursor</strong>.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href="/docs.txt"
                    target="_blank"
                    className="flex items-center gap-1.5 bg-[#2a2636] hover:bg-[#373248] text-purple-200 px-3 py-1.5 rounded-lg border border-purple-500/30 text-xs transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>Abrir /docs.txt</span>
                  </a>

                  <button
                    onClick={() => copyToClipboard(RAW_AI_TXT, 'raw_ai_txt')}
                    className="flex items-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white font-semibold px-3 py-1.5 rounded-lg text-xs transition-colors shadow cursor-pointer"
                  >
                    {copiedIndex === 'raw_ai_txt' ? <Check className="w-3.5 h-3.5 text-emerald-200" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedIndex === 'raw_ai_txt' ? 'Copiado!' : 'Copiar TXT Completo'}</span>
                  </button>
                </div>
              </div>

              <div className="bg-[#121316] p-4 rounded-xl border border-[#2c3038] font-mono text-[11px] text-[#dcdfe4] overflow-x-auto max-h-64">
                <pre className="whitespace-pre-wrap leading-relaxed">
                  {RAW_AI_TXT}
                </pre>
              </div>
            </div>
          )}

          {/* TAB 5: ARQUITETURA GRATUITA */}
          {activeTab === 'free_architecture' && (
            <div className="space-y-4">
              <div className="bg-emerald-950/25 p-4 rounded-xl border border-emerald-500/25 space-y-2">
                <div className="flex items-center gap-2 text-emerald-400 font-semibold">
                  <ShieldCheck className="w-4 h-4" />
                  <span>Por que o VideoMeet é 100% Gratuito?</span>
                </div>
                <p className="text-emerald-200/80 leading-relaxed text-[11px]">
                  Ao contrário de Twilio ou Zoom que cobram por minuto e usam servidores centrais caros, nossa arquitetura opera em <strong>WebRTC Peer-to-Peer direto</strong>:
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="bg-[#1e2026] p-3.5 rounded-xl border border-[#2d313a]">
                  <div className="text-white font-semibold text-xs mb-1">1. Vídeo Direto (P2P)</div>
                  <p className="text-[11px] text-[#9aa0a6]">
                    Os dados de áudio e vídeo trafegam diretamente entre os navegadores, sem servidor intermediário.
                  </p>
                </div>

                <div className="bg-[#1e2026] p-3.5 rounded-xl border border-[#2d313a]">
                  <div className="text-white font-semibold text-xs mb-1">2. Zero Custo de Tráfego</div>
                  <p className="text-[11px] text-[#9aa0a6]">
                    Apenas o sinal inicial de conexão é trocado via Firestore no plano gratuito.
                  </p>
                </div>

                <div className="bg-[#1e2026] p-3.5 rounded-xl border border-[#2d313a]">
                  <div className="text-white font-semibold text-xs mb-1">3. Sem Limite de Tempo</div>
                  <p className="text-[11px] text-[#9aa0a6]">
                    Transmissões e chamadas podem rodar continuamente sem cortes aos 40 minutos.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 sm:px-6 py-3 bg-[#1d1f24] border-t border-[#2c3038] flex items-center justify-between text-xs text-[#9aa0a6]">
          <span>SDK aberto e compatível com todos os navegadores modernos.</span>
          <button
            onClick={onClose}
            className="bg-[#252830] hover:bg-[#30343f] text-white px-4 py-1.5 rounded-lg border border-[#383d47] transition-colors cursor-pointer font-medium"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
