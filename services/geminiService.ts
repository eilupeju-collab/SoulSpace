
import { GoogleGenAI, LiveServerMessage, Modality, Type, Part, Content } from "@google/genai";
import { PersonalityConfig, LanguageCode } from "../types";
import { createPCM16Blob, base64ToUint8Array, decodeAudioData } from "./audioUtils";
import { getLanguageLabel } from "../constants";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// Text Chat Generator
export async function* streamChatResponse(
  history: Content[],
  messageParts: string | Part[],
  personality: PersonalityConfig,
  language: LanguageCode
) {
  const model = 'gemini-3-flash-preview';
  const langLabel = getLanguageLabel(language);
  
  const chat = ai.chats.create({
    model: model,
    // Note: History is typically managed within the Chat object session or passed to create
    config: {
      systemInstruction: `${personality.systemInstruction}\n\nIMPORTANT: You must respond exclusively in ${langLabel}. If the user speaks in another language, acknowledge it briefly but continue the conversation in ${langLabel}.`,
    }
  });

  const result = await chat.sendMessageStream({ message: messageParts });
  
  for await (const chunk of result) {
    yield chunk.text;
  }
}

// Translate Text on demand
export async function translateText(
  text: string,
  targetLanguage: LanguageCode
): Promise<string | null> {
  const model = 'gemini-3-flash-preview';
  const langLabel = getLanguageLabel(targetLanguage);
  
  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: [{ parts: [{ text: `Translate the following text to ${langLabel}. Provide ONLY the translation, no extra commentary:\n\n${text}` }] }],
    });
    return response.text?.trim() || null;
  } catch (e) {
    console.error("Translation failed", e);
    return null;
  }
}

// Generate Speech (TTS)
export async function generateSpeech(
  text: string,
  personality: PersonalityConfig
): Promise<string | null> {
  const model = "gemini-2.5-flash-preview-tts";
  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: [{ parts: [{ text: text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: personality.voiceName },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    return base64Audio || null;
  } catch (e) {
    console.error("Speech generation failed", e);
    return null;
  }
}

// Generate Quick Replies
export async function generateQuickReplies(
  history: Content[],
  personality: PersonalityConfig,
  language: LanguageCode
): Promise<string[]> {
  const model = 'gemini-3-flash-preview';
  const langLabel = getLanguageLabel(language);
  
  try {
    const chat = ai.chats.create({
      model: model,
      config: {
        systemInstruction: `You are a helpful conversation assistant observing a chat between a user and a ${personality.title}. 
        Your task is to generate 3 short, relevant, and emotionally appropriate "quick reply" options for the USER to say next.
        - Respond ONLY in ${langLabel}.
        - Keep them concise (max 6 words).
        - Vary the tone (e.g., one gratitude, one follow-up question, one statement).
        - Ensure they fit the context of the last message.`
      }
    });

    const response = await chat.sendMessage({
      message: "Generate 3 quick replies now.",
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });

    const text = response.text;
    if (text) {
      try {
        return JSON.parse(text);
      } catch (e) {
        console.error("Failed to parse quick replies JSON", e);
      }
    }
  } catch (e) {
    console.error("Failed to generate quick replies", e);
  }
  
  return [];
}

// Image Generation for Avatars
export async function generatePersonalityAvatar(personality: PersonalityConfig): Promise<string | null> {
  const model = 'gemini-2.5-flash-image';
  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: {
        parts: [
          {
            text: `Create a high-quality, digital art portrait for a personality named "${personality.title}".
            
            Description: ${personality.description}
            
            Style: Soft, warm, and comforting digital art. Use a rounded composition with gentle lighting. 
            The image should be a centered portrait of a friendly face or a comforting symbolic representation (like a glowing lantern, a peaceful tree, or a warm sun), designed specifically to be used as a circular profile avatar.
            
            Color Palette: ${personality.color} (Prioritize soft pastels and warm tones).
            Background: Simple, soft, and dreamy to avoid clutter.`
          }
        ]
      }
    });

    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData && part.inlineData.mimeType.startsWith('image/')) {
        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
      }
    }
  } catch (e) {
    console.error("Failed to avatar generate", e);
  }
  return null;
}

// Live API Connection
export const connectLiveSession = async (
  personality: PersonalityConfig,
  language: LanguageCode,
  onAudioData: (buffer: AudioBuffer) => void,
  onClose: () => void
) => {
  const model = 'gemini-2.5-flash-native-audio-preview-09-2025';
  const langLabel = getLanguageLabel(language);
  
  // Audio Contexts
  const inputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
  const outputAudioContext = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
  
  let nextStartTime = 0;
  const sources = new Set<AudioBufferSourceNode>();
  const outputNode = outputAudioContext.createGain();
  outputNode.connect(outputAudioContext.destination);

  let isRecording = false;
  let stream: MediaStream | null = null;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch (err) {
    console.error("Microphone access denied", err);
    throw err;
  }

  const sessionPromise = ai.live.connect({
    model,
    callbacks: {
      onopen: () => {
        console.log("Live session opened");
        const source = inputAudioContext.createMediaStreamSource(stream!);
        const scriptProcessor = inputAudioContext.createScriptProcessor(4096, 1, 1);
        
        scriptProcessor.onaudioprocess = (e) => {
          if (!isRecording) return;
          const inputData = e.inputBuffer.getChannelData(0);
          const pcmBlob = createPCM16Blob(inputData);
          sessionPromise.then(session => session.sendRealtimeInput({ media: pcmBlob }));
        };

        source.connect(scriptProcessor);
        scriptProcessor.connect(inputAudioContext.destination);
      },
      onmessage: async (msg: LiveServerMessage) => {
        const base64Audio = msg.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
        if (base64Audio) {
           nextStartTime = Math.max(nextStartTime, outputAudioContext.currentTime);
           try {
             const audioBuffer = await decodeAudioData(base64ToUint8Array(base64Audio), outputAudioContext);
             onAudioData(audioBuffer);
             const source = outputAudioContext.createBufferSource();
             source.buffer = audioBuffer;
             source.connect(outputNode);
             source.addEventListener('ended', () => sources.delete(source));
             source.start(nextStartTime);
             nextStartTime += audioBuffer.duration;
             sources.add(source);
           } catch (e) {
             console.error("Error decoding audio", e);
           }
        }
        if (msg.serverContent?.interrupted) {
          sources.forEach(s => {
            try {
              s.stop();
            } catch (e) {}
            sources.delete(s);
          });
          nextStartTime = 0;
        }
      },
      onclose: () => {
        console.log("Live session closed");
        onClose();
      },
      onerror: (err) => {
        console.error("Live session error", err);
        onClose();
      }
    },
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: personality.voiceName }}
      },
      systemInstruction: `${personality.systemInstruction}\n\nIMPORTANT: You must speak and understand ONLY in ${langLabel}. If the user speaks in another language, kindly ask them to speak in ${langLabel} once you are back in conversation.`,
    }
  });

  return {
    disconnect: () => {
      sessionPromise.then(session => session.close());
      inputAudioContext.close();
      outputAudioContext.close();
      if (stream) stream.getTracks().forEach(track => track.stop());
    },
    setIsRecording: (recording: boolean) => {
      isRecording = recording;
    }
  };
};
