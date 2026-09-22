import { NextRequest, NextResponse } from 'next/server';

function generateRoomCode() {
  const chars = 'abcdefghijklmnopqrstuvwxyz';
  const segment = (len: number) =>
    Array.from({ length: len }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  return `${segment(3)}-${segment(4)}-${segment(3)}`;
}

export async function GET(req: NextRequest) {
  return handleRequest(req);
}

export async function POST(req: NextRequest) {
  return handleRequest(req);
}

async function handleRequest(req: NextRequest) {
  const url = new URL(req.url);
  const origin = `${url.protocol}//${url.host}`;
  const customCode = url.searchParams.get('code');
  const mode = url.searchParams.get('mode') || 'stream';

  const roomCode = customCode ? customCode.toLowerCase().trim() : generateRoomCode();

  const senderUrl = `${origin}/?mode=stream&role=sender&room=${roomCode}`;
  const viewerUrl = `${origin}/?mode=stream&role=viewer&room=${roomCode}`;
  const meetingUrl = `${origin}/?room=${roomCode}`;
  const embedViewer = `${viewerUrl}&embed=true`;
  const embedMeeting = `${meetingUrl}&embed=true`;
  const obsBrowserSource = embedViewer;

  const iframeSnippet = `<iframe src="${embedViewer}" width="100%" height="500" allow="camera; microphone; display-capture; autoplay; fullscreen" allowfullscreen style="border:none; border-radius:12px; background:#121316;"></iframe>`;

  return NextResponse.json({
    success: true,
    roomCode,
    mode,
    links: {
      senderUrl,
      viewerUrl,
      meetingUrl,
      embedViewer,
      embedMeeting,
    },
    obsBrowserSource,
    iframeSnippet,
    sdkExample: `VideoMeet.createViewer({ container: '#video-box', roomCode: '${roomCode}' });`,
    isFree: true,
    technology: 'WebRTC P2P + Firebase Signaling (Zero Media Server Costs)',
  });
}
