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
      transcription
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
        transcription: transcription
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

    // Automatically translate and summarize if transcription exists
    let translatedText = '';
    let summary = '';
    
    if (transcription && transcription.trim()) {
      try {
        // Step 1: Translate the transcription
        const translateResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/audio/translate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: transcription })
        });
        
        if (translateResponse.ok) {
          const translateData = await translateResponse.json();
          translatedText = translateData.translatedText || '';
          
          // Step 2: Generate summary from translated text
          if (translatedText) {
            const summaryResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/audio/summarize`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ translatedText })
            });
            
            if (summaryResponse.ok) {
              const summaryData = await summaryResponse.json();
              summary = summaryData.summary || '';
            }
          }
        }
        
        // Update the record with translation and summary
        if (translatedText || summary) {
          await supabaseAdmin
            .from('audios')
            .update({
              translate_to_english: translatedText,
              summary: summary
            })
            .eq('id', dbRecord.id);
        }
      } catch (error) {
        console.error('Error in automatic translation/summary:', error);
        // Don't fail the save operation if translation/summary fails
      }
    }

    return NextResponse.json({ 
      success: true, 
      record: {
        ...dbRecord,
        translate_to_english: translatedText,
        summary: summary
      }
    })
  } catch (e: any) {
    console.error('Route error:', e)
    return NextResponse.json(
      { success: false, error: 'Internal server error' },
      { status: 500 }
    )
  }
}
