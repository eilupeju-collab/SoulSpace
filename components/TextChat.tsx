
import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, MessageRole, PersonalityConfig, PersonalityType, LanguageCode } from '../types';
import { streamChatResponse, generateQuickReplies, generateSpeech, translateText } from '../services/geminiService';
import { Send, User, Sparkles, Mic, X, Play, Pause, ThumbsUp, ThumbsDown, Volume2, Loader, AudioLines, Trash2, Languages, Globe, Waves } from 'lucide-react';
import { getIcon, SUPPORTED_LANGUAGES, getLanguageLabel } from '../constants';
import { blobToBase64, base64ToUint8Array, pcmToWav } from '../services/audioUtils';
import { Content, Part } from '@google/genai';
import { soundService } from '../services/soundService';

interface Props {
  personality: PersonalityConfig;
  language: LanguageCode;
  onLanguageChange: (lang: LanguageCode) => void;
  onBack: () => void;
  avatarUrl?: string;
}

const getPersonalityStyles = (type: PersonalityType) => {
  switch (type) {
    case PersonalityType.MENTOR:
      return { 
        shadow: 'shadow-emerald-200/50', 
        dot: 'bg-emerald-400', 
        border: 'border-emerald-100', 
        ring: 'ring-emerald-100', 
        button: 'hover:bg-emerald-50 text-emerald-700 border-emerald-100', 
        glow: 'shadow-[0_0_15px_rgba(52,211,153,0.3)]',
        accent: 'emerald'
      };
    case PersonalityType.FRIEND:
      return { 
        shadow: 'shadow-amber-200/50', 
        dot: 'bg-amber-400', 
        border: 'border-amber-100', 
        ring: 'ring-amber-100', 
        button: 'hover:bg-amber-50 text-amber-700 border-amber-100', 
        glow: 'shadow-[0_0_15px_rgba(251,191,36,0.3)]',
        accent: 'amber'
      };
    case PersonalityType.ELDER:
      return { 
        shadow: 'shadow-stone-300/50', 
        dot: 'bg-stone-400', 
        border: 'border-stone-200', 
        ring: 'ring-stone-200', 
        button: 'hover:bg-stone-100 text-stone-700 border-stone-200', 
        glow: 'shadow-[0_0_15px_rgba(168,162,158,0.3)]',
        accent: 'stone'
      };
    case PersonalityType.PRAYER:
      return { 
        shadow: 'shadow-violet-200/50', 
        dot: 'bg-violet-400', 
        border: 'border-violet-100', 
        ring: 'ring-violet-100', 
        button: 'hover:bg-violet-50 text-violet-700 border-violet-100', 
        glow: 'shadow-[0_0_15px_rgba(167,139,250,0.3)]',
        accent: 'violet'
      };
    default:
      return { 
        shadow: 'shadow-stone-200/50', 
        dot: 'bg-stone-400', 
        border: 'border-stone-100', 
        ring: 'ring-stone-100', 
        button: 'hover:bg-stone-100 text-stone-700 border-stone-200', 
        glow: '',
        accent: 'primary'
      };
  }
};

const getThinkingLabel = (lang: LanguageCode) => {
  const labels: Record<LanguageCode, string> = {
    en: 'Thinking...',
    es: 'Pensando...',
    fr: 'Réflexion...',
    ja: '考え中...',
    de: 'Überlegt...',
    ar: 'يفكر...',
    ko: '생각 중...',
    zh: '思考中...'
  };
  return labels[lang] || labels.en;
};

