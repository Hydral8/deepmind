"use client";

import Link from "next/link";
import { Show } from "@/lib/data";

export default function HeroBanner({ show }: { show: Show }) {
  return (
    <div className="relative h-[90vh] min-h-[650px]">
      {/* Background image */}
      <div className="absolute inset-0">
        <img
          src={show.banner}
          alt={show.title}
          className="w-full h-full object-cover"
        />
        {/* Left-side dark gradient for text readability */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent" />
        {/* Bottom fade */}
        <div className="absolute bottom-0 left-0 right-0 h-[200px] bg-gradient-to-t from-[#0e0e0e] to-transparent" />
      </div>

      {/* Pagination dots */}
      <div className="absolute top-24 left-1/2 -translate-x-1/2 flex gap-2 z-20">
        {[0, 1, 2, 3, 4].map((i) => (
          <div
            key={i}
            className={`w-[6px] h-[6px] rounded-full ${
              i === 0 ? "bg-white" : "bg-white/30"
            }`}
          />
        ))}
      </div>

      {/* Main content area */}
      <div className="relative z-10 h-full max-w-[1440px] mx-auto px-12 flex items-end pb-28">
        <div className="flex w-full items-end justify-between">
          {/* Left column: title, desc, buttons */}
          <div className="max-w-[500px] fade-up">
            <h1 className="text-[64px] font-black leading-[0.9] tracking-[-0.03em] text-white uppercase mb-5">
              {show.title}
            </h1>

            <p className="text-[13px] text-white/50 leading-relaxed mb-7 max-w-[400px]">
              {show.description}
            </p>

            {/* Buttons */}
            <div className="flex items-center gap-4 mb-8">
              <Link
                href={`/show/${show.id}`}
                className="inline-flex items-center gap-3 px-10 py-3 border border-white text-white text-[12px] font-semibold tracking-[0.2em] uppercase hover:bg-white hover:text-black transition-all duration-200"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="5 3 19 12 5 21 5 3" />
                </svg>
                Play
              </Link>
              <button className="w-11 h-11 rounded-full border border-white/30 flex items-center justify-center hover:border-white/70 transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.5">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
              </button>
            </div>

            {/* Trailer thumbnail */}
            <div className="flex items-center gap-3 cursor-pointer group">
              <div className="relative w-[150px] h-[85px] rounded overflow-hidden border border-white/15 group-hover:border-white/40 transition-colors">
                <img
                  src={show.episodes[0]?.thumbnail || show.image}
                  alt="Trailer"
                  className="w-full h-full object-cover opacity-70 group-hover:opacity-90 transition-opacity"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-7 h-7 rounded-full bg-white/20 backdrop-blur-sm flex items-center justify-center">
                    <svg width="8" height="8" viewBox="0 0 24 24" fill="white">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                  </div>
                </div>
              </div>
              <span className="text-[10px] text-white/30 tracking-[0.2em] uppercase group-hover:text-white/50 transition-colors">
                Watch Trailer
              </span>
            </div>
          </div>

          {/* Right column: metadata */}
          <div className="hidden lg:block text-right mb-4">
            <div className="mb-5">
              <div className="text-[10px] text-white/30 tracking-[0.2em] uppercase mb-1">Creator</div>
              <div className="text-[13px] text-white/70">{show.creator}</div>
            </div>
            <div className="mb-5">
              <div className="text-[10px] text-white/30 tracking-[0.2em] uppercase mb-1">Stars</div>
              <div className="text-[13px] text-white/70 space-y-0.5">
                {show.stars.map((s) => (
                  <div key={s}>{s}</div>
                ))}
              </div>
            </div>
            <div className="flex gap-4 justify-end mb-3">
              {show.genre.map((g) => (
                <span key={g} className="text-[12px] text-white/40">{g}</span>
              ))}
            </div>
            <div className="text-[12px] text-white/20">1 / 5</div>
          </div>
        </div>
      </div>
    </div>
  );
}
