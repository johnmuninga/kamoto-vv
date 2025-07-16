import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function GET() {
  
  const { data, error } = await supabaseAdmin
    .from('audios')
    .select('*')
    .order('id', { ascending: false })

  if (error) {
    console.error('Database error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch records' },
      { status: 500 }
    )
  }
  

  return NextResponse.json({ success: true, records: data || [] })
}
