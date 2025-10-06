import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { SUPPORTED_LANGUAGES } from '@/lib/types'

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const {
      audioData,
      socialWorkerName,
      engagementDate,
      recordingName,
      community,
      language,
      audioType,
      transcription,
      translate_to_english,
      summary
    } = body

    if (
      !audioData ||
      !socialWorkerName ||
      !recordingName ||
      !community ||
      !language
    ) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields' },
        { status: 400 }
      )
    }
   
    const base64 = audioData.split(',').pop()!
    const buffer = Buffer.from(base64, 'base64')

    
    const timestamp = Date.now()
    const safeName = recordingName.replace(/[^a-zA-Z0-9]/g, '_')
    const filename = `${timestamp}-${safeName}.webm`

    const { error: uploadError } = await supabaseAdmin.storage
      .from('audios')
      .upload(filename, buffer, {
        contentType: audioType || 'audio/webm',
        upsert: false
      })

    if (uploadError) {
      console.error('Upload error:', uploadError)
      return NextResponse.json(
        { success: false, error: 'Failed to upload audio' },
        { status: 500 }
      )
    }

   
    const { data: urlData } = supabaseAdmin.storage
      .from('audios')
      .getPublicUrl(filename)
    const publicUrl = urlData.publicUrl

    
    const languageSupported = SUPPORTED_LANGUAGES.includes(language)

   
    const { data: dbRecord, error: dbError } = await supabaseAdmin
      .from('audios')
      .insert({
        url: publicUrl,
        type: audioType || 'audio/webm',
        social_worker_name: socialWorkerName,
        engagement_date: engagementDate,
        recording_name: recordingName,
        community,
        engagement_language: language,
        language_supported: languageSupported,
        transcription: transcription,
        translate_to_english: translate_to_english || null,
        summary: summary || null
      })
      .select()
      .single()

    if (dbError) {
      console.error('DB error:', dbError)
      return NextResponse.json(
        { success: false, error: 'Failed to save record' },
        { status: 500 }
      )
    }

    // Translation and summary are now handled on the frontend
    // and passed directly to this API

    return NextResponse.json({ 
      success: true, 
      record: dbRecord
    })
  } catch (e: any) {
    console.error('Route error:', e)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
