
import React, { useEffect, useState, useRef } from 'react';
import { PersonalityConfig, LanguageCode } from '../types';
import { connectLiveSession } from '../services/geminiService';
import { Mic, PhoneOff, AlertCircle, Volume2, VolumeX, Globe } from 'lucide-react';
import { getIcon, SUPPORTED_LANGUAGES, getLanguageLabel } from '../constants';
import { soundService } from '../services/soundService';

interface Props {
  personality: PersonalityConfig;
  language: LanguageCode;
  onLanguageChange: (lang: LanguageCode) => void;
  onBack: () => void;
  avatarUrl?: string;
}

const LiveSession: React.FC<Props> = ({ personality, language, onLanguageChange, onBack, avatarUrl }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [isAmbienceMuted, setIsAmbienceMuted] = useState(soundService.isAmbienceMuted());
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);
  
  const disconnectRef = useRef<(() => void) | null>(null);
  const setRecordingRef = useRef<((recording: boolean) => void) | null>(null);

  const targetVolumeRef = useRef(0);
  const currentVolumeRef = useRef(0);
  const bgRef = useRef<HTMLDivElement>(null);
  const ring1Ref = useRef<HTMLDivElement>(null);
  const ring2Ref = useRef<HTMLDivElement>(null);
  const ring3Ref = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number>(0);

  useEffect(() => {
    soundService.startAmbience(personality.id);
    return () => { soundService.stopAmbience(); };
  }, [personality.id]);

  useEffect(() => {
    const animate = () => {
      targetVolumeRef.current *= 0.95;
      currentVolumeRef.current += (targetVolumeRef.current - currentVolumeRef.current) * 0.1;
      const v = currentVolumeRef.current;
      const scaleBase = 1 + v;
      if (bgRef.current) { bgRef.current.style.transform = `scale(${1.2 + v * 0.15})`; bgRef.current.style.filter = `blur(60px) opacity(${0.3 + v * 0.2}) saturate(${1.5 + v * 0.5})`; }
      if (ring1Ref.current) { ring1Ref.current.style.transform = `scale(${scaleBase * 1.5})`; ring1Ref.current.style.opacity = `${0.2 + v * 0.3}`; }
      if (ring2Ref.current) { ring2Ref.current.style.transform = `scale(${scaleBase * 1.25})`; ring2Ref.current.style.opacity = `${0.3 + v * 0.3}`; }
      if (ring3Ref.current) { ring3Ref.current.style.transform = `scale(${scaleBase * 1.1})`; ring3Ref.current.style.opacity = `${0.1 + v * 0.1}`; }
      animationFrameRef.current = requestAnimationFrame(animate);
    };
    animationFrameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameRef.current);
  }, []);

  useEffect(() => {
    let active = true;
    const startSession = async () => {
      try {
        if (disconnectRef.current) disconnectRef.current();
        const { disconnect, setIsRecording } = await connectLiveSession(
          personality,
          language,
          (audioBuffer) => {
             const data = audioBuffer.getChannelData(0);
             let sum = 0;
             for(let i=0; i<data.length; i+=5) sum += data[i] * data[i];
             const rms = Math.sqrt(sum / (data.length/5));
             if (active) targetVolumeRef.current = Math.min(rms * 5, 2.0);
          },
          () => { if (active) setIsConnected(false); }
        );
        disconnectRef.current = disconnect;
        setRecordingRef.current = setIsRecording;
        setIsConnected(true);
        setError(null);
      } catch (err: any) {
        if (active) { setError("Failed to connect. Check permissions."); setIsConnected(false); soundService.playError(); }
      }
    };
    startSession();
    return () => { active = false; if (disconnectRef.current) disconnectRef.current(); };
  }, [personality, language]);

  const startRecording = (e: React.SyntheticEvent) => { e.preventDefault(); if (setRecordingRef.current) { soundService.playStartRecord(); setRecordingRef.current(true); setIsUserSpeaking(true); } };
  const stopRecording = (e: React.SyntheticEvent) => { e.preventDefault(); if (setRecordingRef.current) { soundService.playStopRecord(); setRecordingRef.current(false); setIsUserSpeaking(false); } };

  const themeColor = personality.color.split(' ')[0].replace('bg-', 'bg-');

  return (
    <div className="flex flex-col h-full bg-stone-50 relative overflow-hidden select-none">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
         {avatarUrl ? (
            <div ref={bgRef} className="absolute inset-0 transition-transform duration-100 ease-out will-change-transform" style={{ backgroundImage: `url(${avatarUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(60px) opacity(0.3) saturate(1.5)', transform: 'scale(1.2)' }} />
         ) : (
             <div ref={bgRef} className="w-full h-full relative will-change-transform">
                <div className={`absolute top-[-10%] left-[-10%] w-[50vh] h-[50vh] rounded-full blur-3xl opacity-30 ${themeColor}`} />
                <div className="absolute bottom-[-10%] right-[-10%] w-[60vh] h-[60vh] rounded-full blur-3xl opacity-30 bg-blue-100" />
             </div>
         )}
      </div>

      <div className="relative z-20 flex items-center justify-between px-6 py-6">
        <button onClick={() => { soundService.playClick(); onBack(); }} className="flex items-center gap-2 text-stone-500 hover:text-stone-800 transition-colors bg-white/50 hover:bg-white/80 backdrop-blur-sm px-4 py-2 rounded-xl border border-white/20 shadow-sm">
          <span className="font-medium">End Session</span>
        </button>

        <div className="flex items-center gap-3">
          <div className="relative">
            <button 
              onClick={() => { setIsLanguageMenuOpen(!isLanguageMenuOpen); soundService.playClick(); }}
              className="flex items-center gap-2 text-stone-600 bg-white/50 hover:bg-white/80 backdrop-blur-sm px-4 py-2 rounded-xl border border-white/20 shadow-sm"
            >
              <Globe size={18} className="text-stone-400" />
              <span className="font-bold text-sm">{SUPPORTED_LANGUAGES.find(l => l.code === language)?.flag} {language.toUpperCase()}</span>
            </button>
            {isLanguageMenuOpen && (
              <div className="absolute top-full right-0 mt-2 w-40 bg-white border border-stone-100 rounded-2xl shadow-xl p-2 z-50 grid grid-cols-1 gap-1 animate-in slide-in-from-top-2 duration-200">
                {SUPPORTED_LANGUAGES.map((lang) => (
                  <button 
                    key={lang.code}
                    onClick={() => { onLanguageChange(lang.code); setIsLanguageMenuOpen(false); soundService.playClick(); }}
                    className={`flex items-center gap-3 p-2 rounded-xl text-sm transition-colors ${language === lang.code ? 'bg-primary text-white' : 'hover:bg-stone-50 text-stone-700'}`}
                  >
                    <span>{lang.flag}</span>
                    <span className="font-medium">{lang.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => { soundService.playClick(); const muted = soundService.toggleAmbienceMute(); setIsAmbienceMuted(muted); }} className="text-stone-500 hover:text-stone-800 transition-colors bg-white/50 hover:bg-white/80 backdrop-blur-sm p-3 rounded-xl border border-white/20 shadow-sm">
            {isAmbienceMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center relative z-10">
        {!isConnected && !error && <div className="text-stone-500 font-serif text-lg animate-pulse">Connecting in {getLanguageLabel(language)}...</div>}
        {error && <div className="bg-red-50 text-red-600 px-6 py-4 rounded-xl flex items-center gap-3 border border-red-100 shadow-sm"><AlertCircle size={24} /><p>{error}</p></div>}
        {isConnected && (
            <div className="relative flex items-center justify-center">
                <div ref={ring1Ref} className={`absolute w-72 h-72 rounded-full opacity-20 will-change-transform ${themeColor}`} />
                <div ref={ring2Ref} className={`absolute w-56 h-56 rounded-full opacity-30 will-change-transform ${themeColor}`} />
                <div ref={ring3Ref} className={`absolute w-48 h-48 rounded-full opacity-10 border border-current will-change-transform ${personality.color.replace('bg-', 'text-')}`} />
                <div className={`w-44 h-44 rounded-full shadow-2xl flex items-center justify-center z-20 bg-white transition-all duration-300 overflow-hidden ring-8 ring-white/30 backdrop-blur-md ${isUserSpeaking ? 'scale-95 ring-primary/40' : 'animate-float'}`}>
                    <div className={`w-full h-full flex items-center justify-center ${avatarUrl ? '' : personality.color.split(' ')[0]}`}>
                        {avatarUrl ? <img src={avatarUrl} alt={personality.title} className="w-full h-full object-cover" /> : getIcon(personality.icon, "w-16 h-16")}
                    </div>
                </div>
            </div>
        )}
        {isConnected && (
            <div className="mt-16 text-center h-20">
                <h2 className="font-serif text-3xl text-stone-800 mb-2">{personality.title}</h2>
                <p className={`text-lg font-medium transition-colors ${isUserSpeaking ? 'text-primary' : 'text-stone-500'}`}>
                  {isUserSpeaking ? "Listening..." : "Hold button to speak"}
                </p>
                <p className="text-[10px] text-stone-400 mt-2 uppercase tracking-widest font-bold">Session Language: {getLanguageLabel(language)}</p>
            </div>
        )}
      </div>

      <div className="p-8 pb-12 flex flex-col items-center gap-6 relative z-10">
        <button disabled={!isConnected} onMouseDown={startRecording} onMouseUp={stopRecording} onMouseLeave={stopRecording} onTouchStart={startRecording} onTouchEnd={stopRecording} className={`w-24 h-24 rounded-full flex items-center justify-center shadow-xl transition-all duration-200 border-4 border-white/50 ${!isConnected ? 'opacity-50 bg-stone-200 text-stone-400' : isUserSpeaking ? 'bg-primary text-white scale-110 shadow-primary/40 ring-4 ring-primary/30' : 'bg-white text-stone-600 hover:bg-stone-50'}`}><Mic size={36} /></button>
        <button onClick={() => { soundService.playClick(); onBack(); }} className="text-stone-500 text-sm hover:text-red-500 transition-colors flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-red-50/50 backdrop-blur-sm"><PhoneOff size={16} /><span>Disconnect</span></button>
      </div>
    </div>
  );
};

export default LiveSession;
