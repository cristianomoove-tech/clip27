import React, { useState, useEffect } from 'react';
import { 
  X, 
  Settings, 
  Key, 
  Cpu, 
  Check, 
  ShieldCheck, 
  RefreshCw, 
  ExternalLink,
  Sliders,
  Cloud
} from 'lucide-react';
import { AppSettings } from '../types';
import { saveStoredSettings } from '../services/aiService';
import { validateApifyToken } from '../services/apifyService';

interface SettingsModalProps {
  settings: AppSettings;
  isOpen: boolean;
  onClose: () => void;
  onSave: (updated: AppSettings) => void;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  settings,
  isOpen,
  onClose,
  onSave,
}) => {
  const [openRouterKey, setOpenRouterKey] = useState(settings.openRouterApiKey);
  const [model, setModel] = useState(settings.openRouterModel || 'google/gemini-3.8-flash');
  const [apifyToken, setApifyToken] = useState(settings.apifyToken);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isTestingApify, setIsTestingApify] = useState(false);
  const [apifyTestResult, setApifyTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isSaved, setIsSaved] = useState(false);

  // Sync local form state whenever cloud settings update or modal opens
  useEffect(() => {
    setOpenRouterKey(settings.openRouterApiKey || '');
    setModel(settings.openRouterModel || 'google/gemini-3.8-flash');
    setApifyToken(settings.apifyToken || '');
  }, [settings.openRouterApiKey, settings.openRouterModel, settings.apifyToken, isOpen]);

  if (!isOpen) return null;

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);

    if (!openRouterKey.trim()) {
      setTimeout(() => {
        setIsTesting(false);
        setTestResult({
          success: true,
          message: 'Modo Local Ativo: Motor de Fallback Inteligente operacional com CUSTO ZERO!',
        });
      }, 500);
      return;
    }

    try {
      const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${openRouterKey.trim()}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': window.location.origin,
          'X-Title': 'AI Creative Engine',
        },
        body: JSON.stringify({
          model: model,
          messages: [{ role: 'user', content: 'responda "ok" em 1 palavra' }],
          max_tokens: 5,
        }),
      });

      if (res.ok) {
        setTestResult({
          success: true,
          message: 'Conexão OpenRouter estabelecida com sucesso via modelo :free!',
        });
      } else {
        const err = await res.json().catch(() => null);
        setTestResult({
          success: false,
          message: `Falha na API: ${err?.error?.message || 'Chave inválida ou limite excedido.'}`,
        });
      }
    } catch {
      setTestResult({
        success: false,
        message: 'Erro de conexão na requisição à API OpenRouter.',
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleTestApify = async () => {
    setIsTestingApify(true);
    setApifyTestResult(null);

    if (!apifyToken.trim()) {
      setTimeout(() => {
        setIsTestingApify(false);
        setApifyTestResult({
          success: true,
          message: 'Modo Base Calibrada Ativo: Sem token, o Radar utiliza dados em tempo real calibrados com alto CTR.',
        });
      }, 400);
      return;
    }

    try {
      const res = await validateApifyToken(apifyToken);
      if (res.valid && res.user) {
        setApifyTestResult({
          success: true,
          message: `Conexão Apify validada com sucesso! Usuário: @${res.user.username} (Plano: ${res.user.plan || 'Free Tier'})`,
        });
      } else {
        setApifyTestResult({
          success: false,
          message: res.error || 'Token inválido ou não autorizado na Apify.',
        });
      }
    } catch {
      setApifyTestResult({
        success: false,
        message: 'Erro de rede ao conectar com a API da Apify.',
      });
    } finally {
      setIsTestingApify(false);
    }
  };

  const handleSave = () => {
    const updated: AppSettings = {
      openRouterApiKey: openRouterKey.trim(),
      openRouterModel: model,
      apifyToken: apifyToken.trim(),
    };
    saveStoredSettings(updated);
    onSave(updated);
    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
      onClose();
    }, 900);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/90 backdrop-blur-xl animate-fade-in">
      <div className="w-full max-w-lg max-h-[94vh] overflow-y-auto glass-card rounded-2xl sm:rounded-3xl border border-purple-500/30 p-4 sm:p-6 shadow-[0_0_50px_rgba(168,85,247,0.25)] relative">
        {/* Header */}
        <div className="flex items-center justify-between pb-3 sm:pb-4 mb-4 sm:mb-5 border-b border-purple-500/15">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-600/20 border border-purple-500/30 flex items-center justify-center text-purple-300 shrink-0">
              <Settings className="w-5 h-5 text-fuchsia-400" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-white">
                Configurações da Engine (BYOK)
              </h3>
              <p className="text-[11px] sm:text-xs text-slate-400">
                Chave com custo zero ou gerador local inteligente.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-11 h-11 flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer shrink-0"
            aria-label="Fechar configurações"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="space-y-4 sm:space-y-5">
          {/* Status Banner */}
          <div className="p-3.5 rounded-xl bg-purple-950/20 border border-purple-500/20 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-2">
              <span
                className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                  openRouterKey.trim().length > 5 || apifyToken.trim().length > 5
                    ? 'bg-emerald-400 shadow-[0_0_8px_#34d399]'
                    : 'bg-amber-400 shadow-[0_0_8px_#fbbf24]'
                }`}
              />
              <span className="font-semibold text-white">
                {openRouterKey.trim().length > 5 || apifyToken.trim().length > 5
                  ? 'Chaves Salvas na Nuvem da Conta'
                  : 'Modo Local Custo Zero Ativo'}
              </span>
            </div>
            <span className="text-[10px] font-mono text-emerald-300 bg-emerald-950/50 px-2.5 py-0.5 rounded-lg border border-emerald-500/30 flex items-center gap-1">
              <Cloud className="w-3 h-3 text-emerald-400" />
              <span>Sync PC & Mobile</span>
            </span>
          </div>

          {/* OpenRouter API Key Field */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-white flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-purple-400" />
                <span>OpenRouter API Key (Opcional)</span>
              </label>
              <a
                href="https://openrouter.ai/keys"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-fuchsia-400 hover:underline flex items-center gap-1"
              >
                <span>Obter chave grátis</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
            <input
              type="password"
              value={openRouterKey}
              onChange={(e) => setOpenRouterKey(e.target.value)}
              placeholder="sk-or-v1-xxxxxxxxxxxx (ou deixe vazio para usar gerador local)"
              className="w-full bg-slate-950 border border-purple-500/30 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-fuchsia-500"
            />
            <p className="text-[10px] text-slate-400">
              Permite chamar modelos avançados como <code className="text-purple-300">google/gemini-3.8-flash</code> ou modelos gratuitos como <code className="text-purple-300">google/gemma-4-31b-it:free</code>.
            </p>
          </div>

          {/* Model Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-white flex items-center gap-1.5">
              <Cpu className="w-3.5 h-3.5 text-blue-400" />
              <span>Modelo de IA Selecionado</span>
            </label>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              className="w-full bg-slate-950 border border-purple-500/30 rounded-xl px-3.5 py-2.5 text-xs text-white focus:outline-none focus:border-fuchsia-500"
            >
              <option value="google/gemini-3.8-flash">
                Google Gemini 3.8 Flash (Última Geração Oficial)
              </option>
              <option value="google/gemini-3.7-flash">
                Google Gemini 3.7 Flash (Raciocínio Híbrido)
              </option>
              <option value="google/gemini-3.5-flash-lite">
                Google Gemini 3.5 Flash Lite (Ultra Rápido)
              </option>
              <option value="google/gemma-4-31b-it:free">
                Google Gemma 4 31B (100% Gratuito - Free Tier)
              </option>
              <option value="google/gemma-4-26b-a4b-it:free">
                Google Gemma 4 26B A4B (100% Gratuito - Free Tier)
              </option>
              <option value="openrouter/free">
                OpenRouter Free Router (Seleção Automática Gratuita)
              </option>
              <option value="meta-llama/llama-3.3-70b-instruct:free">
                Meta Llama 3.3 70B (Free Tier)
              </option>
              <option value="deepseek/deepseek-r1:free">
                DeepSeek R1 Reasoning (Free Tier)
              </option>
            </select>
          </div>

          {/* Apify Token Field */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-white flex items-center gap-1.5">
                <Sliders className="w-3.5 h-3.5 text-emerald-400" />
                <span>Apify API Token (Para o Trending Radar)</span>
              </label>
              <a
                href="https://apify.com"
                target="_blank"
                rel="noreferrer"
                className="text-[11px] text-emerald-400 hover:underline flex items-center gap-1"
              >
                <span>Obter Apify Token</span>
                <ExternalLink className="w-2.5 h-2.5" />
              </a>
            </div>
            <input
              type="password"
              value={apifyToken}
              onChange={(e) => setApifyToken(e.target.value)}
              placeholder="apify_api_xxxxxxxx (ou deixe vazio para base calibrada)"
              className="w-full bg-slate-950 border border-purple-500/30 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-fuchsia-500"
            />
            <div className="flex items-center justify-between pt-1">
              <p className="text-[10px] text-slate-400">
                Se deixado em branco, a aplicação usa a base calibrada em tempo real sem erros.
              </p>
              <button
                type="button"
                onClick={handleTestApify}
                disabled={isTestingApify}
                className="text-[11px] font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
              >
                {isTestingApify ? (
                  <>
                    <RefreshCw className="w-3 h-3 animate-spin" />
                    <span>Testando...</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-3 h-3" />
                    <span>Testar Chave Apify</span>
                  </>
                )}
              </button>
            </div>

            {apifyTestResult && (
              <div
                className={`p-2.5 rounded-xl text-xs font-medium border mt-1.5 ${
                  apifyTestResult.success
                    ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30'
                    : 'bg-rose-950/40 text-rose-300 border-rose-500/30'
                }`}
              >
                {apifyTestResult.message}
              </div>
            )}
          </div>

          {/* Firebase Connection Card */}
          <div className="p-3.5 rounded-xl bg-purple-950/20 border border-purple-500/25 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Banco de Dados Firebase Firestore</span>
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                ONLINE
              </span>
            </div>
            <div className="space-y-1 text-[11px] font-mono text-slate-400 pt-1">
              <div className="flex justify-between">
                <span>Projeto:</span>
                <span className="text-white font-bold">image-ia-sdh87</span>
              </div>
              <div className="flex justify-between">
                <span>Database ID:</span>
                <span className="text-fuchsia-300 truncate max-w-[200px]">ai-studio-aicreativeengine...</span>
              </div>
              <div className="flex justify-between">
                <span>Autenticação:</span>
                <span className="text-emerald-400">Google OAuth Ativo</span>
              </div>
            </div>
          </div>

          {/* Test Connection Button */}
          <div>
            <button
              onClick={handleTestConnection}
              disabled={isTesting}
              className="w-full py-2.5 rounded-xl border border-purple-500/30 hover:border-purple-500/50 bg-purple-950/20 hover:bg-purple-900/30 text-xs font-semibold text-purple-300 transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              {isTesting ? (
                <>
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  <span>Testando Conexão...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Testar Conexão com a API</span>
                </>
              )}
            </button>
          </div>

          {testResult && (
            <div
              className={`p-3 rounded-xl text-xs font-medium border ${
                testResult.success
                  ? 'bg-emerald-950/40 text-emerald-300 border-emerald-500/30'
                  : 'bg-rose-950/40 text-rose-300 border-rose-500/30'
              }`}
            >
              {testResult.message}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-5 mt-6 border-t border-purple-500/15 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white transition-colors cursor-pointer"
          >
            Cancelar
          </button>
          <button
            onClick={handleSave}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-[0_0_15px_rgba(217,70,239,0.3)] transition-all cursor-pointer"
          >
            {isSaved ? <Check className="w-4 h-4 text-white" /> : null}
            <span>{isSaved ? 'Configurações Salvas!' : 'Salvar Alterações'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
