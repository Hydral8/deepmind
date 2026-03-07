"use client";

import { useRef } from "react";
import { Show } from "@/lib/data";
import ShowCard from "./ShowCard";

export default function ShowRow({
  title,
  shows,
}: {
  title?: string;
  shows: Show[];
}) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (dir: "left" | "right") => {
    if (scrollRef.current) {
      const amount = dir === "left" ? -600 : 600;
      scrollRef.current.scrollBy({ left: amount, behavior: "smooth" });
    }
  };

  return (
    <section className="mb-8 relative group/row">
      {title && (
        <h2 className="text-sm font-semibold tracking-widest uppercase text-white/60 mb-4">
          {title}
        </h2>
      )}

      {/* Scroll buttons */}
      <button
        onClick={() => scroll("left")}
        className="absolute left-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-opacity border border-white/10 -translate-x-1/2"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
          <polyline points="15 18 9 12 15 6" />
        </svg>
      </button>
      <button
        onClick={() => scroll("right")}
        className="absolute right-0 top-1/2 -translate-y-1/2 z-10 w-10 h-10 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover/row:opacity-100 transition-opacity border border-white/10 translate-x-1/2"
      >
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>

      <div
        ref={scrollRef}
        className="row-scroll flex gap-3 overflow-x-auto"
      >
        {shows.map((show) => (
          <div key={show.id} className="flex-shrink-0 w-[240px]">
            <ShowCard show={show} />
          </div>
        ))}
      </div>
    </section>
  );
}
