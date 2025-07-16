import { NextResponse } from "next/server";
const {Translate} = require('@google-cloud/translate').v2;

const translate = new Translate({
  projectId: process.env.GCP_PROJECT_ID,
  credentials: {
    client_email: process.env.GCP_CLIENT_EMAIL!,
    private_key: (process.env.GCP_PRIVATE_KEY || "").replace(/\\n/g, "\n"),
  }
})

export async function POST(request: Request) {
  const { text, targetLanguage = "en" } = await request.json();
  if (!text) {
    return NextResponse.json({ error: "Missing text to translate" }, { status: 400 });
  }

  try {
    const [translatedText] = await translate.translate(text, targetLanguage);
    console.log(`Translated text: ${translatedText}`);
    return NextResponse.json({ translatedText });
  } catch (e) {
    console.error("Translate client error:", e);
    return NextResponse.json({ error: "Translation failed" }, { status: 500 });
  }
}
