import { useState } from "react";
import { useLocation } from "wouter";
import { Mail, Lock, Building2, Eye, EyeOff } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useAuthStore } from "@/lib/authStore";

export default function Auth() {
  const [, setLocation] = useLocation();
  const [isSignUp, setIsSignUp] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    company: "",
  });

  const { signIn, signUp } = useAuthStore();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);

    try {
      if (isSignUp) {
        if (!formData.company.trim()) {
          setError("Company name is required");
          setIsLoading(false);
          return;
        }

        const { error } = await signUp(
          formData.email,
          formData.password,
          formData.company
        );

        if (error) {
          setError(error.message || "Sign up failed");
        } else {
          setLocation("/");
        }
      } else {
        const { error } = await signIn(formData.email, formData.password);

        if (error) {
          setError(error.message || "Sign in failed");
        } else {
          const admin = useAuthStore.getState().isAdmin;
          setLocation(admin ? "/admin" : "/");
        }
      }
    } catch (err) {
      setError("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <Header />

      <main className="flex-1 flex items-center justify-center py-12 px-4">
        <div className="w-full max-w-md">
          {/* Card */}
          <div className="bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-8 text-center">
              <h1 className="text-2xl font-bold mb-2">
                {isSignUp ? "Create Account" : "Sign In"}
              </h1>
              <p className="text-slate-300 text-sm">
                {isSignUp
                  ? "Join XL Traders to view prices and manage orders"
                  : "Access your account to view prices"}
              </p>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmit} className="p-8 space-y-4">
              {/* Error Message */}
              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
                  {error}
                </div>
              )}

              {/* Email */}
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail
                    size={18}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type="email"
                    name="email"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    placeholder="you@company.com"
                    className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:border-red-600 focus:ring-2 focus:ring-red-100 outline-none transition"
                  />
                </div>
              </div>

              {/* Company (Sign Up Only) */}
              {isSignUp && (
                <div>
                  <label className="block text-sm font-semibold text-slate-900 mb-2">
                    Company Name
                  </label>
                  <div className="relative">
                    <Building2
                      size={18}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                    />
                    <input
                      type="text"
                      name="company"
                      value={formData.company}
                      onChange={handleChange}
                      required={isSignUp}
                      placeholder="Your Company Ltd."
                      className="w-full pl-10 pr-4 py-2 border border-slate-300 rounded-lg focus:border-red-600 focus:ring-2 focus:ring-red-100 outline-none transition"
                    />
                  </div>
                </div>
              )}

              {/* Password */}
              <div>
                <label className="block text-sm font-semibold text-slate-900 mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock
                    size={18}
                    className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                  />
                  <input
                    type={showPassword ? "text" : "password"}
                    name="password"
                    value={formData.password}
                    onChange={handleChange}
                    required
                    placeholder="••••••••"
                    className="w-full pl-10 pr-10 py-2 border border-slate-300 rounded-lg focus:border-red-600 focus:ring-2 focus:ring-red-100 outline-none transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white font-bold py-2 px-4 rounded-lg transition mt-6"
              >
                {isLoading
                  ? "Loading..."
                  : isSignUp
                    ? "Create Account"
                    : "Sign In"}
              </button>

              {/* Toggle */}
              <div className="text-center text-sm text-slate-600 mt-4">
                {isSignUp ? (
                  <>
                    Already have an account?{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setIsSignUp(false);
                        setError(null);
                      }}
                      className="text-red-600 font-semibold hover:text-red-700"
                    >
                      Sign In
                    </button>
                  </>
                ) : (
                  <>
                    Don't have an account?{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setIsSignUp(true);
                        setError(null);
                      }}
                      className="text-red-600 font-semibold hover:text-red-700"
                    >
                      Sign Up
                    </button>
                  </>
                )}
              </div>
            </form>

            {/* Info Box */}
            <div className="bg-slate-50 border-t border-slate-200 p-6 text-sm text-slate-600">
              <p className="font-semibold text-slate-900 mb-2">Why sign in?</p>
              <ul className="space-y-1">
                <li>✓ View wholesale prices</li>
                <li>✓ Track your enquiries</li>
                <li>✓ Manage your account</li>
                <li>✓ Receive order updates</li>
              </ul>
            </div>
          </div>

          {/* Guest Option */}
          <div className="text-center mt-6">
            <p className="text-slate-600 text-sm mb-3">
              Want to browse without signing in?
            </p>
            <a
              href="/catalog"
              className="text-red-600 font-semibold hover:text-red-700"
            >
              Continue as Guest
            </a>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
