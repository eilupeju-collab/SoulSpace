
export enum PersonalityType {
  MENTOR = 'MENTOR',
  FRIEND = 'FRIEND',
  ELDER = 'ELDER',
  PRAYER = 'PRAYER'
}

export interface PersonalityConfig {
  id: PersonalityType;
  title: string;
  description: string;
  icon: string;
  systemInstruction: string;
  voiceName: string;
  color: string;
}

export enum MessageRole {
  USER = 'user',
  MODEL = 'model'
}

export interface ChatMessage {
  id: string;
  role: MessageRole;
  text: string;
  audioUrl?: string;
  audioBase64?: string;
  audioMimeType?: string;
  timestamp: Date;
  isStreaming?: boolean;
  feedback?: 'up' | 'down';
}

export enum AppMode {
  SELECTION = 'SELECTION',
  TEXT_CHAT = 'TEXT_CHAT',
  VOICE_CHAT = 'VOICE_CHAT'
}

// Audio related types
export interface AudioVisualizerData {
  volume: number;
}
