
import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    
    const { translatedText } = await req.json();

    if (!translatedText || typeof translatedText !== 'string') {
      return NextResponse.json(
        { error: 'Missing or invalid translatedText' },
        { status: 400 }
      );
    }

    
    const messages = [
      {
        role: 'system',
        content: [
          "You are a professional summarization assistant.",
          "Create concise, accurate summaries using only the information provided.",
          "Do NOT add, infer, or hallucinate any details.",
        ].join(' ')
      },
      {
        role: 'user',
        content: `Please summarize the following English text into a clear, concise, and professional summary suitable for reporting and archiving:\n\n"""${translatedText}"""\n\nSummary:`
      }
    ];

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages,
        temperature: 0,
        max_tokens: 300,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error('OpenAI API error:', err);
      return NextResponse.json(
        { error: 'Failed to generate summary' },
        { status: 500 }
      );
    }

    const { choices } = await response.json();
    const summary = choices[0]?.message?.content.trim() ?? '';

    return NextResponse.json({ summary });
  } catch (error) {
    console.error('Error summarizing translated text:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
