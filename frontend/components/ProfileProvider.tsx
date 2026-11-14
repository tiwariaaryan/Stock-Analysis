"use client";
import { createContext, useContext, useState, useEffect, ReactNode } from "react";

const API = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

type Profile = {
  id: number;
  username: string;
  display_name: string | null;
  created_at: string;
};

type ProfileContextType = {
  profile: Profile | null;
  userId: number | null;
  login: (p: Profile) => void;
  logout: () => void;
  switchProfile: () => void;
};

const ProfileContext = createContext<ProfileContextType>({
  profile: null, userId: null,
  login: () => {}, logout: () => {}, switchProfile: () => {},
});

export function useProfile() { return useContext(ProfileContext); }

export function ProfileProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem("investintel_profile");
    if (stored) {
      try { setProfile(JSON.parse(stored)); } catch { localStorage.removeItem("investintel_profile"); }
    }
    setLoaded(true);
  }, []);

  function login(p: Profile) {
    setProfile(p);
    localStorage.setItem("investintel_profile", JSON.stringify(p));
  }

  function logout() {
    setProfile(null);
    localStorage.removeItem("investintel_profile");
  }

  function switchProfile() {
    logout();
  }

  if (!loaded) return null;

  return (
    <ProfileContext.Provider value={{ profile, userId: profile?.id ?? null, login, logout, switchProfile }}>
      {children}
    </ProfileContext.Provider>
  );
}
