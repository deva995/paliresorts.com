import React, { useState, useEffect, useRef } from 'react';
import { useApp } from '../../context/AppContext';
import {
  validateIndianMobile,
  maskMobileNumber,
  OTP_LENGTH,
  OTP_RESEND_COOLDOWN_SEC
} from '../../utils/otpAuth';
import { CustomerDiningSession } from '../../types';
import { DevOtpCornerCard } from '../../components/customer/DevOtpCornerCard';
import {
  ShieldCheck,
  Smartphone,
  ArrowRight,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  Clock,
  Sparkles,
  User,
  Eye,
  EyeOff
} from 'lucide-react';

interface CustomerMobileAuthProps {
  tableNumber: string;
  tableId: string;
  restaurantId: string;
  title?: string;
  subtitle?: string;
  submitButtonText?: string;
  onSuccess: (session: CustomerDiningSession) => void;
  onCancel?: () => void;
}

export const CustomerMobileAuth: React.FC<CustomerMobileAuthProps> = ({
  tableNumber,
  tableId,
  restaurantId,
  title,
  subtitle,
  submitButtonText,
  onSuccess,
  onCancel
}) => {
  const {
    sendCustomerOTP,
    verifyCustomerOTP,
    resendCustomerOTP,
    activeOtpRequest,
    customerSession,
    updateCustomerSessionName,
    customers
  } = useApp();

  // Auth Steps: 'mobile' | 'otp' | 'name'
  const [step, setStep] = useState<'mobile' | 'otp' | 'name'>('mobile');

  // Mobile Input State
  const [rawMobile, setRawMobile] = useState('');
  const [mobileError, setMobileError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  // OTP Input State (6 digits)
  const [otpDigits, setOtpDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [otpError, setOtpError] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [cooldownSeconds, setCooldownSeconds] = useState(0);
  const [isExpired, setIsExpired] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const [isDevOtpDismissed, setIsDevOtpDismissed] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Name Input State (for new customers without existing name)
  const [customerName, setCustomerName] = useState('');
  const [nameError, setNameError] = useState<string | null>(null);
  const [tempVerifiedCustomer, setTempVerifiedCustomer] = useState<{
    customerId: string;
    mobile: string;
    maskedMobile: string;
  } | null>(null);

  // Toggle for guest to view full resort background ambiance
  const [isAmbianceView, setIsAmbianceView] = useState(false);

  // Cooldown countdown timer for Resend OTP
  useEffect(() => {
    let interval: any = null;
    if (cooldownSeconds > 0) {
      interval = setInterval(() => {
        setCooldownSeconds(prev => (prev > 1 ? prev - 1 : 0));
      }, 1000);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [cooldownSeconds]);

  // Expiration watcher based on activeOtpRequest
  useEffect(() => {
    if (!activeOtpRequest || step !== 'otp') return;

    const checkExpiry = () => {
      const now = Date.now();
      if (now > activeOtpRequest.expiresAt) {
        setIsExpired(true);
      }
    };

    checkExpiry();
    const interval = setInterval(checkExpiry, 2000);
    return () => clearInterval(interval);
  }, [activeOtpRequest, step]);

  // Handle Mobile Submit & Send OTP
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setMobileError(null);

    const validation = validateIndianMobile(rawMobile);
    if (!validation.isValid) {
      setMobileError(validation.error || 'Please enter a valid 10-digit mobile number.');
      return;
    }

    setIsSending(true);
    try {
      const result = await sendCustomerOTP(validation.rawDigits, tableId, restaurantId, tableNumber);
      if (!result.success) {
        setMobileError(result.error || 'Failed to send OTP. Please try again.');
        setIsSending(false);
        return;
      }

      // Reset OTP screen state
      setOtpDigits(Array(OTP_LENGTH).fill(''));
      setOtpError(null);
      setIsExpired(false);
      setIsLocked(false);
      setCooldownSeconds(OTP_RESEND_COOLDOWN_SEC);
      setIsDevOtpDismissed(false);
      setStep('otp');

      // Auto-focus first input box
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 150);
    } catch (err: any) {
      setMobileError(err?.message || 'Service unavailable. Please notify the table captain.');
    } finally {
      setIsSending(false);
    }
  };

  // Handle OTP digit changes
  const handleDigitChange = (index: number, val: string) => {
    // Digits only
    const clean = val.replace(/\D/g, '');
    if (!clean) {
      const copy = [...otpDigits];
      copy[index] = '';
      setOtpDigits(copy);
      return;
    }

    // Handle paste of full 6 digits
    if (clean.length > 1) {
      const pasted = clean.slice(0, OTP_LENGTH).split('');
      const newDigits = [...otpDigits];
      pasted.forEach((d, i) => {
        if (i < OTP_LENGTH) newDigits[i] = d;
      });
      setOtpDigits(newDigits);
      const nextIdx = Math.min(pasted.length, OTP_LENGTH - 1);
      inputRefs.current[nextIdx]?.focus();
      if (newDigits.join('').length === OTP_LENGTH) {
        setTimeout(() => handleVerifyOtp(undefined, newDigits.join('')), 80);
      }
      return;
    }

    const copy = [...otpDigits];
    copy[index] = clean.slice(-1);
    setOtpDigits(copy);

    // Auto-advance to next box or auto-verify when 6th digit entered
    if (clean && index < OTP_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    } else if (clean && index === OTP_LENGTH - 1) {
      if (copy.every(d => d !== '') && copy.join('').length === OTP_LENGTH) {
        setTimeout(() => handleVerifyOtp(undefined, copy.join('')), 80);
      }
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // Handle OTP Verification Submit
  const handleVerifyOtp = async (e?: React.FormEvent, overrideOtp?: string) => {
    if (e) e.preventDefault();
    setOtpError(null);

    const enteredOtp = overrideOtp || otpDigits.join('');
    if (enteredOtp.length !== OTP_LENGTH) {
      setOtpError(`Please enter all ${OTP_LENGTH} digits.`);
      return;
    }

    setIsVerifying(true);
    try {
      const result = await verifyCustomerOTP(enteredOtp);
      if (!result.success) {
        setOtpError(result.error || 'Invalid OTP code. Please try again.');
        setIsVerifying(false);
        return;
      }

      // Verification Succeeded!
      const session = result.session!;

      // Check if customer already has a personalized name
      const existingCust = customers.find(c => c.id === session.customerId);
      const hasRealName = existingCust?.name && existingCust.name !== 'Resort Guest' && existingCust.name.trim().length > 1;

      if (!hasRealName) {
        // Step 3: Lightweight "WHAT SHOULD WE CALL YOU?" step
        setTempVerifiedCustomer({
          customerId: session.customerId,
          mobile: session.mobileNumber,
          maskedMobile: session.maskedMobile,
        });
        setCustomerName('');
        setStep('name');
      } else {
        // Returning customer with recognized name: Proceed directly to menu!
        onSuccess(session);
      }
    } catch (err: any) {
      setOtpError(err?.message || 'Verification system error. Please try again.');
    } finally {
      setIsVerifying(false);
    }
  };

  // Resend OTP
  const handleResendOtp = async () => {
    if (cooldownSeconds > 0) return;
    setOtpError(null);
    setIsExpired(false);
    setIsLocked(false);
    setIsDevOtpDismissed(false);
    setOtpDigits(Array(OTP_LENGTH).fill(''));

    const result = await resendCustomerOTP();
    if (result.success) {
      setCooldownSeconds(OTP_RESEND_COOLDOWN_SEC);
      inputRefs.current[0]?.focus();
    } else {
      setOtpError(result.error || 'Failed to resend OTP.');
    }
  };

  // Handle Name Submit
  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = customerName.trim() || 'Resort Guest';

    if (tempVerifiedCustomer) {
      updateCustomerSessionName(cleanName);
    }
    if (customerSession) {
      const updatedSession = { ...customerSession, customerName: cleanName };
      onSuccess(updatedSession);
    } else {
      setStep('mobile');
      setMobileError('Your verified session is unavailable. Please verify again.');
    }
  };

  return (
    <div className="relative min-h-[780px] w-full flex flex-col justify-between overflow-hidden rounded-3xl text-[#1D241F] font-sans shadow-2xl">
      {/* Background Luxury Resort Image with Sunset, Poolside & Evening Candlelit Ambiance */}
      <div className="absolute inset-0 z-0 select-none">
        <img
          src="/customer_resort_sunset.svg"
          alt="Pali Resort & Club Sunset Dining Ambiance"
          className="w-full h-full object-cover object-center transform scale-100 transition-transform duration-700 ease-out"
          referrerPolicy="no-referrer"
        />
        {/* Deep luxury gradient overlays */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0e2118]/90 via-[#0e2118]/30 to-[#0b1b14]/60" />
        <div className="absolute inset-0 bg-radial from-transparent via-[#0e2118]/20 to-[#0a1711]/75" />
      </div>

      {/* Top Floating Utility Bar */}
      <div className="relative z-20 pt-4 px-4 sm:px-6 flex items-center justify-between">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-black/45 backdrop-blur-md border border-white/20 text-white text-xs font-semibold hover:bg-black/70 transition-all cursor-pointer shadow-sm"
          >
            <span>← Back</span>
          </button>
        ) : (
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-black/45 backdrop-blur-md border border-[#C5A86A]/40 text-[#f3e7c4] text-xs font-semibold shadow-sm">
            <span className="w-2 h-2 rounded-full bg-[#C5A86A] animate-pulse" />
            <span>Table {tableNumber}</span>
          </div>
        )}

        {/* Guest Action: Toggle to admire full resort sunset photograph */}
        <button
          type="button"
          onClick={() => setIsAmbianceView(!isAmbianceView)}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-black/45 backdrop-blur-md border border-[#C5A86A]/50 text-[#f3e7c4] text-xs font-semibold hover:bg-black/70 transition-all cursor-pointer shadow-md"
          title={isAmbianceView ? 'Return to customer login' : 'View full resort photo'}
        >
          {isAmbianceView ? (
            <>
              <EyeOff className="w-3.5 h-3.5 text-[#C5A86A]" />
              <span>Login Form</span>
            </>
          ) : (
            <>
              <Eye className="w-3.5 h-3.5 text-[#C5A86A]" />
              <span>Resort Ambiance</span>
            </>
          )}
        </button>
      </div>

      {/* Center Section: Customer Login Form Card or Full Ambiance Card */}
      <div className="relative z-10 w-full max-w-md mx-auto p-4 sm:p-6 my-auto">
        {isAmbianceView ? (
          <div className="text-center p-6 bg-black/60 backdrop-blur-md rounded-3xl border border-[#C5A86A]/40 text-white space-y-3 shadow-2xl animate-fadeIn">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#c5a86a]/20 border border-[#c5a86a]/40 text-[#f3e7c4] text-[11px] font-semibold tracking-wider uppercase">
              <Sparkles className="w-3 h-3 text-[#dfc78f]" />
              <span>Poolside Dining Experience</span>
            </div>
            <h2 className="text-2xl font-serif font-bold text-white tracking-wide">Pali Resort &amp; Club</h2>
            <p className="text-xs text-stone-200 leading-relaxed max-w-xs mx-auto">
              Table {tableNumber} • Sunset dining by the pool with handcrafted cocktails and coastal forest breeze.
            </p>
            <button
              type="button"
              onClick={() => setIsAmbianceView(false)}
              className="mt-2 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-[#163024] hover:bg-[#0f2219] text-[#F7F4EC] text-xs font-bold border border-[#C5A86A]/60 transition-all shadow-lg cursor-pointer"
            >
              <span>Continue Customer Login</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#C5A86A]" />
            </button>
          </div>
        ) : (
          <div className="bg-[#fcfbf7]/95 sm:bg-[#fcfbf7]/92 backdrop-blur-md rounded-3xl border border-[#C5A86A]/35 shadow-2xl p-6 sm:p-8 space-y-6">

            {/* Brand Header */}
            <div className="text-center space-y-2 border-b border-[#DDD8C9] pb-4 relative">
              <div className="bg-white p-3 rounded-2xl shadow-xs border border-[#DDD8C9] inline-block mx-auto max-w-[240px]">
                <img
                  src="/palilogo.png"
                  alt="Pali Resort & Club • Pali Village"
                  className="h-14 sm:h-16 w-auto object-contain mx-auto"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div>
                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#163024] text-[#F7F4EC] rounded-full text-xs font-mono font-bold shadow-xs">
                  <span className="w-2 h-2 rounded-full bg-[#C5A86A] animate-pulse" />
                  <span>TABLE {tableNumber}</span>
                </div>
              </div>
            </div>

        {/* STEP 1: MOBILE NUMBER INPUT */}
        {step === 'mobile' && (
          <div className="space-y-5">
            <div className="text-center space-y-1.5">
              <h1 className="text-2xl font-bold font-serif text-[#163024]">
                {title || 'Welcome'}
              </h1>
              <p className="text-xs text-[#687067] font-medium">
                {subtitle || 'Enter your mobile number to continue.'}
              </p>
            </div>

            {mobileError && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-start justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span className="font-medium">{mobileError}</span>
                </div>
                <button
                  type="button"
                  onClick={(e) => handleSendOtp(e)}
                  disabled={isSending || rawMobile.length !== 10}
                  className="shrink-0 px-2.5 py-1 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-900 font-bold text-[11px] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Retry
                </button>
              </div>
            )}

            <form onSubmit={handleSendOtp} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-[#163024] mb-1.5 tracking-wider">
                  Mobile Number
                </label>
                <div className="relative flex items-center">
                  {/* Indian Flag & Country Code Prefix */}
                  <div className="absolute left-3.5 flex items-center gap-1.5 pointer-events-none text-stone-700 font-bold text-sm">
                    <span className="text-base">🇮🇳</span>
                    <span>+91</span>
                    <span className="text-stone-300 ml-1">|</span>
                  </div>
                  <input
                    id="input-customer-mobile"
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    value={rawMobile}
                    onChange={e => {
                      const clean = e.target.value.replace(/\D/g, '');
                      setRawMobile(clean);
                      if (mobileError) setMobileError(null);
                    }}
                    placeholder="10-digit mobile"
                    className="w-full pl-24 pr-4 py-3.5 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl text-base font-mono font-semibold tracking-wider text-[#1D241F] focus:outline-none focus:ring-2 focus:ring-[#163024] focus:bg-white transition-all"
                    autoFocus
                  />
                </div>
                <p className="text-[11px] text-[#687067] mt-1.5">
                  Your number is used to identify your dining session.
                </p>
              </div>

              <button
                id="btn-send-otp"
                type="submit"
                disabled={isSending || rawMobile.length !== 10}
                className={`w-full py-3.5 px-4 rounded-xl font-bold text-xs uppercase tracking-widest text-[#F7F4EC] bg-[#163024] hover:bg-[#0f2219] transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer ${
                  rawMobile.length !== 10 || isSending ? 'opacity-60 cursor-not-allowed' : ''
                }`}
              >
                {isSending ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-[#C5A86A]" />
                    <span>REQUESTING OTP...</span>
                  </>
                ) : (
                  <>
                    <span>SEND OTP</span>
                    <ArrowRight className="w-4 h-4 text-[#C5A86A]" />
                  </>
                )}
              </button>
            </form>

            <div className="pt-2 border-t border-[#DDD8C9]/80 text-center">
              <p className="text-[10px] text-[#687067] leading-relaxed">
                By entering, you confirm you are seated at Table {tableNumber} of Pali Resort & Club.
              </p>
            </div>
          </div>
        )}

        {/* STEP 2: OTP VERIFICATION */}
        {step === 'otp' && (
          <div className="space-y-5">
            {/* Dev OTP Corner Card */}
            {activeOtpRequest?.devOtp && !isDevOtpDismissed && !isExpired && (
              <DevOtpCornerCard
                otp={activeOtpRequest.devOtp}
                onClose={() => setIsDevOtpDismissed(true)}
              />
            )}

            <div className="text-center space-y-1.5">
              <h1 className="text-xl font-bold font-serif text-[#163024]">
                VERIFY MOBILE NUMBER
              </h1>
              <p className="text-xs text-[#687067]">
                Enter the 6-digit OTP sent to{' '}
                <span className="font-semibold text-[#163024]">{maskMobileNumber(rawMobile)}</span>
              </p>
              <button
                type="button"
                onClick={() => {
                  setStep('mobile');
                  setOtpError(null);
                }}
                className="text-[11px] text-[#526B4A] hover:text-[#163024] font-semibold underline cursor-pointer"
              >
                Change mobile number
              </button>
            </div>

            {/* Error alerts with Resend/Retry action for failed, expired or 429 errors */}
            {(otpError || isExpired) && (
              <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl flex items-start justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                  <span className="font-medium">
                    {isExpired
                      ? 'Your OTP code has expired. Please request a new OTP.'
                      : otpError}
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {!isExpired && (
                    <button
                      type="button"
                      onClick={() => handleVerifyOtp()}
                      disabled={isVerifying || otpDigits.join('').length !== OTP_LENGTH}
                      className="shrink-0 px-2.5 py-1 rounded-lg bg-stone-200 hover:bg-stone-300 text-stone-900 font-bold text-[11px] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Retry
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    disabled={cooldownSeconds > 0}
                    className="shrink-0 px-2.5 py-1 rounded-lg bg-rose-100 hover:bg-rose-200 text-rose-900 font-bold text-[11px] transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {cooldownSeconds > 0 ? `Resend (${cooldownSeconds}s)` : 'Resend'}
                  </button>
                </div>
              </div>
            )}

            {/* 6 Individual Numeric Digits */}
            <div className="space-y-3">
              <div className="flex justify-center items-center gap-2 sm:gap-2.5">
                {otpDigits.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={el => (inputRefs.current[idx] = el)}
                    id={`input-otp-digit-${idx}`}
                    type="password"
                    aria-label={`Verification digit ${idx+1}`}
                    inputMode="numeric"
                    pattern="[0-9]*"
                    maxLength={1}
                    disabled={isVerifying}
                    value={digit ? '•' : ''}
                    onChange={e => handleDigitChange(idx, e.target.value)}
                    onKeyDown={e => handleKeyDown(idx, e)}
                    className={`w-11 h-13 sm:w-12 sm:h-14 text-center text-xl font-mono font-bold rounded-xl border transition-all ${
                      digit
                        ? 'border-[#163024] bg-white text-[#163024] ring-1 ring-[#163024]'
                        : 'border-[#DDD8C9] bg-[#F7F4EC] text-[#1D241F]'
                    } focus:outline-none focus:ring-2 focus:ring-[#C5A86A]`}
                  />
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="space-y-3">
              <button
                id="btn-verify-otp"
                type="button"
                onClick={() => handleVerifyOtp()}
                disabled={isVerifying || otpDigits.join('').length !== OTP_LENGTH}
                className={`w-full py-3.5 px-4 rounded-xl font-bold text-xs uppercase tracking-widest text-[#F7F4EC] bg-[#163024] hover:bg-[#0f2219] transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer ${
                  otpDigits.join('').length !== OTP_LENGTH || isVerifying ? 'opacity-60 cursor-not-allowed' : ''
                }`}
              >
                {isVerifying ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-[#C5A86A]" />
                    <span>VERIFYING OTP...</span>
                  </>
                ) : (
                  <>
                    <span>VERIFY OTP</span>
                    <ArrowRight className="w-4 h-4 text-[#C5A86A]" />
                  </>
                )}
              </button>

              {/* Resend Cooldown Link */}
              <div className="text-center pt-1">
                <span className="text-xs text-[#687067]">Didn't receive the code? </span>
                {cooldownSeconds > 0 ? (
                  <span className="text-xs font-semibold text-[#687067]">
                    Resend in {cooldownSeconds}s
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={handleResendOtp}
                    className="text-xs font-bold text-[#526B4A] hover:text-[#163024] underline cursor-pointer ml-1"
                  >
                    RESEND OTP
                  </button>
                )}
              </div>
            </div>

          </div>
        )}

        {/* STEP 3: "WHAT SHOULD WE CALL YOU?" (Lightweight step for new customers) */}
        {step === 'name' && (
          <div className="space-y-5">
            <div className="text-center space-y-1.5">
              <div className="w-12 h-12 mx-auto rounded-full bg-[#163024]/10 text-[#163024] flex items-center justify-center">
                <User className="w-6 h-6 text-[#163024]" />
              </div>
              <h1 className="text-xl sm:text-2xl font-bold font-serif text-[#163024]">
                WHAT SHOULD WE CALL YOU?
              </h1>
              <p className="text-xs text-[#687067]">
                Help our dining captains personalize your experience at Pali Resort & Club.
              </p>
            </div>

            <form onSubmit={handleNameSubmit} className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase text-[#163024] mb-1.5 tracking-wider">
                  Your Name
                </label>
                <input
                  id="input-customer-name"
                  type="text"
                  value={customerName}
                  onChange={e => setCustomerName(e.target.value)}
                  placeholder="e.g. Rahul Mehta"
                  className="w-full px-4 py-3.5 bg-[#F7F4EC] border border-[#DDD8C9] rounded-xl text-sm font-semibold text-[#1D241F] focus:outline-none focus:ring-2 focus:ring-[#163024] focus:bg-white transition-all"
                  autoFocus
                />
              </div>

              <button
                id="btn-continue-dining"
                type="submit"
                className="w-full py-3.5 px-4 rounded-xl font-bold text-xs uppercase tracking-widest text-[#F7F4EC] bg-[#163024] hover:bg-[#0f2219] transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>{submitButtonText || 'CONTINUE TO DINING MENU'}</span>
                <ArrowRight className="w-4 h-4 text-[#C5A86A]" />
              </button>
            </form>
          </div>
        )}

          </div>
        )}
      </div>

      {/* Bottom Subtle Location Footer */}
      <div className="relative z-10 pb-4 px-4 text-center">
        <p className="text-[11px] text-white/80 font-medium drop-shadow-xs">
          Pali Resort &amp; Club • Nature&apos;s Gateway • Coastal Sanctuary
        </p>
      </div>
    </div>
  );
};
