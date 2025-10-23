
export enum Speaker {
  USER = 'USER',
  TUTOR = 'TUTOR',
}

export interface TranscriptEntry {
  speaker: Speaker;
  text: string;
  image?: string;
}
