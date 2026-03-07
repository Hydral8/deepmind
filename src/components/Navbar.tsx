"use client";

import Link from "next/link";
import { useSearchParams, usePathname } from "next/navigation";

export default function Navbar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filter = pathname === "/" ? searchParams.get("filter") : null;
  const isHome = pathname === "/" && !filter;
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-black/90 via-black/50 to-transparent">
      <div className="max-w-[1440px] mx-auto px-12 h-16 flex items-center justify-between">
        {/* Left */}
        <div className="flex items-center gap-6">
          <Link href="/" className="text-[22px] font-black tracking-[-0.05em] text-white select-none">
            ALTTV
          </Link>
          <div className="flex items-center gap-2 text-white/40 hover:text-white/70 transition-colors cursor-pointer">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" />
              <line x1="21" y1="21" x2="16.65" y2="16.65" />
            </svg>
            <span className="text-[11px] tracking-[0.15em] uppercase">Search</span>
          </div>
        </div>

        {/* Center */}
        <div className="flex items-center gap-8">
          <Link href="/" className={`text-[11px] tracking-[0.15em] uppercase transition-colors ${isHome ? "text-white font-medium" : "text-white/35 hover:text-white/70"}`}>
            Home
          </Link>
          <Link href="/?filter=tv" className={`text-[11px] tracking-[0.15em] uppercase transition-colors ${filter === "tv" ? "text-white font-medium" : "text-white/35 hover:text-white/70"}`}>
            TV Shows
          </Link>
          <Link href="/?filter=movies" className={`text-[11px] tracking-[0.15em] uppercase transition-colors ${filter === "movies" ? "text-white font-medium" : "text-white/35 hover:text-white/70"}`}>
            Movies
          </Link>
          <Link href="/assets" className="text-[11px] tracking-[0.15em] uppercase text-white/35 hover:text-white/70 transition-colors">
            Assets
          </Link>
        </div>

        {/* Right */}
        <div className="flex items-center gap-4">
          <span className="text-[11px] tracking-[0.15em] uppercase text-white/35 hover:text-white/70 transition-colors cursor-pointer">
            Profile
          </span>
          <div className="w-8 h-8 rounded overflow-hidden">
            <img
              src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=64&h=64&fit=crop&crop=face"
              alt="Profile"
              className="w-full h-full object-cover"
            />
          </div>
        </div>
      </div>
    </nav>
  );
}