const AudioPlayer: React.FC<{ 
  url: string; 
  styles: any; 
  isUser: boolean; 
  onPlayStateChange?: (playing: boolean) => void;
  isPlayingGlobal?: boolean;
}> = ({ url, styles, isUser, onPlayStateChange, isPlayingGlobal }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    if (isPlayingGlobal === false && isPlaying) {
      audioRef.current?.pause();
      setIsPlaying(false);
    }
  }, [isPlayingGlobal]);

  const togglePlay = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    soundService.playSoftClick();
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    const newState = !isPlaying;
    setIsPlaying(newState);
    onPlayStateChange?.(newState);
  };

  const handleEnded = () => {
    setIsPlaying(false);
    onPlayStateChange?.(false);
  };

  return (
    <div className={`flex items-center gap-3 p-2 mb-2 rounded-2xl transition-colors ${isUser ? 'bg-white/10' : 'bg-stone-50'}`}>
      <button 
        onClick={togglePlay} 
        className={`w-9 h-9 rounded-full flex items-center justify-center transition-all active:scale-90 shadow-sm ${isUser ? 'bg-white/20 hover:bg-white/30 text-white' : `bg-white hover:bg-${styles.accent}-50 text-${styles.accent}-600 border border-stone-100`}`}
      >
        {isPlaying ? <Pause size={16} fill="currentColor" /> : <Play size={16} fill="currentColor" className="ml-0.5"/>}
      </button>
      <div className="flex flex-col flex-1 gap-1">
         <div className={`h-1.5 w-full rounded-full overflow-hidden ${isUser ? 'bg-white/20' : 'bg-stone-200'}`}>
             <div 
               className={`h-full transition-all duration-300 ${isUser ? 'bg-white' : styles.dot} ${isPlaying ? 'animate-pulse opacity-100' : 'opacity-0'}`} 
               style={{ width: '100%' }}
             />
         </div>
         <div className="flex justify-between items-center">
            <span className={`text-[10px] font-bold uppercase tracking-tight ${isUser ? 'text-white/60' : 'text-stone-400'}`}>Voice Response</span>
            {isPlaying && (
              <div className="flex gap-0.5 items-end h-2">
                {[1, 2, 3, 2, 1].map((h, i) => (
                  <div key={i} className={`w-0.5 rounded-full ${isUser ? 'bg-white/60' : styles.dot}`} style={{ height: `${h * 20}%`, animation: `pulse-slow ${0.5 + i * 0.1}s infinite` }} />
                ))}
              </div>
            )}
         </div>
      </div>
      <audio ref={audioRef} src={url} onEnded={handleEnded} className="hidden" />
    </div>
  );
};

