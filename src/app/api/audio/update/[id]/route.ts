import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase';
import { useParams } from 'next/navigation';

export async function PATCH(req: NextRequest,
  { params }: { params: { id: string } }) {
  const id = params.id;
  const body = await req.json();
  const { transcription, summary, translate_to_english } = body;

  if (!id) {
    return NextResponse.json({ error: 'Missing record ID' }, { status: 400 });
  }

  const updateData: any = {};
  if (transcription !== undefined) updateData.transcription = transcription;
  if (summary !== undefined) updateData.summary = summary;
  if (translate_to_english !== undefined) updateData.translate_to_english = translate_to_english;

  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: 'No fields to update' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('audios')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    console.error('Database update error:', error);
    return NextResponse.json({ error: 'Failed to update record' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    record: data
  }, { status: 200 });
}
