"use client";

import Link from "next/link";
import { Show } from "@/lib/data";

export default function ShowCard({ show }: { show: Show }) {
  return (
    <Link href={`/show/${show.id}`} className="group block relative overflow-hidden rounded">
      <div className="relative aspect-[16/10] bg-[#1a1a1a]">
        <img
          src={show.image}
          alt={show.title}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
        {/* Bottom gradient for text */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
        {/* Title overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-3">
          <h3 className="text-[15px] font-extrabold text-white uppercase tracking-wide leading-tight drop-shadow-lg">
            {show.title}
          </h3>
        </div>
      </div>
    </Link>
  );
}

export function ShowCardTall({ show }: { show: Show }) {
  return (
    <Link href={`/show/${show.id}`} className="group block relative overflow-hidden rounded flex-1 min-w-0">
      <div className="relative aspect-[3/4] bg-[#1a1a1a]">
        <img
          src={show.banner}
          alt={show.title}
          className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/10 to-transparent" />
        {/* Title at bottom */}
        <div className="absolute bottom-0 left-0 right-0 p-6">
          <h3 className="text-[28px] font-black text-white uppercase tracking-tight leading-none drop-shadow-lg mb-4">
            {show.title}
          </h3>
          <div className="border border-white/40 text-center py-2 text-[11px] tracking-[0.2em] uppercase text-white hover:bg-white hover:text-black transition-all cursor-pointer">
            See All
          </div>
        </div>
      </div>
    </Link>
  );
}
