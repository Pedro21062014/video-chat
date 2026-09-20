import type {Metadata} from 'next';
import './globals.css'; // Global styles

export const metadata: Metadata = {
  title: 'VideoMeet',
  description: 'Aplicativo moderno de videochamadas com WebRTC P2P criptografado, salas instantâneas sem login, compartilhamento de tela, chat, reações e efeitos sonoros.',
  icons: {
    icon: '/logo_video_bonito.png',
    apple: '/logo_video_bonito.png',
  },
  openGraph: {
    title: 'VideoMeet',
    description: 'Aplicativo moderno de videochamadas com WebRTC P2P criptografado, salas instantâneas sem login, compartilhamento de tela, chat, reações e efeitos sonoros.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'VideoMeet',
    description: 'Aplicativo moderno de videochamadas com WebRTC P2P criptografado, salas instantâneas sem login, compartilhamento de tela, chat, reações e efeitos sonoros.',
  },
};

export default function RootLayout({children}: {children: React.ReactNode}) {
  return (
    <html lang="pt-BR">
      <head>
        <link rel="icon" href="/logo_video_bonito.png" type="image/png" />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
