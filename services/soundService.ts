
import { PersonalityType } from '../types';

const AudioContextClass = (window.AudioContext || (window as any).webkitAudioContext);
let audioCtx: AudioContext | null = null;
let ambienceGain: GainNode | null = null;
let ambienceNodes: AudioNode[] = [];
let ambienceTimers: number[] = [];
let isAmbienceMuted = false;

const getContext = () => {
  if (!audioCtx) {
    audioCtx = new AudioContextClass();
  }
  return audioCtx;
};

// Create noise buffer (White or Pink approximation)
const createNoiseBuffer = (ctx: AudioContext, type: 'white' | 'pink' = 'white') => {
  const bufferSize = ctx.sampleRate * 4; // 4 seconds loop for better variety
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  
  if (type === 'white') {
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }
  } else {
    // Pink noise approximation (1/f)
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        b0 = 0.99886 * b0 + white * 0.0555179;
        b1 = 0.99332 * b1 + white * 0.0750759;
        b2 = 0.96900 * b2 + white * 0.1538520;
        b3 = 0.86650 * b3 + white * 0.3104856;
        b4 = 0.55000 * b4 + white * 0.5329522;
        b5 = -0.7616 * b5 - white * 0.0168980;
        data[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
        data[i] *= 0.11; // Normalize roughly
        b6 = white * 0.115926;
    }
  }
  return buffer;
};

const playTone = (freq: number, type: OscillatorType, duration: number, volume: number = 0.1, ramp: 'exp' | 'linear' = 'exp') => {
    try {
        const ctx = getContext();
        if (ctx.state === 'suspended') ctx.resume();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = type;
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        
        gain.gain.setValueAtTime(volume, ctx.currentTime);
        if (ramp === 'exp') {
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        } else {
            gain.gain.linearRampToValueAtTime(0, ctx.currentTime + duration);
        }
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start();
        osc.stop(ctx.currentTime + duration);
    } catch (e) {
        console.error("Audio playback error", e);
    }
};

