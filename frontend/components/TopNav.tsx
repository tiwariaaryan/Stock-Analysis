"use client";
import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useProfile } from "@/components/ProfileProvider";

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export default function TopNav() {
  const router = useRouter();
  const path = usePathname();
  const { profile, logout } = useProfile();
  const isHome = path === "/";
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  useEffect(() => {
    fetch(`${API}/api/v1/market/refresh-status`)
      .then(r => r.json())
      .then(d => {
        if (d.last_refresh) {
          const secs = d.age_seconds;
          if (secs < 60) setLastRefresh(`${Math.round(secs)}s ago`);
          else if (secs < 3600) setLastRefresh(`${Math.round(secs / 60)}m ago`);
          else setLastRefresh(`${Math.round(secs / 3600)}h ago`);
        }
      })
      .catch(() => {});
  }, [refreshing]);

  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), 4000);
      return () => clearTimeout(t);
    }
  }, [toast]);

  async function handleRefresh() {
    setRefreshing(true);
    setToast(null);
    try {
      const url = profile?.id ? `${API}/api/v1/market/refresh-all?user_id=${profile.id}` : `${API}/api/v1/market/refresh-all`;
      const res = await fetch(url, { method: "POST" });
      if (res.ok) {
        const data = await res.json();
        setLastRefresh("just now");
        setToast(`${data.refreshed}/${data.total} prices updated`);
      } else {
        setToast("Refresh failed — check backend");
      }
    } catch {
      setToast("Could not reach backend");
    }
    setRefreshing(false);
  }

  const label =
    path === "/" ? "Home" :
    path === "/ai-intelligence" ? "AI Intelligence Hub" :
    path === "/market" ? "Live Market" :
    path === "/wishlist" ? "Wishlist" :
    path === "/chat" ? "AI Chat" :
    path.startsWith("/portfolio") ? "Portfolio" :
    path.startsWith("/market/") ? "Stock Detail" : "";

  return (
    <>
      <header className="sticky top-0 z-40 bg-bg-primary/90 backdrop-blur border-b border-border h-12 flex items-center justify-between px-5">
        <div className="flex items-center gap-2">
          {!isHome && (
            <>
              <NavBtn onClick={() => router.back()} title="Back" d="M19 12H5 M12 19l-7-7 7-7" />
              <NavBtn onClick={() => router.forward()} title="Forward" d="M5 12h14 M12 5l7 7-7 7" />
              <NavBtn onClick={() => router.push("/")} title="Home" d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10" />
            </>
          )}
          <span className="text-[13px] text-txt-muted ml-1">{label}</span>
        </div>
        <div className="flex items-center gap-3">
          {!isHome && (
            <>
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className={`relative flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-[11px] font-semibold transition-all border ${
                  refreshing
                    ? "bg-accent text-white border-accent shadow-lg shadow-accent/25 animate-pulse"
                    : "bg-bg-card border-border text-txt-secondary hover:text-white hover:bg-accent hover:border-accent hover:shadow-lg hover:shadow-accent/20"
                }`}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                  className={refreshing ? "animate-spin" : ""}>
                  <path d="M21 2v6h-6" /><path d="M3 12a9 9 0 0 1 15-6.7L21 8" /><path d="M3 22v-6h6" /><path d="M21 12a9 9 0 0 1-15 6.7L3 16" />
                </svg>
                {refreshing ? "Refreshing Prices..." : "Refresh Prices"}
              </button>
              {lastRefresh && !refreshing && (
                <span className="text-[10px] text-txt-dim">{lastRefresh}</span>
              )}
            </>
          )}
          <div className="flex items-center gap-1.5 ml-1">
            <div className="w-1.5 h-1.5 rounded-full bg-gain" />
            <span className="text-[11px] text-txt-muted">NSE</span>
          </div>
          {profile && (
            <div className="relative ml-2">
              <button onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-bg-card border border-border hover:border-border-hover transition-colors">
                <div className="w-6 h-6 rounded-md bg-accent-muted flex items-center justify-center">
                  <span className="text-xs font-bold text-accent-light">{(profile.display_name || profile.username).charAt(0).toUpperCase()}</span>
                </div>
                <span className="text-[11px] text-txt-secondary font-medium max-w-[80px] truncate">{profile.display_name || profile.username}</span>
              </button>
              {showProfileMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)} />
                  <div className="absolute right-0 top-full mt-1 w-48 bg-bg-card border border-border rounded-lg shadow-xl z-50 py-1 animate-fade-in">
                    <div className="px-3 py-2 border-b border-border">
                      <p className="text-xs font-semibold text-txt-primary">{profile.display_name}</p>
                      <p className="text-[10px] text-txt-dim">@{profile.username}</p>
                    </div>
                    <button onClick={() => { setShowProfileMenu(false); logout(); router.replace("/login"); }}
                      className="w-full text-left px-3 py-2 text-xs text-txt-secondary hover:text-txt-primary hover:bg-bg-hover transition-colors">
                      Switch Profile
                    </button>
                    <button onClick={() => { setShowProfileMenu(false); logout(); router.replace("/login"); }}
                      className="w-full text-left px-3 py-2 text-xs text-loss hover:bg-loss/5 transition-colors">
                      Logout
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </header>

      {/* Progress bar while refreshing */}
      {refreshing && (
        <div className="fixed top-12 left-56 right-0 z-50 h-1 bg-bg-card overflow-hidden">
          <div className="h-full bg-accent rounded-full animate-progress" style={{
            animation: "progress 8s ease-in-out infinite",
          }} />
          <style jsx>{`
            @keyframes progress {
              0% { width: 0%; margin-left: 0; }
              50% { width: 60%; margin-left: 20%; }
              100% { width: 0%; margin-left: 100%; }
            }
          `}</style>
        </div>
      )}

      {/* Toast notification */}
      {toast && (
        <div className="fixed top-16 right-6 z-50 animate-fade-in">
          <div className={`px-4 py-2.5 rounded-lg text-sm font-medium shadow-xl border ${
            toast.includes("failed") || toast.includes("Could not")
              ? "bg-loss/15 border-loss/30 text-loss"
              : "bg-gain/15 border-gain/30 text-gain"
          }`}>
            {toast.includes("failed") || toast.includes("Could not") ? "✕ " : "✓ "}{toast}
          </div>
        </div>
      )}
    </>
  );
}

function NavBtn({ onClick, title, d }: { onClick: () => void; title: string; d: string }) {
  return (
    <button onClick={onClick} title={title}
      className="w-7 h-7 rounded-md bg-bg-card border border-border flex items-center justify-center text-txt-muted hover:text-txt-primary hover:border-border-hover transition-colors">
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d={d} />
      </svg>
    </button>
  );
}
