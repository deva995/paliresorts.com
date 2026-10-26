import React, { useState, useEffect } from 'react';
import { useApp } from '../../context/AppContext';
import { Lock, UserRound, ArrowRight, AlertCircle, Loader2 } from 'lucide-react';

export const LoginView: React.FC = () => {
  const { login } = useApp();
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [unlockAt, setUnlockAt] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    if (!unlockAt) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [unlockAt]);
  const remainingSeconds = unlockAt ? Math.max(0, Math.ceil((Date.parse(unlockAt) - now) / 1000)) : 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting || remainingSeconds > 0) return;
    setErrorMessage(null);
    if (!identifier.trim() || !password) {
      setErrorMessage('Please enter both your identifier and password.');
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await login(identifier.trim(), password);
      if (!result.success && result.error) {
        setErrorMessage(result.error);
        setNow(Date.now());
        setUnlockAt(result.unlockAt || null);
      }
    } catch (err: any) {
      setErrorMessage(err?.message || 'Authentication failed. Please verify your credentials.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-[100dvh] sm:min-h-screen bg-[#F7F4EC] text-[#1D241F] flex flex-col justify-center py-4 sm:py-12 sm:px-6 lg:px-8 overflow-x-hidden font-sans">
      {/* Customer resort background — mobile only */}
      <div className="absolute inset-0 z-0 sm:hidden pointer-events-none" aria-hidden="true">
        <img
          src="/customer_resort_sunset.svg"
          alt=""
          className="w-full h-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0e2118]/85 via-[#0e2118]/35 to-[#0b1b14]/65" />
      </div>

      {/* Ambient background accents */}
      <div className="absolute top-0 -left-40 w-96 h-96 bg-[#526B4A]/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 -right-40 w-96 h-96 bg-[#C5A86A]/15 rounded-full blur-3xl pointer-events-none" />

      <div className="relative mt-0 sm:mt-6 sm:mx-auto sm:w-full sm:max-w-md z-10 px-4">
        <div className="bg-white/95 sm:bg-white backdrop-blur-sm sm:backdrop-blur-none text-[#1D241F] py-5 sm:py-8 px-5 sm:px-10 shadow-xl rounded-2xl border border-[#DDD8C9]">
          <div className="mb-4 sm:mb-6">
            <img
              src="/palilogo.png"
              alt="Pali Resort & Club"
              className="h-12 sm:h-16 w-auto object-contain mt-1 sm:mt-3 mx-auto"
              referrerPolicy="no-referrer"
            />
          </div>

          {errorMessage && (
            <div role="alert" className="mb-4 p-3 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {remainingSeconds > 0 && <p role="status" aria-live="polite" aria-atomic="true" className="mb-4 text-sm text-rose-800">
            Sign-in available at {new Date(unlockAt!).toLocaleTimeString()}. Try again in {remainingSeconds} seconds.
          </p>}
          <form onSubmit={handleSubmit} className="space-y-4 font-sans">
            <div>
              <label htmlFor="input-login-email" className="block text-xs font-bold uppercase text-[#1D241F] mb-1">
                Username
              </label>
              <div className="relative">
                <UserRound className="w-4 h-4 text-[#687067] absolute left-3 top-3.5" />
                <input
                  id="input-login-email"
                  type="text"
                  required
                  value={identifier}
                  onChange={e => { setIdentifier(e.target.value); setUnlockAt(null); }}
                  placeholder="Enter your username"
                  disabled={isSubmitting}
                  className="w-full pl-9 pr-3.5 py-2.5 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#163024] focus:bg-white text-[#1D241F] transition-all font-medium disabled:opacity-60"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label htmlFor="input-login-password" className="block text-xs font-bold uppercase text-[#1D241F]">
                  Password
                </label>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#687067] absolute left-3 top-3.5" />
                <input
                  id="input-login-password"
                  type="password"
                  required
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••"
                  disabled={isSubmitting}
                  className="w-full pl-9 pr-3.5 py-2.5 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-[#163024] focus:bg-white text-[#1D241F] transition-all font-medium disabled:opacity-60"
                />
              </div>
            </div>

            <button
              id="btn-login-submit"
              type="submit"
              disabled={isSubmitting || remainingSeconds > 0}
              className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl shadow-md text-sm font-bold text-[#F7F4EC] bg-[#163024] hover:bg-[#0f2219] transition-all cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Authenticating...</span>
                </>
              ) : (
                <>
                  <span>Sign In</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>


        </div>
      </div>
    </div>
  );
};