export const soundService = {
  // Subtle click for buttons
  playClick: () => playTone(800, 'sine', 0.1, 0.05),
  
  // Softer click for secondary interactions
  playSoftClick: () => playTone(600, 'sine', 0.08, 0.03),
  
  // Ascending sound for sending a message
  playSend: () => {
    try {
        const ctx = getContext();
        if (ctx.state === 'suspended') ctx.resume();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const t = ctx.currentTime;
        
        osc.frequency.setValueAtTime(300, t);
        osc.frequency.exponentialRampToValueAtTime(600, t + 0.15);
        
        gain.gain.setValueAtTime(0.05, t);
        gain.gain.linearRampToValueAtTime(0, t + 0.15);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start();
        osc.stop(t + 0.15);
    } catch (e) {}
  },

  // Gentle chime for receiving a message
  playReceive: () => {
    try {
        const ctx = getContext();
        if (ctx.state === 'suspended') ctx.resume();
        const t = ctx.currentTime;
        
        // Simple 2-note chime
        [523.25, 659.25].forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            
            osc.type = 'sine';
            osc.frequency.value = freq;
            
            gain.gain.setValueAtTime(0, t + i * 0.1);
            gain.gain.linearRampToValueAtTime(0.05, t + i * 0.1 + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, t + i * 0.1 + 0.4);
            
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            osc.start(t + i * 0.1);
            osc.stop(t + i * 0.1 + 0.4);
        });
    } catch (e) {}
  },

  // Transition chord
  playTransition: () => {
    try {
        const ctx = getContext();
        if (ctx.state === 'suspended') ctx.resume();
        const t = ctx.currentTime;
        
        // Major chord
        [440, 554.37, 659.25].forEach((freq, i) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            
            osc.type = 'sine';
            osc.frequency.value = freq;
            
            gain.gain.setValueAtTime(0, t);
            gain.gain.linearRampToValueAtTime(0.03, t + 0.1);
            gain.gain.exponentialRampToValueAtTime(0.001, t + 1.5);
            
            osc.connect(gain);
            gain.connect(ctx.destination);
            
            osc.start(t);
            osc.stop(t + 1.5);
        });
    } catch (e) {}
  },
  
  playStartRecord: () => playTone(880, 'sine', 0.1, 0.05),
  playStopRecord: () => playTone(440, 'sine', 0.1, 0.05),
  playError: () => playTone(150, 'triangle', 0.3, 0.1),

  // --- Dynamic Ambience Logic ---

  startAmbience: (type: PersonalityType) => {
    const ctx = getContext();
    if (ctx.state === 'suspended') ctx.resume();
    
    // Cleanup previous
    soundService.stopAmbience();
    
    ambienceGain = ctx.createGain();
    ambienceGain.gain.value = isAmbienceMuted ? 0 : 0.05; // Master Ambience Volume
    ambienceGain.connect(ctx.destination);
    
    // Fade in
    if (!isAmbienceMuted) {
        ambienceGain.gain.setValueAtTime(0, ctx.currentTime);
        ambienceGain.gain.linearRampToValueAtTime(0.05, ctx.currentTime + 3);
    }

    if (type === PersonalityType.ELDER) {
        // --- ELDER: Deep, Gusty Wind ---
        // Layer 1: Low Rumble (Pink Noise)
        const rumbleSrc = ctx.createBufferSource();
        rumbleSrc.buffer = createNoiseBuffer(ctx, 'pink');
        rumbleSrc.loop = true;
        
        const rumbleFilter = ctx.createBiquadFilter();
        rumbleFilter.type = 'lowpass';
        rumbleFilter.frequency.value = 200;
        
        // Layer 2: Howling Wind (Filtered White Noise with LFO)
        const howlSrc = ctx.createBufferSource();
        howlSrc.buffer = createNoiseBuffer(ctx, 'white');
        howlSrc.loop = true;
        
        const howlFilter = ctx.createBiquadFilter();
        howlFilter.type = 'bandpass';
        howlFilter.Q.value = 1.5;
        
        // LFO to modulate Howl Frequency (simulating changing wind pitch)
        const lfo = ctx.createOscillator();
        lfo.type = 'sine';
        lfo.frequency.value = 0.08; // Very slow
        const lfoGain = ctx.createGain();
        lfoGain.gain.value = 300; // Swing range
        
        // Connect LFO -> Filter Freq (Center at 400Hz)
        howlFilter.frequency.value = 400;
        lfo.connect(lfoGain);
        lfoGain.connect(howlFilter.frequency);
        
        // Connections
        rumbleSrc.connect(rumbleFilter);
        rumbleFilter.connect(ambienceGain);
        
        howlSrc.connect(howlFilter);
        howlFilter.connect(ambienceGain);
        
        // Start
        rumbleSrc.start();
        howlSrc.start();
        lfo.start();
        
        ambienceNodes.push(rumbleSrc, rumbleFilter, howlSrc, howlFilter, lfo, lfoGain);

    } else if (type === PersonalityType.MENTOR) {
        // --- MENTOR: Peaceful Forest (Leaves & Birds) ---
        // Layer 1: Rustling Leaves (Filtered Pink Noise)
        const leavesSrc = ctx.createBufferSource();
        leavesSrc.buffer = createNoiseBuffer(ctx, 'pink');
        leavesSrc.loop = true;

        const leavesFilter = ctx.createBiquadFilter();
        leavesFilter.type = 'highpass';
        leavesFilter.frequency.value = 800;
        
        const leavesFilter2 = ctx.createBiquadFilter();
        leavesFilter2.type = 'lowpass';
        leavesFilter2.frequency.value = 3000;
        
        // Gentle Volume Swell
        const swellLfo = ctx.createOscillator();
        swellLfo.type = 'sine';
        swellLfo.frequency.value = 0.1;
        const swellGain = ctx.createGain();
        swellGain.gain.value = 0.02; // Modulation amount
        const leafBaseGain = ctx.createGain();
        leafBaseGain.gain.value = 0.05;

        // Connections
        swellLfo.connect(swellGain);
        swellGain.connect(leafBaseGain.gain);
        
        leavesSrc.connect(leavesFilter);
        leavesFilter.connect(leavesFilter2);
        leavesFilter2.connect(leafBaseGain);
        leafBaseGain.connect(ambienceGain);
        
        leavesSrc.start();
        swellLfo.start();
        ambienceNodes.push(leavesSrc, leavesFilter, leavesFilter2, swellLfo, swellGain, leafBaseGain);

        // Layer 2: Random Bird Chirps
        const triggerBird = () => {
            if (!ambienceGain) return;
            const t = ctx.currentTime;
            
            const osc = ctx.createOscillator();
            const g = ctx.createGain();
            
            osc.connect(g);
            g.connect(ambienceGain!); // Connect to main ambience
            
            // Randomize Chirp
            // Start freq high (2000-4000), chirp down or up
            const startFreq = 2000 + Math.random() * 2000;
            const endFreq = startFreq + (Math.random() * 1000 - 500);
            
            osc.frequency.setValueAtTime(startFreq, t);
            osc.frequency.exponentialRampToValueAtTime(endFreq, t + 0.15);
            
            // Envelope (Short blip)
            g.gain.setValueAtTime(0, t);
            g.gain.linearRampToValueAtTime(0.04, t + 0.02);
            g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
            
            osc.start(t);
            osc.stop(t + 0.15);
        };

        const scheduleBirds = () => {
             const delay = 3000 + Math.random() * 7000; // Random delay 3-10s
             const id = window.setTimeout(() => {
                 triggerBird();
                 scheduleBirds();
             }, delay);
             ambienceTimers.push(id);
        };
        scheduleBirds();

    } else if (type === PersonalityType.PRAYER) {
        // --- PRAYER: Ethereal Choir (Drone Pad) ---
        // 3 Oscillators forming a chord (Root, Major 3rd, Perfect 5th)
        // Base Freq: 130.81 (C3)
        const chord = [130.81, 164.81, 196.00]; 
        
        chord.forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            osc.type = 'sine'; // Pure tone
            osc.frequency.value = freq;
            
            // Detune slightly for richness
            osc.detune.value = (Math.random() * 10 - 5); 

            const oscGain = ctx.createGain();
            oscGain.gain.value = 0.0;
            
            // Slow "Breathing" LFO for each voice
            const lfo = ctx.createOscillator();
            lfo.type = 'sine';
            lfo.frequency.value = 0.05 + (Math.random() * 0.02); // Different breath rates
            
            const lfoGain = ctx.createGain();
            lfoGain.gain.value = 0.03; // Depth
            
            // Logic: Base volume + LFO
            // Use a constant source for base volume if possible, or just oscillate around a mean
            // Simpler: Connect LFO to gain, offset by connection not supported directly easily in raw API without ConstantSourceNode (which is fine to use)
            // Fallback: Just simple gain oscillation 0 to 0.06
            
            // Re-routing for simple breathing:
            // Osc -> Gain (modulated) -> Main
            osc.connect(oscGain);
            oscGain.connect(ambienceGain!);
            
            // Manual breathing loop using ramp to simulate LFO if we want precise control, 
            // but LFO node connected to Gain AudioParam is standard.
            // But standard LFO goes -1 to 1. We want 0.02 to 0.08.
            // So: Gain.gain.value = 0.05. LFO connected to Gain.gain.
            oscGain.gain.value = 0.05;
            lfo.connect(oscGain.gain); 
            
            osc.start();
            lfo.start();
            ambienceNodes.push(osc, oscGain, lfo);
        });

    } else {
        // --- FRIEND: Warm Sunny Room Tone ---
        // Layer 1: Warmth (Low Triangle Pad)
        const warmOsc = ctx.createOscillator();
        warmOsc.type = 'triangle';
        warmOsc.frequency.value = 110; // A2
        
        const warmFilter = ctx.createBiquadFilter();
        warmFilter.type = 'lowpass';
        warmFilter.frequency.value = 180; // Very muffled
        
        const warmGain = ctx.createGain();
        warmGain.gain.value = 0.1;
        
        warmOsc.connect(warmFilter);
        warmFilter.connect(warmGain);
        warmGain.connect(ambienceGain);
        
        // Layer 2: Subtle "Air" (Filtered Pink Noise)
        const airSrc = ctx.createBufferSource();
        airSrc.buffer = createNoiseBuffer(ctx, 'pink');
        airSrc.loop = true;
        
        const airFilter = ctx.createBiquadFilter();
        airFilter.type = 'highpass';
        airFilter.frequency.value = 4000; // Just the hiss
        
        const airGain = ctx.createGain();
        airGain.gain.value = 0.02; // Very quiet
        
        airSrc.connect(airFilter);
        airFilter.connect(airGain);
        airGain.connect(ambienceGain);
        
        warmOsc.start();
        airSrc.start();
        
        ambienceNodes.push(warmOsc, warmFilter, warmGain, airSrc, airFilter, airGain);
    }
  },

  stopAmbience: () => {
    // Clear timers
    ambienceTimers.forEach(id => clearTimeout(id));
    ambienceTimers = [];

    if (ambienceGain) {
        const ctx = getContext();
        // Fade out
        try {
            ambienceGain.gain.setTargetAtTime(0, ctx.currentTime, 0.5);
        } catch(e) {}
        
        // Disconnect after fade
        const nodesToStop = [...ambienceNodes]; // Copy array
        const gainToDisconnect = ambienceGain;

        setTimeout(() => {
            nodesToStop.forEach(n => {
                try { n.disconnect(); } catch(e) {}
                try { (n as any).stop(); } catch(e) {}
            });
            try { gainToDisconnect.disconnect(); } catch(e) {}
        }, 1000);
        
        ambienceNodes = [];
        ambienceGain = null;
    }
  },

  toggleAmbienceMute: () => {
      isAmbienceMuted = !isAmbienceMuted;
      if (ambienceGain) {
          const ctx = getContext();
          if (isAmbienceMuted) {
              ambienceGain.gain.setTargetAtTime(0, ctx.currentTime, 0.5);
          } else {
              ambienceGain.gain.setTargetAtTime(0.05, ctx.currentTime, 1);
          }
      }
      return isAmbienceMuted;
  },
  
  isAmbienceMuted: () => isAmbienceMuted
};
