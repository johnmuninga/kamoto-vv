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

export const SOUTH_AFRICAN_PROVINCES = [
  'Soweto',
  'Khayelitsha',
  'Tembisa',
  'Mamelodi',
  'Umlazi',
  'Mdantsane',
  'Seshego',
  'KwaMashu',
  'Mitchells Plain',
  'Soshanguve',
  'Katlehong',
  'Botshabelo',
  'Alexandra',
  'Galeshewe',
  'Thabong',
  'Zwide',
  'eSikhawini',
  'Boipatong',
  'Malamulele',
  'Ikageng'
] as const;

export const SUPPORTED_LANGUAGES = [
  'Zulu',
  'Xhosa',
  'Afrikaans',
  'Sotho',
  'Tswana',
  'Sepedi',
  'English'
] as const;

export const ALL_LANGUAGES = [
  "English",
  "Zulu",
  "Xhosa",
  "Afrikaans",
  "Sepedi",
  "Northern Sotho",
  "Shona",
  "Swati",
  "Tsonga",
  "Venda",
  "Ndebele",
  "Tswana",
  "Sotho",
  "Ikageng",
] as const;

export type Province = typeof SOUTH_AFRICAN_PROVINCES[number];
export type Language = typeof SUPPORTED_LANGUAGES[number];