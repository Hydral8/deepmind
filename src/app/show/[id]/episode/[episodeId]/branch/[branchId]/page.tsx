"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { getShow, getBranch, getEpisode } from "@/lib/data";
import VideoPlayer from "@/components/VideoPlayer";

export default function BranchPage() {
  const params = useParams();
  const showId = params.id as string;
  const episodeId = params.episodeId as string;
  const branchId = params.branchId as string;

  const show = getShow(showId);
  const episode = getEpisode(showId, episodeId);
  const branch = getBranch(showId, episodeId, branchId);

  if (!show || !episode || !branch) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-white/30">Not found</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen pt-20">
      <div className="max-w-[1000px] mx-auto px-12">
        {/* Back */}
        <Link
          href={`/show/${showId}`}
          className="inline-flex items-center gap-2 text-[10px] text-white/30 hover:text-white/60 transition-colors mb-8 tracking-[0.15em] uppercase"
        >
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          {show.title} &middot; S{episode.season}E{episode.number}
        </Link>

        {/* Title */}
        <div className="flex items-start gap-4 mb-5">
          <div className="w-9 h-9 bg-white/10 flex items-center justify-center flex-shrink-0 mt-1">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2">
              <path d="M7 3v18M3 7l4-4 4 4M17 3v18M13 17l4 4 4-4" />
            </svg>
          </div>
          <div>
            <h1 className="text-[24px] font-black uppercase tracking-tight mb-1.5">{branch.title}</h1>
            <p className="text-[13px] text-white/35">{branch.description}</p>
          </div>
        </div>

        <div className="flex items-center gap-5 text-[11px] text-white/25 mb-10">
          <span className="flex items-center gap-1">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
            {branch.likes}
          </span>
          <span>by {branch.author}</span>
          <span>Fork @ {branch.forkPoint}</span>
          <span>{branch.createdAt}</span>
        </div>

        {/* Video player */}
        <div className="mb-8">
          <VideoPlayer
            src={episode.videoUrl}
            poster={episode.thumbnail}
            forkPoint={branch.forkPoint}
          />
        </div>

        {/* Timeline indicator */}
        <div className="flex items-center gap-3 p-4 bg-[#181818] mb-8">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-white/25" />
            <span className="text-[10px] text-white/30 tracking-[0.15em] uppercase">Original</span>
          </div>
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/15">
            <polyline points="9 18 15 12 9 6" />
          </svg>
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-white" />
            <span className="text-[10px] text-white font-semibold tracking-[0.15em] uppercase">
              Alternate @ {branch.forkPoint}
            </span>
          </div>
        </div>

        {/* Scenes */}
        {branch.scenes.length > 0 && (
          <div className="mb-10">
            <h2 className="text-[12px] font-semibold tracking-[0.2em] uppercase text-white/50 mb-6">Scenes</h2>
            <div className="space-y-4 relative">
              <div className="absolute left-[13px] top-0 bottom-0 w-px bg-gradient-to-b from-white/20 via-white/10 to-transparent" />

              {branch.scenes.map((scene, i) => (
                <div key={scene.id} className="relative pl-10">
                  <div className="absolute left-[9px] top-5 w-[9px] h-[9px] rounded-full bg-white border-2 border-[#0e0e0e]" />

                  <div className="bg-[#181818] p-5 hover:bg-[#1f1f1f] transition-colors">
                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-[10px] font-semibold text-white/50 tracking-[0.15em] uppercase">
                        Scene {i + 1}
                      </span>
                      {scene.characters.map((char) => (
                        <span key={char.id} className="px-2 py-0.5 text-[9px] bg-white/5 text-white/40">
                          {char.name}
                        </span>
                      ))}
                    </div>
                    <p className="text-[13px] text-white/55 mb-3">{scene.description}</p>
                    {scene.dialogue && (
                      <div className="pl-4 border-l border-white/15 py-1">
                        <p className="text-[12px] italic text-white/30">{scene.dialogue}</p>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {branch.scenes.length === 0 && (
          <div className="border border-dashed border-white/10 p-12 text-center mb-10">
            <p className="text-[12px] text-white/20">
              This alternate timeline has been outlined but scenes haven&apos;t been generated yet.
            </p>
          </div>
        )}
      </div>

      <div className="h-20" />
    </main>
  );
}
