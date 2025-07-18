// app/api/audio/transcribe/route.ts
import { NextRequest, NextResponse } from 'next/server';

export const config = {
  runtime: 'edge',
};

export async function POST(req: NextRequest) {
  try {
    // 1) Pull the multipart FormData from the request
    const formData = await req.formData();
    const file = formData.get('file');
    if (!(file instanceof Blob)) {
      return NextResponse.json(
        { error: 'Missing or invalid "file" field' },
        { status: 400 }
      );
    }

    // 2) Append Whisper‐specific parameters
    formData.append('model', 'whisper-1');
    // If you know the language code you can force it, e.g.:
    // formData.append('language', 'zu');

    // 3) Call OpenAI’s transcription endpoint
    const openaiRes = await fetch(
      'https://api.openai.com/v1/audio/transcriptions',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        },
        body: formData,
      }
    );

    if (!openaiRes.ok) {
      const err = await openaiRes.text();
      console.error('Whisper error:', err);
      return NextResponse.json(
        { error: 'Transcription service failed' },
        { status: 502 }
      );
    }

    const { text: transcription } = await openaiRes.json();

    // 4) Return the transcript
    return NextResponse.json({ transcription });
  } catch (e) {
    console.error('Error in /api/audio/transcribe:', e);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
