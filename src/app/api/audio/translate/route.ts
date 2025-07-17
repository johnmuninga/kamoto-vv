import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { text } = await req.json();

    if (!text || typeof text !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid text to translate' },
        { status: 400 }
      );
    }

    const prompt = `
You are a helpful assistant. Translate the following text into clear,  English:

Text:
"""
${text}
"""

English Translation:
`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0,
        max_tokens: 2000,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('OpenAI API error:', err);
      return NextResponse.json(
        { error: 'Failed to translate text' },
        { status: 500 }
      );
    }

    const { choices } = await response.json();
    const translatedText = choices?.[0]?.message?.content.trim() ?? '';

    return NextResponse.json({ translatedText });
  } catch (error) {
    console.error('Error translating text:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
