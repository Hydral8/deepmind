"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { SHOWS, getMovies, getSeries } from "@/lib/data";
import HeroBanner from "@/components/HeroBanner";
import CategoryTabs from "@/components/CategoryTabs";
import ShowGrid from "@/components/ShowGrid";
import { ShowCardTall } from "@/components/ShowCard";

const TABS = [
  { label: "Continue Watching", count: 4 },
  { label: "My List", count: 7 },
  { label: "Latest", count: 12 },
];

export default function Home() {
  const [activeTab, setActiveTab] = useState(0);
  const searchParams = useSearchParams();
  const filter = searchParams.get("filter");

  const movies = getMovies();
  const series = getSeries();

  const filtered = filter === "tv" ? series : filter === "movies" ? movies : null;
  const heroShow = filtered ? filtered[0] || SHOWS[0] : SHOWS[0];

  return (
    <main className="min-h-screen">
      <HeroBanner show={heroShow} />

      <div className="max-w-[1440px] mx-auto px-12 -mt-10 relative z-10">
        <CategoryTabs tabs={TABS} activeIndex={activeTab} onChange={setActiveTab} />

        {filtered ? (
          <div className="mb-12 mt-6">
            <h2 className="text-[12px] font-semibold tracking-[0.2em] uppercase text-white/50 mb-5">
              {filter === "tv" ? "TV Shows" : "Movies"}
            </h2>
            <ShowGrid shows={filtered} />
          </div>
        ) : (
          <>
            {/* Tall featured cards */}
            <div className="flex gap-5 mt-6 mb-14">
              {SHOWS.slice(0, 3).map((show) => (
                <ShowCardTall key={show.id} show={show} />
              ))}
            </div>

            {/* TV Shows section */}
            <div className="mb-12">
              <h2 className="text-[12px] font-semibold tracking-[0.2em] uppercase text-white/50 mb-5">
                TV Shows
              </h2>
              <ShowGrid shows={series} />
            </div>

            {/* Movies section */}
            <div className="mb-12">
              <h2 className="text-[12px] font-semibold tracking-[0.2em] uppercase text-white/50 mb-5">
                Movies
              </h2>
              <ShowGrid shows={movies} />
            </div>

            {/* All content */}
            <div className="mb-12">
              <h2 className="text-[12px] font-semibold tracking-[0.2em] uppercase text-white/50 mb-5">
                All Titles
              </h2>
              <ShowGrid shows={SHOWS} />
            </div>
          </>
        )}
      </div>

      <footer className="mt-24 border-t border-white/5 py-8 px-12">
        <div className="max-w-[1440px] mx-auto flex items-center justify-between">
          <span className="text-[16px] font-black tracking-[-0.05em] text-white/15">ALTTV</span>
          <p className="text-[10px] text-white/10 tracking-[0.2em] uppercase">
            Powered by Gemini &middot; Veo &middot; Lyria
          </p>
        </div>
      </footer>
    </main>
  );
}
