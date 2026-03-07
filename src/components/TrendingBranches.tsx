"use client";

import { getAllBranches } from "@/lib/data";

export default function TrendingBranches() {
  const branches = getAllBranches().slice(0, 6);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {branches.map((branch) => (
        <div
          key={branch.id}
          className="group relative overflow-hidden rounded-md bg-[#181818] hover:bg-[#222] transition-all duration-300 p-5 cursor-pointer border border-transparent hover:border-white/10"
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="w-5 h-5 rounded-sm bg-white/10 flex items-center justify-center">
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5">
                <path d="M7 3v18M3 7l4-4 4 4M17 3v18M13 17l4 4 4-4" />
              </svg>
            </div>
            <span className="text-[10px] text-white/40 tracking-wider uppercase">
              {branch.showTitle}
            </span>
          </div>

          <h3 className="font-semibold text-sm mb-2 text-white/90 group-hover:text-white transition-colors">
            {branch.title}
          </h3>
          <p className="text-xs text-white/40 line-clamp-2 mb-4">
            {branch.description}
          </p>

          <div className="flex items-center justify-between text-[10px] text-white/30">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
                {branch.likes}
              </span>
              <span>@ {branch.forkPoint}</span>
            </div>
            <span className="text-white/20">by {branch.author}</span>
          </div>
        </div>
      ))}
    </div>
  );
}
