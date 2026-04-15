export type ContentType = 'series' | 'movie' | 'unknown';

export type GPTScenario = 'foreign' | 'translit' | 'cleanRussian';

export type StatusType = 'pending' | 'processed' | 'skipped' | 'error';

export interface MediaFile {
  path: string;
  originalName: string;
  extension: string;
  type: ContentType;
  metadata?: {
    title?: string;
    season?: number;
    episode?: number;
    year?: number;
  };
  newName?: string;
  status: StatusType;
}

export interface MediaFolder {
  path: string;
  originalName: string;
  contentType: ContentType;
  files: MediaFile[];
  newName?: string;
}

export interface GPTBatch {
  files: MediaFile[];
  prompt: string;
  response?: string;
}

export interface ProcessingResult {
  total: number;
  renamed: number;
  skipped: number;
  errors: number;
}
