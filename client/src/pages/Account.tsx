import { useEffect } from "react";
import { Link, useLocation } from "wouter";
import { LogOut, Package, MessageCircle, ShieldCheck } from "lucide-react";

import { useAuthStore } from "@/lib/authStore";

const WA_NUMBER = import.meta.env.VITE_WHATSAPP_NUMBER || "919773239442";

/**
 * The account tab.
 *
 * Deliberately small. It shows who you are signed in as, the fact that rates
 * are unlocked, and the ways to get help — and nothing it cannot back.
 *
 * Order history is NOT here yet, and is not stubbed with a "coming soon" card.
 * `orders.user_id` exists and now populates automatically (it DEFAULTs to
 * auth.uid()), so the data is accumulating, but there is no history UI and
 * promising one on screen would be a claim we cannot honour today.
 */
export default function Account() {
  const [, setLocation] = useLocation();
  const { isAuthenticated, user, profile, signOut } = useAuthStore();

  // Signed-out visitors have no account page to see.
  useEffect(() => {
    if (!isAuthenticated) setLocation("/auth");
  }, [isAuthenticated, setLocation]);

  if (!isAuthenticated) return null;

  const name =
    profile?.contact_person ||
    profile?.company_name ||
    user?.email ||
    "Your account";

  return (
    <main className="flex-1 pb-24 md:pb-10">
      <div className="container max-w-2xl py-6">
        <h1 className="mb-4 text-2xl font-extrabold tracking-tight">
          My account
        </h1>

        <div className="mb-4 rounded-2xl border border-slate-200 bg-white p-5">
          <div className="text-body-md font-bold">{name}</div>
          {profile?.company_name && profile?.contact_person && (
            <div className="text-body-sm text-slate-500">
              {profile.company_name}
            </div>
          )}
          {user?.email && (
            <div className="mt-0.5 text-body-sm text-slate-500">
              {user.email}
            </div>
          )}
          <div
            className="mt-3 inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1 text-caption font-bold"
            style={{
              background: "var(--xl-accent-soft)",
              color: "var(--xl-accent)",
            }}
          >
            <ShieldCheck size={12} />
            Wholesale rates unlocked
          </div>
        </div>

        <div className="mb-4 grid gap-3 sm:grid-cols-2">
          <Link
            href="/catalog"
            className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-red-200"
          >
            <Package size={18} className="text-slate-400" />
            <span className="text-body-sm font-bold">Browse catalogue</span>
          </Link>
          <a
            href={`https://wa.me/${WA_NUMBER}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-emerald-200"
          >
            <MessageCircle size={18} className="text-emerald-600" />
            <span className="text-body-sm font-bold">Chat on WhatsApp</span>
          </a>
        </div>

        <button
          onClick={async () => {
            await signOut();
            setLocation("/");
          }}
          className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white p-4 text-body-sm font-bold text-slate-600 transition hover:border-red-200 hover:text-red-600"
        >
          <LogOut size={16} />
          Sign out
        </button>
      </div>
    </main>
  );
}
