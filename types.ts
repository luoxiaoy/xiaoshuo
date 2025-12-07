
export enum AppStep {
  SETUP = 'SETUP',
  OUTLINE = 'OUTLINE',
  CHAPTERS = 'CHAPTERS',
  WRITING = 'WRITING',
}

export interface NovelConfig {
  title: string;
  genre: string;
  tone: string; // e.g., Dark, Humorous, Serious
  protagonist: string;
  worldSetting: string;
  writingStyle: string; // e.g., Shuangwen, High IQ, Suspense
  targetChapterCount: number;
  targetWordCount: number;
  additionalNotes: string;
}

export interface Chapter {
  id: string;
  title: string;
  summary: string;
  content: string;
  isGenerated: boolean;
}

export interface Novel {
  id: string;
  lastModified: number;
  config: NovelConfig;
  outline: string;
  chapters: Chapter[];
  currentChapterId: string | null;
  step: AppStep;
}

export interface AIRequestParams {
  apiKey: string;
  model: string;
}
