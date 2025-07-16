import { NextResponse } from 'next/server'
import { elevenlabs } from '@/utils/elevenlabs'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: Request) {
  try {
    const { audioBase64 } = await request.json()
    if (!audioBase64) {
      return NextResponse.json({ error: 'No audio data' }, { status: 400 })
    }

    const buffer = Buffer.from(audioBase64, 'base64')
    const blob = new Blob([buffer], { type: 'audio/webm;codecs=opus' })

    
    const stream = await elevenlabs.audioIsolation.convert({ audio: blob })
    const isolatedBlob = await new Response(stream).blob()
    const isoBuffer = Buffer.from(await isolatedBlob.arrayBuffer())

   
    const fileName = `isolated_${Date.now()}.webm`
    const { error: uploadError } = await supabaseAdmin
      .storage
      .from('audios')
      .upload(fileName, isoBuffer, { contentType: 'audio/webm' })

    if (uploadError) {
      return NextResponse.json({ error: uploadError.message }, { status: 500 })
    }

    const { data: urlData } = supabaseAdmin
      .storage
      .from('audios')
      .getPublicUrl(fileName)

    
    const { data: meta, error: metaErr } = await supabaseAdmin
      .from('audios')
      .insert({ url: urlData.publicUrl, type: 'isolated' })
      .select('id, url, type')
      .single()

    if (metaErr) {
      return NextResponse.json({ error: metaErr.message }, { status: 500 })
    }

    return NextResponse.json(meta)
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
