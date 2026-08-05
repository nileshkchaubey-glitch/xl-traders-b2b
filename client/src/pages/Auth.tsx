import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Eye, EyeOff } from "lucide-react";
import Header from "@/components/Header";
import { useAuthStore } from "@/lib/authStore";

/**
 * Sign in / create a business account (docs/DESIGN_SYSTEM.md §4.1).
 *
 * NOTE ON THE DESIGN BOARD: it shows a "+91 / Mobile number → Send OTP" flow.
 * Phone OTP is an authentication-mechanism change — it needs Supabase's phone
 * provider, an SMS gateway, and a migration path for existing email accounts —
 * so it is out of scope for a storefront redesign and is flagged in the PR for
 * an explicit decision. This screen keeps the existing email + password
 * credentials and adopts the design's ink block, type and rules, so switching
 * to OTP later replaces the fields inside a shell that already looks right.
 */
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
          setError("Business name is required");
          setIsLoading(false);
          return;
        }
        const { error } = await signUp(
          formData.email,
          formData.password,
          formData.company
        );
        if (error) setError(error.message || "Sign up failed");
        else setLocation("/account");
      } else {
        const { error } = await signIn(formData.email, formData.password);
        if (error) {
          setError(error.message || "Sign in failed");
        } else {
          const admin = useAuthStore.getState().isAdmin;
          setLocation(admin ? "/admin" : "/account");
        }
      }
    } catch {
      setError("An unexpected error occurred");
    } finally {
      setIsLoading(false);
    }
  };

  const fieldClass =
    "w-full h-12 px-3.5 border border-rule bg-white text-body-md text-ink outline-none focus:border-ink transition-colors duration-150 placeholder:text-ink-faint";

  return (
    <div className="min-h-screen bg-white flex flex-col text-ink">
      <Header />

      <main className="flex-1 pb-28 md:pb-24">
        <div className="shell max-w-md">
          <div className="border-b-2 border-ink pt-5 pb-4">
            <h1 className="font-display text-display-sm font-bold tracking-[-0.025em]">
              {isSignUp ? "Create a business account" : "Sign in"}
            </h1>
          </div>

          <section className="bg-ink px-[18px] md:px-7 py-6 md:py-7 mt-6">
            <h2 className="font-display text-[30px] leading-[1.1] font-bold text-white tracking-[-0.03em] text-pretty">
              Your wholesale rates
            </h2>
            <p className="text-body text-ink-inverse mt-2.5 leading-relaxed">
              Public pages show MRP. Signed in, every pack shows the rate you
              actually pay.
            </p>

            <form
              onSubmit={handleSubmit}
              className="mt-5 flex flex-col gap-2.5"
            >
              {error && (
                <p className="bg-amber-600 text-white text-body-sm font-medium px-3 py-2.5">
                  {error}
                </p>
              )}

              {isSignUp && (
                <input
                  type="text"
                  name="company"
                  value={formData.company}
                  onChange={handleChange}
                  required
                  placeholder="Business name"
                  aria-label="Business name"
                  className={fieldClass}
                />
              )}

              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                autoComplete="email"
                placeholder="Email address"
                aria-label="Email address"
                className={fieldClass}
              />

              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  required
                  autoComplete={isSignUp ? "new-password" : "current-password"}
                  placeholder="Password"
                  aria-label="Password"
                  className={`${fieldClass} pr-11`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint"
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full h-12 bg-red-600 text-white text-body-md font-semibold hover:bg-red-700 transition-colors duration-150 disabled:opacity-60"
              >
                {isLoading
                  ? "Working…"
                  : isSignUp
                    ? "Create account"
                    : "Sign in"}
              </button>
            </form>

            <p className="text-body-sm text-ink-inverse mt-3.5">
              {isSignUp ? "Already have an account?" : "New buyer?"}{" "}
              <button
                type="button"
                onClick={() => {
                  setIsSignUp(v => !v);
                  setError(null);
                }}
                className="text-white font-semibold"
              >
                {isSignUp ? "Sign in" : "Create a business account"}
              </button>
            </p>
          </section>

          <p className="text-body-sm text-ink-muted mt-6">
            Browsing without an account is fine —{" "}
            <Link href="/catalog" className="text-red-600 font-semibold">
              see the catalogue
            </Link>
            .
          </p>
        </div>
      </main>
    </div>
  );
}
