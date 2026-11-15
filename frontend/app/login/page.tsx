"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useProfile } from "@/components/ProfileProvider";

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

type ProfileItem = { id: number; username: string; display_name: string | null; created_at: string };

export default function LoginPage() {
  const router = useRouter();
  const { profile, login } = useProfile();
  const [profiles, setProfiles] = useState<ProfileItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [pinFor, setPinFor] = useState<ProfileItem | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");

  const [newUsername, setNewUsername] = useState("");
  const [newDisplayName, setNewDisplayName] = useState("");
  const [newPin, setNewPin] = useState("");
  const [creating, setCreating] = useState(false);

  // Account Deletion State
  const [deleteTarget, setDeleteTarget] = useState<ProfileItem | null>(null);
  const [deletePin, setDeletePin] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    if (profile) { router.replace("/"); return; }
    fetch(`${API}/api/v1/profiles`).then(r => r.json()).then(setProfiles).catch(() => {}).finally(() => setLoading(false));
  }, [profile, router]);

  async function handleVerifyPin() {
    if (!pinFor || !pin) return;
    setError("");
    try {
      const res = await fetch(`${API}/api/v1/profiles/${pinFor.id}/verify`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin }),
      });
      if (res.ok) {
        const user = await res.json();
        login(user);
        router.replace("/");
      } else {
        const data = await res.json();
        setError(data.detail || "Incorrect PIN");
        setPin("");
      }
    } catch { setError("Could not reach server"); }
  }

  async function handleCreate() {
    if (!newUsername.trim() || !newDisplayName.trim() || !newPin || newPin.length < 4) return;
    setCreating(true);
    setError("");
    try {
      const res = await fetch(`${API}/api/v1/profiles`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: newUsername.trim(), display_name: newDisplayName.trim(), pin: newPin }),
      });
      if (res.ok) {
        const user = await res.json();
        login(user);
        router.replace("/");
      } else {
        const data = await res.json();
        setError(data.detail || "Failed to create profile");
      }
    } catch { setError("Could not reach server"); }
    setCreating(false);
  }

  async function handleDeleteProfile() {
    if (!deleteTarget || !deletePin) return;
    setDeleting(true);
    setError("");
    try {
      const res = await fetch(`${API}/api/v1/profiles/${deleteTarget.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: deletePin }),
      });
      if (res.ok) {
        setProfiles(prev => prev.filter(p => p.id !== deleteTarget.id));
        setDeleteTarget(null);
        setDeletePin("");
      } else {
        const data = await res.json();
        setError(data.detail || "Failed to delete account");
      }
    } catch {
      setError("Could not reach server");
    } finally {
      setDeleting(false);
    }
  }

  const isProtected = (p: ProfileItem) => {
    return p.id === 1 || p.id === 2 || p.username === "default_user" || p.username === "aaryan";
  };

  if (profile) return null;

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl bg-accent-muted flex items-center justify-center mx-auto mb-4 border border-accent/30">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#a78bfa" strokeWidth="1.5">
              <path d="M12 3l1.5 5.5L19 10l-5.5 1.5L12 17l-1.5-5.5L5 10l5.5-1.5L12 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-txt-primary">
            <span className="text-accent-light">Invest</span>Intel
          </h1>
          <p className="text-sm text-txt-muted mt-1">Select your profile or create a new one</p>
        </div>

        {error && (
          <div className="bg-loss/10 border border-loss/30 text-loss text-sm px-4 py-2.5 rounded-lg mb-4 text-center">
            {error}
          </div>
        )}

        {/* Delete Confirmation Modal */}
        {deleteTarget && (
          <div className="bg-bg-card border border-loss/40 rounded-xl p-6 mb-4 animate-fade-in shadow-xl">
            <div className="flex items-center gap-2 text-loss mb-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <h3 className="text-sm font-bold text-loss">Delete Account</h3>
            </div>
            <p className="text-xs text-txt-secondary mb-3 leading-relaxed">
              Are you sure you want to permanently delete profile <span className="font-semibold text-txt-primary">{deleteTarget.display_name || deleteTarget.username}</span>? All sandboxes, portfolios, and trade data will be wiped.
            </p>
            <label className="text-[11px] text-txt-muted mb-1.5 block">Enter account PIN to confirm:</label>
            <input
              type="password" inputMode="numeric" maxLength={8} autoFocus
              value={deletePin} onChange={e => { setDeletePin(e.target.value); setError(""); }}
              onKeyDown={e => e.key === "Enter" && handleDeleteProfile()}
              placeholder="Account PIN"
              className="w-full bg-bg-input border border-border rounded-lg px-4 py-2.5 text-center text-lg tracking-[0.4em] font-mono text-txt-primary placeholder-txt-dim focus:outline-none focus:border-loss/50"
            />
            <div className="flex gap-2 mt-4">
              <button onClick={handleDeleteProfile} disabled={!deletePin || deleting}
                className="flex-1 px-4 py-2 bg-loss hover:bg-loss/80 text-white font-medium rounded-lg transition-colors disabled:opacity-50 text-xs">
                {deleting ? "Deleting..." : "Permanently Delete"}
              </button>
              <button onClick={() => { setDeleteTarget(null); setDeletePin(""); setError(""); }}
                className="px-4 py-2 text-txt-muted hover:text-txt-primary transition-colors text-xs">
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* PIN Entry Modal */}
        {pinFor && !deleteTarget && (
          <div className="bg-bg-card border border-border rounded-xl p-6 mb-4 animate-fade-in">
            <p className="text-sm text-txt-secondary mb-1">Enter PIN for</p>
            <p className="text-lg font-bold text-txt-primary mb-4">{pinFor.display_name || pinFor.username}</p>
            <input
              type="password" inputMode="numeric" maxLength={8} autoFocus
              value={pin} onChange={e => { setPin(e.target.value); setError(""); }}
              onKeyDown={e => e.key === "Enter" && handleVerifyPin()}
              placeholder="Enter PIN"
              className="w-full bg-bg-input border border-border rounded-lg px-4 py-3 text-center text-xl tracking-[0.5em] font-mono text-txt-primary placeholder-txt-dim focus:outline-none focus:border-accent/50"
            />
            <div className="flex gap-2 mt-4">
              <button onClick={handleVerifyPin} disabled={!pin}
                className="flex-1 px-4 py-2.5 bg-accent hover:bg-accent-dark text-white font-medium rounded-lg transition-colors disabled:opacity-50">
                Unlock
              </button>
              <button onClick={() => { setPinFor(null); setPin(""); setError(""); }}
                className="px-4 py-2.5 text-txt-muted hover:text-txt-primary transition-colors">
                Back
              </button>
            </div>
          </div>
        )}

        {/* Profile List */}
        {!pinFor && !deleteTarget && !showCreate && (
          <>
            {loading ? (
              <div className="space-y-3">
                {[1,2].map(i => <div key={i} className="h-16 bg-bg-card rounded-xl animate-pulse" />)}
              </div>
            ) : profiles.length > 0 ? (
              <div className="space-y-2.5 mb-6">
                {profiles.map(p => {
                  const protectedAcc = isProtected(p);
                  return (
                    <div
                      key={p.id}
                      className="w-full bg-bg-card border border-border rounded-xl p-3.5 hover:border-accent/40 transition-all group flex items-center justify-between"
                    >
                      {/* Clickable Profile Info */}
                      <button
                        type="button"
                        onClick={() => { setPinFor(p); setError(""); }}
                        className="flex items-center gap-3 flex-1 text-left cursor-pointer focus:outline-none"
                      >
                        <div className="w-10 h-10 rounded-lg bg-accent-muted flex items-center justify-center shrink-0">
                          <span className="text-lg font-bold text-accent-light">
                            {(p.display_name || p.username).charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="text-sm font-semibold text-txt-primary group-hover:text-accent-light transition-colors">
                              {p.display_name || p.username}
                            </p>
                            {protectedAcc && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-400 font-mono font-medium">Protected</span>
                            )}
                            {p.username === "test" && (
                              <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400 font-mono font-medium">PIN: 0000</span>
                            )}
                          </div>
                          <p className="text-[11px] text-txt-dim">@{p.username}</p>
                        </div>
                      </button>

                      {/* Action buttons on right */}
                      <div className="flex items-center gap-2 shrink-0">
                        {!protectedAcc && (
                          <button
                            type="button"
                            title={`Delete account ${p.display_name || p.username}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setDeleteTarget(p);
                              setDeletePin("");
                              setError("");
                            }}
                            className="p-2 text-txt-muted hover:text-loss hover:bg-loss/10 rounded-lg transition-colors"
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                              <path d="M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2M10 11v6M14 11v6" />
                            </svg>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => { setPinFor(p); setError(""); }}
                          className="p-1.5 text-txt-muted hover:text-txt-primary transition-colors focus:outline-none"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4a5568" strokeWidth="2">
                            <rect x="3" y="11" width="18" height="11" rx="2" ry="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="text-center py-6 mb-4">
                <p className="text-sm text-txt-muted">No profiles yet. Create your first one below.</p>
              </div>
            )}

            <button onClick={() => setShowCreate(true)}
              className="w-full px-4 py-3 bg-accent hover:bg-accent-dark text-white font-medium rounded-xl transition-colors text-sm">
              + Create New Profile
            </button>
          </>
        )}

        {/* Create Profile Form */}
        {showCreate && !pinFor && !deleteTarget && (
          <div className="bg-bg-card border border-border rounded-xl p-6 animate-fade-in">
            <h3 className="text-base font-semibold text-txt-primary mb-4">Create Profile</h3>
            <div className="space-y-3">
              <div>
                <label className="text-[11px] text-txt-muted mb-1 block">Username</label>
                <input value={newUsername} onChange={e => setNewUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                  placeholder="e.g. trader_pro, guest"
                  className="w-full bg-bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-txt-primary placeholder-txt-dim focus:outline-none focus:border-accent/50" />
              </div>
              <div>
                <label className="text-[11px] text-txt-muted mb-1 block">Display Name</label>
                <input value={newDisplayName} onChange={e => setNewDisplayName(e.target.value)}
                  placeholder="e.g. John Doe"
                  className="w-full bg-bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-txt-primary placeholder-txt-dim focus:outline-none focus:border-accent/50" />
              </div>
              <div>
                <label className="text-[11px] text-txt-muted mb-1 block">PIN (minimum 4 digits)</label>
                <input type="password" inputMode="numeric" maxLength={8}
                  value={newPin} onChange={e => setNewPin(e.target.value.replace(/\D/g, ""))}
                  placeholder="Enter a secure PIN"
                  className="w-full bg-bg-input border border-border rounded-lg px-3 py-2.5 text-sm text-txt-primary placeholder-txt-dim focus:outline-none focus:border-accent/50 tracking-[0.3em] text-center font-mono" />
              </div>
            </div>
            <div className="flex gap-2 mt-5">
              <button onClick={handleCreate}
                disabled={creating || !newUsername.trim() || !newDisplayName.trim() || newPin.length < 4}
                className="flex-1 px-4 py-2.5 bg-accent hover:bg-accent-dark text-white font-medium rounded-lg transition-colors disabled:opacity-50 text-sm">
                {creating ? "Creating..." : "Create & Login"}
              </button>
              <button onClick={() => { setShowCreate(false); setError(""); }}
                className="px-4 py-2.5 text-txt-muted hover:text-txt-primary transition-colors text-sm">
                Back
              </button>
            </div>
          </div>
        )}

        <p className="text-center text-[10px] text-txt-dim mt-6">
          Local-first research platform. Data stored in your local database.
        </p>
      </div>
    </div>
  );
}
