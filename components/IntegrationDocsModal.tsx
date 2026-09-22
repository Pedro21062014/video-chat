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
  BookOpen,
  Terminal,
  Sparkles,
  Layers,
  Monitor,
  ShieldCheck,
  Radio,
  Sliders,
  Play,
  RotateCcw,
} from 'lucide-react';

interface IntegrationDocsModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentRoomId?: string;
}

export const IntegrationDocsModal: React.FC<IntegrationDocsModalProps> = ({
  isOpen,
  onClose,
  currentRoomId,
}) => {
  const [activeTab, setActiveTab] = useState<'stream' | 'meeting' | 'params' | 'free_architecture'>('stream');
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-[#202124] text-[#e8eaed] rounded-2xl border border-[#3c4043] shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#3c4043]/60 bg-[#28292c]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#1a73e8]/20 border border-[#8ab4f8]/30 flex items-center justify-center text-[#8ab4f8]">
              <Code2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-semibold text-white tracking-tight">
                  Integrações, Transmissão via Código & SDK
                </h2>
                <span className="bg-emerald-500/20 text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/30 uppercase tracking-wider">
                  100% Gratuito
                </span>
              </div>
              <p className="text-xs text-[#9aa0a6]">
                Transmita sua câmera ou incorpore chamadas de vídeo no seu próprio site ou app.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-[#3c4043] text-[#9aa0a6] hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Live Code Tester Bar */}
        <div className="px-6 py-3 bg-[#1e1f23] border-b border-[#3c4043]/40 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-[#9aa0a6]">Código de Pareamento de Teste:</span>
            <input
              type="text"
              value={customCode}
              onChange={(e) => setCustomCode(e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ''))}
              placeholder="ex: cam-782-910"
              className="bg-[#2d2f34] text-[#8ab4f8] font-mono font-bold text-xs px-3 py-1.5 rounded-lg border border-[#3c4043] focus:outline-none focus:border-[#8ab4f8] w-36 sm:w-44"
            />
            <button
              onClick={generateNewCode}
              title="Gerar outro código aleatório"
              className="p-1.5 rounded-lg bg-[#28292c] hover:bg-[#3c4043] text-[#9aa0a6] hover:text-white border border-[#3c4043]/60 transition-colors"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => window.open(senderUrl.replace('&embed=true', ''), '_blank')}
              className="flex items-center gap-1.5 bg-[#1a73e8] hover:bg-[#1b66c9] text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors shadow-sm"
            >
              <Video className="w-3.5 h-3.5" />
              <span>Abrir Transmissor</span>
              <ExternalLink className="w-3 h-3 opacity-70" />
            </button>

            <button
              onClick={() => window.open(viewerUrl.replace('&embed=true', ''), '_blank')}
              className="flex items-center gap-1.5 bg-[#28292c] hover:bg-[#3c4043] text-[#8ab4f8] text-xs font-medium px-3 py-1.5 rounded-lg border border-[#3c4043] transition-colors"
            >
              <Tv className="w-3.5 h-3.5" />
              <span>Abrir Receptor</span>
              <ExternalLink className="w-3 h-3 opacity-70" />
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-[#3c4043]/60 bg-[#28292c]/50 px-6 gap-1 overflow-x-auto">
          <button
            onClick={() => setActiveTab('stream')}
            className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'stream'
                ? 'border-[#8ab4f8] text-[#8ab4f8]'
                : 'border-transparent text-[#9aa0a6] hover:text-[#e8eaed]'
            }`}
          >
            <Radio className="w-4 h-4" />
            <span>1. Só Transmissão & Pareamento</span>
          </button>

          <button
            onClick={() => setActiveTab('meeting')}
            className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'meeting'
                ? 'border-[#8ab4f8] text-[#8ab4f8]'
                : 'border-transparent text-[#9aa0a6] hover:text-[#e8eaed]'
            }`}
          >
            <Layers className="w-4 h-4" />
            <span>2. Chamada Completa (Embed)</span>
          </button>

          <button
            onClick={() => setActiveTab('params')}
            className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'params'
                ? 'border-[#8ab4f8] text-[#8ab4f8]'
                : 'border-transparent text-[#9aa0a6] hover:text-[#e8eaed]'
            }`}
          >
            <Sliders className="w-4 h-4" />
            <span>3. Parâmetros de URL & API REST</span>
          </button>

          <button
            onClick={() => setActiveTab('free_architecture')}
            className={`flex items-center gap-2 px-4 py-3 text-xs sm:text-sm font-medium border-b-2 transition-all whitespace-nowrap ${
              activeTab === 'free_architecture'
                ? 'border-[#8ab4f8] text-[#8ab4f8]'
                : 'border-transparent text-[#9aa0a6] hover:text-[#e8eaed]'
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>4. Por que é 100% Gratuito?</span>
          </button>
        </div>

        {/* Tab Contents */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* TAB 1: SÓ TRANSMISSÃO / PAREAMENTO */}
          {activeTab === 'stream' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="bg-[#1e1f23] p-4 rounded-xl border border-[#3c4043]/60">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Radio className="w-4 h-4 text-[#8ab4f8]" />
                  Como funciona o Modo de Transmissão por Pareamento
                </h3>
                <p className="text-xs text-[#9aa0a6] mt-1.5 leading-relaxed">
                  Permite transmitir apenas a câmera ou a tela de um dispositivo (ex: smartphone, webcam ou PC) para outro lugar (ex: outro monitor, site externo, sistema de segurança, OBS Studio ou dashboard) usando apenas o mesmo código de pareamento.
                </p>
              </div>

              {/* Snippet 1: Iframe HTML */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#8ab4f8] flex items-center gap-1.5">
                    <Terminal className="w-3.5 h-3.5" />
                    Opção A: Iframe HTML (Visualizador / Receptor)
                  </span>
                  <button
                    onClick={() =>
                      copyToClipboard(
                        `<iframe\n  src="${viewerUrl}"\n  width="100%"\n  height="500"\n  allow="camera; microphone; display-capture; autoplay; fullscreen"\n  allowfullscreen\n  style="border: none; border-radius: 12px; background: #121316;">\n</iframe>`,
                        'iframe_stream'
                      )
                    }
                    className="flex items-center gap-1 text-xs text-[#9aa0a6] hover:text-white transition-colors"
                  >
                    {copiedIndex === 'iframe_stream' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedIndex === 'iframe_stream' ? 'Copiado!' : 'Copiar Iframe'}</span>
                  </button>
                </div>

                <div className="relative bg-[#131417] p-3.5 rounded-xl border border-[#3c4043]/50 font-mono text-xs text-[#e8eaed] overflow-x-auto">
                  <pre className="text-[11px] leading-relaxed">
{`<iframe
  src="${viewerUrl}"
  width="100%"
  height="500"
  allow="camera; microphone; display-capture; autoplay; fullscreen"
  allowfullscreen
  style="border: none; border-radius: 12px; background: #121316;">
</iframe>`}
                  </pre>
                </div>
              </div>

              {/* Snippet 2: JavaScript SDK */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#8ab4f8] flex items-center gap-1.5">
                    <Code2 className="w-3.5 h-3.5" />
                    Opção B: JavaScript SDK (Zero Dependências)
                  </span>
                  <button
                    onClick={() =>
                      copyToClipboard(
                        `<!-- 1. Inclua o SDK no seu site -->\n<script src="${baseUrl}/videomeet-sdk.js"></script>\n\n<!-- 2. Container onde o vídeo será exibido -->\n<div id="camera-stream" style="width: 100%; height: 450px;"></div>\n\n<script>\n  // Criar o receptor pareado com o código\n  const viewer = VideoMeet.createViewer({\n    container: '#camera-stream',\n    roomCode: '${cleanCode}',\n    baseUrl: '${baseUrl}'\n  });\n</script>`,
                        'js_sdk'
                      )
                    }
                    className="flex items-center gap-1 text-xs text-[#9aa0a6] hover:text-white transition-colors"
                  >
                    {copiedIndex === 'js_sdk' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedIndex === 'js_sdk' ? 'Copiado!' : 'Copiar SDK'}</span>
                  </button>
                </div>

                <div className="relative bg-[#131417] p-3.5 rounded-xl border border-[#3c4043]/50 font-mono text-xs text-[#e8eaed] overflow-x-auto">
                  <pre className="text-[11px] leading-relaxed">
{`<!-- 1. Inclua o SDK no seu site -->
<script src="${baseUrl}/videomeet-sdk.js"></script>

<!-- 2. Container onde o vídeo será exibido -->
<div id="camera-stream" style="width: 100%; height: 450px;"></div>

<script>
  // Criar o receptor pareado com o código
  const viewer = VideoMeet.createViewer({
    container: '#camera-stream',
    roomCode: '${cleanCode}',
    baseUrl: '${baseUrl}'
  });
</script>`}
                  </pre>
                </div>
              </div>

              {/* Snippet 3: OBS Studio / Live Stream */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#8ab4f8] flex items-center gap-1.5">
                    <Monitor className="w-3.5 h-3.5" />
                    Opção C: OBS Studio / Streamlabs (Browser Source)
                  </span>
                  <button
                    onClick={() => copyToClipboard(viewerUrl, 'obs_url')}
                    className="flex items-center gap-1 text-xs text-[#9aa0a6] hover:text-white transition-colors"
                  >
                    {copiedIndex === 'obs_url' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedIndex === 'obs_url' ? 'Copiado!' : 'Copiar URL do OBS'}</span>
                  </button>
                </div>

                <div className="bg-[#131417] p-3.5 rounded-xl border border-[#3c4043]/50 font-mono text-xs text-emerald-300 break-all">
                  {viewerUrl}
                </div>
                <p className="text-[11px] text-[#9aa0a6]">
                  No OBS Studio: Adicione uma fonte <strong>Navegador (Browser Source)</strong>, cole a URL acima e defina a resolução para 1920x1080.
                </p>
              </div>
            </div>
          )}

          {/* TAB 2: CHAMADA COMPLETA (EMBED) */}
          {activeTab === 'meeting' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="bg-[#1e1f23] p-4 rounded-xl border border-[#3c4043]/60">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Layers className="w-4 h-4 text-[#8ab4f8]" />
                  Incorporar Reunião Completa no seu Site ou Aplicativo
                </h3>
                <p className="text-xs text-[#9aa0a6] mt-1.5 leading-relaxed">
                  Adicione uma sala de videoconferência completa com áudio bidirecional, chat, reações, compartilhamento de tela e layout adaptativo em qualquer página web.
                </p>
              </div>

              {/* Snippet Iframe Reunião */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#8ab4f8]">Código Iframe para Reunião Completa:</span>
                  <button
                    onClick={() =>
                      copyToClipboard(
                        `<iframe\n  src="${meetingUrl}"\n  width="100%"\n  height="650"\n  allow="camera; microphone; display-capture; autoplay; fullscreen; clipboard-write"\n  allowfullscreen\n  style="border: none; border-radius: 16px; background: #121316;">\n</iframe>`,
                        'iframe_meeting'
                      )
                    }
                    className="flex items-center gap-1 text-xs text-[#9aa0a6] hover:text-white transition-colors"
                  >
                    {copiedIndex === 'iframe_meeting' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedIndex === 'iframe_meeting' ? 'Copiado!' : 'Copiar Iframe'}</span>
                  </button>
                </div>

                <div className="relative bg-[#131417] p-3.5 rounded-xl border border-[#3c4043]/50 font-mono text-xs text-[#e8eaed] overflow-x-auto">
                  <pre className="text-[11px] leading-relaxed">
{`<iframe
  src="${meetingUrl}"
  width="100%"
  height="650"
  allow="camera; microphone; display-capture; autoplay; fullscreen; clipboard-write"
  allowfullscreen
  style="border: none; border-radius: 16px; background: #121316;">
</iframe>`}
                  </pre>
                </div>
              </div>

              {/* React Component Snippet */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-[#8ab4f8]">Exemplo em React / Next.js:</span>
                  <button
                    onClick={() =>
                      copyToClipboard(
                        `export function VideoCallWidget({ roomCode }: { roomCode: string }) {\n  return (\n    <iframe\n      src={\`${baseUrl}/?room=\${roomCode}&embed=true\`}\n      className="w-full h-[600px] rounded-2xl border-none bg-[#121316]"\n      allow="camera; microphone; display-capture; autoplay; fullscreen"\n      allowFullScreen\n    />\n  );\n}`,
                        'react_snippet'
                      )
                    }
                    className="flex items-center gap-1 text-xs text-[#9aa0a6] hover:text-white transition-colors"
                  >
                    {copiedIndex === 'react_snippet' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedIndex === 'react_snippet' ? 'Copiado!' : 'Copiar Componente'}</span>
                  </button>
                </div>

                <div className="relative bg-[#131417] p-3.5 rounded-xl border border-[#3c4043]/50 font-mono text-xs text-[#e8eaed] overflow-x-auto">
                  <pre className="text-[11px] leading-relaxed">
{`export function VideoCallWidget({ roomCode }: { roomCode: string }) {
  return (
    <iframe
      src={\`${baseUrl}/?room=\${roomCode}&embed=true\`}
      className="w-full h-[600px] rounded-2xl border-none bg-[#121316]"
      allow="camera; microphone; display-capture; autoplay; fullscreen"
      allowFullScreen
    />
  );
}`}
                  </pre>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PARÂMETROS DE URL & API REST */}
          {activeTab === 'params' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="bg-[#1e1f23] p-4 rounded-xl border border-[#3c4043]/60">
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-[#8ab4f8]" />
                  Tabela de Parâmetros de URL
                </h3>
                <p className="text-xs text-[#9aa0a6] mt-1.5 leading-relaxed">
                  Você pode personalizar o comportamento de inicialização passando parâmetros na URL:
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left border-collapse">
                  <thead>
                    <tr className="border-b border-[#3c4043] text-[#9aa0a6] bg-[#28292c]">
                      <th className="py-2.5 px-3 font-semibold">Parâmetro</th>
                      <th className="py-2.5 px-3 font-semibold">Valores</th>
                      <th className="py-2.5 px-3 font-semibold">Descrição</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#3c4043]/50 font-mono text-[11px]">
                    <tr>
                      <td className="py-2.5 px-3 text-[#8ab4f8] font-bold">room</td>
                      <td className="py-2.5 px-3 text-white">string (ex: abc-defg-hij)</td>
                      <td className="py-2.5 px-3 text-[#9aa0a6] font-sans">Código da sala ou pareamento</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 text-[#8ab4f8] font-bold">mode</td>
                      <td className="py-2.5 px-3 text-white">stream | meeting</td>
                      <td className="py-2.5 px-3 text-[#9aa0a6] font-sans">Define se é só transmissão ou reunião</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 text-[#8ab4f8] font-bold">role</td>
                      <td className="py-2.5 px-3 text-white">sender | viewer</td>
                      <td className="py-2.5 px-3 text-[#9aa0a6] font-sans">Para modo stream: se é transmissor ou receptor</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 text-[#8ab4f8] font-bold">embed</td>
                      <td className="py-2.5 px-3 text-white">true | false</td>
                      <td className="py-2.5 px-3 text-[#9aa0a6] font-sans">Oculta cabeçalhos externos para encaixar perfeitamente em iframes</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 text-[#8ab4f8] font-bold">audio</td>
                      <td className="py-2.5 px-3 text-white">1 | 0</td>
                      <td className="py-2.5 px-3 text-[#9aa0a6] font-sans">Microfone inicial (1 = ligado, 0 = mutado)</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 text-[#8ab4f8] font-bold">video</td>
                      <td className="py-2.5 px-3 text-white">1 | 0</td>
                      <td className="py-2.5 px-3 text-[#9aa0a6] font-sans">Câmera inicial (1 = ligada, 0 = desligada)</td>
                    </tr>
                    <tr>
                      <td className="py-2.5 px-3 text-[#8ab4f8] font-bold">quality</td>
                      <td className="py-2.5 px-3 text-white">1080p | 720p | 480p</td>
                      <td className="py-2.5 px-3 text-[#9aa0a6] font-sans">Resolução alvo padrão de transmissão</td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* SDK Session Generator Helper */}
              <div className="space-y-2">
                <span className="text-xs font-semibold text-[#8ab4f8]">Gerador Automático de Sessão via SDK:</span>
                <div className="bg-[#131417] p-3.5 rounded-xl border border-[#3c4043]/50 font-mono text-xs text-[#e8eaed] space-y-2">
                  <div className="text-emerald-400 font-bold">VideoMeet.createSession()</div>
                  <p className="text-[11px] text-[#9aa0a6] font-sans">
                    Retorna links prontos e códigos de pareamento instantaneamente no cliente para transmissor, receptor ou embed, sem precisar de backend adicional.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* TAB 4: ARQUITETURA GRATUITA */}
          {activeTab === 'free_architecture' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="bg-emerald-950/30 p-5 rounded-2xl border border-emerald-500/30 space-y-3">
                <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                  <ShieldCheck className="w-5 h-5" />
                  <span>Por que este serviço é 100% Gratuito e Não Gera Custos?</span>
                </div>
                <p className="text-xs text-emerald-200/80 leading-relaxed">
                  Diferente de serviços convencionais que cobram por minuto (Twilio, Agora, Zoom SDK), nossa aplicação opera através de <strong>WebRTC Peer-to-Peer (P2P)</strong>:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
                  <div className="bg-[#1e1f23]/90 p-3 rounded-xl border border-[#3c4043]/50">
                    <div className="text-white font-medium text-xs mb-1">1. Conexão Direta (P2P)</div>
                    <p className="text-[11px] text-[#9aa0a6]">
                      O fluxo de vídeo vai diretamente do dispositivo A para o dispositivo B sem passar por servidores de mídia caros.
                    </p>
                  </div>

                  <div className="bg-[#1e1f23]/90 p-3 rounded-xl border border-[#3c4043]/50">
                    <div className="text-white font-medium text-xs mb-1">2. Zero Custo de Mídia</div>
                    <p className="text-[11px] text-[#9aa0a6]">
                      Apenas o sinal inicial (SDP/ICE) é trocado via Firestore no plano gratuito, reduzindo o tráfego do servidor a quase zero.
                    </p>
                  </div>

                  <div className="bg-[#1e1f23]/90 p-3 rounded-xl border border-[#3c4043]/50">
                    <div className="text-white font-medium text-xs mb-1">3. Sem Limites de Tempo</div>
                    <p className="text-[11px] text-[#9aa0a6]">
                      As transmissões e chamadas não possuem limite de 40 minutos. Podem ficar ativas continuamente.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[#28292c] border-t border-[#3c4043]/60 flex items-center justify-between">
          <div className="text-xs text-[#9aa0a6]">
            Precisa de ajuda? O SDK é aberto e funciona em qualquer navegador moderno.
          </div>
          <button
            onClick={onClose}
            className="bg-[#1a73e8] hover:bg-[#1b66c9] text-white px-5 py-2 rounded-xl text-xs font-semibold transition-colors"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
