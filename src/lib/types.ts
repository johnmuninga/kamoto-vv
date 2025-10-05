export interface AudioRecord {
  id: string;
  url: string | null;
  type: string | null;
  social_worker_name: string | null;
  engagement_date: string | null;
  recording_name: string | null;
  community: string | null;
  engagement_language: string | null;
  language_supported: boolean | null;
  transcription: string | null;
  summary?: string | null;
  translate_to_english?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CreateAudioRecord {
  url: string;
  type: string;
  social_worker_name: string;
  engagement_date: string;
  recording_name: string;
  community: string;
  engagement_language: string;
  language_supported: boolean;
  transcription?: string;
}

export interface UpdateAudioRecord {
  transcription?: string;
  summary?: string;
}

export const KOLWEZI_COMMUNITIES = [
  'Kolwezi Centre',
  'Manika',
  'Dilala',
  'Musonoie',
  'Kakanda',
  'Luilu',
  'Mutoshi',
  'Kambove',
  'Kipushi',
  'Likasi',
  'Lubumbashi',
  'Kinshasa',
  'Matadi',
  'Mbuji-Mayi',
  'Kananga',
  'Kisangani',
  'Bukavu',
  'Goma',
  'Mbandaka',
  'Tshikapa'
] as const;

export const SUPPORTED_LANGUAGES = [
  'English',
  'French',
  'Swahili',
  'Lingala'
] as const;

export const ALL_LANGUAGES = [
  "English",
  "French",
  "Swahili",
  "Lingala",
  "Balubakat",
  "Kibemba"
] as const;

export type Community = typeof KOLWEZI_COMMUNITIES[number];
export type Language = typeof SUPPORTED_LANGUAGES[number];