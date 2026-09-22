'use client';

import React, { useState } from 'react';
import {
  FileText,
  Copy,
  Check,
  ArrowLeft,
  Download,
  ExternalLink,
  Code2,
  Tv,
  Layers,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';
import Link from 'next/link';

const RAW_DOCS_TXT = `# ==============================================================================
# VIDEOMEET - DOCUMENTAÇÃO TÉCNICA E GUIA DE INTEGRAÇÃO (LLMS & DEVELOPERS)
# Versão: 2.1.0 | Protocolo: WebRTC P2P (Sem servidor de mídia pago / 100% Gratuito)
# Formato: Texto Puro (Markdown Plaintext para consumo por IA e Agentes)
# ==============================================================================

## 1. VISÃO GERAL DA ARQUITETURA
O VideoMeet é uma plataforma e SDK de videoconferência e transmissão de vídeo WebRTC
Peer-to-Peer (P2P). A sinalização (SDP Offers/Answers e ICE Candidates) é gerenciada
de forma serverless e sem custos de infraestrutura.

A plataforma suporta dois modos operacionais principais:
1. TRANSMISSÃO PURA (Modo Stream / Pareamento via Código):
   - Transmissor (Sender): Capta a câmera ou tela local e transmite diretamente para o receptor.
   - Receptor (Viewer): Recebe o streaming P2P em tempo real com baixa latência (<200ms).
   - Ideal para: Câmeras de segurança, babá eletrônica, compartilhamento de tela de suporte, monitoramento, etc.

2. SALA DE REUNIÃO COMPLETA (Modo Meeting):
   - Grade adaptativa de participantes (desktop bento grid ou visualização estilo WhatsApp mobile com PIP arrastável).
   - Chat em tempo real, reações de emoji flutuantes, levantar a mão, controle de microfone/câmera, seleção de qualidade (360p, 720p HD, 1080p Full HD) e compartilhamento de tela com ícone MonitorUp.

---

## 2. MODOS DE INTEGRAÇÃO VIA URL (IFRAME & POPUP)

A integração mais rápida é feita via URL embedding em um <iframe> ou nova janela.

### 2.1. Parâmetros de Query String Suportados

| Parâmetro | Valores Possíveis | Padrão | Descrição |
|---|---|---|---|
| mode | stream | meeting | meeting | Define se a sessão é apenas transmissão P2P ou reunião completa. |
| role | sender | viewer | sender | (Apenas em mode=stream): sender para transmitir; viewer para assistir. |
| room | string (ex: cam-101, abc-defg-hij) | aleatório | O código da sala ou identificador de pareamento. |
| name | string (ex: Carlos, Camera Sala) | Convidado | Nome exibido no tile de vídeo e chat. |
| embed | true | false | false | Remove cabeçalhos e otimiza o layout para exibição embutida/iframe. |
| audio | true | false | true | Estado inicial do microfone (false = mudo). |
| video | true | false | true | Estado inicial da câmera (false = câmera desligada). |
| quality | 360p | 720p | 1080p | 720p | Resolução e taxa de quadros padrão do transmissor. |

---

## 3. EXEMPLOS PRÁTICOS DE URLS

Assuma https://videomeet.app (ou o seu domínio):

A) Transmitir a câmera de um celular ou dispositivo (Transmissor):
https://SEU_DOMINIO/?mode=stream&role=sender&room=sala-402&embed=true

B) Exibir o vídeo da câmera em outro site/dashboard (Receptor):
https://SEU_DOMINIO/?mode=stream&role=viewer&room=sala-402&embed=true

C) Incorporar uma Reunião Completa de Vídeo:
https://SEU_DOMINIO/?room=reuniao-equipe&name=João&embed=true

---

## 4. EXEMPLOS DE CÓDIGO DE INTEGRAÇÃO

### 4.1. Código HTML Básico (Iframe Simples)
<iframe
  src="https://SEU_DOMINIO/?mode=stream&role=viewer&room=camera-sala-01&embed=true"
  width="100%"
  height="480"
  style="border: 0; border-radius: 12px; background: #000;"
  allow="camera; microphone; display-capture; autoplay"
  allowfullscreen
></iframe>

### 4.2. Componente React / Next.js
export function StreamViewer({ roomCode, baseUrl = window.location.origin }: { roomCode: string, baseUrl?: string }) {
  const streamUrl = \`\${baseUrl}/?mode=stream&role=viewer&room=\${encodeURIComponent(roomCode)}&embed=true\`;
  return (
    <div className="w-full aspect-video rounded-xl overflow-hidden shadow-2xl bg-black border border-neutral-800">
      <iframe
        src={streamUrl}
        title={\`Transmissão \${roomCode}\`}
        className="w-full h-full border-0"
        allow="camera; microphone; display-capture; autoplay"
        allowFullScreen
      />
    </div>
  );
}

### 4.3. JavaScript SDK (videomeet-sdk.js)
<script src="https://SEU_DOMINIO/videomeet-sdk.js"></script>
<div id="video-container" style="width: 100%; height: 500px;"></div>
<script>
  const session = VideoMeet.createSession({
    mode: 'stream',
    role: 'viewer',
    room: 'canal-456',
    embed: true
  });
  VideoMeet.embed({
    container: '#video-container',
    mode: 'stream',
    role: 'viewer',
    room: 'canal-456'
  });
</script>

---

## 5. PERMISSÕES E POLÍTICAS DE NAVEGADOR
1. allow="camera; microphone; display-capture; autoplay" é OBRIGATÓRIO em iframes.
2. WebRTC exige HTTPS ou localhost.
3. Se o autoplay de áudio for bloqueado pelo navegador, o vídeo inicia mudo e disponibiliza o botão "Ativar Som".

---

## 6. ENDPOINTS ESTÁTICOS
- Documentação em TXT Puro: /docs.txt e /llms.txt
- JavaScript SDK: /videomeet-sdk.js
- Aplicação Web: /
`;

export default function DocsPage() {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    if (typeof navigator !== 'undefined') {
      navigator.clipboard.writeText(RAW_DOCS_TXT);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDownload = () => {
    const blob = new Blob([RAW_DOCS_TXT], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'videomeet-docs.txt';
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-[#111214] text-[#e8eaed] flex flex-col font-sans selection:bg-[#8ab4f8]/30">
      {/* Top Header */}
      <header className="sticky top-0 z-30 bg-[#18191c]/90 backdrop-blur-md border-b border-[#2d3139] px-4 sm:px-8 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="flex items-center gap-2 text-xs sm:text-sm font-medium text-[#9aa0a6] hover:text-white transition-colors bg-[#23262d] px-3 py-1.5 rounded-lg border border-[#333842]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Voltar ao App</span>
          </Link>
          <div className="h-4 w-px bg-[#333842]" />
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#8ab4f8]" />
            <h1 className="text-sm font-semibold text-white tracking-tight">
              Documentação em TXT para IA & Desenvolvedores
            </h1>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <a
            href="/docs.txt"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:flex items-center gap-1.5 text-xs text-[#9aa0a6] hover:text-white bg-[#23262d] px-3 py-1.5 rounded-lg border border-[#333842] transition-colors"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>Abrir /docs.txt</span>
          </a>

          <button
            onClick={handleDownload}
            className="flex items-center gap-1.5 text-xs text-[#9aa0a6] hover:text-white bg-[#23262d] px-3 py-1.5 rounded-lg border border-[#333842] transition-colors"
            title="Baixar arquivo TXT"
          >
            <Download className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Baixar TXT</span>
          </button>

          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-xs font-semibold text-[#041e49] bg-[#8ab4f8] hover:bg-[#a8c7fa] px-3.5 py-1.5 rounded-lg transition-colors shadow-sm"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-900" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copiado para o Clipboard!' : 'Copiar TXT para IA'}</span>
          </button>
        </div>
      </header>

      {/* Info Banner */}
      <div className="max-w-5xl w-full mx-auto px-4 sm:px-6 pt-6">
        <div className="bg-[#1a1c22] border border-[#2d3139] p-4 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs text-[#9aa0a6]">
          <div className="flex items-center gap-2.5">
            <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
            <span>
              Este formato foi otimizado para ser enviado como prompt de contexto para <strong>ChatGPT, Claude, Gemini, Cursor</strong> ou lido por scripts de automação.
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <code className="text-[#8ab4f8] bg-[#23262d] px-2 py-0.5 rounded font-mono">/docs.txt</code>
            <code className="text-[#8ab4f8] bg-[#23262d] px-2 py-0.5 rounded font-mono">/llms.txt</code>
          </div>
        </div>
      </div>

      {/* Main Text Content */}
      <main className="max-w-5xl w-full mx-auto px-4 sm:px-6 py-6 flex-1">
        <div className="relative bg-[#16171a] border border-[#2a2d35] rounded-2xl p-4 sm:p-6 shadow-2xl overflow-hidden">
          <div className="absolute top-3 right-4 flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="flex items-center gap-1.5 text-[11px] text-[#9aa0a6] hover:text-white bg-[#202227] px-2.5 py-1 rounded border border-[#333740] transition-colors"
            >
              {copied ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              <span>{copied ? 'Copiado!' : 'Copiar Tudo'}</span>
            </button>
          </div>

          <pre className="font-mono text-xs sm:text-[13px] leading-relaxed text-[#dcdfe4] whitespace-pre-wrap select-all overflow-x-auto pt-2">
            {RAW_DOCS_TXT}
          </pre>
        </div>
      </main>
    </div>
  );
}
