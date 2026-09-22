'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import {
  Code2,
  FileText,
  Copy,
  Check,
  ExternalLink,
  Terminal,
  Layers,
  Radio,
  Sliders,
  ShieldCheck,
  Video,
  Tv,
  CheckCircle2,
  ChevronRight,
  BookOpen,
  Zap,
  HelpCircle,
  Download,
  ArrowLeft,
  Sparkles,
  Smartphone,
  Lock,
} from 'lucide-react';

interface DocsViewProps {
  onBackToApp?: () => void;
  onOpenDevPlayground?: () => void;
}

export const DocsView: React.FC<DocsViewProps> = ({
  onBackToApp,
  onOpenDevPlayground,
}) => {
  const [activeSection, setActiveSection] = useState<string>('overview');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Interactive URL builder in docs
  const [builderRoom, setBuilderRoom] = useState('minha-sala');
  const [builderMode, setBuilderMode] = useState<'stream' | 'meeting'>('stream');
  const [builderRole, setBuilderRole] = useState<'sender' | 'viewer'>('viewer');
  const [builderQuality, setBuilderQuality] = useState('720p');
  const [builderEmbed, setBuilderEmbed] = useState(true);
  const [builderAudio, setBuilderAudio] = useState(true);
  const [builderVideo, setBuilderVideo] = useState(true);
  const [builderName, setBuilderName] = useState('Visitante');

  const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://videomeet.app';

  const copyToClipboard = (text: string, key: string) => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(text);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    }
  };

  const generatedUrl = `${baseUrl}/?room=${encodeURIComponent(builderRoom)}&mode=${builderMode}${
    builderMode === 'stream' ? `&role=${builderRole}` : ''
  }&quality=${builderQuality}&embed=${builderEmbed}&audio=${builderAudio}&video=${builderVideo}&name=${encodeURIComponent(
    builderName
  )}`;

  const navItems = [
    { id: 'overview', title: 'Visão Geral & Arquitetura', icon: BookOpen },
    { id: 'quickstart', title: 'Início Rápido (3 Minutos)', icon: Zap },
    { id: 'modes', title: 'Modos: Stream vs Reunião', icon: Layers },
    { id: 'sdk', title: 'SDK JavaScript Global', icon: Code2 },
    { id: 'iframe', title: 'Iframe & Embed HTML', icon: Terminal },
    { id: 'react', title: 'React & Next.js', icon: Sparkles },
    { id: 'obs', title: 'OBS Studio & Live Streaming', icon: Tv },
    { id: 'builder', title: 'Gerador Interativo de URL', icon: Sliders },
    { id: 'params', title: 'Tabela de Parâmetros', icon: FileText },
    { id: 'security', title: 'WebRTC P2P & Segurança', icon: ShieldCheck },
    { id: 'ai', title: 'Guia para IAs (llms.txt)', icon: FileText },
    { id: 'faq', title: 'Perguntas Frequentes (FAQ)', icon: HelpCircle },
  ];

  return (
    <div className="min-h-screen w-full bg-[#111216] text-[#e8eaed] font-sans antialiased flex flex-col">
      {/* Docs Header */}
      <header className="sticky top-0 z-40 w-full bg-[#16181e]/90 backdrop-blur-md border-b border-[#292c35] px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {onBackToApp ? (
            <button
              onClick={onBackToApp}
              className="flex items-center gap-2 text-xs text-[#9aa0a6] hover:text-white bg-[#22252e] hover:bg-[#2c303c] px-3 py-1.5 rounded-lg border border-[#343946] transition-all cursor-pointer"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Voltar ao App</span>
            </button>
          ) : (
            <Link
              href="/"
              className="flex items-center gap-2 text-xs text-[#9aa0a6] hover:text-white bg-[#22252e] hover:bg-[#2c303c] px-3 py-1.5 rounded-lg border border-[#343946] transition-all"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Início</span>
            </Link>
          )}

          <div className="h-4 w-px bg-[#292c35] hidden sm:block" />

          <div className="flex items-center gap-2.5">
            <div className="relative w-7 h-7 rounded-lg overflow-hidden bg-[#242731]">
              <Image
                src="/logo_video_bonito.png"
                alt="VideoMeet Logo"
                fill
                className="object-contain p-0.5"
                referrerPolicy="no-referrer"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-semibold text-sm text-white">VideoMeet Docs</span>
              <span className="text-[10px] bg-emerald-500/15 text-emerald-400 font-semibold px-2 py-0.5 rounded-full border border-emerald-500/30">
                v1.0 • WebRTC P2P
              </span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {onOpenDevPlayground && (
            <button
              onClick={onOpenDevPlayground}
              className="flex items-center gap-1.5 text-xs text-[#8ab4f8] hover:text-white bg-[#1a73e8]/20 hover:bg-[#1a73e8]/30 px-3 py-1.5 rounded-lg border border-[#1a73e8]/40 transition-colors cursor-pointer"
            >
              <Terminal className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Abrir</span> Playground
            </button>
          )}

          <a
            href="/videomeet-sdk.js"
            download="videomeet-sdk.js"
            className="flex items-center gap-1.5 text-xs text-white bg-[#1a73e8] hover:bg-[#1558b0] px-3 py-1.5 rounded-lg shadow-sm transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Baixar</span> SDK
          </a>
        </div>
      </header>

      {/* Main Docs Content Layout */}
      <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 py-8 flex-1 grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Sidebar Navigation */}
        <aside className="lg:col-span-3">
          <div className="sticky top-20 flex flex-col gap-1 bg-[#171920] p-3 rounded-2xl border border-[#282c37] shadow-lg">
            <span className="text-[11px] font-semibold text-[#8ab4f8] px-3 py-2 uppercase tracking-wider">
              Sumário da Documentação
            </span>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeSection === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setActiveSection(item.id);
                    const el = document.getElementById(item.id);
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium text-left transition-all cursor-pointer ${
                    isActive
                      ? 'bg-[#1a73e8] text-white shadow-md font-semibold'
                      : 'text-[#9aa0a6] hover:text-white hover:bg-[#222631]'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-[#8ab4f8]'}`} />
                    <span>{item.title}</span>
                  </div>
                  <ChevronRight className={`w-3 h-3 ${isActive ? 'opacity-100' : 'opacity-0'}`} />
                </button>
              );
            })}
          </div>
        </aside>

        {/* Right Article Body */}
        <main className="lg:col-span-9 flex flex-col gap-10 text-xs sm:text-sm text-[#c7ccd6] leading-relaxed">
          {/* SECTION: Overview */}
          <section id="overview" className="flex flex-col gap-4 scroll-mt-24">
            <div className="flex items-center gap-2 text-[#8ab4f8]">
              <BookOpen className="w-5 h-5" />
              <span className="text-xs font-semibold uppercase tracking-wider">1. Visão Geral</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              VideoMeet: Plataforma WebRTC P2P de Câmeras & Reuniões
            </h1>
            <p className="text-sm text-[#9aa0a6] leading-relaxed">
              O <strong>VideoMeet</strong> foi projetado para fornecer transmissão de vídeo em tempo real com latência ultra-baixa (&lt;150ms) e videoconferências completas sem necessidade de criar contas, assinar planos pagos ou instalar softwares pesados.
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
              <div className="bg-[#171920] p-4 rounded-xl border border-[#282c37]">
                <div className="flex items-center gap-2 text-white font-semibold text-xs mb-1">
                  <ShieldCheck className="w-4 h-4 text-emerald-400" />
                  100% P2P Grátis
                </div>
                <p className="text-[11px] text-[#9aa0a6]">
                  O tráfego de vídeo e áudio trafega diretamente entre os navegadores sem intermediários cobrando por minuto.
                </p>
              </div>

              <div className="bg-[#171920] p-4 rounded-xl border border-[#282c37]">
                <div className="flex items-center gap-2 text-white font-semibold text-xs mb-1">
                  <Zap className="w-4 h-4 text-amber-400" />
                  Latência Ultra-Baixa
                </div>
                <p className="text-[11px] text-[#9aa0a6]">
                  Ideal para câmeras de segurança, transmissões com OBS, dashboards industriais e suporte remoto.
                </p>
              </div>

              <div className="bg-[#171920] p-4 rounded-xl border border-[#282c37]">
                <div className="flex items-center gap-2 text-white font-semibold text-xs mb-1">
                  <Terminal className="w-4 h-4 text-[#8ab4f8]" />
                  Embed em Qualquer Lugar
                </div>
                <p className="text-[11px] text-[#9aa0a6]">
                  Incorpore com 1 linha de Iframe HTML, SDK Javascript nativo ou componentes React.
                </p>
              </div>
            </div>
          </section>

          <hr className="border-[#282c37]" />

          {/* SECTION: Quickstart */}
          <section id="quickstart" className="flex flex-col gap-4 scroll-mt-24">
            <div className="flex items-center gap-2 text-emerald-400">
              <Zap className="w-5 h-5" />
              <span className="text-xs font-semibold uppercase tracking-wider">2. Início Rápido</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Como funciona o Pareamento de Câmera em 3 Passos
            </h2>

            <ol className="space-y-3 list-decimal list-inside text-xs sm:text-sm">
              <li className="bg-[#171920] p-3.5 rounded-xl border border-[#282c37]">
                <strong className="text-white">Escolha ou gere um código:</strong> Ex: <code className="text-[#8ab4f8] bg-[#111216] px-2 py-0.5 rounded font-mono">camera-01</code>.
              </li>
              <li className="bg-[#171920] p-3.5 rounded-xl border border-[#282c37]">
                <strong className="text-white">No dispositivo transmissor (smartphone ou PC):</strong> Abra a URL do emissor (<code className="text-[#8ab4f8] font-mono">mode=stream&role=sender</code>) e conceda permissão de câmera.
              </li>
              <li className="bg-[#171920] p-3.5 rounded-xl border border-[#282c37]">
                <strong className="text-white">No site de visualização ou OBS:</strong> Carregue o Iframe receptor (<code className="text-[#8ab4f8] font-mono">mode=stream&role=viewer</code>). O vídeo aparecerá instantaneamente!
              </li>
            </ol>
          </section>

          <hr className="border-[#282c37]" />

          {/* SECTION: Modes */}
          <section id="modes" className="flex flex-col gap-4 scroll-mt-24">
            <div className="flex items-center gap-2 text-purple-400">
              <Layers className="w-5 h-5" />
              <span className="text-xs font-semibold uppercase tracking-wider">3. Modos de Operação</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Modo Transmissão (Stream) vs Modo Reunião (Meeting)
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-[#171920] p-5 rounded-2xl border border-[#282c37] flex flex-col gap-2">
                <div className="flex items-center gap-2 text-[#8ab4f8] font-semibold text-sm">
                  <Radio className="w-4 h-4" />
                  Modo Transmissão (mode=stream)
                </div>
                <p className="text-xs text-[#9aa0a6] leading-relaxed">
                  Projetado para monitoramento, compartilhamento de câmera remota, transmissão de tela e OBS Studio. Um lado apenas transmite (Sender) e o outro lado apenas assiste (Viewer) em tela cheia sem pedir permissão de microfone.
                </p>
                <div className="mt-2 text-[11px] font-mono text-[#8ab4f8] bg-[#101215] p-2.5 rounded-xl border border-[#242833]">
                  ?mode=stream&role=viewer&room=sala-01&embed=true
                </div>
              </div>

              <div className="bg-[#171920] p-5 rounded-2xl border border-[#282c37] flex flex-col gap-2">
                <div className="flex items-center gap-2 text-emerald-400 font-semibold text-sm">
                  <Video className="w-4 h-4" />
                  Modo Reunião (mode=meeting)
                </div>
                <p className="text-xs text-[#9aa0a6] leading-relaxed">
                  Projetado para chamadas e reuniões de trabalho em grupo. Suporta áudio bidirecional, chat com mensagens em tempo real, reações de emoji, orador em destaque automático e compartilhamento de tela.
                </p>
                <div className="mt-2 text-[11px] font-mono text-emerald-400 bg-[#101215] p-2.5 rounded-xl border border-[#242833]">
                  ?room=sala-01&embed=true&name=Participante
                </div>
              </div>
            </div>
          </section>

          <hr className="border-[#282c37]" />

          {/* SECTION: JavaScript SDK */}
          <section id="sdk" className="flex flex-col gap-4 scroll-mt-24">
            <div className="flex items-center gap-2 text-amber-400">
              <Code2 className="w-5 h-5" />
              <span className="text-xs font-semibold uppercase tracking-wider">4. SDK JavaScript Global</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Como usar `videomeet-sdk.js` em Vanilla JS & HTML
            </h2>

            <div className="relative bg-[#0d0f13] rounded-2xl overflow-hidden border border-[#282c37]">
              <div className="flex items-center justify-between px-4 py-2.5 bg-[#171920] border-b border-[#282c37] text-xs">
                <span className="font-mono text-[#8ab4f8]">index.html</span>
                <button
                  onClick={() =>
                    copyToClipboard(
                      `<script src="${baseUrl}/videomeet-sdk.js"></script>\n\n<div id="player" style="width: 100%; height: 500px;"></div>\n\n<script>\n  // Receptor em 1 chamada\n  const stream = VideoMeet.createViewer({\n    container: '#player',\n    roomCode: 'meu-canal-1',\n    baseUrl: '${baseUrl}'\n  });\n</script>`,
                      'sdk_code'
                    )
                  }
                  className="flex items-center gap-1 text-[11px] text-[#9aa0a6] hover:text-white cursor-pointer"
                >
                  {copiedKey === 'sdk_code' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'sdk_code' ? 'Copiado!' : 'Copiar'}</span>
                </button>
              </div>
              <pre className="p-4 text-xs font-mono text-[#e8eaed] overflow-x-auto leading-relaxed">
{`<!-- 1. Carregue o SDK -->
<script src="${baseUrl}/videomeet-sdk.js"></script>

<!-- 2. Crie a div do container -->
<div id="player" style="width: 100%; height: 500px;"></div>

<script>
  // Inicializa receptor de vídeo pareado
  const stream = VideoMeet.createViewer({
    container: '#player',
    roomCode: 'meu-canal-1',
    baseUrl: '${baseUrl}'
  });
</script>`}
              </pre>
            </div>
          </section>

          <hr className="border-[#282c37]" />

          {/* SECTION: Interactive Builder */}
          <section id="builder" className="flex flex-col gap-4 scroll-mt-24">
            <div className="flex items-center gap-2 text-[#8ab4f8]">
              <Sliders className="w-5 h-5" />
              <span className="text-xs font-semibold uppercase tracking-wider">5. Gerador Interativo de URL</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Personalize sua URL de Incorporação ao Vivo
            </h2>

            <div className="bg-[#171920] p-5 rounded-2xl border border-[#282c37] flex flex-col gap-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div>
                  <label className="text-[#9aa0a6] font-medium block mb-1">Código da Sala / Canal:</label>
                  <input
                    type="text"
                    value={builderRoom}
                    onChange={(e) => setBuilderRoom(e.target.value)}
                    className="w-full bg-[#101215] border border-[#373c49] rounded-lg px-3 py-2 text-white font-mono"
                  />
                </div>

                <div>
                  <label className="text-[#9aa0a6] font-medium block mb-1">Modo:</label>
                  <select
                    value={builderMode}
                    onChange={(e) => setBuilderMode(e.target.value as 'stream' | 'meeting')}
                    className="w-full bg-[#101215] border border-[#373c49] rounded-lg px-3 py-2 text-white"
                  >
                    <option value="stream">Transmissão (Stream)</option>
                    <option value="meeting">Reunião Completa (Meeting)</option>
                  </select>
                </div>

                {builderMode === 'stream' && (
                  <div>
                    <label className="text-[#9aa0a6] font-medium block mb-1">Papel:</label>
                    <select
                      value={builderRole}
                      onChange={(e) => setBuilderRole(e.target.value as 'sender' | 'viewer')}
                      className="w-full bg-[#101215] border border-[#373c49] rounded-lg px-3 py-2 text-white"
                    >
                      <option value="viewer">Receptor (Viewer)</option>
                      <option value="sender">Transmissor (Sender)</option>
                    </select>
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2 pt-2 border-t border-[#282c37]">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-[#9aa0a6] font-medium">URL Gerada:</span>
                  <button
                    onClick={() => copyToClipboard(generatedUrl, 'builder_url')}
                    className="flex items-center gap-1 text-[11px] text-[#8ab4f8] hover:text-white cursor-pointer"
                  >
                    {copiedKey === 'builder_url' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'builder_url' ? 'Copiado!' : 'Copiar URL'}</span>
                  </button>
                </div>
                <div className="bg-[#101215] p-3 rounded-xl border border-[#282c37] font-mono text-xs text-emerald-400 break-all">
                  {generatedUrl}
                </div>
              </div>
            </div>
          </section>

          <hr className="border-[#282c37]" />

          {/* SECTION: Parameters Table */}
          <section id="params" className="flex flex-col gap-4 scroll-mt-24">
            <div className="flex items-center gap-2 text-emerald-400">
              <FileText className="w-5 h-5" />
              <span className="text-xs font-semibold uppercase tracking-wider">6. Parâmetros de Query String</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Todos os Parâmetros Suportados na URL
            </h2>

            <div className="overflow-x-auto rounded-xl border border-[#282c37]">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#1a1d26] text-[#9aa0a6] border-b border-[#282c37]">
                    <th className="py-3 px-4 font-semibold">Parâmetro</th>
                    <th className="py-3 px-4 font-semibold">Valores</th>
                    <th className="py-3 px-4 font-semibold">Descrição</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#282c37] font-mono">
                  <tr className="hover:bg-[#161820]">
                    <td className="py-3 px-4 text-[#8ab4f8] font-bold">room</td>
                    <td className="py-3 px-4 text-white">string</td>
                    <td className="py-3 px-4 text-[#9aa0a6] font-sans">Código da sala ou canal de pareamento</td>
                  </tr>
                  <tr className="hover:bg-[#161820]">
                    <td className="py-3 px-4 text-[#8ab4f8] font-bold">mode</td>
                    <td className="py-3 px-4 text-white">stream | meeting</td>
                    <td className="py-3 px-4 text-[#9aa0a6] font-sans">Define se é só transmissão P2P ou conferência completa</td>
                  </tr>
                  <tr className="hover:bg-[#161820]">
                    <td className="py-3 px-4 text-[#8ab4f8] font-bold">role</td>
                    <td className="py-3 px-4 text-white">sender | viewer</td>
                    <td className="py-3 px-4 text-[#9aa0a6] font-sans">Se o dispositivo irá emitir a câmera ou assistir</td>
                  </tr>
                  <tr className="hover:bg-[#161820]">
                    <td className="py-3 px-4 text-[#8ab4f8] font-bold">embed</td>
                    <td className="py-3 px-4 text-white">true | false</td>
                    <td className="py-3 px-4 text-[#9aa0a6] font-sans">Oculta cabeçalhos e barras externas para iframes</td>
                  </tr>
                  <tr className="hover:bg-[#161820]">
                    <td className="py-3 px-4 text-[#8ab4f8] font-bold">quality</td>
                    <td className="py-3 px-4 text-white">360p | 720p | 1080p | 4k</td>
                    <td className="py-3 px-4 text-[#9aa0a6] font-sans">Resolução alvo do vídeo WebRTC</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <hr className="border-[#282c37]" />

          {/* SECTION: AI Guide */}
          <section id="ai" className="flex flex-col gap-4 scroll-mt-24">
            <div className="flex items-center gap-2 text-purple-400">
              <Sparkles className="w-5 h-5" />
              <span className="text-xs font-semibold uppercase tracking-wider">7. Guia para IAs (llms.txt)</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Prompt para ChatGPT, Claude, Gemini & Cursor
            </h2>

            <div className="bg-[#1b1926] p-5 rounded-2xl border border-purple-500/20 flex flex-col gap-3">
              <p className="text-xs text-purple-200">
                Copie o prompt abaixo e envie para seu assistente de IA gerar o código de integração do VideoMeet automaticamente no seu projeto:
              </p>

              <div className="relative bg-[#0e0c16] p-4 rounded-xl border border-purple-500/30 text-xs font-mono text-purple-200">
                <button
                  onClick={() =>
                    copyToClipboard(
                      `Você é um desenvolvedor frontend. Integre o player de vídeo gratuito VideoMeet no meu app usando o iframe:\n<iframe src="${baseUrl}/?mode=stream&role=viewer&room={MEU_CODIGO}&embed=true" width="100%" height="480" allow="camera; microphone; display-capture; autoplay" allowfullscreen style="border:0; border-radius:12px;"></iframe>`,
                      'ai_prompt'
                    )
                  }
                  className="absolute top-3 right-3 flex items-center gap-1 text-[11px] bg-purple-600 hover:bg-purple-700 text-white px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                >
                  {copiedKey === 'ai_prompt' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copiedKey === 'ai_prompt' ? 'Copiado!' : 'Copiar Prompt'}</span>
                </button>
                <pre className="whitespace-pre-wrap leading-relaxed pr-24">
{`Você é um desenvolvedor frontend. Integre o player de vídeo gratuito VideoMeet no meu app usando o iframe:
<iframe 
  src="${baseUrl}/?mode=stream&role=viewer&room={MEU_CODIGO}&embed=true" 
  width="100%" 
  height="480" 
  allow="camera; microphone; display-capture; autoplay" 
  allowfullscreen 
  style="border:0; border-radius:12px;">
</iframe>`}
                </pre>
              </div>
            </div>
          </section>

          <hr className="border-[#282c37]" />

          {/* SECTION: FAQ */}
          <section id="faq" className="flex flex-col gap-4 scroll-mt-24 pb-12">
            <div className="flex items-center gap-2 text-amber-400">
              <HelpCircle className="w-5 h-5" />
              <span className="text-xs font-semibold uppercase tracking-wider">8. FAQ</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
              Perguntas Frequentes
            </h2>

            <div className="space-y-3 text-xs">
              <div className="bg-[#171920] p-4 rounded-xl border border-[#282c37]">
                <strong className="text-white block font-medium mb-1">Há limite de duração da chamada ou transmissão?</strong>
                <span className="text-[#9aa0a6]">Não. Como a conexão é direta P2P entre navegadores, as chamadas podem durar horas sem desconexões automáticas aos 40 minutos.</span>
              </div>

              <div className="bg-[#171920] p-4 rounded-xl border border-[#282c37]">
                <strong className="text-white block font-medium mb-1">Por que o iframe do receptor não pede permissão de câmera?</strong>
                <span className="text-[#9aa0a6]">No modo `role=viewer`, o VideoMeet desativa a captura local de mídia, permitindo que qualquer pessoa assista sem precisar ter câmera ligada.</span>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
};
