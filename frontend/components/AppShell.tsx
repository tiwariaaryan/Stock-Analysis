"use client";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { ProfileProvider, useProfile } from "@/components/ProfileProvider";
import Sidebar from "@/components/Sidebar";
import TopNav from "@/components/TopNav";

function AuthGate({ children }: { children: React.ReactNode }) {
  const { profile } = useProfile();
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (!profile && pathname !== "/login") {
      router.replace("/login");
    }
  }, [profile, pathname, router]);

  if (pathname === "/login") {
    return <>{children}</>;
  }

  if (!profile) return null;

  return (
    <>
      <Sidebar />
      <main className="ml-[220px] min-h-screen flex flex-col">
        <TopNav />
        <div className="flex-1">{children}</div>
      </main>
    </>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <ProfileProvider>
      <AuthGate>{children}</AuthGate>
    </ProfileProvider>
  );
}