const TextChat: React.FC<Props> = ({ personality, language, onLanguageChange, onBack, avatarUrl }) => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem(`chat_history_${personality.id}`);
    if (saved) {
      try {
        return JSON.parse(saved).map((m: any) => ({ ...m, timestamp: new Date(m.timestamp), isStreaming: false }));
      } catch (e) { console.error(e); }
    }
    return [{ id: 'init', role: MessageRole.MODEL, text: `Hello. I am here as your ${personality.title}. How is your heart today?`, timestamp: new Date() }];
  });
  
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDictating, setIsDictating] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);
  const [isTranslatingId, setIsTranslatingId] = useState<string | null>(null);

  const [generatingAudioId, setGeneratingAudioId] = useState<string | null>(null);
  const [activeAudioId, setActiveAudioId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  useEffect(() => { scrollToBottom(); }, [messages, suggestions]);

  useEffect(() => {
    try { localStorage.setItem(`chat_history_${personality.id}`, JSON.stringify(messages)); } catch (e) { console.warn(e); }
  }, [messages, personality.id]);

  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    if (lastMsg && lastMsg.role === MessageRole.MODEL && !lastMsg.isStreaming && suggestions.length === 0) {
      generateQuickReplies(mapMessagesToContent(messages), personality, language).then(setSuggestions);
    }
  }, [language]);

  const mapMessagesToContent = (msgs: ChatMessage[]): Content[] => {
     return msgs.map(m => {
        const parts: Part[] = [];
        if (m.text) parts.push({ text: m.text });
        if (m.audioBase64) parts.push({ inlineData: { data: m.audioBase64, mimeType: m.audioMimeType || 'audio/webm' } });
        return { role: m.role, parts: parts };
     });
  };

  const toggleDictation = () => {
    soundService.playClick();
    if (isDictating) { recognitionRef.current?.stop(); setIsDictating(false); return; }
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitRecognition;
    if (!SpeechRecognition) { alert("Speech recognition not supported."); return; }
    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.lang = language; 
    recognition.onstart = () => { setIsDictating(true); soundService.playStartRecord(); };
    recognition.onresult = (event: any) => {
      const current = event.resultIndex;
      const transcript = event.results[current][0].transcript;
      setInputText(prev => (prev + ' ' + transcript).trimStart());
    };
    recognition.onerror = () => setIsDictating(false);
    recognition.onend = () => setIsDictating(false);
    recognitionRef.current = recognition;
    recognition.start();
  };

  const handleTranslate = async (e: React.MouseEvent, msg: ChatMessage) => {
    e.stopPropagation();
    if (isTranslatingId) return;
    soundService.playClick();
    setIsTranslatingId(msg.id);
    try {
      if (msg.translatedText) {
        setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, translatedText: undefined } : m));
      } else {
        const translation = await translateText(msg.text, language);
        if (translation) {
          setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, translatedText: translation } : m));
        }
      }
    } catch (e) {
      soundService.playError();
    } finally {
      setIsTranslatingId(null);
    }
  };

  const handleSend = async (textOverride?: string) => {
    const textToSend = textOverride || inputText;
    if (!textToSend.trim() || isLoading) return;
    soundService.playSend();
    if (isDictating) { recognitionRef.current?.stop(); setIsDictating(false); }
    const userMsg: ChatMessage = { id: Date.now().toString(), role: MessageRole.USER, text: textToSend, timestamp: new Date() };
    processMessageSend(userMsg);
    setInputText('');
  };

  const processMessageSend = async (userMsg: ChatMessage) => {
    setMessages(prev => [...prev, userMsg]);
    setSuggestions([]);
    setIsLoading(true);
    let messagePart: string | Part[] = userMsg.text;
    if (userMsg.audioBase64) {
        messagePart = [{ inlineData: { data: userMsg.audioBase64, mimeType: userMsg.audioMimeType || 'audio/webm' } }];
        if (userMsg.text) (messagePart as Part[]).push({ text: userMsg.text });
    }
    try {
      const generator = streamChatResponse(mapMessagesToContent(messages), messagePart, personality, language);
      const modelMsgId = (Date.now() + 1).toString();
      setMessages(prev => [...prev, { id: modelMsgId, role: MessageRole.MODEL, text: '', timestamp: new Date(), isStreaming: true }]);
      soundService.playReceive();
      let fullText = '';
      for await (const chunk of generator) {
        fullText += chunk;
        setMessages(prev => prev.map(m => m.id === modelMsgId ? { ...m, text: fullText } : m));
      }
      setMessages(prev => prev.map(m => m.id === modelMsgId ? { ...m, isStreaming: false } : m));
      generateQuickReplies(mapMessagesToContent([...messages, userMsg, { id: modelMsgId, role: MessageRole.MODEL, text: fullText, timestamp: new Date() }]), personality, language).then(setSuggestions);
    } catch (error) {
      console.error(error);
      soundService.playError();
      setMessages(prev => [...prev, { id: Date.now().toString(), role: MessageRole.MODEL, text: "I'm having trouble connecting.", timestamp: new Date() }]);
    } finally { setIsLoading(false); }
  };

  const handleFeedback = (e: React.MouseEvent, id: string, feedback: 'up' | 'down') => {
    e.stopPropagation();
    soundService.playSoftClick();
    setMessages(prev => prev.map(m => m.id === id ? { ...m, feedback } : m));
  };

  const handleSpeak = async (msg: ChatMessage) => {
    if (generatingAudioId) return;
    setGeneratingAudioId(msg.id);
    soundService.playClick();
    try {
        const textToSpeak = msg.translatedText || msg.text;
        const base64 = await generateSpeech(textToSpeak, personality);
        if (base64) {
            const bytes = base64ToUint8Array(base64);
            const pcmData = new Int16Array(bytes.buffer);
            const wavBlob = pcmToWav(pcmData);
            const url = URL.createObjectURL(wavBlob);
            setMessages(prev => prev.map(m => m.id === msg.id ? { ...m, audioUrl: url } : m));
            // Automatically play after generation
            setActiveAudioId(msg.id);
        }
    } catch (e) {
        soundService.playError();
    } finally { setGeneratingAudioId(null); }
  };

  const handleBubbleTap = (msg: ChatMessage) => {
    if (msg.role === MessageRole.USER || msg.isStreaming) return;
    
    if (msg.audioUrl) {
      // Toggle existing playback
      if (activeAudioId === msg.id) {
        setActiveAudioId(null);
      } else {
        setActiveAudioId(msg.id);
      }
    } else {
      // Generate if not present
      handleSpeak(msg);
    }
  };

  const styles = getPersonalityStyles(personality.id);

  return (
    <div className="flex flex-col h-full bg-stone-50/50 relative overflow-hidden">
      {avatarUrl && (
        <div className="absolute inset-0 z-0 opacity-10 pointer-events-none transition-opacity duration-1000" style={{ backgroundImage: `url(${avatarUrl})`, backgroundSize: 'cover', backgroundPosition: 'center', filter: 'blur(20px) saturate(1.2)' }} />
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white/90 backdrop-blur-md border-b border-stone-100 shadow-sm z-20">
        <div className="flex items-center gap-4">
          <div className={`rounded-full overflow-hidden border-2 border-white shadow-sm w-12 h-12 ${avatarUrl ? 'p-0' : 'p-2 ' + personality.color.split(' ')[0]}`}>
             {avatarUrl ? <img src={avatarUrl} alt={personality.title} className="w-full h-full object-cover" /> : getIcon(personality.icon, "w-full h-full")}
          </div>
          <div>
            <h2 className="font-serif font-medium text-xl text-stone-800">{personality.title}</h2>
            <div className="flex items-center gap-2">
               <span className="text-[10px] text-stone-500 uppercase tracking-widest font-bold">Text Session</span>
               <button 
                onClick={() => setIsLanguageMenuOpen(!isLanguageMenuOpen)}
                className="flex items-center gap-1.5 px-2 py-0.5 bg-stone-100 rounded-full hover:bg-stone-200 transition-colors"
               >
                 <span className="text-xs">{SUPPORTED_LANGUAGES.find(l => l.code === language)?.flag}</span>
                 <span className="text-[10px] font-bold text-stone-600 uppercase">{language}</span>
               </button>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
            <button 
              onClick={() => { soundService.playClick(); setMessages([{ id: Date.now().toString(), role: MessageRole.MODEL, text: `Hello. I am here as your ${personality.title}. How is your heart today?`, timestamp: new Date() }]); }}
              className="p-2 text-stone-400 hover:text-red-500 transition-colors bg-stone-50 hover:bg-red-50 rounded-lg border border-stone-100"
            >
              <Trash2 size={18} />
            </button>
            <button onClick={() => { soundService.playClick(); onBack(); }} className="text-sm text-stone-500 hover:text-stone-800 transition-colors bg-stone-100 hover:bg-stone-200 px-3 py-2 rounded-lg border border-stone-200/50">
              End Session
            </button>
        </div>

        {isLanguageMenuOpen && (
          <div className="absolute top-16 left-1/2 -translate-x-1/2 w-48 bg-white border border-stone-100 rounded-2xl shadow-xl p-2 z-50 grid grid-cols-2 gap-1 animate-in fade-in zoom-in duration-200">
             {SUPPORTED_LANGUAGES.map((lang) => (
                <button 
                  key={lang.code}
                  onClick={() => { onLanguageChange(lang.code); setIsLanguageMenuOpen(false); soundService.playClick(); }}
                  className={`flex items-center gap-2 p-2 rounded-xl text-sm transition-colors ${language === lang.code ? 'bg-primary text-white' : 'hover:bg-stone-50 text-stone-700'}`}
                >
                  <span>{lang.flag}</span>
                  <span className="font-medium">{lang.label}</span>
                </button>
             ))}
          </div>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 relative z-10">
        {messages.map((msg) => {
          const isUser = msg.role === MessageRole.USER;
          const isTyping = !isUser && msg.isStreaming && msg.text.length === 0;
          const isPlaying = activeAudioId === msg.id;
          const displayText = msg.translatedText || msg.text;

          return (
            <div key={msg.id} className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'} group animate-in fade-in slide-in-from-bottom-2 duration-300`}>
              <div className={`flex max-w-[85%] sm:max-w-[70%] gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center mt-auto overflow-hidden shadow-sm ring-2 ring-white ${isUser ? 'bg-primary text-white' : personality.color.split(' ')[0] + ' border border-white'}`}>
                  {isUser ? <User size={16} /> : (avatarUrl ? <img src={avatarUrl} alt={personality.title} className="w-full h-full object-cover" /> : getIcon(personality.icon, "w-5 h-5"))}
                </div>

                <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} min-w-0`}>
                  <div 
                    onClick={() => handleBubbleTap(msg)}
                    className={`relative p-4 sm:p-5 rounded-3xl text-sm sm:text-base leading-relaxed transition-all duration-300 cursor-pointer overflow-hidden
                      ${isUser ? 'bg-primary text-white rounded-br-none shadow-md shadow-primary/20' : 
                      `bg-white/95 backdrop-blur-sm text-stone-800 rounded-bl-none border ${styles.border} shadow-lg ${styles.shadow}`}
                      ${isTyping ? `animate-pulse-slow ${styles.glow}` : ''}
                      ${isPlaying ? `ring-4 ${styles.ring} ring-opacity-50 border-transparent` : ''}
                    `}
                  >
                    {/* Audio Player Header */}
                    {msg.audioUrl && (
                      <div className="animate-in slide-in-from-top duration-300">
                        <AudioPlayer 
                          url={msg.audioUrl} 
                          styles={styles} 
                          isUser={isUser} 
                          isPlayingGlobal={isPlaying}
                          onPlayStateChange={(playing) => {
                            if (playing) setActiveAudioId(msg.id);
                            else if (activeAudioId === msg.id) setActiveAudioId(null);
                          }}
                        />
                      </div>
                    )}

                    {isTyping ? (
                      <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-1.5 py-1 px-1 h-6">
                          <div className={`w-2.5 h-2.5 rounded-full animate-[bounce_1s_infinite_-0.32s] ${styles.dot} ${styles.glow}`} />
                          <div className={`w-2.5 h-2.5 rounded-full animate-[bounce_1s_infinite_-0.16s] ${styles.dot} ${styles.glow}`} />
                          <div className={`w-2.5 h-2.5 rounded-full animate-[bounce_1s_infinite] ${styles.dot} ${styles.glow}`} />
                        </div>
                        <span className={`text-[10px] font-bold uppercase tracking-widest animate-pulse transition-colors ${styles.dot.replace('bg-', 'text-')}`}>
                          {getThinkingLabel(language)}
                        </span>
                      </div>
                    ) : (
                      <>
                        <div className="flex flex-col gap-1">
                          {msg.translatedText && <span className="text-[10px] text-primary font-bold uppercase tracking-widest flex items-center gap-1 mb-1"><Globe size={10}/> Translated to {getLanguageLabel(language)}</span>}
                          {displayText}
                        </div>
                        {msg.isStreaming && <span className="inline-block w-1.5 h-4 ml-1 align-middle bg-current animate-pulse"/>}
                      </>
                    )}

                    {/* Ripple effect when playing */}
                    {isPlaying && (
                      <div className={`absolute bottom-0 right-0 w-16 h-16 opacity-10 pointer-events-none transition-transform duration-1000 transform scale-150`}>
                        <Waves size={64} className={`animate-pulse ${styles.dot.replace('bg-', 'text-')}`} />
                      </div>
                    )}
                  </div>

                  {!isUser && !msg.isStreaming && !isTyping && (
                     <div className={`flex items-center gap-2 mt-2 ml-1 transition-opacity duration-200 ${msg.feedback || generatingAudioId || isTranslatingId === msg.id || isPlaying ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleSpeak(msg); }} 
                          disabled={!!generatingAudioId} 
                          className={`p-1.5 rounded-full transition-all active:scale-95 ${generatingAudioId === msg.id ? `text-${styles.accent}-600 bg-${styles.accent}-50` : 'text-stone-300 hover:text-stone-500 hover:bg-stone-100'}`}
                          title="Generate Voice"
                        >
                           {generatingAudioId === msg.id ? (
                             <div className="flex items-center gap-2 px-1">
                                <Loader size={14} className="animate-spin" />
                                <span className="text-[10px] font-bold uppercase">Synthesizing...</span>
                             </div>
                           ) : <Volume2 size={16} />}
                        </button>
                        <button onClick={(e) => handleTranslate(e, msg)} className={`p-1.5 rounded-full transition-all active:scale-95 ${msg.translatedText ? 'text-primary bg-primary/10' : 'text-stone-300 hover:text-stone-500 hover:bg-stone-100'}`} title="Translate message">
                           {isTranslatingId === msg.id ? <Loader size={14} className="animate-spin" /> : <Languages size={16} />}
                        </button>
                        <div className="w-px h-4 bg-stone-100 mx-1" />
                        <button onClick={(e) => handleFeedback(e, msg.id, 'up')} className={`p-1.5 rounded-full transition-all active:scale-95 ${msg.feedback === 'up' ? 'text-emerald-500 bg-emerald-50' : 'text-stone-300 hover:text-stone-500 hover:bg-stone-100'}`}><ThumbsUp size={14} fill={msg.feedback === 'up' ? "currentColor" : "none"} /></button>
                        <button onClick={(e) => handleFeedback(e, msg.id, 'down')} className={`p-1.5 rounded-full transition-all active:scale-95 ${msg.feedback === 'down' ? 'text-red-500 bg-red-50' : 'text-stone-300 hover:text-stone-500 hover:bg-stone-100'}`}><ThumbsDown size={14} fill={msg.feedback === 'down' ? "currentColor" : "none"} /></button>
                     </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="bg-white/90 backdrop-blur-md border-t border-stone-100 z-10 p-4">
        {!isLoading && suggestions.length > 0 && (
          <div className="max-w-4xl mx-auto pb-3 flex gap-2 overflow-x-auto no-scrollbar scroll-smooth">
             {suggestions.map((s, i) => <button key={i} onClick={() => handleSend(s)} className={`flex-shrink-0 text-sm px-4 py-2 rounded-full border bg-white shadow-sm transition-all active:scale-95 whitespace-nowrap ${styles.button} animate-in fade-in zoom-in duration-300`} style={{ animationDelay: `${i * 50}ms` }}>{s}</button>)}
          </div>
        )}
        <div className="max-w-4xl mx-auto flex gap-3 items-center">
          <button onClick={toggleDictation} className={`relative p-3 rounded-2xl transition-all flex items-center justify-center shadow-sm border border-transparent ${isDictating ? 'bg-primary text-white shadow-lg' : 'bg-stone-100 text-stone-400'}`}>
            {isDictating && <span className="absolute inset-0 rounded-2xl bg-primary opacity-40 animate-ping"></span>}
            {isDictating ? <AudioLines className="w-5 h-5 animate-pulse" /> : <Mic className="w-5 h-5" />}
          </button>
          <input 
            type="text" 
            value={inputText} 
            onChange={(e) => setInputText(e.target.value)} 
            onKeyDown={(e) => e.key === 'Enter' && handleSend()} 
            placeholder={isDictating ? "Listening..." : "Type your message..."} 
            disabled={isLoading} 
            className="flex-1 bg-stone-100/50 border border-stone-100 text-stone-800 rounded-2xl px-5 py-3 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-stone-400 font-medium" 
          />
          <button onClick={() => handleSend()} disabled={isLoading || !inputText.trim()} className="bg-primary hover:bg-primary/90 disabled:opacity-50 text-white p-3 rounded-2xl transition-all shadow-lg active:scale-90"><Send size={18} /></button>
        </div>
      </div>
    </div>
  );
};

export default TextChat;
