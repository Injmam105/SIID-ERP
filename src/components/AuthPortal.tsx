import React, { useEffect, useState } from 'react';
import {
  Building2,
  Download,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Moon,
  Phone,
  ShieldCheck,
  Sun,
  UserCheck,
  UserPlus,
} from 'lucide-react';
import { apiFetch, type CompanySettings, setToken } from '../lib/api.ts';

interface SetupStatus {
  ownerInitialized: boolean;
  ownerMobileHint: string;
  requireSetupSecret: boolean;
  smsConfigured: boolean;
  smsProvider: string | null;
  smsMissingVars: string[];
  dbMode: string;
  company: CompanySettings;
}

interface Props {
  darkMode: boolean;
  onToggleDark: () => void;
  onAuthenticated: () => void;
}

export function AuthPortal({ darkMode, onToggleDark, onAuthenticated }: Props) {
  const [setup, setSetup] = useState<SetupStatus | null>(null);
  const [portal, setPortal] = useState<'ADMIN' | 'EMPLOYEE' | 'CLIENT'>('ADMIN');
  const [mode, setMode] = useState<'LOGIN' | 'REGISTER_EMPLOYEE' | 'REGISTER_CLIENT' | 'FORGOT_PASSWORD'>('LOGIN');
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Login fields
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');

  // Initial Owner Bootstrap fields
  const [ownerName, setOwnerName] = useState('MD Zawed Ansar');
  const [ownerMobile, setOwnerMobile] = useState('9650598785');
  const [ownerEmail, setOwnerEmail] = useState('sirahiinfrainteriordesign@gmail.com');
  const [ownerPw, setOwnerPw] = useState('');
  const [ownerConfirm, setOwnerConfirm] = useState('');
  const [setupSecret, setSetupSecret] = useState('');

  // Registration & OTP fields
  const [regName, setRegName] = useState('');
  const [regMobile, setRegMobile] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regEmpType, setRegEmpType] = useState('PERMANENT');
  const [regAddress, setRegAddress] = useState('');
  const [regEmergency, setRegEmergency] = useState('');
  const [regCity, setRegCity] = useState('');
  const [regState, setRegState] = useState('');
  const [regGstin, setRegGstin] = useState('');
  const [regPw, setRegPw] = useState('');
  const [regConfirm, setRegConfirm] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [otpVerifiedToken, setOtpVerifiedToken] = useState<string | null>(null);

  useEffect(() => {
    apiFetch<SetupStatus>('/auth/setup-status')
      .then(setSetup)
      .catch((e) => setError((e as Error).message));
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  function resetOtpState() {
    setOtpSent(false);
    setOtpInput('');
    setOtpVerifiedToken(null);
    setCooldown(0);
    setError(null);
    setSuccess(null);
  }

  async function handleOwnerBootstrap(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<{ token: string }>('/auth/bootstrap-owner', {
        method: 'POST',
        body: JSON.stringify({
          mobile: ownerMobile,
          fullName: ownerName,
          email: ownerEmail,
          password: ownerPw,
          confirmPassword: ownerConfirm,
          setupSecret,
        }),
      });
      setToken(res.token);
      onAuthenticated();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<{ token: string }>('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ identifier, password, portal }),
      });
      setToken(res.token);
      onAuthenticated();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleSendOtp(purpose: 'EMPLOYEE_REGISTER' | 'CLIENT_REGISTER' | 'PASSWORD_RESET') {
    setBusy(true);
    setError(null);
    setSuccess(null);
    try {
      const res = await apiFetch<{ message: string; resendCooldownSeconds: number }>('/otp/send', {
        method: 'POST',
        body: JSON.stringify({ mobile: regMobile, purpose }),
      });
      setOtpSent(true);
      setCooldown(res.resendCooldownSeconds || 60);
      setSuccess(res.message);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleVerifyOtp(purpose: 'EMPLOYEE_REGISTER' | 'CLIENT_REGISTER' | 'PASSWORD_RESET') {
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<{ otpVerificationToken: string }>('/otp/verify', {
        method: 'POST',
        body: JSON.stringify({ mobile: regMobile, purpose, otp: otpInput }),
      });
      setOtpVerifiedToken(res.otpVerificationToken);
      setSuccess('Mobile number verified via SMS OTP.');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleRegisterSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!otpVerifiedToken) {
      setError('Mandatory mobile SMS OTP verification has not been completed.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      if (mode === 'REGISTER_EMPLOYEE') {
        const res = await apiFetch<{ message: string }>('/auth/register/employee', {
          method: 'POST',
          body: JSON.stringify({
            fullName: regName,
            mobile: regMobile,
            email: regEmail,
            password: regPw,
            confirmPassword: regConfirm,
            employeeType: regEmpType,
            address: regAddress,
            emergencyContact: regEmergency,
            otpVerificationToken: otpVerifiedToken,
          }),
        });
        setSuccess(res.message);
      } else {
        const res = await apiFetch<{ message: string }>('/auth/register/client', {
          method: 'POST',
          body: JSON.stringify({
            clientName: regName,
            mobile: regMobile,
            email: regEmail,
            password: regPw,
            confirmPassword: regConfirm,
            address: regAddress,
            city: regCity,
            state: regState,
            gstin: regGstin,
            otpVerificationToken: otpVerifiedToken,
          }),
        });
        setSuccess(res.message);
      }
      resetOtpState();
      setMode('LOGIN');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function handleResetPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!otpVerifiedToken) {
      setError('Verify your mobile via SMS OTP first.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await apiFetch<{ message: string }>('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          mobile: regMobile,
          newPassword: regPw,
          confirmPassword: regConfirm,
          otpVerificationToken: otpVerifiedToken,
        }),
      });
      setSuccess(res.message);
      resetOtpState();
      setMode('LOGIN');
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const company = setup?.company;
  const logoSrc = company?.logo_url || '/src/assets/images/siid_company_logo_1794819635021.jpg';

  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] dark:bg-[#07111E] text-[#0B1F3A] dark:text-slate-100">
      <header className="h-16 px-6 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-[#0B1728] flex items-center justify-between gap-8">
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-9 h-9 rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden bg-white flex items-center justify-center">
            <img
              src={logoSrc}
              alt="SIID Logo"
              referrerPolicy="no-referrer"
              className="w-full h-full object-contain"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
          <span className="font-display font-bold text-lg tracking-tight whitespace-nowrap">SIID ERP</span>
        </div>

        <nav className="hidden md:flex items-center gap-6 text-sm text-slate-600 dark:text-slate-300">
          <a href="#login-panel" className="hover:text-[#0B1F3A] dark:hover:text-white whitespace-nowrap shrink-0">
            Role Access
          </a>
          <a href="/api/export-flutter-bundle" className="hover:text-[#0B1F3A] dark:hover:text-white whitespace-nowrap shrink-0 flex items-center gap-1.5">
            <Download className="w-3.5 h-3.5" />
            Flutter & MySQL Source
          </a>
          <span className="text-slate-400 whitespace-nowrap shrink-0 tabular-nums">IT Support: 7503354996</span>
        </nav>

        <button
          type="button"
          onClick={onToggleDark}
          aria-label="Toggle Light and Dark Mode"
          className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-medium flex items-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800 whitespace-nowrap shrink-0"
        >
          {darkMode ? <Sun className="w-4 h-4 text-[#C69B2D]" /> : <Moon className="w-4 h-4 text-[#0B1F3A]" />}
          <span>{darkMode ? 'Light' : 'Dark'}</span>
        </button>
      </header>

      <main className="flex-1 grid lg:grid-cols-12 items-stretch">
        {/* Left Architectural Brand Column */}
        <section className="lg:col-span-6 relative overflow-hidden bg-[#0B1F3A] text-white flex flex-col justify-between p-8 lg:p-12">
          <img
            src="/src/assets/images/siid_hero_architecture_1794819636763.jpg"
            alt="Sirahi Infrastructure & Interior Design Studio"
            referrerPolicy="no-referrer"
            className="absolute inset-0 w-full h-full object-cover opacity-30"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0B1F3A] via-[#0B1F3A]/75 to-[#0B1F3A]/40" />

          <div className="relative z-10 flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-white p-1.5 shadow-sm flex items-center justify-center shrink-0">
              <img
                src={logoSrc}
                alt="Sirahi Infrastructure & Interior Design"
                referrerPolicy="no-referrer"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <p className="text-xs font-medium text-[#E5C158] tracking-wide">
                Sirahi Infrastructure & Interior Design
              </p>
              <p className="text-xs text-slate-300 tabular-nums">GSTIN: 07DCYPA1228R1ZZ · sirahi.in</p>
            </div>
          </div>

          <div className="relative z-10 my-10 max-w-xl">
            <h1 className="font-display text-3xl lg:text-5xl font-bold leading-tight text-balance">
              One Company. Multiple Projects. Complete Control.
            </h1>
            <p className="mt-4 text-slate-200 text-base leading-relaxed">
              Enterprise resource planning for interior design studios, civil infrastructure sites, material brand
              specifications, attendance, payroll, quotations, and real-time multi-device cloud synchronization.
            </p>
            <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-4 border-t border-white/15 pt-6 text-xs text-slate-200">
              <div>
                <p className="font-semibold text-white">Director / Owner</p>
                <p className="mt-1">MD Zawed Ansar</p>
                <p className="font-mono tabular-nums text-[#E5C158]">9650598785</p>
              </div>
              <div>
                <p className="font-semibold text-white">Official Contact</p>
                <p className="mt-1 truncate">sirahiinfrainteriordesign@gmail.com</p>
                <p className="text-slate-300">https://sirahi.in</p>
              </div>
              <div>
                <p className="font-semibold text-white">IT Head & Support</p>
                <p className="mt-1">Injmam Ansari</p>
                <p className="font-mono tabular-nums text-[#E5C158]">7503354996</p>
              </div>
            </div>
          </div>

          <div className="relative z-10 flex flex-wrap items-center justify-between gap-4 border-t border-white/15 pt-5 text-xs text-slate-300">
            <span>Architecture · Flutter Mobile Client + Node.js & MySQL Backend</span>
            <a
              href="/api/export-flutter-bundle"
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-white/10 hover:bg-white/20 text-white font-medium transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              Download Flutter + MySQL Codebase (.zip)
            </a>
          </div>
        </section>

        {/* Right Authentication Column */}
        <section id="login-panel" className="lg:col-span-6 flex items-center justify-center p-6 sm:p-10">
          <div className="w-full max-w-md bg-white dark:bg-[#0F1D32] border border-slate-200 dark:border-slate-800 rounded-xl p-7">
            {/* Portal Tabs */}
            {mode === 'LOGIN' && (
              <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 dark:bg-slate-800/70 rounded-lg mb-6">
                {(['ADMIN', 'EMPLOYEE', 'CLIENT'] as const).map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => {
                      setPortal(p);
                      setError(null);
                      setSuccess(null);
                    }}
                    className={`py-2 px-3 rounded-md text-xs font-semibold transition-colors whitespace-nowrap ${
                      portal === p
                        ? 'bg-[#0B1F3A] text-white dark:bg-[#1D4ED8]'
                        : 'text-slate-600 dark:text-slate-300 hover:text-slate-900'
                    }`}
                  >
                    {p === 'ADMIN' ? 'Admin Login' : p === 'EMPLOYEE' ? 'Employee Login' : 'Client Login'}
                  </button>
                ))}
              </div>
            )}

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-xs text-red-700 dark:text-red-300">
                {error}
              </div>
            )}
            {success && (
              <div className="mb-4 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-900 text-xs text-emerald-700 dark:text-emerald-300">
                {success}
              </div>
            )}

            {/* Protected First-Time Owner Bootstrap */}
            {setup && !setup.ownerInitialized && portal === 'ADMIN' && mode === 'LOGIN' ? (
              <form onSubmit={handleOwnerBootstrap} className="space-y-4">
                <div className="flex items-start gap-3 pb-3 border-b border-slate-200 dark:border-slate-800">
                  <ShieldCheck className="w-5 h-5 text-[#C69B2D] shrink-0 mt-0.5" />
                  <div>
                    <h2 className="font-display font-bold text-lg">Initial Owner Account Setup</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      Protected bootstrap for authorized Owner mobile <span className="font-mono">9650598785</span>.
                      Locks permanently after activation.
                    </p>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">Owner / Director Full Name</label>
                  <input
                    type="text"
                    required
                    value={ownerName}
                    onChange={(e) => setOwnerName(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium mb-1">Authorized Mobile</label>
                    <input
                      type="text"
                      readOnly
                      value={ownerMobile}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 font-mono tabular-nums"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium mb-1">Official Email</label>
                    <input
                      type="email"
                      required
                      value={ownerEmail}
                      onChange={(e) => setOwnerEmail(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">
                    Strong Password (8+ chars, Upper, Lower, Digit, Symbol)
                  </label>
                  <input
                    type="password"
                    required
                    value={ownerPw}
                    onChange={(e) => setOwnerPw(e.target.value)}
                    placeholder="Create strong Owner password"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">Confirm Password</label>
                  <input
                    type="password"
                    required
                    value={ownerConfirm}
                    onChange={(e) => setOwnerConfirm(e.target.value)}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
                  />
                </div>
                {setup.requireSetupSecret && (
                  <div>
                    <label className="block text-xs font-medium mb-1">Server Setup Security Key</label>
                    <input
                      type="password"
                      required
                      value={setupSecret}
                      onChange={(e) => setSetupSecret(e.target.value)}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
                    />
                  </div>
                )}

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full py-2.5 px-4 rounded-lg bg-[#0B1F3A] hover:bg-[#132E54] text-white text-sm font-semibold transition-colors disabled:opacity-50"
                >
                  {busy ? 'Initializing Owner Account...' : 'Initialize Owner Account'}
                </button>
              </form>
            ) : mode === 'LOGIN' ? (
              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <h2 className="font-display font-bold text-xl">
                    {portal === 'ADMIN'
                      ? 'Admin & Management Login'
                      : portal === 'EMPLOYEE'
                        ? 'Employee & Labour Login'
                        : 'Client Portal Login'}
                  </h2>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Sign in with your registered mobile number or email address.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-medium mb-1">Mobile Number or Email</label>
                  <input
                    type="text"
                    required
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder="e.g. 9650598785"
                    className="w-full px-3.5 py-2.5 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
                  />
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-medium">Password</label>
                    <button
                      type="button"
                      onClick={() => {
                        resetOtpState();
                        setMode('FORGOT_PASSWORD');
                      }}
                      className="text-xs text-[#1D4ED8] hover:underline"
                    >
                      Forgot Password?
                    </button>
                  </div>
                  <div className="relative">
                    <input
                      type={showPw ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full px-3.5 py-2.5 pr-10 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(!showPw)}
                      aria-label="Toggle password visibility"
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-700"
                    >
                      {showPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={busy}
                  className="w-full py-2.5 px-4 rounded-lg bg-[#0B1F3A] hover:bg-[#132E54] dark:bg-[#1D4ED8] text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                >
                  <Lock className="w-4 h-4" />
                  <span>{busy ? 'Authenticating...' : 'Sign In'}</span>
                </button>

                {portal !== 'ADMIN' && (
                  <div className="pt-3 border-t border-slate-200 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        resetOtpState();
                        setMode(portal === 'CLIENT' ? 'REGISTER_CLIENT' : 'REGISTER_EMPLOYEE');
                      }}
                      className="w-full py-2 px-4 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-semibold flex items-center justify-center gap-2 hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      <UserPlus className="w-4 h-4 text-[#1D4ED8]" />
                      <span>
                        {portal === 'CLIENT'
                          ? 'New Client Registration (Real SMS OTP)'
                          : 'New Employee / Labour Registration (Real SMS OTP)'}
                      </span>
                    </button>
                  </div>
                )}
              </form>
            ) : mode === 'FORGOT_PASSWORD' ? (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="font-display font-bold text-lg flex items-center gap-2">
                    <KeyRound className="w-5 h-5 text-[#1D4ED8]" />
                    Reset Password
                  </h2>
                  <button
                    type="button"
                    onClick={() => setMode('LOGIN')}
                    className="text-xs text-slate-500 hover:text-slate-900"
                  >
                    Back to Login
                  </button>
                </div>

                {!setup?.smsConfigured && (
                  <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
                    SMS OTP gateway is not configured on the server. Password reset requires a verified SMS provider
                    (Twilio / Fast2SMS / MSG91).
                  </div>
                )}

                <div className="flex gap-2">
                  <input
                    type="tel"
                    required
                    disabled={Boolean(otpVerifiedToken)}
                    value={regMobile}
                    onChange={(e) => setRegMobile(e.target.value)}
                    placeholder="Registered 10-digit mobile"
                    className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
                  />
                  <button
                    type="button"
                    disabled={busy || cooldown > 0 || Boolean(otpVerifiedToken)}
                    onClick={() => handleSendOtp('PASSWORD_RESET')}
                    className="px-3.5 py-2 rounded-lg bg-[#1D4ED8] text-white text-xs font-semibold disabled:opacity-50 whitespace-nowrap"
                  >
                    {cooldown > 0 ? `${cooldown}s` : 'Send OTP'}
                  </button>
                </div>

                {otpSent && !otpVerifiedToken && (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={otpInput}
                      onChange={(e) => setOtpInput(e.target.value)}
                      placeholder="Enter 6-digit SMS OTP"
                      className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628] font-mono"
                    />
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => handleVerifyOtp('PASSWORD_RESET')}
                      className="px-3.5 py-2 rounded-lg bg-[#0B1F3A] text-white text-xs font-semibold whitespace-nowrap"
                    >
                      Verify OTP
                    </button>
                  </div>
                )}

                {otpVerifiedToken && (
                  <>
                    <input
                      type="password"
                      required
                      value={regPw}
                      onChange={(e) => setRegPw(e.target.value)}
                      placeholder="New Strong Password"
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
                    />
                    <input
                      type="password"
                      required
                      value={regConfirm}
                      onChange={(e) => setRegConfirm(e.target.value)}
                      placeholder="Confirm New Password"
                      className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
                    />
                    <button
                      type="submit"
                      disabled={busy}
                      className="w-full py-2.5 rounded-lg bg-[#0B1F3A] text-white text-sm font-semibold"
                    >
                      Update Password
                    </button>
                  </>
                )}
              </form>
            ) : (
              /* Employee or Client Self-Registration with Mandatory Real SMS OTP */
              <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
                <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
                  <h2 className="font-display font-bold text-lg flex items-center gap-2">
                    {mode === 'REGISTER_CLIENT' ? (
                      <Building2 className="w-5 h-5 text-[#1D4ED8]" />
                    ) : (
                      <UserCheck className="w-5 h-5 text-[#1D4ED8]" />
                    )}
                    {mode === 'REGISTER_CLIENT' ? 'Client Registration' : 'Employee Registration'}
                  </h2>
                  <button
                    type="button"
                    onClick={() => setMode('LOGIN')}
                    className="text-xs text-slate-500 hover:text-slate-900"
                  >
                    Back
                  </button>
                </div>

                {!setup?.smsConfigured && (
                  <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
                    Real SMS OTP provider is not configured on the server ({setup?.smsMissingVars.join(', ')}). Sending OTP
                    will display the live server configuration error and block registration.
                  </div>
                )}

                <div className="space-y-2">
                  <label className="block text-xs font-semibold">
                    Step 1: Verify Mobile Number via Real SMS OTP
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="tel"
                      required
                      disabled={Boolean(otpVerifiedToken)}
                      value={regMobile}
                      onChange={(e) => setRegMobile(e.target.value)}
                      placeholder="10-digit mobile number"
                      className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628] font-mono"
                    />
                    <button
                      type="button"
                      disabled={busy || cooldown > 0 || Boolean(otpVerifiedToken)}
                      onClick={() =>
                        handleSendOtp(mode === 'REGISTER_CLIENT' ? 'CLIENT_REGISTER' : 'EMPLOYEE_REGISTER')
                      }
                      className="px-3 py-2 rounded-lg bg-[#1D4ED8] text-white text-xs font-semibold disabled:opacity-50 whitespace-nowrap"
                    >
                      {otpVerifiedToken ? 'Verified' : cooldown > 0 ? `${cooldown}s` : 'Send OTP'}
                    </button>
                  </div>
                  {otpSent && !otpVerifiedToken && (
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={otpInput}
                        onChange={(e) => setOtpInput(e.target.value)}
                        placeholder="6-digit SMS OTP"
                        className="flex-1 px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628] font-mono"
                      />
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() =>
                          handleVerifyOtp(mode === 'REGISTER_CLIENT' ? 'CLIENT_REGISTER' : 'EMPLOYEE_REGISTER')
                        }
                        className="px-3.5 py-2 rounded-lg bg-[#0B1F3A] text-white text-xs font-semibold whitespace-nowrap"
                      >
                        Verify OTP
                      </button>
                    </div>
                  )}
                </div>

                <div className="space-y-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
                  <input
                    type="text"
                    required
                    value={regName}
                    onChange={(e) => setRegName(e.target.value)}
                    placeholder={mode === 'REGISTER_CLIENT' ? 'Client / Company Name *' : 'Full Name *'}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
                  />
                  <input
                    type="email"
                    value={regEmail}
                    onChange={(e) => setRegEmail(e.target.value)}
                    placeholder="Email Address"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
                  />

                  {mode === 'REGISTER_EMPLOYEE' ? (
                    <div className="grid grid-cols-2 gap-2.5">
                      <select
                        value={regEmpType}
                        onChange={(e) => setRegEmpType(e.target.value)}
                        className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
                      >
                        <option value="PERMANENT">Permanent Employee</option>
                        <option value="CONTRACT">Contract Employee</option>
                        <option value="DAILY_WAGE">Daily Wage Labour</option>
                      </select>
                      <input
                        type="text"
                        value={regEmergency}
                        onChange={(e) => setRegEmergency(e.target.value)}
                        placeholder="Emergency Contact"
                        className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
                      />
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      <input
                        type="text"
                        value={regCity}
                        onChange={(e) => setRegCity(e.target.value)}
                        placeholder="City"
                        className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
                      />
                      <input
                        type="text"
                        value={regState}
                        onChange={(e) => setRegState(e.target.value)}
                        placeholder="State"
                        className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
                      />
                      <input
                        type="text"
                        value={regGstin}
                        onChange={(e) => setRegGstin(e.target.value)}
                        placeholder="GSTIN (opt.)"
                        className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
                      />
                    </div>
                  )}

                  <input
                    type="text"
                    value={regAddress}
                    onChange={(e) => setRegAddress(e.target.value)}
                    placeholder="Full Address"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
                  />

                  <div className="grid grid-cols-2 gap-2.5">
                    <input
                      type="password"
                      required
                      value={regPw}
                      onChange={(e) => setRegPw(e.target.value)}
                      placeholder="Strong Password *"
                      className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
                    />
                    <input
                      type="password"
                      required
                      value={regConfirm}
                      onChange={(e) => setRegConfirm(e.target.value)}
                      placeholder="Confirm Password *"
                      className="px-3 py-2 text-sm rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B1628]"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={busy || !otpVerifiedToken}
                  className="w-full py-2.5 rounded-lg bg-[#0B1F3A] text-white text-sm font-semibold disabled:opacity-50"
                >
                  {busy ? 'Submitting...' : 'Submit Registration for Admin Approval'}
                </button>
              </form>
            )}

            <div className="mt-6 pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
              <span className="flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5 text-[#C69B2D]" />
                IT Support: 7503354996
              </span>
              <span className="tabular-nums">DB: {setup?.dbMode === 'mysql' ? 'MySQL 8.0' : 'SQLite + MySQL Schema'}</span>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
