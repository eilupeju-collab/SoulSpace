
import React, { useState } from 'react';
import { PERSONALITIES, SUPPORTED_LANGUAGES, getLanguageLabel } from './constants';
import { AppMode, PersonalityConfig, PersonalityType, LanguageCode } from './types';
import PersonalityCard from './components/PersonalityCard';
import TextChat from './components/TextChat';
import LiveSession from './components/LiveSession';
import { MessageSquare, Mic, Sparkles, Languages } from 'lucide-react';
import { generatePersonalityAvatar } from './services/geminiService';
import { soundService } from './services/soundService';

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>(AppMode.SELECTION);
  const [selectedPersonality, setSelectedPersonality] = useState<PersonalityConfig | null>(null);
  const [selectedLanguage, setSelectedLanguage] = useState<LanguageCode>('en');
  const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
  
  const [avatars, setAvatars] = useState<Record<string, string>>(() => {
    try { return JSON.parse(localStorage.getItem('soulspace_avatars') || '{}'); } catch { return {}; }
  });
  
  const handleSelectPersonality = (p: PersonalityConfig) => {
    setSelectedPersonality(p);
    if (!avatars[p.id]) {
      generatePersonalityAvatar(p).then(url => {
        if (url) {
          setAvatars(prev => {
            const next = { ...prev, [p.id]: url };
            try { localStorage.setItem('soulspace_avatars', JSON.stringify(next)); } catch (e) {}
            return next;
          });
        }
      });
    }
  };

  const handleStartSession = (type: 'text' | 'voice') => {
    if (!selectedPersonality) return;
    soundService.playTransition();
    setMode(type === 'text' ? AppMode.TEXT_CHAT : AppMode.VOICE_CHAT);
  };

  const handleBack = () => {
    setMode(AppMode.SELECTION);
  };

  if (mode === AppMode.TEXT_CHAT && selectedPersonality) {
    return <TextChat 
      personality={selectedPersonality} 
      language={selectedLanguage}
      onLanguageChange={setSelectedLanguage}
      onBack={handleBack} 
      avatarUrl={avatars[selectedPersonality.id]}
    />;
  }

  if (mode === AppMode.VOICE_CHAT && selectedPersonality) {
    return <LiveSession 
      personality={selectedPersonality} 
      language={selectedLanguage}
      onLanguageChange={setSelectedLanguage}
      onBack={handleBack} 
      avatarUrl={avatars[selectedPersonality.id]}
    />;
  }

  return (
    <div className="min-h-screen bg-warm selection:bg-primary/20 flex flex-col">
      
      {/* Hero Header */}
      <header className="pt-10 pb-6 px-6 text-center max-w-4xl mx-auto">
        <div className="flex flex-col items-center gap-6">
          <div className="inline-flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm animate-fade-in-up">
             <Sparkles size={16} className="text-secondary" />
             <span className="text-sm font-medium text-stone-600 tracking-wide uppercase">AI Counseling Companion</span>
          </div>
          
          {/* Language Picker */}
          <div className="relative">
            <button 
              onClick={() => { soundService.playClick(); setIsLangMenuOpen(!isLangMenuOpen); }}
              className="flex items-center gap-2 px-5 py-2.5 bg-white border border-stone-100 rounded-full shadow-sm hover:shadow-md transition-all text-stone-700 font-medium"
            >
              <Languages size={18} className="text-primary" />
              <span>Language: {getLanguageLabel(selectedLanguage)}</span>
            </button>
            {isLangMenuOpen && (
              <div className="absolute top-full left-1/2 -translate-x-1/2 mt-3 w-64 bg-white border border-stone-100 rounded-3xl shadow-2xl p-3 z-50 grid grid-cols-2 gap-2 animate-in slide-in-from-top-4 duration-300">
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <button 
                    key={lang.code}
                    onClick={() => { setSelectedLanguage(lang.code); setIsLangMenuOpen(false); soundService.playClick(); }}
                    className={`flex items-center gap-2 p-2.5 rounded-2xl text-sm transition-all ${selectedLanguage === lang.code ? 'bg-primary text-white scale-105' : 'hover:bg-stone-50 text-stone-600'}`}
                  >
                    <span>{lang.flag}</span>
                    <span className="font-semibold">{lang.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <h1 className="font-serif text-5xl md:text-6xl text-stone-900 mt-10 mb-6 leading-tight">
          Find Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">SoulSpace</span>
        </h1>
        <p className="text-xl text-stone-500 max-w-2xl mx-auto leading-relaxed">
          Choose a companion that resonates with your spirit. Experience personalized care in <span className="text-primary font-bold">{getLanguageLabel(selectedLanguage)}</span>.
        </p>
      </header>

      {/* Personality Grid */}
      <main className="max-w-6xl mx-auto px-6 pb-32 flex-1">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {Object.values(PERSONALITIES).map((p) => (
            <PersonalityCard 
              key={p.id}
              personality={p}
              selected={selectedPersonality?.id === p.id}
              onSelect={handleSelectPersonality}
              avatarUrl={avatars[p.id]}
            />
          ))}
        </div>

        <div className="mt-12 flex justify-center">
            <div className="max-w-3xl text-center px-6 py-6 rounded-3xl bg-white/50 backdrop-blur-sm border border-white/60 shadow-sm relative overflow-hidden group hover:bg-white/80 transition-all duration-500">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-purple-500 to-secondary opacity-50"></div>
                <p className="font-medium text-sm sm:text-base leading-relaxed text-stone-600">
                   <span className="block text-xs uppercase tracking-widest text-stone-400 mb-2 font-bold">Important Notice</span>
                   SoulSpace is an AI companion and does not replace professional medical or psychological care. Please seek professional attention when needed.
                </p>
            </div>
        </div>

        {/* Action Bar */}
        <div className={`fixed bottom-0 left-0 w-full bg-white border-t border-stone-100 p-6 transition-transform duration-500 ease-in-out z-50
          ${selectedPersonality ? 'translate-y-0' : 'translate-y-full'}`}>
          <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
            
            <div className="flex items-center gap-4">
               {selectedPersonality && (
                 <>
                   <div className={`w-12 h-12 rounded-full flex items-center justify-center overflow-hidden ${selectedPersonality.color.split(' ')[0]}`}>
                     {avatars[selectedPersonality.id] ? <img src={avatars[selectedPersonality.id]} alt={selectedPersonality.title} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-current opacity-20" />}
                   </div>
                   <div>
                     <p className="text-xs text-stone-400 uppercase tracking-wider font-bold">Session with {selectedPersonality.title}</p>
                     <h3 className="font-serif text-lg text-stone-800">Ready in {getLanguageLabel(selectedLanguage)}</h3>
                   </div>
                 </>
               )}
            </div>

            <div className="flex gap-4 w-full sm:w-auto">
              <button 
                onClick={() => handleStartSession('text')}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-8 py-3 rounded-xl bg-stone-100 text-stone-700 font-medium hover:bg-stone-200 transition-colors"
              >
                <MessageSquare size={20} />
                Text Chat
              </button>
              <button 
                onClick={() => handleStartSession('voice')}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-8 py-3 rounded-xl bg-primary text-white font-medium hover:bg-primary/90 shadow-lg shadow-primary/25 transition-all hover:-translate-y-0.5"
              >
                <Mic size={20} />
                Live Voice
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default App;
