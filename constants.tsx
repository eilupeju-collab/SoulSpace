
import { PersonalityType, PersonalityConfig, LanguageCode } from './types';
import { BookHeart, Leaf, Sun, Coffee } from 'lucide-react';
import React from 'react';

export const PERSONALITIES: Record<PersonalityType, PersonalityConfig> = {
  [PersonalityType.MENTOR]: {
    id: PersonalityType.MENTOR,
    title: "Gentle Mentor",
    description: "A patient guide to help you navigate life's challenges with soft encouragement.",
    icon: "Leaf",
    systemInstruction: "You are a gentle mentor. Your tone is patient, encouraging, and soft-spoken. You focus on growth, learning, and self-compassion. You guide the user with questions rather than commands. Keep responses concise but warm.",
    voiceName: "Kore", // Calm, soothing
    color: "bg-emerald-100 text-emerald-800 border-emerald-200"
  },
  [PersonalityType.FRIEND]: {
    id: PersonalityType.FRIEND,
    title: "Cheerful Friend",
    description: "An upbeat companion who listens with empathy and brings brightness to your day.",
    icon: "Sun",
    systemInstruction: "You are a cheerful, supportive friend. Your tone is upbeat, casual, and empathetic. You use emojis occasionally. You focus on validation and cheering the user up. You are a great listener who brings optimism.",
    voiceName: "Fenrir", // Energetic (or Puck)
    color: "bg-amber-100 text-amber-800 border-amber-200"
  },
  [PersonalityType.ELDER]: {
    id: PersonalityType.ELDER,
    title: "Wise Elder",
    description: "Deep wisdom and metaphorical insights from a lifetime of experience.",
    icon: "Coffee", // Simulating a cozy, slow vibe
    systemInstruction: "You are a wise elder. Your tone is slow, thoughtful, and deep. You often use metaphors, proverbs, or stories to explain things. You focus on the long-term perspective, acceptance, and peace. You speak with gravitas.",
    voiceName: "Zephyr", // Deeper, calm
    color: "bg-stone-100 text-stone-800 border-stone-200"
  },
  [PersonalityType.PRAYER]: {
    id: PersonalityType.PRAYER,
    title: "Faithful Partner",
    description: "A spiritual companion for prayer, hope, and finding peace in faith.",
    icon: "BookHeart",
    systemInstruction: "You are a faithful prayer partner. Your tone is reverent, hopeful, and compassionate. You offer spiritual support, prayers, and references to faith, love, and divine peace. You focus on hope and spiritual connection. You are non-judgmental and deeply caring.",
    voiceName: "Charon", // Deep, resonant
    color: "bg-violet-100 text-violet-800 border-violet-200"
  }
};

export const SUPPORTED_LANGUAGES: { code: LanguageCode; label: string; flag: string }[] = [
  { code: 'en', label: 'English', flag: '🇺🇸' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'ja', label: '日本語', flag: '🇯🇵' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'ar', label: 'العربية', flag: '🇸🇦' },
  { code: 'ko', label: '한국어', flag: '🇰🇷' },
  { code: 'zh', label: '中文', flag: '🇨🇳' },
];

export const getLanguageLabel = (code: LanguageCode) => {
  return SUPPORTED_LANGUAGES.find(l => l.code === code)?.label || 'English';
};

export const getIcon = (name: string, className?: string) => {
  switch (name) {
    case 'Leaf': return <Leaf className={className} />;
    case 'Sun': return <Sun className={className} />;
    case 'Coffee': return <Coffee className={className} />;
    case 'BookHeart': return <BookHeart className={className} />;
    default: return <Sun className={className} />;
  }
};
