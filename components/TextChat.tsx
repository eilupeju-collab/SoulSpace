import React, { useState, useRef, useEffect } from 'react';
import { ChatMessage, MessageRole, PersonalityConfig, PersonalityType } from '../types';
import { streamChatResponse, generateQuickReplies, generateSpeech } from '../services/geminiService';
import { Send, User, Sparkles, Mic, MicOff, Trash2, StopCircle, X, Play, Pause, ThumbsUp, ThumbsDown, Volume2, Loader, AudioLines } from 'lucide-react';
import { getIcon } from '../constants';
import { blobToBase64, base64ToUint8Array, pcmToWav } from '../services/audioUtils';
import { Content, Part } from '@google/genai';
import { soundService } from '../services/soundService';

interface Props {
  personality: PersonalityConfig;
  onBack: () => void;
  avatarUrl?: string;
}

// Helper to get personality-specific styling classes
const getPersonalityStyles = (type: PersonalityType) => {
  switch (type) {
    case PersonalityType.MENTOR:
      return { 
        shadow: 'shadow-emerald-200/50', 
        dot: 'bg-emerald-400', 
        border: 'border-emerald-100',
        ring: 'ring-emerald-100',
        button: 'hover:bg-emerald-50 text-emerald-700 border-emerald-100',
        fill: 'fill-emerald-500'
      };
    case PersonalityType.FRIEND:
      return { 
        shadow: 'shadow-amber-200/50', 
        dot: 'bg-amber-400', 
        border: 'border-amber-100',
        ring: 'ring-amber-100',
        button: 'hover:bg-amber-50 text-amber-700 border-amber-100',
        fill: 'fill-amber-500'
      };
    case PersonalityType.ELDER:
      return { 
        shadow: 'shadow-stone-300/50', 
        dot: 'bg-stone-400', 
        border: 'border-stone-200',
        ring: 'ring-stone-200',
        button: 'hover:bg-stone-100 text-stone-700 border-stone-200',
        fill: 'fill-stone-500'
      };
    case PersonalityType.PRAYER:
      return { 
        shadow: 'shadow-violet-200/50', 
        dot: 'bg-violet-400', 
        border: 'border-violet-100',
        ring: 'ring-violet-100',
        button: 'hover:bg-violet-50 text-violet-700 border-violet-100',
        fill: 'fill-violet-500'
      };
    default:
      return { 
        shadow: 'shadow-stone-200/50', 
        dot: 'bg-stone-400', 
        border: 'border-stone-100',
        ring: 'ring-stone-100',
        button: 'hover:bg-stone-100 text-stone-700 border-stone-200',
        fill: 'fill-stone-500'
      };
  }
};

