// src/app/api/audio/save/route.ts
import { NextResponse } from "next/server"
import { supabaseAdmin } from "@/lib/supabase"
import { SUPPORTED_LANGUAGES } from "@/lib/types"

export async function POST(request: Request) {
  const {
    url,
    type,
    socialWorkerName,
    engagementDate,
    recordingName,
    community,
    language,
    transcription,
  } = await request.json()

  
  if (!url || !recordingName || !community || !language) {
    return NextResponse.json({ success: false, error: "Missing fields" }, { status: 400 })
  }

  const languageSupported = SUPPORTED_LANGUAGES.includes(language)

  const { data: dbRecord, error: dbError } = await supabaseAdmin
    .from("audios")
    .insert({
      url,
      type,
      social_worker_name: socialWorkerName,
      engagement_date: engagementDate,
      recording_name: recordingName,
      community,
      engagement_language: language,
      language_supported: languageSupported,
      transcription,
    })
    .select()
    .single()

  if (dbError) {
    console.error("DB error:", dbError)
    return NextResponse.json({ success: false, error: "Failed to save record" }, { status: 500 })
  }

  return NextResponse.json({ success: true, record: dbRecord })
}
