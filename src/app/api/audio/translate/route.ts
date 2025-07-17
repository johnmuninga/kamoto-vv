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

   const messages = [
  {
    role: 'system',
    content:
      "You are a professional translator and cultural interpreter. Your job is to convert texts from any language into fluent, professional English — preserving tone, names, cultural nuance, and intent. Never summarize or simplify unless explicitly asked. Always preserve sentence structure and speaker style.",
  },
  {
    role: 'user',
    content: `Please rewrite the following text into professional, natural English without changing names or cultural references:\n\n"""${text}"""\n\nRewritten English Version:`,
  },
];


    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4-turbo',
        messages,
        temperature: 0.3,
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
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
