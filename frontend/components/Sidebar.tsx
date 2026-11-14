"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const nav = [
  { href: "/", label: "Home", icon: "M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z M9 22V12h6v10" },
  { href: "/ai-intelligence", label: "AI Intelligence", icon: "M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" },
  { href: "/market", label: "Live Market", icon: "M22 7l-8.5 8.5-4-4L2 17 M16 7h6v6" },
  { href: "/portfolio", label: "Portfolio", icon: "M21 12V7H5a2 2 0 0 1 0-4h14v4 M3 5v14a2 2 0 0 0 2 2h16v-5 M18 12a2 2 0 0 0 0 4h4v-4Z" },
  { href: "/wishlist", label: "Wishlist", icon: "M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" },
  { href: "/chat", label: "AI Chat", icon: "M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" },
];

export default function Sidebar() {
  const path = usePathname();
  return (
    <aside className="fixed left-0 top-0 bottom-0 w-56 bg-bg-card border-r border-border flex flex-col z-50">
      <div className="px-5 py-5 border-b border-border">
        <Link href="/" className="block">
          <h1 className="text-lg font-bold text-txt-primary tracking-tight">
            <span className="text-accent-light">Invest</span>Intel
          </h1>
          <p className="text-[10px] text-txt-muted mt-0.5">India Market Research</p>
        </Link>
      </div>

      <nav className="flex-1 py-4 px-3 space-y-1">
        {nav.map((n) => {
          const active = n.href === "/" ? path === "/" : path.startsWith(n.href);
          return (
            <Link key={n.href} href={n.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-[13px] font-medium transition-colors ${
                active ? "bg-accent-muted text-accent-light" : "text-txt-secondary hover:text-txt-primary hover:bg-bg-hover"
              }`}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d={n.icon} />
              </svg>
              {n.label}
            </Link>
          );
        })}
      </nav>

      <div className="px-5 py-4 border-t border-border">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-gain animate-pulse" />
          <span className="text-[11px] text-txt-muted">Market Open</span>
        </div>
      </div>
    </aside>
  );
}
