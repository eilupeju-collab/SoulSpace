
import React, { useEffect, useState, useRef } from 'react';
import { PersonalityConfig } from '../types';
import { connectLiveSession } from '../services/geminiService';
import { Mic, PhoneOff, AlertCircle, Volume2, VolumeX } from 'lucide-react';
import { getIcon } from '../constants';
import { soundService } from '../services/soundService';

interface Props {
  personality: PersonalityConfig;
  onBack: () => void;
  avatarUrl?: string;
}

const LiveSession: React.FC<Props> = ({ personality, onBack, avatarUrl }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [isAmbienceMuted, setIsAmbienceMuted] = useState(soundService.isAmbienceMuted());
  
  const disconnectRef = useRef<(() => void) | null>(null);
  const setRecordingRef = useRef<((recording: boolean) => void) | null>(null);

  // Visualization Refs (Direct DOM manipulation for performance)
  const targetVolumeRef = useRef(0);
  const currentVolumeRef = useRef(0);
  const bgRef = useRef<HTMLDivElement>(null);
  const ring1Ref = useRef<HTMLDivElement>(null);
  const ring2Ref = useRef<HTMLDivElement>(null);
  const ring3Ref = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number>(0);

  // Start Ambience on Mount
  useEffect(() => {
    soundService.startAmbience(personality.id);
    return () => {
      soundService.stopAmbience();
    };
  }, [personality.id]);

  // Animation Loop
  useEffect(() => {
    const animate = () => {
      // Decay target volume slowly to zero if no new audio comes in
      targetVolumeRef.current *= 0.95;
      
      // Smoothly interpolate current volume towards target
      currentVolumeRef.current += (targetVolumeRef.current - currentVolumeRef.current) * 0.1;
      
      const v = currentVolumeRef.current;
      const scaleBase = 1 + v;

      // 1. Animate Background (Breathing effect)
      if (bgRef.current) {
        bgRef.current.style.transform = `scale(${1.2 + v * 0.15})`;
        // Subtly increase brightness/saturation with volume
        bgRef.current.style.filter = `blur(60px) opacity(${0.3 + v * 0.2}) saturate(${1.5 + v * 0.5})`;
      }

      // 2. Animate Rings
      if (ring1Ref.current) {
        ring1Ref.current.style.transform = `scale(${scaleBase * 1.5})`;
        ring1Ref.current.style.opacity = `${0.2 + v * 0.3}`;
      }
      if (ring2Ref.current) {
        ring2Ref.current.style.transform = `scale(${scaleBase * 1.25})`;
        ring2Ref.current.style.opacity = `${0.3 + v * 0.3}`;
      }
      if (ring3Ref.current) {
        ring3Ref.current.style.transform = `scale(${scaleBase * 1.1})`;
        ring3Ref.current.style.opacity = `${0.1 + v * 0.1}`;
      }

      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animationFrameRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameRef.current);
  }, []);

  // Voice Command Integration
  useEffect(() => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) return;

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.lang = 'en-US';

    recognition.onresult = (event: any) => {
      const lastIndex = event.results.length - 1;
      const transcript = event.results[lastIndex][0].transcript.toLowerCase();

      if (transcript.includes('start listening')) {
        if (setRecordingRef.current) {
          soundService.playStartRecord();
          setRecordingRef.current(true);
          setIsUserSpeaking(true);
        }
      } else if (transcript.includes('stop listening') || transcript.includes('stop recording')) {
        if (setRecordingRef.current) {
          soundService.playStopRecord();
          setRecordingRef.current(false);
          setIsUserSpeaking(false);
        }
      }
    };

    recognition.onerror = (e: any) => {
        // Silently handle errors
    };

    try {
        recognition.start();
    } catch(e) {
        console.debug("Voice recognition start failed", e);
    }

    return () => {
        try { recognition.stop(); } catch(e) {}
    };
  }, []);

  useEffect(() => {
    let active = true;

    const startSession = async () => {
      try {
        const { disconnect, setIsRecording } = await connectLiveSession(
          personality,
          (audioBuffer) => {
             // Calculate RMS (Root Mean Square) for volume
             const data = audioBuffer.getChannelData(0);
             let sum = 0;
             // Sample for performance
             for(let i=0; i<data.length; i+=5) {
               sum += data[i] * data[i];
             }
             const rms = Math.sqrt(sum / (data.length/5));
             
             // Update target volume for the animation loop
             // Amplify the RMS to make the visualizer more responsive
             if (active) {
                targetVolumeRef.current = Math.min(rms * 5, 2.0);
             }
          },
          () => {
             if (active) setIsConnected(false);
          }
        );
        disconnectRef.current = disconnect;
        setRecordingRef.current = setIsRecording;
        setIsConnected(true);
      } catch (err: any) {
        if (active) {
            setError("Failed to access microphone or connect. Please ensure permissions are granted.");
            setIsConnected(false);
            soundService.playError();
        }
      }
    };

    startSession();

    return () => {
      active = false;
      if (disconnectRef.current) disconnectRef.current();
    };
  }, [personality]);

  // Handle Push-to-Talk Interaction
  const startRecording = (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (setRecordingRef.current) {
      soundService.playStartRecord();
      setRecordingRef.current(true);
      setIsUserSpeaking(true);
    }
  };

  const stopRecording = (e: React.SyntheticEvent) => {
    e.preventDefault();
    if (setRecordingRef.current) {
      soundService.playStopRecord();
      setRecordingRef.current(false);
      setIsUserSpeaking(false);
    }
  };

  const handleDisconnect = () => {
      soundService.playClick();
      onBack();
  };

  const toggleAmbience = () => {
      soundService.playClick();
      const muted = soundService.toggleAmbienceMute();
      setIsAmbienceMuted(muted);
  };

  const themeColor = personality.color.split(' ')[0].replace('bg-', 'bg-');

  return (
    <div className="flex flex-col h-full bg-stone-50 relative overflow-hidden select-none">
      
      {/* Background Decor & Ambience */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
         {avatarUrl ? (
            <div 
                ref={bgRef}
                className="absolute inset-0 transition-transform duration-100 ease-out will-change-transform"
                style={{ 
                    backgroundImage: `url(${avatarUrl})`, 
                    backgroundSize: 'cover', 
                    backgroundPosition: 'center',
                    filter: 'blur(60px) opacity(0.3) saturate(1.5)',
                    transform: 'scale(1.2)'
                }}
            />
         ) : (
             <div ref={bgRef} className="w-full h-full relative will-change-transform">
                <div className={`absolute top-[-10%] left-[-10%] w-[50vh] h-[50vh] rounded-full blur-3xl opacity-30 ${themeColor}`} />
                <div className="absolute bottom-[-10%] right-[-10%] w-[60vh] h-[60vh] rounded-full blur-3xl opacity-30 bg-blue-100" />
             </div>
         )}
      </div>

      {/* Header */}
      <div className="relative z-10 flex items-center justify-between px-6 py-6">
        <button onClick={handleDisconnect} className="flex items-center gap-2 text-stone-500 hover:text-stone-800 transition-colors bg-white/50 hover:bg-white/80 backdrop-blur-sm px-4 py-2 rounded-xl border border-white/20 shadow-sm">
          <span className="font-medium">End Session</span>
        </button>

        <button 
           onClick={toggleAmbience}
           className="flex items-center gap-2 text-stone-500 hover:text-stone-800 transition-colors bg-white/50 hover:bg-white/80 backdrop-blur-sm p-3 rounded-xl border border-white/20 shadow-sm"
           title={isAmbienceMuted ? "Unmute Ambience" : "Mute Ambience"}
        >
           {isAmbienceMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
        </button>
      </div>

      {/* Main Visualizer Area */}
      <div className="flex-1 flex flex-col items-center justify-center relative z-10">
        
        {!isConnected && !error && (
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-stone-500 font-serif text-lg animate-pulse w-full text-center">
            Connecting to {personality.title}...
          </div>
        )}

        {error && (
           <div className="bg-red-50/90 backdrop-blur-md text-red-600 px-6 py-4 rounded-xl flex items-center gap-3 max-w-md mx-auto shadow-sm border border-red-100">
             <AlertCircle size={24} />
             <p>{error}</p>
           </div>
        )}

        {isConnected && (
            <div className="relative flex items-center justify-center">
                {/* Visualizer Rings (Model Voice) */}
                <div 
                  ref={ring1Ref}
                  className={`absolute w-72 h-72 rounded-full opacity-20 will-change-transform ${themeColor}`}
                />
                 <div 
                  ref={ring2Ref}
                  className={`absolute w-56 h-56 rounded-full opacity-30 will-change-transform ${themeColor}`}
                />
                <div 
                  ref={ring3Ref}
                  className={`absolute w-48 h-48 rounded-full opacity-10 border border-current will-change-transform ${personality.color.replace('bg-', 'text-')}`}
                />
                
                {/* Center Icon/Avatar */}
                <div className={`w-44 h-44 rounded-full shadow-2xl flex items-center justify-center z-20 bg-white transition-all duration-300 overflow-hidden ring-8 ring-white/30 backdrop-blur-md
                    ${isUserSpeaking ? 'scale-95 ring-primary/40 shadow-primary/20' : 'animate-float shadow-stone-200'}`}>
                    <div className={`w-full h-full flex items-center justify-center ${avatarUrl ? '' : personality.color.split(' ')[0]}`}>
                        {avatarUrl ? (
                          <img src={avatarUrl} alt={personality.title} className="w-full h-full object-cover" />
                        ) : (
                          getIcon(personality.icon, "w-16 h-16")
                        )}
                    </div>
                </div>
            </div>
        )}
        
        {isConnected && (
            <div className="mt-16 text-center h-20">
                <h2 className="font-serif text-3xl text-stone-800 mb-2 drop-shadow-sm">{personality.title}</h2>
                <p className={`text-lg transition-colors duration-300 font-medium tracking-wide flex items-center justify-center gap-2
                  ${isUserSpeaking ? 'text-primary' : 'text-stone-500'}`}>
                  {isUserSpeaking ? (
                    <>
                      <span className="relative flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-primary"></span>
                      </span>
                      Listening...
                    </>
                  ) : "Hold button to speak"}
                </p>
                <p className="text-xs text-stone-400 mt-2 opacity-80">
                    or say <span className="font-semibold">"Start listening"</span>
                </p>
            </div>
        )}
      </div>

      {/* Controls */}
      <div className="p-8 pb-12 flex flex-col items-center gap-6 relative z-10">
        
        <button 
           disabled={!isConnected}
           onMouseDown={startRecording}
           onMouseUp={stopRecording}
           onMouseLeave={stopRecording}
           onTouchStart={startRecording}
           onTouchEnd={stopRecording}
           className={`w-24 h-24 rounded-full flex items-center justify-center shadow-xl transition-all duration-200 border-4 border-white/50
             ${!isConnected ? 'opacity-50 cursor-not-allowed bg-stone-200 text-stone-400' : ''}
             ${isUserSpeaking 
               ? 'bg-primary text-white scale-110 shadow-primary/40 ring-4 ring-primary/30' 
               : 'bg-white text-stone-600 hover:bg-stone-50 hover:scale-105'}`}
        >
          <Mic size={36} />
        </button>

        <button 
           onClick={handleDisconnect}
           className="text-stone-500 text-sm hover:text-red-500 transition-colors flex items-center gap-2 px-4 py-2 rounded-lg hover:bg-red-50/50 backdrop-blur-sm"
        >
          <PhoneOff size={16} />
          <span>Disconnect</span>
        </button>
      </div>
    </div>
  );
};

export default LiveSession;
