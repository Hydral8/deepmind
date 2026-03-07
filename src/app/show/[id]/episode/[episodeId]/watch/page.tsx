"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { getShow, getEpisode } from "@/lib/data";
import VideoPlayer from "@/components/VideoPlayer";

export default function WatchPage() {
  const params = useParams();
  const showId = params.id as string;
  const episodeId = params.episodeId as string;

  const show = getShow(showId);
  const episode = getEpisode(showId, episodeId);

  if (!show || !episode) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-white/30">Not found</p>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-black">
      {/* Top bar */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-black/90 to-transparent">
        <div className="max-w-[1440px] mx-auto px-8 h-14 flex items-center justify-between">
          <Link
            href={`/show/${showId}`}
            className="inline-flex items-center gap-2 text-[11px] text-white/40 hover:text-white transition-colors tracking-[0.1em] uppercase"
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6" />
            </svg>
            Back to {show.title}
          </Link>
          <div className="text-[11px] text-white/30 tracking-[0.1em] uppercase">
            S{episode.season} E{episode.number} &middot; {episode.title}
          </div>
        </div>
      </div>

      {/* Video */}
      <div className="pt-14 max-w-[1200px] mx-auto px-4">
        <VideoPlayer
          src={episode.videoUrl}
          poster={episode.thumbnail}
        />
      </div>

      {/* Episode info below */}
      <div className="max-w-[1200px] mx-auto px-8 py-8">
        <div className="flex items-start justify-between">
          <div className="max-w-2xl">
            <h1 className="text-[20px] font-bold mb-2">{episode.title}</h1>
            <p className="text-[12px] text-white/40 leading-relaxed mb-4">{episode.description}</p>

            <div className="flex items-center gap-4 text-[11px] text-white/25">
              <span>{episode.duration}</span>
              <span>{show.rating}</span>
              <span>{show.year}</span>
              <span>{show.genre.join(" / ")}</span>
            </div>
          </div>

          <Link
            href={`/show/${showId}/episode/${episodeId}/create`}
            className="flex-shrink-0 inline-flex items-center gap-2 px-5 py-2.5 text-[10px] font-semibold tracking-[0.15em] uppercase text-white border border-white/20 hover:bg-white hover:text-black transition-all"
          >
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
              <line x1="12" y1="5" x2="12" y2="19" />
              <line x1="5" y1="12" x2="19" y2="12" />
            </svg>
            Create Alternate
          </Link>
        </div>

        {/* Alternate timelines */}
        {episode.branches.length > 0 && (
          <div className="mt-8 pt-6 border-t border-white/5">
            <h2 className="text-[11px] font-semibold tracking-[0.2em] uppercase text-white/40 mb-4">
              Alternate Timelines
            </h2>
            <div className="space-y-2">
              {episode.branches.map((branch) => (
                <Link
                  key={branch.id}
                  href={`/show/${showId}/episode/${episodeId}/branch/${branch.id}`}
                  className="flex items-center justify-between p-4 bg-[#141414] hover:bg-[#1a1a1a] transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/25 group-hover:text-white/50 transition-colors">
                      <path d="M7 3v18M3 7l4-4 4 4M17 3v18M13 17l4 4 4-4" />
                    </svg>
                    <div>
                      <div className="text-[13px] font-medium group-hover:text-white transition-colors">{branch.title}</div>
                      <div className="text-[10px] text-white/25">Fork @ {branch.forkPoint} &middot; by {branch.author} &middot; {branch.likes} likes</div>
                    </div>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/15">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
