"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getShow } from "@/lib/data";
import { ExtractedAssets } from "@/lib/types";

interface EpisodeAssets {
  filename: string;
  videoPath: string;
  data: ExtractedAssets;
}

export default function ShowPage() {
  const params = useParams();
  const id = params.id as string;
  const show = getShow(id);

  const [episodeAssets, setEpisodeAssets] = useState<Record<string, EpisodeAssets>>({});
  const [extracting, setExtracting] = useState<Record<string, boolean>>({});
  const [showAssetsPanel, setShowAssetsPanel] = useState(false);

  // Load cached assets on mount
  useEffect(() => {
    fetch("/api/assets")
      .then((r) => r.json())
      .then((data) => {
        const map: Record<string, EpisodeAssets> = {};
        for (const asset of data.assets || []) {
          // Match by videoPath to episode
          map[asset.videoPath] = asset;
        }
        setEpisodeAssets(map);
      });
  }, []);

  if (!show) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-white/30">Not found</p>
      </div>
    );
  }

  const totalBranches = show.episodes.reduce(
    (acc, ep) => acc + ep.branches.length,
    0
  );

  // Collect all assets across episodes for this show
  const allCharacters = new Map<string, ExtractedAssets["characters"][0]>();
  const allEnvironments: ExtractedAssets["environments"] = [];
  const allObjects: ExtractedAssets["objects"] = [];

  for (const ep of show.episodes) {
    if (!ep.videoUrl) continue;
    const asset = episodeAssets[ep.videoUrl];
    if (!asset) continue;
    for (const c of asset.data.characters) {
      if (!allCharacters.has(c.name)) allCharacters.set(c.name, c);
    }
    allEnvironments.push(...asset.data.environments);
    allObjects.push(...asset.data.objects);
  }

  const hasAnyAssets = allCharacters.size > 0;
  const episodesWithVideo = show.episodes.filter((ep) => ep.videoUrl);
  const extractedCount = episodesWithVideo.filter(
    (ep) => ep.videoUrl && episodeAssets[ep.videoUrl]
  ).length;

  async function handleExtract(videoPath: string, episodeTitle: string) {
    setExtracting((prev) => ({ ...prev, [videoPath]: true }));
    try {
      const res = await fetch("/api/extract-assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ videoPath, showTitle: show!.title, episodeTitle }),
      });
      const data = await res.json();
      if (res.ok) {
        setEpisodeAssets((prev) => ({
          ...prev,
          [videoPath]: {
            filename: videoPath.replace(/^\//, "").replace(/\//g, "--").replace(/\.mp4$/, "") + ".json",
            videoPath,
            data: data.assets,
          },
        }));
      }
    } finally {
      setExtracting((prev) => ({ ...prev, [videoPath]: false }));
    }
  }

  async function handleExtractAll() {
    const toExtract = episodesWithVideo.filter(
      (ep) => ep.videoUrl && !episodeAssets[ep.videoUrl]
    );
    // Extract in parallel
    await Promise.all(
      toExtract.map((ep) => handleExtract(ep.videoUrl!, ep.title))
    );
  }

  return (
    <main className="min-h-screen">
      {/* Hero */}
      <div className="relative h-[55vh] min-h-[400px]">
        <img
          src={show.banner}
          alt={show.title}
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0e0e0e] via-[#0e0e0e]/40 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0e0e0e]/70 to-transparent" />

        <div className="relative z-10 h-full max-w-[1440px] mx-auto px-12 flex flex-col justify-end pb-14">
          <div className="max-w-xl">
            <div className="flex items-center gap-3 mb-3">
              <span className="px-2 py-0.5 text-[10px] font-semibold border border-white/30 tracking-[0.1em] uppercase">
                {show.rating}
              </span>
              <span className="text-[11px] text-white/40 tracking-wide">
                {show.year} &middot; {show.seasons} Season
                {show.seasons > 1 ? "s" : ""}
              </span>
            </div>

            <h1 className="text-[52px] font-black tracking-[-0.02em] leading-[0.9] uppercase mb-4">
              {show.title}
            </h1>
            <p className="text-[13px] text-white/45 leading-relaxed mb-5 max-w-md">
              {show.description}
            </p>

            <div className="flex items-center gap-4 mb-5">
              {show.genre.map((g) => (
                <span key={g} className="text-[11px] text-white/35">
                  {g}
                </span>
              ))}
            </div>

            <div className="flex items-center gap-8 text-center">
              <div>
                <div className="text-[20px] font-bold">
                  {show.episodes.length}
                </div>
                <div className="text-[9px] text-white/30 tracking-[0.2em] uppercase">
                  Episodes
                </div>
              </div>
              <div className="w-px h-8 bg-white/10" />
              <div>
                <div className="text-[20px] font-bold">{totalBranches}</div>
                <div className="text-[9px] text-white/30 tracking-[0.2em] uppercase">
                  Alternates
                </div>
              </div>
              {hasAnyAssets && (
                <>
                  <div className="w-px h-8 bg-white/10" />
                  <div>
                    <div className="text-[20px] font-bold">
                      {allCharacters.size}
                    </div>
                    <div className="text-[9px] text-white/30 tracking-[0.2em] uppercase">
                      Characters
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-[1440px] mx-auto px-12 mt-8">
        {/* Assets panel toggle */}
        <div className="flex items-center gap-4 mb-6">
          {episodesWithVideo.length > 0 && (
            <button
              onClick={() => setShowAssetsPanel(!showAssetsPanel)}
              className={`inline-flex items-center gap-2 px-4 py-2 text-[10px] font-semibold tracking-[0.15em] uppercase transition-all ${
                showAssetsPanel
                  ? "bg-white text-black"
                  : "text-white border border-white/20 hover:bg-white hover:text-black"
              }`}
            >
              <svg
                width="10"
                height="10"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <circle cx="12" cy="12" r="10" />
                <path d="M12 16v-4M12 8h.01" />
              </svg>
              {hasAnyAssets
                ? `Assets (${extractedCount}/${episodesWithVideo.length} episodes)`
                : "Extract Assets"}
            </button>
          )}

          {showAssetsPanel &&
            extractedCount < episodesWithVideo.length && (
              <button
                onClick={handleExtractAll}
                disabled={Object.values(extracting).some(Boolean)}
                className="px-4 py-2 text-[10px] font-semibold tracking-[0.15em] uppercase text-white/50 border border-white/10 hover:border-white/30 hover:text-white transition-all disabled:opacity-30"
              >
                Extract All Missing
              </button>
            )}
        </div>

        {/* Assets panel */}
        {showAssetsPanel && (
          <div className="mb-10 p-6 bg-[#141414] border border-white/5">
            {!hasAnyAssets ? (
              <p className="text-[12px] text-white/30">
                No assets extracted yet. Click &quot;Extract&quot; on an episode
                below, or &quot;Extract All Missing&quot; above.
              </p>
            ) : (
              <div>
                {/* Characters across all episodes */}
                <h3 className="text-[10px] tracking-[0.2em] uppercase text-white/40 mb-4">
                  All Characters ({allCharacters.size})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 mb-6">
                  {Array.from(allCharacters.values()).map((char, i) => (
                    <div
                      key={i}
                      className="bg-[#1a1a1a] border border-white/5 overflow-hidden"
                    >
                      {char.imagePath && (
                        <div className="aspect-video bg-black">
                          <img
                            src={char.imagePath}
                            alt={char.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <div className="p-4">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-[13px] font-semibold truncate">
                            {char.name}
                          </span>
                          <span className="text-[8px] px-1.5 py-0.5 bg-white/5 text-white/25 tracking-[0.1em] uppercase flex-shrink-0">
                            {char.role}
                          </span>
                        </div>
                        <p className="text-[11px] text-white/40 line-clamp-2">
                          {char.description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Environments */}
                <h3 className="text-[10px] tracking-[0.2em] uppercase text-white/40 mb-3">
                  Environments ({allEnvironments.length})
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-6">
                  {allEnvironments.map((env, i) => (
                    <div
                      key={i}
                      className="bg-[#1a1a1a] border border-white/5 overflow-hidden"
                    >
                      {env.imagePath && (
                        <div className="aspect-video bg-black">
                          <img
                            src={env.imagePath}
                            alt={env.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      )}
                      <div className="p-4">
                        <h4 className="text-[12px] font-semibold mb-1">
                          {env.name}
                        </h4>
                        <p className="text-[11px] text-white/35 line-clamp-2">
                          {env.description}
                        </p>
                        <div className="flex gap-3 mt-2 text-[9px] text-white/20">
                          <span>{env.lighting}</span>
                          <span>{env.mood}</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Objects */}
                {allObjects.length > 0 && (
                  <>
                    <h3 className="text-[10px] tracking-[0.2em] uppercase text-white/40 mb-3">
                      Key Objects ({allObjects.length})
                    </h3>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                      {allObjects.map((obj, i) => (
                        <div
                          key={i}
                          className="bg-[#1a1a1a] border border-white/5 overflow-hidden"
                        >
                          {obj.imagePath && (
                            <div className="aspect-video bg-black">
                              <img
                                src={obj.imagePath}
                                alt={obj.name}
                                className="w-full h-full object-cover"
                              />
                            </div>
                          )}
                          <div className="p-3">
                            <span className="text-[11px] text-white/50 font-semibold">
                              {obj.name}
                            </span>
                            <p className="text-[10px] text-white/20 mt-0.5">
                              {obj.significance}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                <div className="mt-4 text-right">
                  <Link
                    href="/assets"
                    className="text-[10px] text-white/25 hover:text-white/50 transition-colors tracking-[0.15em] uppercase"
                  >
                    View full details &rarr;
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Episodes */}
        <h2 className="text-[12px] font-semibold tracking-[0.2em] uppercase text-white/50 mb-6">
          Episodes
        </h2>
        <div className="space-y-3">
          {show.episodes.map((ep) => {
            const asset = ep.videoUrl ? episodeAssets[ep.videoUrl] : null;
            const isExtracting = ep.videoUrl
              ? extracting[ep.videoUrl]
              : false;

            return (
              <div
                key={ep.id}
                className="group flex flex-col md:flex-row rounded overflow-hidden bg-[#181818] hover:bg-[#1f1f1f] transition-colors"
              >
                {/* Thumbnail */}
                <Link
                  href={`/show/${show.id}/episode/${ep.id}/watch`}
                  className="relative w-full md:w-[280px] flex-shrink-0 aspect-video md:aspect-auto block"
                >
                  <img
                    src={ep.thumbnail}
                    alt={ep.title}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="w-10 h-10 rounded-full bg-black/50 backdrop-blur-sm flex items-center justify-center border border-white/20">
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="white"
                      >
                        <polygon points="5 3 19 12 5 21 5 3" />
                      </svg>
                    </div>
                  </div>
                  <div className="absolute bottom-2 right-2 px-1.5 py-0.5 text-[10px] bg-black/70 text-white/60 rounded-sm">
                    {ep.duration}
                  </div>
                  {ep.videoUrl && (
                    <div className="absolute top-2 left-2 px-1.5 py-0.5 text-[9px] bg-white/10 backdrop-blur-sm text-white/70 rounded-sm tracking-wider uppercase">
                      Playable
                    </div>
                  )}
                </Link>

                {/* Info */}
                <div className="flex-1 p-5">
                  <div className="mb-1.5">
                    <span className="text-[10px] text-white/25 tracking-[0.15em] uppercase mr-2">
                      S{ep.season} E{ep.number}
                    </span>
                    <span className="text-[13px] font-semibold text-white/85">
                      {ep.title}
                    </span>
                  </div>
                  <p className="text-[12px] text-white/35 mb-3 leading-relaxed">
                    {ep.description}
                  </p>

                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      href={`/show/${show.id}/episode/${ep.id}/create`}
                      className="inline-flex items-center gap-2 px-4 py-2 text-[10px] font-semibold tracking-[0.15em] uppercase text-white border border-white/20 hover:bg-white hover:text-black transition-all"
                    >
                      <svg
                        width="9"
                        height="9"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.5"
                      >
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                      Create Alternate
                    </Link>

                    {/* Extract button */}
                    {ep.videoUrl && !asset && (
                      <button
                        onClick={() =>
                          handleExtract(ep.videoUrl!, ep.title)
                        }
                        disabled={isExtracting}
                        className="inline-flex items-center gap-2 px-3 py-2 text-[10px] tracking-[0.1em] uppercase text-white/30 border border-white/10 hover:border-white/25 hover:text-white/60 transition-all disabled:opacity-30"
                      >
                        {isExtracting ? (
                          <>
                            <div className="w-3 h-3 rounded-full border border-white/20 border-t-white/80 spin" />
                            Extracting...
                          </>
                        ) : (
                          <>
                            <svg
                              width="9"
                              height="9"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="currentColor"
                              strokeWidth="2"
                            >
                              <circle cx="12" cy="12" r="10" />
                              <path d="M12 16v-4M12 8h.01" />
                            </svg>
                            Extract Assets
                          </>
                        )}
                      </button>
                    )}

                    {ep.branches.map((branch) => (
                      <Link
                        key={branch.id}
                        href={`/show/${show.id}/episode/${ep.id}/branch/${branch.id}`}
                        className="inline-flex items-center gap-2 px-3 py-2 bg-white/5 text-white/45 text-[10px] tracking-[0.05em] hover:bg-white/10 hover:text-white/70 transition-colors"
                      >
                        <svg
                          width="8"
                          height="8"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="2"
                        >
                          <path d="M7 3v18M3 7l4-4 4 4M17 3v18M13 17l4 4 4-4" />
                        </svg>
                        {branch.title}
                        <span className="text-white/20">{branch.likes}</span>
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="h-20" />
    </main>
  );
}
