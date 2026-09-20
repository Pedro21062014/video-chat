import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'VideoMeet',
  description:
    'Aplicativo moderno de videochamadas com PeerJS P2P criptografado, salas instantâneas sem login, compartilhamento de tela, chat, reações, efeitos sonoros e deploy compatível com Cloudflare Pages.',
  icons: {
    icon: '/logo_video_bonito.png',
    apple: '/logo_video_bonito.png',
  },
  openGraph: {
    title: 'VideoMeet',
    description:
      'Aplicativo moderno de videochamadas com PeerJS P2P criptografado, salas instantâneas sem login, compartilhamento de tela, chat, reações, efeitos sonoros e deploy compatível com Cloudflare Pages.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VideoMeet',
    description:
      'Aplicativo moderno de videochamadas com PeerJS P2P criptografado, salas instantâneas sem login, compartilhamento de tela, chat, reações, efeitos sonoros e deploy compatível com Cloudflare Pages.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="pt-BR">
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
