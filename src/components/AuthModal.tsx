import React, { useState } from 'react';
import { 
  X, 
  Lock, 
  Mail, 
  Eye, 
  EyeOff, 
  ShieldCheck, 
  Sparkles, 
  LogIn, 
  UserPlus, 
  AlertCircle,
  CheckCircle2,
  KeyRound
} from 'lucide-react';
import { loginWithEmailPassword, registerWithEmailPassword, loginWithGoogle } from '../services/firebase';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (email: string, isAdmin: boolean) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [isRegister, setIsRegister] = useState(false);
  const [email, setEmail] = useState('cristianomoove@gmail.com');
  const [password, setPassword] = useState('admin123456');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const isAdminEmail = email.trim().toLowerCase() === 'cristianomoove@gmail.com';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!email.trim() || !password.trim()) {
      setErrorMsg('Por favor, preencha o e-mail e a senha.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('A senha deve conter no mínimo 6 caracteres.');
      return;
    }

    setIsLoading(true);

    try {
      if (isRegister) {
        const user = await registerWithEmailPassword(email.trim(), password);
        if (user) {
          setSuccessMsg('Conta criada com sucesso! Conectando...');
          setTimeout(() => {
            onSuccess(user.email || email, isAdminEmail);
            onClose();
          }, 800);
        } else {
          setErrorMsg('Não foi possível registrar com esses dados. Tente fazer login.');
        }
      } else {
        const user = await loginWithEmailPassword(email.trim(), password);
        if (user) {
          const isAdmin = (user.email || email).toLowerCase() === 'cristianomoove@gmail.com';
          setSuccessMsg(isAdmin ? 'Bem-vindo, Administrador Master!' : 'Login realizado com sucesso!');
          setTimeout(() => {
            onSuccess(user.email || email, isAdmin);
            onClose();
          }, 800);
        } else {
          setErrorMsg('E-mail ou senha inválidos. Verifique suas credenciais.');
        }
      }
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err?.message || 'Falha na autenticação. Verifique os dados informados.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const user = await loginWithGoogle();
      if (user) {
        const isAdmin = (user.email || '').toLowerCase() === 'cristianomoove@gmail.com';
        onSuccess(user.email || '', isAdmin);
        onClose();
      }
    } catch (err: any) {
      setErrorMsg('Erro ao conectar com Google. Tente com e-mail e senha.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/90 backdrop-blur-xl animate-fade-in">
      <div className="w-full max-w-md glass-card rounded-3xl border border-purple-500/30 p-6 sm:p-7 shadow-[0_0_60px_rgba(168,85,247,0.3)] relative">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 mb-5 border-b border-purple-500/15">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-purple-600 to-pink-600 flex items-center justify-center text-white shadow-[0_0_15px_rgba(217,70,239,0.4)]">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span>{isRegister ? 'Criar Acesso' : 'Entrar no Sistema'}</span>
                {isAdminEmail && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold">
                    ADMIN
                  </span>
                )}
              </h3>
              <p className="text-xs text-slate-400">
                {isRegister
                  ? 'Cadastre seu usuário para sincronizar com o Firestore'
                  : 'Acesse como administrador ou criador'}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
            aria-label="Fechar modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Admin credential badge alert */}
        <div className="p-3.5 rounded-2xl bg-purple-950/40 border border-purple-500/30 mb-5 text-xs">
          <div className="flex items-center gap-2 text-fuchsia-300 font-bold mb-1">
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
            <span>Perfil de Administrador Master</span>
          </div>
          <p className="text-slate-300 text-[11px] leading-relaxed">
            E-mail admin autorizado: <strong className="text-white font-mono">cristianomoove@gmail.com</strong>.
            Possui controle de todos os projetos, telemetria do Firestore e limpeza de banco.
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Email input */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-white flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-purple-400" />
              <span>E-mail do Administrador / Usuário</span>
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seuemail@exemplo.com"
              required
              className="w-full bg-slate-950 border border-purple-500/30 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-fuchsia-500"
            />
          </div>

          {/* Password input */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-white flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-purple-400" />
                <span>Senha de Acesso</span>
              </label>
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="text-[11px] text-slate-400 hover:text-slate-200 flex items-center gap-1"
              >
                {showPassword ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                <span>{showPassword ? 'Ocultar' : 'Mostrar'}</span>
              </button>
            </div>
            <input
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Digite sua senha (mínimo 6 dígitos)"
              required
              className="w-full bg-slate-950 border border-purple-500/30 rounded-xl px-3.5 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-fuchsia-500"
            />
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Submit button */}
          <button
            type="submit"
            disabled={isLoading}
            className="w-full min-h-[44px] flex items-center justify-center gap-2 py-3 rounded-xl font-bold text-xs text-white bg-gradient-to-r from-purple-600 via-fuchsia-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 shadow-[0_0_20px_rgba(217,70,239,0.35)] transition-all cursor-pointer disabled:opacity-50"
          >
            {isLoading ? (
              <span>Autenticando...</span>
            ) : isRegister ? (
              <>
                <UserPlus className="w-4 h-4" />
                <span>Cadastrar e Acessar</span>
              </>
            ) : (
              <>
                <LogIn className="w-4 h-4" />
                <span>Entrar como {isAdminEmail ? 'Admin' : 'Usuário'}</span>
              </>
            )}
          </button>
        </form>

        {/* Separator */}
        <div className="relative my-4">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-purple-500/15" />
          </div>
          <div className="relative flex justify-center text-[10px] uppercase font-mono">
            <span className="bg-[#0b0e1a] px-2 text-slate-500">ou conecte com</span>
          </div>
        </div>

        {/* Google Alternative Button */}
        <button
          onClick={handleGoogleLogin}
          disabled={isLoading}
          className="w-full min-h-[42px] flex items-center justify-center gap-2 py-2.5 rounded-xl border border-purple-500/30 hover:border-purple-500/50 bg-slate-900 hover:bg-slate-800 text-xs font-semibold text-slate-200 transition-all cursor-pointer"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24">
            <path
              fill="#4285F4"
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            />
            <path
              fill="#34A853"
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            />
            <path
              fill="#FBBC05"
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
            />
            <path
              fill="#EA4335"
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
            />
          </svg>
          <span>Continuar com Google (1-Clique)</span>
        </button>

        {/* Toggle between Login and Register */}
        <div className="mt-4 pt-3 border-t border-purple-500/10 text-center">
          <button
            type="button"
            onClick={() => {
              setIsRegister(!isRegister);
              setErrorMsg(null);
            }}
            className="text-xs text-purple-400 hover:text-fuchsia-300 font-semibold cursor-pointer"
          >
            {isRegister
              ? 'Já possui uma conta? Fazer login com e-mail'
              : 'Não tem uma conta? Criar nova conta com e-mail'}
          </button>
        </div>
      </div>
    </div>
  );
};
