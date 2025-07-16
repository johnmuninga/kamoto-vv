import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const { audioUrl, audioId } = await request.json()

    if (!audioUrl || !audioId) {
      return NextResponse.json({ error: 'Missing audio URL or ID' }, { status: 400 })
    }
    if (!process.env.ELEVENLABS_API_KEY) {
      return NextResponse.json({ error: 'ElevenLabs API key not configured' }, { status: 500 })
    }

    
    const formData = new FormData()
    formData.append('cloud_storage_url', audioUrl)
    formData.append('model_id', 'scribe_v1')

    const transcriptionResponse = await fetch(
      'https://api.elevenlabs.io/v1/speech-to-text',
      {
        method: 'POST',
        headers: { 'xi-api-key': process.env.ELEVENLABS_API_KEY! },
        body: formData,
      }
    )

    if (!transcriptionResponse.ok) {
      const errText = await transcriptionResponse.text()
      console.error('ElevenLabs error:', errText)
      return NextResponse.json({ error: 'Failed to transcribe audio' }, { status: 500 })
    }

    const { text: transcription } = await transcriptionResponse.json()

   
    const { error: updateError } = await supabaseAdmin
      .from('audios')
      .update({ transcription })
      .eq('id', audioId)

    if (updateError) {
      console.error('DB update error:', updateError)
      return NextResponse.json({ error: 'Failed to update record' }, { status: 500 })
    }

    return NextResponse.json({ success: true, transcription })
  } catch (e) {
    console.error('Unexpected error in transcription route:', e)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
