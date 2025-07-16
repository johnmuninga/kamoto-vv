import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { transcript } = await req.json();

    if (!transcript || typeof transcript !== 'string') {
      return NextResponse.json({ error: 'Missing or invalid transcript' }, { status: 400 });
    }

    const prompt = `
You are a helpful assistant. Summarize the following audio transcript into a clear, concise, and professional summary suitable for reporting and archiving:

Transcript:
"""
${transcript}
"""

Summary:
`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.5,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', errorText);
      return NextResponse.json({ error: 'Failed to generate summary' }, { status: 500 });
    }

    const data = await response.json();
    const summary = data.choices[0].message.content.trim();

    return NextResponse.json({ summary });
  } catch (error) {
    console.error('Error summarizing transcript:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