const AudioPlayer: React.FC<{ url: string; styles: any; isUser: boolean }> = ({ url, styles, isUser }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const audioRef = useRef<HTMLAudioElement>(null);
  
  const togglePlay = () => {
    soundService.playSoftClick();
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  const handleEnded = () => setIsPlaying(false);

  return (
    <div className={`flex items-center gap-3 p-1 min-w-[140px] ${isUser ? 'text-white' : 'text-stone-700'}`}>
      <button 
        onClick={togglePlay}
        className={`w-8 h-8 rounded-full flex items-center justify-center transition-transform active:scale-95
          ${isUser ? 'bg-white/20 hover:bg-white/30 text-white' : 'bg-stone-100 hover:bg-stone-200 text-stone-600'}`}
      >
        {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" className="ml-0.5"/>}
      </button>
      <div className="flex flex-col flex-1 gap-1">
         <div className={`h-1 w-full rounded-full overflow-hidden ${isUser ? 'bg-white/30' : 'bg-stone-200'}`}>
             <div className={`h-full animate-pulse-slow ${isUser ? 'bg-white' : styles.dot} ${isPlaying ? 'opacity-100' : 'opacity-0'}`} style={{ width: '100%' }}></div>
         </div>
         <span className={`text-[10px] font-medium ${isUser ? 'text-white/80' : 'text-stone-400'}`}>Voice Note</span>
      </div>
      <audio ref={audioRef} src={url} onEnded={handleEnded} className="hidden" />
    </div>
  );
};

const TextChat: React.FC<Props> = ({ personality, onBack, avatarUrl }) => {
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    const saved = localStorage.getItem(`chat_history_${personality.id}`);
    if (saved) {
      try {
        return JSON.parse(saved).map((m: any) => ({
          ...m,
          timestamp: new Date(m.timestamp),
          isStreaming: false
        }));
      } catch (e) {
        console.error("Error parsing history:", e);
      }
    }
    return [
      {
        id: 'init',
        role: MessageRole.MODEL,
        text: `Hello. I am here as your ${personality.title}. How is your heart today?`,
        timestamp: new Date()
      }
    ];
  });
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isDictating, setIsDictating] = useState(false);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  
  // Voice Recording State
  const [isRecordingAudio, setIsRecordingAudio] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<number | null>(null);
  
  // TTS State
  const [generatingAudioId, setGeneratingAudioId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, suggestions]);

  // Persist messages to localStorage
  useEffect(() => {
    // Avoid storing very large audio blobs in localStorage if possible, or handle quota errors
    try {
      localStorage.setItem(`chat_history_${personality.id}`, JSON.stringify(messages));
    } catch (e) {
      console.warn("LocalStorage quota exceeded, cannot save chat history.");
    }
  }, [messages, personality.id]);

  // Initial suggestion generation
  useEffect(() => {
    const lastMsg = messages[messages.length - 1];
    if (lastMsg && lastMsg.role === MessageRole.MODEL && !lastMsg.isStreaming && suggestions.length === 0) {
      const history = mapMessagesToContent(messages);
      generateQuickReplies(history, personality).then(setSuggestions);
    }
  }, []);

  // Cleanup speech recognition and recording on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (timerRef.current) {
         clearInterval(timerRef.current);
      }
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
         mediaRecorderRef.current.stop();
      }
    };
  }, []);

  // --- Helper: Map internal ChatMessage to Gemini Content ---
  const mapMessagesToContent = (msgs: ChatMessage[]): Content[] => {
     return msgs.map(m => {
        const parts: Part[] = [];
        if (m.text) parts.push({ text: m.text });
        if (m.audioBase64) {
           parts.push({ 
             inlineData: { 
               data: m.audioBase64, 
               mimeType: m.audioMimeType || 'audio/webm' 
             } 
           });
        }
        return {
           role: m.role,
           parts: parts
        };
     });
  };

  // --- Dictation Logic ---
  const toggleDictation = () => {
    soundService.playClick();
    if (isDictating) {
      recognitionRef.current?.stop();
      setIsDictating(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onstart = () => {
        setIsDictating(true);
        soundService.playStartRecord();
    };
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

  // --- Voice Note Logic ---
  const startRecordingAudio = async () => {
     try {
       soundService.playStartRecord();
       const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
       const mediaRecorder = new MediaRecorder(stream);
       mediaRecorderRef.current = mediaRecorder;
       audioChunksRef.current = [];

       mediaRecorder.ondataavailable = (event) => {
         if (event.data.size > 0) {
           audioChunksRef.current.push(event.data);
         }
       };

       mediaRecorder.start();
       setIsRecordingAudio(true);
       setRecordingDuration(0);

       timerRef.current = window.setInterval(() => {
          setRecordingDuration(prev => prev + 1);
       }, 1000);

     } catch (err) {
       console.error("Error accessing microphone for voice note:", err);
       soundService.playError();
       alert("Could not access microphone.");
     }
  };

  const stopRecordingAudio = (shouldSend: boolean) => {
    if (!mediaRecorderRef.current) return;
    
    soundService.playStopRecord();

    if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
    }

    mediaRecorderRef.current.onstop = async () => {
       const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
       const tracks = mediaRecorderRef.current?.stream.getTracks();
       tracks?.forEach(track => track.stop()); // Stop mic
       
       if (shouldSend) {
          await handleSendAudio(audioBlob);
       }
       
       setIsRecordingAudio(false);
       setRecordingDuration(0);
    };

    mediaRecorderRef.current.stop();
  };

  const cancelRecording = () => {
     soundService.playClick();
     stopRecordingAudio(false);
  };

  const formatDuration = (seconds: number) => {
     const m = Math.floor(seconds / 60);
     const s = seconds % 60;
     return `${m}:${s.toString().padStart(2, '0')}`;
  };

  const handleClearChat = () => {
    soundService.playClick();
    if (window.confirm("Are you sure you want to clear your chat history?")) {
      localStorage.removeItem(`chat_history_${personality.id}`);
      setMessages([{
          id: Date.now().toString(),
          role: MessageRole.MODEL,
          text: `Hello. I am here as your ${personality.title}. How is your heart today?`,
          timestamp: new Date()
      }]);
      setSuggestions([]);
    }
  };

  const handleBackWithSound = () => {
    soundService.playClick();
    onBack();
  };

  const handleFeedback = (msgId: string, type: 'up' | 'down') => {
    soundService.playSoftClick();
    setMessages(prev => prev.map(m => {
      if (m.id === msgId) {
        const newFeedback = m.feedback === type ? undefined : type;
        return { ...m, feedback: newFeedback };
      }
      return m;
    }));
  };

  const handleSpeak = async (msg: ChatMessage) => {
    if (generatingAudioId) return;
    setGeneratingAudioId(msg.id);
    soundService.playClick();
    
    try {
        const base64 = await generateSpeech(msg.text, personality);
        if (base64) {
            const bytes = base64ToUint8Array(base64);
            const pcmData = new Int16Array(bytes.buffer);
            const wavBlob = pcmToWav(pcmData);
            const url = URL.createObjectURL(wavBlob);
            
            setMessages(prev => prev.map(m => 
                m.id === msg.id ? { ...m, audioUrl: url } : m
            ));
        }
    } catch (e) {
        console.error("Failed to speak", e);
        soundService.playError();
    } finally {
        setGeneratingAudioId(null);
    }
  };

  // --- Send Logic (Text & Audio) ---
  const handleSend = async (textOverride?: string) => {
    const textToSend = textOverride || inputText;
    if (!textToSend.trim() || isLoading) return;

    soundService.playSend();

    if (isDictating) {
      recognitionRef.current?.stop();
      setIsDictating(false);
    }

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: MessageRole.USER,
      text: textToSend,
      timestamp: new Date()
    };

    processMessageSend(userMsg);
    setInputText('');
  };

  const handleSendAudio = async (blob: Blob) => {
      if (isLoading) return;
      
      soundService.playSend();
      
      const base64 = await blobToBase64(blob);
      const url = URL.createObjectURL(blob);

      const userMsg: ChatMessage = {
          id: Date.now().toString(),
          role: MessageRole.USER,
          text: "", // Empty text for audio-only message
          audioUrl: url,
          audioBase64: base64,
          audioMimeType: 'audio/webm',
          timestamp: new Date()
      };

      processMessageSend(userMsg);
  };

  const processMessageSend = async (userMsg: ChatMessage) => {
    setMessages(prev => [...prev, userMsg]);
    setSuggestions([]);
    setIsLoading(true);

    const currentHistory = mapMessagesToContent([...messages, userMsg]);
    
    // Prepare message part for stream function
    let messagePart: string | Part[] = userMsg.text;
    if (userMsg.audioBase64) {
        messagePart = [{
            inlineData: { data: userMsg.audioBase64, mimeType: userMsg.audioMimeType || 'audio/webm' }
        }];
        if (userMsg.text) {
            (messagePart as Part[]).push({ text: userMsg.text });
        }
    }

    try {
      const generator = streamChatResponse(
          mapMessagesToContent(messages), // History (excluding current)
          messagePart, // Current Message
          personality
      );
      
      const modelMsgId = (Date.now() + 1).toString();
      setMessages(prev => [...prev, {
        id: modelMsgId,
        role: MessageRole.MODEL,
        text: '',
        timestamp: new Date(),
        isStreaming: true
      }]);
      
      soundService.playReceive();

      let fullText = '';
      for await (const chunk of generator) {
        fullText += chunk;
        setMessages(prev => prev.map(m => 
          m.id === modelMsgId ? { ...m, text: fullText } : m
        ));
      }
      
      setMessages(prev => prev.map(m => 
        m.id === modelMsgId ? { ...m, isStreaming: false } : m
      ));

      // Generate new suggestions
      const updatedHistory = [...currentHistory, { role: 'model', parts: [{ text: fullText }] }];
      generateQuickReplies(updatedHistory, personality).then(setSuggestions);

    } catch (error) {
      console.error("Chat error:", error);
      soundService.playError();
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        role: MessageRole.MODEL,
        text: "I'm having a little trouble connecting right now. Can we try again?",
        timestamp: new Date()
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const styles = getPersonalityStyles(personality.id);

  return (
    <div className="flex flex-col h-full bg-stone-50/50 relative overflow-hidden">
      
      {/* Immersive Background */}
      {avatarUrl && (
        <div 
            className="absolute inset-0 z-0 opacity-10 pointer-events-none transition-opacity duration-1000"
            style={{ 
                backgroundImage: `url(${avatarUrl})`, 
                backgroundSize: 'cover', 
                backgroundPosition: 'center',
                filter: 'blur(20px) saturate(1.2)'
            }}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-white/90 backdrop-blur-md border-b border-stone-100 shadow-sm z-10">
        <div className="flex items-center gap-4">
          <div className={`rounded-full overflow-hidden border-2 border-white shadow-sm transition-all ${personality.color.split(' ')[0]} ${avatarUrl ? 'w-12 h-12 p-0' : 'w-12 h-12 p-2'}`}>
             {avatarUrl ? (
               <img src={avatarUrl} alt={personality.title} className="w-full h-full object-cover" />
             ) : (
               getIcon(personality.icon, "w-full h-full")
             )}
          </div>
          <div>
            <h2 className="font-serif font-medium text-xl text-stone-800">{personality.title}</h2>
            <p className="text-xs text-stone-500 uppercase tracking-wider font-medium">Text Session</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
            <button 
              onClick={handleClearChat}
              className="p-2 text-stone-400 hover:text-red-500 transition-colors bg-stone-50 hover:bg-red-50 rounded-lg border border-stone-100"
              title="Clear Chat History"
            >
              <Trash2 size={18} />
            </button>
            <button onClick={handleBackWithSound} className="text-sm text-stone-500 hover:text-stone-800 transition-colors bg-stone-100 hover:bg-stone-200 px-3 py-2 rounded-lg border border-stone-200/50">
              End Session
            </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 relative z-10">
        {messages.map((msg) => {
          const isUser = msg.role === MessageRole.USER;
          const isTyping = !isUser && msg.isStreaming && msg.text.length === 0;

          return (
            <div key={msg.id} className={`flex w-full ${isUser ? 'justify-end' : 'justify-start'} group`}>
              <div className={`flex max-w-[85%] sm:max-w-[70%] gap-3 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                
                {/* Avatar */}
                <div className={`flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center mt-auto overflow-hidden shadow-sm ring-2 ring-white
                  ${isUser ? 'bg-primary text-white' : `${personality.color.split(' ')[0]} border border-white`}`}>
                  {isUser ? (
                     <User size={16} />
                  ) : avatarUrl ? (
                     <img src={avatarUrl} alt={personality.title} className="w-full h-full object-cover" />
                  ) : (
                     getIcon(personality.icon, "w-5 h-5")
                  )}
                </div>

                {/* Content Wrapper */}
                <div className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} min-w-0`}>
                  {/* Bubble */}
                  <div className={`p-4 sm:p-5 rounded-3xl text-sm sm:text-base leading-relaxed transition-all duration-300
                    ${isUser 
                      ? 'bg-primary text-white rounded-br-none shadow-md shadow-primary/20' 
                      : `bg-white/95 backdrop-blur-sm text-stone-800 rounded-bl-none border ${styles.border} shadow-lg ${styles.shadow} ${isTyping ? 'ring-2 ring-opacity-50 ' + styles.ring : ''}`
                    }`}>
                    
                    {msg.audioUrl && (
                      <AudioPlayer url={msg.audioUrl} styles={styles} isUser={isUser} />
                    )}

                    {isTyping ? (
                      <div className="flex items-center gap-1.5 py-1 px-1 h-6">
                        <div className={`w-2 h-2 rounded-full animate-[bounce_1.4s_infinite_-0.32s] ${styles.dot}`} />
                        <div className={`w-2 h-2 rounded-full animate-[bounce_1.4s_infinite_-0.16s] ${styles.dot}`} />
                        <div className={`w-2 h-2 rounded-full animate-[bounce_1.4s_infinite] ${styles.dot}`} />
                      </div>
                    ) : (
                      <>
                        {msg.text}
                        {msg.isStreaming && <span className="inline-block w-1.5 h-4 ml-1 align-middle bg-current animate-pulse"/>}
                      </>
                    )}
                    
                  </div>

                  {/* Feedback Controls */}
                  {!isUser && !msg.isStreaming && !isTyping && (
                     <div className={`flex items-center gap-2 mt-2 ml-1 transition-opacity duration-200 ${msg.feedback || generatingAudioId ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'}`}>
                        {!msg.audioUrl && (
                           <button
                             onClick={() => handleSpeak(msg)}
                             disabled={!!generatingAudioId}
                             className={`p-1.5 rounded-full transition-all active:scale-95 text-stone-300 hover:text-stone-500 hover:bg-stone-100 ${generatingAudioId === msg.id ? 'opacity-100' : ''}`}
                             title="Read aloud"
                           >
                              {generatingAudioId === msg.id ? <Loader size={14} className="animate-spin" /> : <Volume2 size={14} />}
                           </button>
                        )}
                        <button 
                          onClick={() => handleFeedback(msg.id, 'up')} 
                          className={`p-1.5 rounded-full transition-all active:scale-95 ${msg.feedback === 'up' ? 'text-emerald-500 bg-emerald-50' : 'text-stone-300 hover:text-stone-500 hover:bg-stone-100'}`}
                          title="Helpful"
                        >
                           <ThumbsUp size={14} fill={msg.feedback === 'up' ? "currentColor" : "none"} />
                        </button>
                        <button 
                          onClick={() => handleFeedback(msg.id, 'down')} 
                          className={`p-1.5 rounded-full transition-all active:scale-95 ${msg.feedback === 'down' ? 'text-red-500 bg-red-50' : 'text-stone-300 hover:text-stone-500 hover:bg-stone-100'}`}
                          title="Not helpful"
                        >
                           <ThumbsDown size={14} fill={msg.feedback === 'down' ? "currentColor" : "none"} />
                        </button>
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
      <div className="bg-white/90 backdrop-blur-md border-t border-stone-100 z-10 transition-all duration-300">
        
        {/* Quick Replies */}
        {!isLoading && !isRecordingAudio && suggestions.length > 0 && (
          <div className="max-w-4xl mx-auto px-4 pt-3 pb-1 flex gap-2 overflow-x-auto no-scrollbar mask-linear-fade">
             {suggestions.map((suggestion, index) => (
               <button
                 key={index}
                 onClick={() => handleSend(suggestion)}
                 className={`flex-shrink-0 text-sm px-4 py-2 rounded-full border bg-white shadow-sm transition-all active:scale-95 whitespace-nowrap
                   ${styles.button} hover:shadow-md`}
               >
                 {suggestion}
               </button>
             ))}
          </div>
        )}

        {/* Input Controls */}
        <div className="p-4 max-w-4xl mx-auto flex gap-3 items-center">
          
          {isRecordingAudio ? (
             <div className="flex-1 flex items-center justify-between bg-red-50 border border-red-100 rounded-2xl px-5 py-3 animate-pulse-slow">
                 <div className="flex items-center gap-3 text-red-500 font-medium">
                     <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse" />
                     <span>Recording {formatDuration(recordingDuration)}</span>
                 </div>
                 <div className="flex items-center gap-2">
                     <button onClick={cancelRecording} className="p-2 text-red-400 hover:text-red-600 hover:bg-red-100 rounded-full transition-colors">
                        <X size={20} />
                     </button>
                     <button onClick={() => stopRecordingAudio(true)} className="p-2 bg-red-500 text-white rounded-full shadow-md hover:bg-red-600 transition-colors hover:scale-105 active:scale-95">
                        <Send size={18} />
                     </button>
                 </div>
             </div>
          ) : (
             <>
                <button
                  onClick={toggleDictation}
                  className={`relative p-3 rounded-2xl transition-all duration-300 flex items-center justify-center shadow-sm border border-transparent
                    ${isDictating 
                      ? 'bg-primary text-white shadow-lg shadow-primary/25' 
                      : 'bg-stone-100 text-stone-400 hover:bg-stone-200 hover:text-stone-600'
                    }`}
                  title={isDictating ? "Stop Dictation" : "Dictate Text"}
                >
                  {isDictating && (
                      <span className="absolute inset-0 rounded-2xl bg-primary opacity-40 animate-ping"></span>
                  )}
                  {isDictating ? <AudioLines className="w-5 h-5 animate-pulse" /> : <Mic className="w-5 h-5" />}
                </button>

                <input
                  type="text"
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder={isDictating ? "Listening to text..." : "Type your message..."}
                  disabled={isLoading}
                  className={`flex-1 bg-stone-50 border border-stone-200 text-stone-800 rounded-2xl px-5 py-3 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all placeholder:text-stone-400
                    ${isDictating ? 'placeholder:text-primary/70 placeholder:animate-pulse' : ''}`}
                />
                
                {inputText.trim() ? (
                  <button
                    onClick={() => handleSend()}
                    disabled={isLoading}
                    className="bg-primary hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed text-white p-3 rounded-2xl transition-all hover:scale-105 active:scale-95 flex items-center justify-center shadow-lg shadow-primary/25"
                  >
                    {isLoading ? <Sparkles className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                  </button>
                ) : (
                  <button
                    onClick={startRecordingAudio}
                    disabled={isLoading}
                    className="bg-stone-100 hover:bg-red-50 text-stone-400 hover:text-red-500 border border-stone-200 hover:border-red-100 p-3 rounded-2xl transition-all hover:scale-105 active:scale-95 flex items-center justify-center shadow-sm"
                    title="Record Voice Note"
                  >
                     <Mic className="w-5 h-5" />
                  </button>
                )}
             </>
          )}

        </div>
      </div>
    </div>
  );
};

export default TextChat;