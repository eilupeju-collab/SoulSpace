
import React, { useState } from 'react';
import { PERSONALITIES } from './constants';
import { AppMode, PersonalityConfig, PersonalityType } from './types';
import PersonalityCard from './components/PersonalityCard';
import TextChat from './components/TextChat';
import LiveSession from './components/LiveSession';
import { MessageSquare, Mic, Sparkles, AlertTriangle } from 'lucide-react';
import { generatePersonalityAvatar } from './services/geminiService';
import { soundService } from './services/soundService';

const App: React.FC = () => {
  const [mode, setMode] = useState<AppMode>(AppMode.SELECTION);
  const [selectedPersonality, setSelectedPersonality] = useState<PersonalityConfig | null>(null);
  const [avatars, setAvatars] = useState<Record<string, string>>(() => {
    try {
      return JSON.parse(localStorage.getItem('soulspace_avatars') || '{}');
    } catch {
      return {};
    }
  });
  
  // Selection Handlers
  const handleSelectPersonality = (p: PersonalityConfig) => {
    setSelectedPersonality(p);
    
    // Lazy generate avatar if not present
    if (!avatars[p.id]) {
      generatePersonalityAvatar(p).then(url => {
        if (url) {
          setAvatars(prev => {
            const next = { ...prev, [p.id]: url };
            try {
              localStorage.setItem('soulspace_avatars', JSON.stringify(next));
            } catch (e) {
              console.warn("Could not save avatar to localStorage (quota exceeded)");
            }
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
    // Don't reset personality so user doesn't have to re-select if they just want to switch modes
  };

  // Render Screens
  if (mode === AppMode.TEXT_CHAT && selectedPersonality) {
    return <TextChat 
      personality={selectedPersonality} 
      onBack={handleBack} 
      avatarUrl={avatars[selectedPersonality.id]}
    />;
  }

  if (mode === AppMode.VOICE_CHAT && selectedPersonality) {
    return <LiveSession 
      personality={selectedPersonality} 
      onBack={handleBack} 
      avatarUrl={avatars[selectedPersonality.id]}
    />;
  }

  return (
    <div className="min-h-screen bg-warm selection:bg-primary/20">
      
      {/* Hero Header */}
      <header className="pt-10 pb-12 px-6 text-center max-w-4xl mx-auto">
        <div className="inline-flex items-center gap-2 bg-white px-4 py-2 rounded-full shadow-sm mb-6 animate-fade-in-up">
           <Sparkles size={16} className="text-secondary" />
           <span className="text-sm font-medium text-stone-600 tracking-wide uppercase">AI Counseling Companion</span>
        </div>
        <h1 className="font-serif text-5xl md:text-6xl text-stone-900 mb-6 leading-tight">
          Find Your <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">SoulSpace</span>
        </h1>
        <p className="text-xl text-stone-500 max-w-2xl mx-auto leading-relaxed">
          Choose a companion that resonates with your spirit. Whether you need quiet wisdom, cheerful support, or a faithful partner in prayer.
        </p>
      </header>

      {/* Personality Grid */}
      <main className="max-w-6xl mx-auto px-6 pb-32">
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

        {/* Disclaimer Footer */}
        <div className="mt-12 flex justify-center">
            <div className="max-w-3xl text-center px-6 py-6 rounded-3xl bg-white/50 backdrop-blur-sm border border-white/60 shadow-sm relative overflow-hidden group hover:bg-white/80 transition-all duration-500">
                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-primary via-purple-500 to-secondary opacity-50"></div>
                <p className="font-medium text-sm sm:text-base leading-relaxed text-transparent bg-clip-text bg-gradient-to-r from-primary via-purple-600 to-secondary">
                   <span className="block text-xs uppercase tracking-widest text-stone-400 mb-2 font-bold">Important Notice</span>
                   The services provided by SoulSpace does not replace the services of professionals such as; medical professionals, Psychologist, therapist and so on. Please seek professional attention when needed.
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
                     {avatars[selectedPersonality.id] ? (
                       <img src={avatars[selectedPersonality.id]} alt={selectedPersonality.title} className="w-full h-full object-cover" />
                     ) : (
                       // Fallback placeholder while loading or if logic fails
                       <div className="w-full h-full bg-current opacity-20" />
                     )}
                   </div>
                   <div>
                     <p className="text-sm text-stone-400 uppercase tracking-wider font-medium">Selected Companion</p>
                     <h3 className="font-serif text-xl text-stone-800">{selectedPersonality.title}</h3>
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
