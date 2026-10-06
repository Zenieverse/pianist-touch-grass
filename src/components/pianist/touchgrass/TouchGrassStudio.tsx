import React, { useState, useEffect } from 'react';
import { 
  OutdoorMissionType, 
  SoundSourceCategory, 
  ExtractedAudioFeatures, 
  GemmaMusicalReasoning, 
  OutdoorMissionRecord,
  SoundMapPoint,
  ActiveListeningLevel
} from './types/touchGrassTypes';
import { AIProvider, gemmaLocalProvider, gemmaCloudProvider } from './ai/aiProvider';
import { audioFeatureExtractor } from './audio/audioFeatureExtractor';
import { pianoAudio } from '../audio/pianoAudio';

import { 
  Compass, 
  Trees, 
  Footprints, 
  Volume2, 
  Headphones, 
  Mic, 
  MicOff, 
  Sparkles, 
  Clock, 
  Play, 
  CheckCircle2, 
  Radio, 
  ShieldCheck, 
  ArrowRight, 
  RotateCcw, 
  Award, 
  Flame, 
  Brain, 
  Piano, 
  MapPin, 
  HelpCircle,
  EyeOff
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface TouchGrassStudioProps {
  onOpenPiano?: () => void;
  onSetTargetNotes?: (notes: string[]) => void;
  onXpEarned?: (xp: number) => void;
}

const DEMO_SCENARIOS = [
  {
    id: 'demo-footsteps',
    title: 'Gravel Footsteps (Walking Stride)',
    category: 'Footsteps / Walking' as SoundSourceCategory,
    tempo: 96,
    pattern: 'Steady duple pulse',
    desc: 'Learner walks along a gravel trail, noticing the rhythmic pulse of their boots.',
    exerciseType: 'ostinato_accompaniment' as const,
    notes: ['C3', 'G3', 'A3', 'F3'],
    explanation: 'Transfers physical walking steps into left-hand anchor bass chords.'
  },
  {
    id: 'demo-birdsong',
    title: 'Morning Robin (Arched Vocal Flutter)',
    category: 'Birdsong / Wildlife' as SoundSourceCategory,
    tempo: 112,
    pattern: 'High-Low-High arched contour',
    desc: 'Learner pauses beneath an oak tree and hears a 3-note melodic motif.',
    exerciseType: 'melody_reproduction' as const,
    notes: ['G4', 'E4', 'G4', 'A4'],
    explanation: 'Identifies pitch direction and reproduces the motif on right-hand treble keys.'
  },
  {
    id: 'demo-rain',
    title: 'Raindrops on Leaves (Natural Ostinato)',
    category: 'Rain / Water Flow' as SoundSourceCategory,
    tempo: 84,
    pattern: 'Looping hydro-acoustic texture',
    desc: 'Learner listens to raindrops creating a repeating rhythmic ostinato.',
    exerciseType: 'piano_rhythm' as const,
    notes: ['E4', 'G4', 'C5', 'G4'],
    explanation: 'Transforms natural rainfall timing into Chopin-style arpeggiated broken triads.'
  },
  {
    id: 'demo-water',
    title: 'Flowing Brook (Improvisation Seed)',
    category: 'Rain / Water Flow' as SoundSourceCategory,
    tempo: 78,
    pattern: 'Gentle organic ripples',
    desc: 'Learner visits a creek and notices continuous liquid harmonic movement.',
    exerciseType: 'improvisation_seed' as const,
    notes: ['C4', 'D4', 'E4', 'G4', 'A4'],
    explanation: 'Uses the C Pentatonic scale to freely improvise over water textures.'
  }
];

export const TouchGrassStudio: React.FC<TouchGrassStudioProps> = ({
  onOpenPiano,
  onSetTargetNotes,
  onXpEarned
}) => {
  // Navigation / Mission Subview
  const [activeView, setActiveView] = useState<'hub' | 'walk-demo' | 'rhythm-hunt' | 'melody-hunt' | 'silence' | 'sound-map'>('hub');
  
  // AI Provider Selection
  const [currentProvider, setCurrentProvider] = useState<AIProvider>(gemmaLocalProvider);
  
  // 60-Second Walk State Machine: 'ready' -> 'outside-phone-away' -> 'what-did-you-hear' -> 'gemma-analyzing' -> 'bring-it-home' -> 'prove-it' -> 'completed'
  const [walkStep, setWalkStep] = useState<'ready' | 'outside-phone-away' | 'what-did-you-hear' | 'gemma-analyzing' | 'bring-it-home' | 'prove-it' | 'completed'>('ready');
  const [walkTimerSeconds, setWalkTimerSeconds] = useState<number>(60);
  const [isTimerRunning, setIsTimerRunning] = useState<boolean>(false);
  
  // Audio Capture / Input State
  const [selectedDemoScenario, setSelectedDemoScenario] = useState<typeof DEMO_SCENARIOS[0] | null>(null);
  const [isRecordingMic, setIsRecordingMic] = useState<boolean>(false);
  const [extractedFeatures, setExtractedFeatures] = useState<ExtractedAudioFeatures | null>(null);
  const [gemmaReasoning, setGemmaReasoning] = useState<GemmaMusicalReasoning | null>(null);
  const [userSoundNotes, setUserSoundNotes] = useState<string>('');
  
  // Tap Tempo Pad
  const [tapTimestamps, setTapTimestamps] = useState<number[]>([]);
  const [tappedBpm, setTappedBpm] = useState<number | null>(null);

  // Performance Evaluation
  const [playedNotes, setPlayedNotes] = useState<string[]>([]);
  const [performancePassed, setPerformancePassed] = useState<boolean>(false);

  // Gamification & Active Listening Progress
  const [activeListeningLevel, setActiveListeningLevel] = useState<ActiveListeningLevel>(2);
  const [outdoorXp, setOutdoorXp] = useState<number>(340);
  const [outdoorStreak, setOutdoorStreak] = useState<number>(2);

  // Countdown timer for "Put your phone away"
  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (isTimerRunning && walkTimerSeconds > 0) {
      timer = setInterval(() => {
        setWalkTimerSeconds(prev => prev - 1);
      }, 1000);
    } else if (walkTimerSeconds === 0 && isTimerRunning) {
      setIsTimerRunning(false);
      setWalkStep('what-did-you-hear');
    }
    return () => clearInterval(timer);
  }, [isTimerRunning, walkTimerSeconds]);

  // Launch 60-Second Walk Mission
  const startWalkMission = () => {
    setWalkStep('outside-phone-away');
    setWalkTimerSeconds(60);
    setIsTimerRunning(true);
    setPlayedNotes([]);
    setPerformancePassed(false);
  };

  // Skip timer for quick testing / indoor demo
  const handleSkipTimer = () => {
    setIsTimerRunning(false);
    setWalkStep('what-did-you-hear');
  };

  // Handle Tap Tempo Pad
  const handleTapPad = () => {
    const now = performance.now();
    const updated = [...tapTimestamps.slice(-5), now];
    setTapTimestamps(updated);

    if (updated.length >= 2) {
      const deltas = [];
      for (let i = 1; i < updated.length; i++) {
        deltas.push(updated[i] - updated[i - 1]);
      }
      const avgMs = deltas.reduce((a, b) => a + b, 0) / deltas.length;
      if (avgMs > 200 && avgMs < 2000) {
        const bpm = Math.round(60000 / avgMs);
        setTappedBpm(bpm);
      }
    }
  };

  // Trigger Real Microphone Capture with Local Privacy Extraction
  const handleRecordMicrophone = async () => {
    setIsRecordingMic(true);
    try {
      const features = await audioFeatureExtractor.captureAndExtractFeatures(3.5);
      setExtractedFeatures(features);
      setIsRecordingMic(false);
      triggerGemmaAnalysis(features, 'Real-world microphone recording');
    } catch (e) {
      setIsRecordingMic(false);
    }
  };

  // Trigger with Selected Deterministic Demo Data
  const handleSelectDemoScenario = (scenario: typeof DEMO_SCENARIOS[0]) => {
    setSelectedDemoScenario(scenario);
    const simulated = audioFeatureExtractor.generateSimulatedCapture(scenario.category);
    simulated.detectedTempoBpm = scenario.tempo;
    setExtractedFeatures(simulated);
    triggerGemmaAnalysis(simulated, scenario.title);
  };

  // Send to Gemma AI Provider for Structured Musical Reasoning
  const triggerGemmaAnalysis = async (features: ExtractedAudioFeatures, description: string) => {
    setWalkStep('gemma-analyzing');
    const reasoning = await currentProvider.interpretSound(features, description);
    setGemmaReasoning(reasoning);
    setWalkStep('bring-it-home');

    if (onSetTargetNotes && reasoning.exercise.targetNotes) {
      onSetTargetNotes(reasoning.exercise.targetNotes);
    }
  };

  // Audition generated exercise
  const handleAuditionExercise = () => {
    if (!gemmaReasoning) return;
    pianoAudio.playArpeggio(gemmaReasoning.exercise.targetNotes, 280);
  };

  // Mark Exercise Proven
  const handleProvePerformance = () => {
    setPerformancePassed(true);
    setWalkStep('completed');
    const xpBonus = 75;
    setOutdoorXp(prev => prev + xpBonus);
    if (onXpEarned) onXpEarned(xpBonus);
    confetti({ particleCount: 65, spread: 80, origin: { y: 0.6 } });
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 sm:p-8 shadow-2xl text-slate-100 space-y-6">
      {/* Brand Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-slate-800">
        <div>
          <div className="flex items-center space-x-2.5">
            <span className="p-2.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 shadow-md">
              <Trees className="w-6 h-6" />
            </span>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-black tracking-wide text-white">PIANIST — Touch Grass</h2>
                <span className="text-[10px] px-2.5 py-0.5 rounded-full font-mono font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                  Open-Source Project
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium">
                Hear the world. Find the music. Play it.
              </p>
            </div>
          </div>
        </div>

        {/* Global Controls: AI Provider & Outdoor XP */}
        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          {/* Gemma Provider Selector */}
          <div className="flex items-center bg-slate-800/90 rounded-xl p-1 border border-slate-700">
            <span className="text-[10px] font-mono text-slate-400 px-2 flex items-center gap-1">
              <Brain className="w-3.5 h-3.5 text-teal-400" />
              Gemma:
            </span>
            <button
              type="button"
              onClick={() => setCurrentProvider(gemmaLocalProvider)}
              className={`px-2.5 py-1 rounded-lg font-mono text-[11px] font-bold transition ${
                currentProvider.providerType === 'local'
                  ? 'bg-emerald-500 text-slate-950 shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Local Edge (Privacy)
            </button>
            <button
              type="button"
              onClick={() => setCurrentProvider(gemmaCloudProvider)}
              className={`px-2.5 py-1 rounded-lg font-mono text-[11px] font-bold transition ${
                currentProvider.providerType === 'cloud'
                  ? 'bg-emerald-500 text-slate-950 shadow-xs'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Cloud Hosted
            </button>
          </div>

          {/* Outdoor XP & Active Listening Level */}
          <div className="flex items-center space-x-2">
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-bold font-mono">
              <Compass className="w-3.5 h-3.5 text-emerald-400" />
              Listening Lvl {activeListeningLevel}
            </span>
            <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 font-bold font-mono">
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              {outdoorXp} Outdoor XP
            </span>
          </div>
        </div>
      </div>

      {/* Hero Callout Banner */}
      <div className="bg-gradient-to-r from-emerald-950/60 via-slate-900 to-teal-950/60 border border-emerald-500/30 rounded-2xl p-6 sm:p-7 shadow-xl">
        <div className="max-w-2xl">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold uppercase tracking-wider mb-2">
            The Non-Screen Music Learning Loop
          </div>
          <h3 className="text-2xl font-black text-white">
            Take your music lesson outside.
          </h3>
          <p className="text-xs text-slate-300 mt-2 leading-relaxed">
            The screen should be the shortest part of your musical day. Step outside, listen to footsteps, birds, raindrops, or urban pulses, then return to the piano and transform real acoustic reality into piano music.
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setActiveView('walk-demo');
                startWalkMission();
              }}
              className="px-6 py-3.5 rounded-2xl bg-gradient-to-r from-emerald-400 to-teal-400 hover:from-emerald-300 hover:to-teal-300 text-slate-950 font-black text-xs transition shadow-xl flex items-center space-x-2 transform hover:scale-102"
            >
              <Compass className="w-4 h-4" />
              <span>START OUTDOOR MISSION (60s WALK)</span>
            </button>

            {onOpenPiano && (
              <button
                type="button"
                onClick={onOpenPiano}
                className="px-5 py-3.5 rounded-2xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-bold text-xs border border-slate-700 transition flex items-center space-x-2"
              >
                <Piano className="w-4 h-4 text-teal-400" />
                <span>OPEN PIANO</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Navigation Tabs between Touch Grass Missions */}
      <div className="flex flex-wrap gap-2 pt-2 border-b border-slate-800 pb-3 text-xs">
        {[
          { id: 'hub', label: 'Overview & Sound → Music', icon: <Trees className="w-3.5 h-3.5" /> },
          { id: 'walk-demo', label: '60-Second Music Walk (Signature)', icon: <Footprints className="w-3.5 h-3.5 text-emerald-400" /> },
          { id: 'rhythm-hunt', label: '1. Rhythm Hunt', icon: <Clock className="w-3.5 h-3.5" /> },
          { id: 'melody-hunt', label: '2. Melody Hunt', icon: <Headphones className="w-3.5 h-3.5" /> },
          { id: 'silence', label: '3. Silence Mission', icon: <EyeOff className="w-3.5 h-3.5" /> },
          { id: 'sound-map', label: '4. Sound Map', icon: <MapPin className="w-3.5 h-3.5" /> },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => {
              setActiveView(tab.id as any);
              if (tab.id === 'walk-demo' && walkStep === 'ready') {
                startWalkMission();
              }
            }}
            className={`px-3.5 py-2 rounded-xl font-semibold transition flex items-center space-x-1.5 ${
              activeView === tab.id
                ? 'bg-emerald-500 text-slate-950 font-bold shadow-md'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            {tab.icon}
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* VIEW 1: SIGNATURE DEMO — 60-SECOND MUSIC WALK */}
      {activeView === 'walk-demo' && (
        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-6">
          {/* STEP 1: OUTSIDE - PUT YOUR PHONE AWAY */}
          {walkStep === 'outside-phone-away' && (
            <div className="text-center py-8 space-y-6 max-w-xl mx-auto animate-fadeIn">
              <div className="w-20 h-20 mx-auto rounded-3xl bg-emerald-500/10 border-2 border-emerald-500/40 text-emerald-400 flex items-center justify-center text-4xl shadow-2xl animate-pulse">
                🌲
              </div>

              <div>
                <h4 className="text-3xl font-black text-white">
                  PUT YOUR PHONE AWAY.
                </h4>
                <p className="text-sm text-emerald-300 font-bold mt-1">
                  Eyes up. Safe footing. Listen.
                </p>
                <p className="text-xs text-slate-400 mt-2 max-w-md mx-auto leading-relaxed">
                  Walk or stand somewhere safe outside. Do not look at this screen. Focus your attention entirely on repeating rhythms or natural pitch contours.
                </p>
              </div>

              {/* Listening Timer Display */}
              <div className="p-6 rounded-2xl bg-slate-900 border border-slate-800 max-w-xs mx-auto">
                <span className="text-xs font-mono text-slate-400 uppercase tracking-wider block mb-1">
                  Listening Countdown
                </span>
                <span className="text-5xl font-mono font-black text-emerald-400 block">
                  {walkTimerSeconds}s
                </span>
              </div>

              <div className="flex items-center justify-center space-x-3 pt-2">
                <button
                  type="button"
                  onClick={handleSkipTimer}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-semibold border border-slate-700 transition"
                >
                  I'm Back (Skip Countdown)
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: WHAT DID YOU HEAR? */}
          {walkStep === 'what-did-you-hear' && (
            <div className="space-y-6 max-w-3xl mx-auto animate-fadeIn">
              <div className="text-center">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-bold uppercase tracking-wider mb-2">
                  Step 2 • Reflection & Capture
                </div>
                <h4 className="text-2xl font-black text-white">
                  What did you hear?
                </h4>
                <p className="text-xs text-slate-300 mt-1 max-w-lg mx-auto">
                  Select a discovered acoustic scenario, tap the rhythm you heard, or record a quick 3-second sample with local feature extraction.
                </p>
              </div>

              {/* Capture Options Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Option A: Microphone Local Capture */}
                <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-sm text-white flex items-center gap-2">
                        <Mic className="w-4 h-4 text-emerald-400" />
                        Live Microphone Capture
                      </span>
                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
                        100% Local Privacy
                      </span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Listens for 3 seconds, extracts musical features (RMS energy, spectral centroid, pulse), and immediately discards the audio buffer.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={handleRecordMicrophone}
                    disabled={isRecordingMic}
                    className={`mt-4 w-full py-3 rounded-xl font-bold text-xs transition flex items-center justify-center space-x-2 shadow-lg ${
                      isRecordingMic
                        ? 'bg-rose-500 text-white animate-pulse'
                        : 'bg-emerald-500 hover:bg-emerald-400 text-slate-950'
                    }`}
                  >
                    <Mic className="w-4 h-4" />
                    <span>{isRecordingMic ? 'Analyzing Outdoor Audio (3s)...' : 'Record 3s Outdoor Sample'}</span>
                  </button>
                </div>

                {/* Option B: Rhythm Tap Pad */}
                <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-bold text-sm text-white flex items-center gap-2">
                        <Clock className="w-4 h-4 text-teal-400" />
                        Rhythm Tap Pad
                      </span>
                      {tappedBpm && (
                        <span className="text-[10px] font-mono text-teal-300 bg-teal-500/10 px-2 py-0.5 rounded-full border border-teal-500/30">
                          {tappedBpm} BPM
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      Tap the rhythm you heard with your footsteps or natural pulses.
                    </p>
                  </div>

                  <div className="flex gap-2 mt-4">
                    <button
                      type="button"
                      onClick={handleTapPad}
                      className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 active:scale-95 text-white font-mono font-bold text-xs border border-slate-700 transition"
                    >
                      Tap Pulse Here
                    </button>
                    {tappedBpm && (
                      <button
                        type="button"
                        onClick={() => {
                          const capture = audioFeatureExtractor.generateSimulatedCapture('Footsteps / Walking');
                          capture.detectedTempoBpm = tappedBpm;
                          setExtractedFeatures(capture);
                          triggerGemmaAnalysis(capture, `Tapped Rhythm at ${tappedBpm} BPM`);
                        }}
                        className="px-4 py-3 rounded-xl bg-teal-500 text-slate-950 font-bold text-xs transition"
                      >
                        Interpret →
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {/* Option C: 4 Deterministic Demo Scenarios (Clearly Labeled DEMO DATA) */}
              <div className="pt-2">
                <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                  Or Select Verified Demo Scenario (Labeled DEMO DATA):
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {DEMO_SCENARIOS.map((demo) => (
                    <button
                      key={demo.id}
                      type="button"
                      onClick={() => handleSelectDemoScenario(demo)}
                      className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/70 hover:bg-slate-800 hover:border-emerald-500/50 text-left transition-all group"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-xs text-white group-hover:text-emerald-300 transition">
                          {demo.title}
                        </span>
                        <span className="text-[9px] font-mono px-2 py-0.5 rounded bg-amber-500/10 text-amber-300 border border-amber-500/30">
                          DEMO DATA
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1">{demo.desc}</p>
                      <div className="mt-2 text-[10px] font-mono text-teal-400">
                        {demo.pattern} • {demo.tempo} BPM
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: GEMMA REASONING */}
          {walkStep === 'gemma-analyzing' && (
            <div className="text-center py-12 space-y-4 max-w-md mx-auto">
              <div className="w-12 h-12 mx-auto rounded-2xl bg-teal-500/20 text-teal-400 flex items-center justify-center animate-spin">
                <Brain className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-white">
                Gemma Reasoning Engine Active...
              </h4>
              <p className="text-xs text-slate-400 leading-relaxed font-mono">
                Extracting acoustic contours • Identifying harmonic relations • Mapping pulse to piano exercise
              </p>
            </div>
          )}

          {/* STEP 4: BRING IT HOME */}
          {walkStep === 'bring-it-home' && gemmaReasoning && (
            <div className="space-y-6 max-w-3xl mx-auto animate-fadeIn">
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-2xl bg-emerald-950/40 border border-emerald-500/40">
                <div className="flex items-center space-x-2.5">
                  <span className="p-2 rounded-xl bg-emerald-500/20 text-emerald-300">
                    <Sparkles className="w-5 h-5" />
                  </span>
                  <div>
                    <span className="text-xs font-mono font-bold text-emerald-400 uppercase">
                      Gemma Interpretation Complete
                    </span>
                    <h4 className="text-base font-bold text-white">
                      {gemmaReasoning.exercise.title}
                    </h4>
                  </div>
                </div>

                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-mono text-slate-400">
                    Engine: <strong className="text-teal-300">{gemmaReasoning.model_provider_name}</strong>
                  </span>
                </div>
              </div>

              {/* Gemma Structured JSON Reasoning Inspection Card */}
              <div className="p-5 rounded-2xl bg-slate-900 border border-slate-800 text-xs">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-slate-300 uppercase tracking-wider font-mono text-[11px]">
                    Structured Musical Reasoning:
                  </span>
                  <span className="text-[10px] font-mono text-emerald-400">
                    Confidence: {(gemmaReasoning.confidence * 100).toFixed(0)}%
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3 font-mono text-[11px]">
                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                    <span className="text-slate-500 block">Category:</span>
                    <strong className="text-white">{gemmaReasoning.source_category}</strong>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                    <span className="text-slate-500 block">Tempo:</span>
                    <strong className="text-teal-400">{gemmaReasoning.tempo_estimate} BPM</strong>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                    <span className="text-slate-500 block">Pulse:</span>
                    <strong className="text-emerald-400">{gemmaReasoning.pulse_detected ? 'Detected' : 'Organic'}</strong>
                  </div>
                  <div className="p-2.5 rounded-lg bg-slate-950 border border-slate-800">
                    <span className="text-slate-500 block">Contour:</span>
                    <strong className="text-amber-400 capitalize">{gemmaReasoning.melodic_contour}</strong>
                  </div>
                </div>

                <p className="text-slate-300 leading-relaxed mb-3">
                  {gemmaReasoning.pedagogy_explanation}
                </p>

                <div className="p-3 rounded-xl bg-teal-950/40 border border-teal-500/30 text-teal-200">
                  <strong className="text-teal-300">Coach Guidance: </strong>
                  {gemmaReasoning.coach_tip}
                </div>
              </div>

              {/* Generated Piano Exercise */}
              <div className="p-6 rounded-2xl bg-gradient-to-r from-slate-900 to-slate-950 border-2 border-emerald-500/60 shadow-xl space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-mono text-emerald-400 uppercase font-bold">
                      Discovered Piano Exercise • Level {gemmaReasoning.exercise.difficulty}
                    </span>
                    <h5 className="text-lg font-bold text-white">
                      {gemmaReasoning.exercise.title}
                    </h5>
                  </div>
                  <button
                    type="button"
                    onClick={handleAuditionExercise}
                    className="px-4 py-2 rounded-xl bg-teal-500 text-slate-950 font-bold text-xs flex items-center space-x-1.5 shadow-md"
                  >
                    <Volume2 className="w-4 h-4" />
                    <span>Audition Target Notes</span>
                  </button>
                </div>

                <p className="text-xs text-slate-200">
                  {gemmaReasoning.exercise.instructions}
                </p>

                <div className="flex items-center space-x-2">
                  <span className="text-xs text-slate-400 font-mono">Target Keys:</span>
                  {gemmaReasoning.exercise.targetNotes.map((note) => (
                    <button
                      key={note}
                      type="button"
                      onClick={() => pianoAudio.playNote(note, 0.85)}
                      className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-300 font-mono font-bold text-xs border border-emerald-500/40 shadow-xs"
                    >
                      {note}
                    </button>
                  ))}
                  <span className="text-xs text-slate-400 ml-2">
                    (Hand: <strong className="text-white">{gemmaReasoning.exercise.suggestedHand}</strong>)
                  </span>
                </div>

                <div className="pt-2">
                  <button
                    type="button"
                    onClick={handleProvePerformance}
                    className="w-full py-3.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-400 hover:from-emerald-400 hover:to-teal-300 text-slate-950 font-black text-xs transition shadow-lg flex items-center justify-center space-x-2"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>I HAVE PLAYED IT ON THE PIANO (PROVE IT)</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: COMPLETED — EMOTIONAL VICTORY */}
          {walkStep === 'completed' && (
            <div className="text-center py-8 space-y-6 max-w-xl mx-auto animate-fadeIn">
              <div className="text-5xl">🌿🎹</div>
              <div>
                <h4 className="text-3xl font-black text-white">
                  You heard it. Now play it.
                </h4>
                <p className="text-base text-emerald-300 font-bold mt-1 italic">
                  "You didn't memorize this. You discovered it."
                </p>
                <p className="text-xs text-slate-400 mt-3 leading-relaxed">
                  You took music learning outside, connected the physical world to piano keyboard geography, and transformed environmental sound into personal musicianship.
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs text-emerald-300 flex items-center justify-center space-x-3">
                <Award className="w-5 h-5 text-amber-400" />
                <span>+75 Outdoor XP Awarded • Active Listening Level Maintained</span>
              </div>

              <div className="flex justify-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setWalkStep('ready');
                    startWalkMission();
                  }}
                  className="px-5 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition shadow-md"
                >
                  Start Another Listening Walk
                </button>
                {onOpenPiano && (
                  <button
                    type="button"
                    onClick={onOpenPiano}
                    className="px-5 py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-700 transition"
                  >
                    Keep Playing on Piano Deck
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* VIEW 2: OVERVIEW & SOUND → MUSIC TRANSFORMATION */}
      {activeView === 'hub' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800">
              <span className="text-2xl mb-1 block">👣</span>
              <h4 className="text-sm font-bold text-white">1. Footsteps</h4>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Rhythm pattern → Left-hand piano walking bass accompaniment.
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800">
              <span className="text-2xl mb-1 block">🐦</span>
              <h4 className="text-sm font-bold text-white">2. Bird-like Contour</h4>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Melodic direction → Right-hand treble melody exercise.
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800">
              <span className="text-2xl mb-1 block">🌧️</span>
              <h4 className="text-sm font-bold text-white">3. Rain & Drops</h4>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Repeating pulse → Piano broken chord ostinato in C Major.
              </p>
            </div>
            <div className="p-5 rounded-2xl bg-slate-950/70 border border-slate-800">
              <span className="text-2xl mb-1 block">🌊</span>
              <h4 className="text-sm font-bold text-white">4. Water Flow</h4>
              <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                Rhythm & texture → Pentatonic improvisation prompt.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 3: SILENCE MISSION */}
      {activeView === 'silence' && (
        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-6 sm:p-8 max-w-xl mx-auto text-center space-y-6">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-teal-500/10 border border-teal-500/30 text-teal-400 flex items-center justify-center text-3xl">
            🤫
          </div>
          <h4 className="text-2xl font-black text-white">
            The 60-Second Silence Mission
          </h4>
          <p className="text-xs text-slate-300 leading-relaxed">
            Go somewhere safe and quiet. Put the phone away. Listen for 60 seconds without speaking.
          </p>

          <div className="p-5 rounded-xl bg-slate-900 border border-slate-800 text-left text-xs space-y-2 text-slate-300">
            <strong className="text-teal-300 block mb-1">Post-Silence Reflection Questions:</strong>
            <p>• What did you hear first?</p>
            <p>• What sound repeated?</p>
            <p>• What changed as time passed?</p>
            <p>• What sound was closest, and what was farthest?</p>
            <p>• Was there a natural pulse?</p>
          </div>

          <button
            type="button"
            onClick={() => {
              setOutdoorXp(prev => prev + 50);
              if (onXpEarned) onXpEarned(50);
              confetti({ particleCount: 30, spread: 60 });
            }}
            className="px-6 py-3 rounded-xl bg-teal-500 hover:bg-teal-400 text-slate-950 font-bold text-xs transition shadow-lg"
          >
            I Completed 60 Seconds of Active Listening (+50 XP)
          </button>
        </div>
      )}

      {/* VIEW 4: RHYTHM & MELODY HUNTS */}
      {(activeView === 'rhythm-hunt' || activeView === 'melody-hunt') && (
        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-6 sm:p-8 max-w-2xl mx-auto space-y-5">
          <h4 className="text-xl font-black text-white">
            {activeView === 'rhythm-hunt' ? 'Outdoor Rhythm Hunt' : 'Outdoor Melody Hunt'}
          </h4>
          <p className="text-xs text-slate-300 leading-relaxed">
            {activeView === 'rhythm-hunt' 
              ? 'Find repeating rhythmic mechanical, human, or natural cycles (traffic lights, construction, bike wheels, dripping water).'
              : 'Listen for natural pitch contours (bird calls, train bells, voices). Did the pitch move higher, lower, or stay level?'}
          </p>

          <div className="grid grid-cols-3 gap-2 text-center text-xs">
            <button
              type="button"
              onClick={() => {
                pianoAudio.playArpeggio(['C4', 'E4', 'G4'], 200);
              }}
              className="p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-emerald-500 text-slate-200"
            >
              Higher (Ascending)
            </button>
            <button
              type="button"
              onClick={() => {
                pianoAudio.playArpeggio(['G4', 'E4', 'C4'], 200);
              }}
              className="p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-emerald-500 text-slate-200"
            >
              Lower (Descending)
            </button>
            <button
              type="button"
              onClick={() => {
                pianoAudio.playArpeggio(['E4', 'E4', 'E4'], 200);
              }}
              className="p-3 rounded-xl bg-slate-900 border border-slate-800 hover:border-emerald-500 text-slate-200"
            >
              Level (Same)
            </button>
          </div>
        </div>
      )}

      {/* VIEW 5: SOUND MAP */}
      {activeView === 'sound-map' && (
        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-6 sm:p-8 space-y-5">
          <div className="flex items-center justify-between">
            <h4 className="text-lg font-black text-white flex items-center gap-2">
              <MapPin className="w-5 h-5 text-emerald-400" />
              Temporary Coarse Acoustic Sound Map
            </h4>
            <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/30">
              No Persistent GPS Tracking
            </span>
          </div>
          <p className="text-xs text-slate-400 leading-relaxed">
            Record the acoustic qualities of sounds around your walking perimeter: category, distance, and repetition.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <span className="font-bold text-white block mb-1">Near Sound</span>
              <p className="text-slate-400">Gravel footsteps beneath your boots (Duple 96 BPM)</p>
            </div>
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <span className="font-bold text-white block mb-1">Mid-Distance Sound</span>
              <p className="text-slate-400">Robin in elm tree (High-Low 3rd interval)</p>
            </div>
            <div className="p-4 rounded-xl bg-slate-900 border border-slate-800">
              <span className="font-bold text-white block mb-1">Far Ambient Sound</span>
              <p className="text-slate-400">Distant highway murmur (Low bass drone C2)</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
