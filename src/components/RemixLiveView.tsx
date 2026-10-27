import React, { useState } from 'react';
import { 
  Radio, 
  Volume2, 
  Play, 
  Pause, 
  Sliders, 
  Music, 
  Zap, 
  Sparkles, 
  Activity, 
  CheckCircle2,
  Mic,
  VolumeX
} from 'lucide-react';

export const RemixLiveView: React.FC = () => {
  const [isPlayingBeat, setIsPlayingBeat] = useState(false);
  const [bpm, setBpm] = useState(128);
  const [activePreset, setActivePreset] = useState('Phonk TikTok Viral');
  const [voiceText, setVoiceText] = useState('Olha esse achado do TikTok Shop antes que esgote o lote!');
  const [isSpeaking, setIsSpeaking] = useState(false);

  // Play synthetic sound effects using Web Audio API
  const playSfx = (type: 'chaching' | 'whoosh' | 'pop' | 'bell') => {
    try {
      const audioCtx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();

      if (type === 'chaching') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(987.77, audioCtx.currentTime); // B5
        osc.frequency.setValueAtTime(1318.51, audioCtx.currentTime + 0.08); // E6
        gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.45);
      } else if (type === 'whoosh') {
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(150, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(600, audioCtx.currentTime + 0.15);
        osc.frequency.exponentialRampToValueAtTime(80, audioCtx.currentTime + 0.3);
        gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.35);
      } else if (type === 'pop') {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(400, audioCtx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(120, audioCtx.currentTime + 0.08);
        gain.gain.setValueAtTime(0.4, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.1);
      } else {
        osc.type = 'sine';
        osc.frequency.setValueAtTime(880, audioCtx.currentTime);
        gain.gain.setValueAtTime(0.25, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.5);
      }

      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.6);
    } catch (e) {
      console.warn('AudioContext indisponível:', e);
    }
  };

  const speakText = () => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(voiceText);
    utterance.lang = 'pt-BR';
    utterance.rate = 1.15; // Fast paced TikTok rhythm
    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);
    window.speechSynthesis.speak(utterance);
  };

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-purple-500/15">
        <div>
          <div className="flex items-center gap-2 mb-1 text-xs text-fuchsia-400 font-semibold tracking-wider uppercase">
            <span>Laboratório de Áudio</span>
            <span>·</span>
            <span>Remix Live BETA</span>
          </div>
          <h2 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight flex items-center gap-3">
            <span>Remix Live & Soundbed</span>
            <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-purple-500/20 text-fuchsia-300 border border-purple-500/30">
              BETA
            </span>
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Pré-escute trilhas sonoras, efeitos de gatilho sonoro (SFX) e sincronia rítmica em tempo real para os criativos.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Left Column: Soundboard FX */}
        <div className="lg:col-span-7 space-y-6">
          {/* Sound Effect Pads */}
          <div className="glass-card rounded-3xl p-6 border border-purple-500/30">
            <h3 className="text-base font-bold text-white mb-2 flex items-center gap-2">
              <Zap className="w-4 h-4 text-amber-400" />
              <span>Gatilhos Sonoros de Alta Retenção (SFX)</span>
            </h3>
            <p className="text-xs text-slate-400 mb-5">
              Dispare efeitos de quebra de padrão que dobram a taxa de retenção nos primeiros 3 segundos.
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { id: 'chaching' as const, label: 'Cha-ching!', desc: 'Venda / Carrinho', color: 'from-amber-600 to-yellow-500' },
                { id: 'whoosh' as const, label: 'Transição Whoosh', desc: 'Corte Rápido', color: 'from-purple-600 to-indigo-600' },
                { id: 'pop' as const, label: 'Bolha Pop', desc: 'Aparecimento', color: 'from-fuchsia-600 to-pink-500' },
                { id: 'bell' as const, label: 'Notificação Sino', desc: 'Alerta / Segredo', color: 'from-emerald-600 to-teal-500' },
              ].map((pad) => (
                <button
                  key={pad.id}
                  onClick={() => playSfx(pad.id)}
                  className="p-4 rounded-2xl bg-slate-950/70 border border-purple-500/20 hover:border-fuchsia-500/60 hover:bg-purple-950/30 transition-all cursor-pointer group text-left relative overflow-hidden"
                >
                  <div className="w-8 h-8 rounded-lg bg-gradient-to-tr flex items-center justify-center text-white mb-2 shadow-sm font-bold text-xs">
                    ⚡
                  </div>
                  <h4 className="text-xs font-bold text-white group-hover:text-fuchsia-300 transition-colors">
                    {pad.label}
                  </h4>
                  <p className="text-[10px] text-slate-400 mt-0.5">{pad.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Speech Synthesizer Preview */}
          <div className="glass-card rounded-3xl p-6 border border-purple-500/30 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Mic className="w-4 h-4 text-purple-400" />
                <span>Simulador de Locução pt-BR (Ritmo TikTok)</span>
              </h3>
              <span className="text-[10px] font-mono text-purple-300 bg-purple-900/40 px-2 py-0.5 rounded border border-purple-500/30">
                1.15x SPEED
              </span>
            </div>

            <textarea
              rows={3}
              value={voiceText}
              onChange={(e) => setVoiceText(e.target.value)}
              className="w-full bg-slate-950 border border-purple-500/30 rounded-2xl p-3.5 text-xs text-white font-mono focus:outline-none focus:border-fuchsia-500 leading-relaxed"
            />

            <button
              onClick={speakText}
              className="w-full sm:w-auto min-h-[44px] flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 transition-all cursor-pointer shadow-[0_0_15px_rgba(217,70,239,0.3)]"
            >
              <Volume2 className="w-4 h-4" />
              <span>{isSpeaking ? 'Falando agora...' : 'Testar Locução em Voz Alta'}</span>
            </button>
          </div>
        </div>

        {/* Right Column: BPM & Beat Studio */}
        <div className="lg:col-span-5 space-y-6">
          <div className="glass-card rounded-3xl p-6 border border-purple-500/30 space-y-5">
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Activity className="w-4 h-4 text-fuchsia-400" />
              <span>Sincronia Rítmica (BPM)</span>
            </h3>

            {/* BPM Visualizer */}
            <div className="p-5 rounded-2xl bg-slate-950/80 border border-purple-500/20 text-center">
              <div className="text-4xl font-black text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-fuchsia-300 font-mono tabular-nums mb-1">
                {bpm} BPM
              </div>
              <p className="text-[11px] text-slate-400">
                Cadência ideal para corte de gancho a cada 1.8 segundos
              </p>

              <div className="mt-4 flex items-center gap-3">
                <span className="text-xs text-slate-500 font-mono">110</span>
                <input
                  type="range"
                  min={110}
                  max={150}
                  value={bpm}
                  onChange={(e) => setBpm(parseInt(e.target.value))}
                  className="w-full accent-fuchsia-500 cursor-pointer"
                />
                <span className="text-xs text-slate-500 font-mono">150</span>
              </div>
            </div>

            {/* Soundbed Preset Selection */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 block">
                Trilha Sonora Recomendada:
              </label>
              {[
                { name: 'Phonk TikTok Viral', bpm: 132, tag: 'Top Retenção' },
                { name: 'Lo-Fi Chill Comercial', bpm: 118, tag: 'Beleza & Casa' },
                { name: 'Tech Energetic House', bpm: 126, tag: 'Gadgets & Tech' },
              ].map((trk) => (
                <div
                  key={trk.name}
                  onClick={() => {
                    setActivePreset(trk.name);
                    setBpm(trk.bpm);
                  }}
                  className={`p-3 rounded-xl border flex items-center justify-between cursor-pointer transition-all ${
                    activePreset === trk.name
                      ? 'border-fuchsia-500 bg-purple-950/30'
                      : 'border-purple-500/15 bg-slate-950/40 hover:border-purple-500/30'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <Music className="w-4 h-4 text-purple-400" />
                    <div>
                      <p className="text-xs font-bold text-white">{trk.name}</p>
                      <p className="text-[10px] text-slate-400 font-mono">{trk.bpm} BPM</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300">
                    {trk.tag}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
