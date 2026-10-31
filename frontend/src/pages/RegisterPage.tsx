import React, { useState } from 'react';
import { Link, useNavigate, Navigate } from 'react-router-dom';
import { UserPlus, Loader2, AlertCircle, CheckCircle2, ArrowLeft, Store } from 'lucide-react';
import { useApp } from '../context';
import { registerUser, extractErrorMessage } from '../services/api';
import logoImg from '../assets/logo.png';

export const RegisterPage: React.FC = () => {
  const { isAuthenticated, login, isLoadingAuth } = useApp();
  const navigate = useNavigate();

  const [name, setName] = useState<string>('');
  const [shopName, setShopName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [phone, setPhone] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // If already authenticated, redirect to home/dashboard
  if (!isLoadingAuth && isAuthenticated) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      const res = await registerUser({
        name,
        email,
        phone,
        password,
        shop_name: shopName.trim(),
      });

      setSuccessMessage(`Account for ${res.name} created! Signing you in...`);

      // Auto login after registration
      await login(email, password);
      navigate('/');
    } catch (err) {
      setErrorMessage(extractErrorMessage(err, 'Registration failed. Please check the entered details.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-8rem)] flex flex-col justify-center items-center py-10 px-4">
      <div className="w-full max-w-md">
        {/* Back Link */}
        <div className="mb-6">
          <Link
            to="/"
            className="inline-flex items-center space-x-1.5 text-xs font-semibold text-[#64748B] hover:text-[#102A56] transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to homepage</span>
          </Link>
        </div>

        {/* Card */}
        <div className="bg-white border border-[#E2E8F0] rounded-2xl shadow-sm p-6 sm:p-8 space-y-6">
          {/* Brand & Heading */}
          <div className="text-center space-y-2">
            <Link to="/" className="inline-block">
              <img src={logoImg} alt="VoiceBill.AI" className="w-12 h-12 mx-auto object-contain" />
            </Link>
            <h1 className="text-2xl font-black text-[#102A56] tracking-tight">
              Create your store account
            </h1>
            <p className="text-xs text-[#64748B]">
              Sign up to start billing customers and managing your shop inventory.
            </p>
          </div>

          {/* Feedback messages */}
          {errorMessage && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start space-x-2.5">
              <AlertCircle className="w-4 h-4 text-rose-600 flex-shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}
          {successMessage && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs flex items-start space-x-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Store Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#102A56]">
                Store / Shop name <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Store className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  value={shopName}
                  onChange={(e) => setShopName(e.target.value)}
                  required
                  placeholder="e.g. Ramesh Kirana & General Store"
                  className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-[#102A56] placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#1677F3]/20 focus:border-[#1677F3] transition"
                />
              </div>
              <p className="text-[11px] text-[#64748B]">This will appear as your store heading on the dashboard.</p>
            </div>

            {/* Owner Full Name */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#102A56]">
                Your full name <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="e.g. Ramesh Kumar"
                className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-3.5 py-2.5 text-xs text-[#102A56] placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#1677F3]/20 focus:border-[#1677F3] transition"
              />
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#102A56]">
                Email address <span className="text-rose-500">*</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="e.g. ramesh@gmail.com"
                className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-3.5 py-2.5 text-xs text-[#102A56] placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#1677F3]/20 focus:border-[#1677F3] transition"
              />
            </div>

            {/* Phone */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#102A56]">
                Phone number <span className="text-rose-500">*</span>
              </label>
              <input
                type="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                required
                placeholder="e.g. 9876543210"
                className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-3.5 py-2.5 text-xs text-[#102A56] placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#1677F3]/20 focus:border-[#1677F3] transition"
              />
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-[#102A56]">
                Password <span className="text-rose-500">*</span>
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                placeholder="At least 6 characters"
                className="w-full bg-[#F8FAFC] border border-[#CBD5E1] rounded-xl px-3.5 py-2.5 text-xs text-[#102A56] placeholder-slate-400 focus:outline-none focus:bg-white focus:ring-2 focus:ring-[#1677F3]/20 focus:border-[#1677F3] transition"
              />
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full flex items-center justify-center space-x-2 py-3 rounded-xl bg-[#1677F3] hover:bg-[#0755D9] text-white font-bold text-xs shadow-sm transition disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Creating account...</span>
                </>
              ) : (
                <>
                  <UserPlus className="w-4 h-4" />
                  <span>Create Account</span>
                </>
              )}
            </button>
          </form>

          {/* Bottom Switch */}
          <div className="text-center pt-2 border-t border-[#E2E8F0] text-xs text-[#64748B]">
            Already have an account?{' '}
            <Link to="/login" className="font-bold text-[#1677F3] hover:underline">
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RegisterPage;
