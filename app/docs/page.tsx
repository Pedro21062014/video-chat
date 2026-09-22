import { DocsView } from '@/components/DocsView';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Documentação & Guia de Integração • VideoMeet',
  description:
    'Documentação técnica completa, SDK JavaScript, snippets para Iframe, React, Next.js, OBS Studio e prompt para IAs (llms.txt) do VideoMeet WebRTC P2P.',
};

export default function DocsPage() {
  return <DocsView />;
}
