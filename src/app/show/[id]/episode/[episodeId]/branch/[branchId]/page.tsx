"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getShow, getBranch, getEpisode } from "@/lib/data";
import VideoPlayer from "@/components/VideoPlayer";
import GenerationProgress from "@/components/GenerationProgress";
import { Storyboard } from "@/lib/types";

interface GeneratedBranch {
  storyboard: Storyboard;
  videos: Record<string, { videoUrl: string; status: string }>;
  images?: Record<string, { startImage?: string; endImage?: string }>;
  frames?: Record<string, { startFrame?: string; endFrame?: string; startTimestamp?: number; endTimestamp?: number }>;
  fullVideo?: string;
}

export default function BranchPage() {
  const params = useParams();
  const showId = params.id as string;
  const episodeId = params.episodeId as string;
  const branchId = params.branchId as string;

  const show = getShow(showId);
  const episode = getEpisode(showId, episodeId);
  const branch = getBranch(showId, episodeId, branchId);

  const [generated, setGenerated] = useState<GeneratedBranch | null>(null);
  const [activePanel, setActivePanel] = useState<string | null>(null);
  const [generating, setGenerating] = useState<Record<string, boolean>>({});
  const [generatingAll, setGeneratingAll] = useState(false);
  const [videoModel, setVideoModel] = useState<"grok" | "kling">("grok");

  useEffect(() => {
    fetch(`/branches/${branchId}.json`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.storyboard) {
          setGenerated({
            storyboard: data.storyboard,
            videos: data.videos || {},
            images: data.images,
            frames: data.frames,
            fullVideo: data.fullVideo,
          });
          if (data.storyboard.panels.length > 0) {
            setActivePanel(data.storyboard.panels[0].id);
          }
        }
      })
      .catch(() => {});
  }, [branchId]);

  // Persist video state to branch JSON
  const persistVideos = useCallback(async (videos: Record<string, { videoUrl: string; status: string }>) => {
    await fetch("/api/branches", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ branchId, videos }),
    });
  }, [branchId]);

  const handleGeneratePanel = useCallback(async (panelId: string) => {
    if (!generated) return;
    const panel = generated.storyboard.panels.find((p) => p.id === panelId);
    if (!panel) return;

    setGenerating((prev) => ({ ...prev, [panelId]: true }));

    try {
      const panelImages = generated.images?.[panelId];
      const res = await fetch("/api/generate-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          panelId: panel.id,
          visualPrompt: panel.visualPrompt || panel.sceneDescription,
          duration: panel.duration,
          firstFramePath: panelImages?.startImage,
          lastFramePath: panelImages?.endImage,
          model: videoModel,
        }),
      });

      const data = await res.json();
      if (res.ok && data.videoUrl) {
        const newVideos = {
          ...generated.videos,
          [panelId]: { videoUrl: data.videoUrl, status: "done" },
        };
        setGenerated((prev) => {
          if (!prev) return prev;
          return { ...prev, videos: newVideos };
        });
        setActivePanel(panelId);
        // Persist to disk
        await persistVideos(newVideos);
      }
    } catch {
      // Silently fail
    } finally {
      setGenerating((prev) => ({ ...prev, [panelId]: false }));
    }
  }, [generated, persistVideos, videoModel]);

  // Generate all videos sequentially: panel1, transition1→2, panel2, transition2→3, panel3...
  const handleGenerateAll = useCallback(async () => {
    if (!generated) return;
    const panels = generated.storyboard.panels;
    setGeneratingAll(true);

    const allVideos = { ...generated.videos };

    for (let i = 0; i < panels.length; i++) {
      const panel = panels[i];
      const panelImages = generated.images?.[panel.id];

      // Generate panel video (start frame → end frame)
      setGenerating((prev) => ({ ...prev, [panel.id]: true }));
      setActivePanel(panel.id);
      try {
        const res = await fetch("/api/generate-video", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            panelId: panel.id,
            visualPrompt: panel.visualPrompt || panel.sceneDescription,
            duration: panel.duration,
            firstFramePath: panelImages?.startImage,
            lastFramePath: panelImages?.endImage,
          }),
        });
        const data = await res.json();
        if (res.ok && data.videoUrl) {
          allVideos[panel.id] = { videoUrl: data.videoUrl, status: "done" };
          setGenerated((prev) => prev ? { ...prev, videos: { ...allVideos } } : prev);
        }
      } catch {
        // continue to next
      } finally {
        setGenerating((prev) => ({ ...prev, [panel.id]: false }));
      }

      // Generate transition to next panel (current end frame → next start frame)
      if (i < panels.length - 1) {
        const nextPanel = panels[i + 1];
        const nextImages = generated.images?.[nextPanel.id];
        const transitionId = `transition-${panel.id}-${nextPanel.id}`;

        if (panelImages?.endImage && nextImages?.startImage) {
          setGenerating((prev) => ({ ...prev, [transitionId]: true }));
          try {
            const res = await fetch("/api/generate-video", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                panelId: transitionId,
                visualPrompt: `Smooth cinematic transition. ${panel.sceneDescription} transitions seamlessly into ${nextPanel.sceneDescription}. Continuous camera movement, matching lighting and color grading.`,
                duration: 4,
                firstFramePath: panelImages.endImage,
                lastFramePath: nextImages.startImage,
              }),
            });
            const data = await res.json();
            if (res.ok && data.videoUrl) {
              allVideos[transitionId] = { videoUrl: data.videoUrl, status: "done" };
              setGenerated((prev) => prev ? { ...prev, videos: { ...allVideos } } : prev);
            }
          } catch {
            // continue
          } finally {
            setGenerating((prev) => ({ ...prev, [transitionId]: false }));
          }
        }
      }
    }

    // Persist all videos
    await persistVideos(allVideos);
    setGeneratingAll(false);
  }, [generated, persistVideos, videoModel]);

  if (!show || !episode || !branch) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-white/30">Not found</p>
      </div>
    );
  }

  const activePanelData = generated?.storyboard.panels.find((p) => p.id === activePanel);
  const activeVideo = activePanel ? generated?.videos[activePanel] : null;
  const activeImages = activePanel ? generated?.images?.[activePanel] : null;
  const activeFrames = activePanel ? generated?.frames?.[activePanel] : null;
  const resolvedStart = activeFrames?.startFrame || activeImages?.startImage;
  const resolvedEnd = activeFrames?.endFrame || activeImages?.endImage;

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
            <h1 className="text-[24px] font-black uppercase tracking-tight mb-1.5">
              {generated?.storyboard.title || branch.title}
            </h1>
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

        {/* Generated storyboard */}
        {generated ? (
          <div>
            {/* Full video if available */}
            {generated.fullVideo && (
              <div className="mb-8">
                <div className="flex items-center gap-2 mb-2">
                  <h3 className="text-[10px] tracking-[0.2em] uppercase text-white/30">Full Alternate</h3>
                  <span className="text-[8px] px-1.5 py-0.5 bg-green-500/10 text-green-400/60 tracking-[0.1em] uppercase">Complete</span>
                </div>
                <div className="aspect-video bg-black border border-white/10 overflow-hidden">
                  <video controls className="w-full h-full" src={generated.fullVideo} />
                </div>
              </div>
            )}

            {/* Active panel video */}
            {activeVideo?.videoUrl && (
              <div className="mb-6">
                <div className="aspect-video bg-black border border-white/10 overflow-hidden">
                  <video key={activeVideo.videoUrl} controls autoPlay className="w-full h-full" src={activeVideo.videoUrl} />
                </div>
              </div>
            )}

            {/* Start/End frames for active panel */}
            {(resolvedStart || resolvedEnd) && (
              <div className="mb-6">
                <div className="flex items-center gap-3 mb-3">
                  <h3 className="text-[10px] tracking-[0.2em] uppercase text-white/30">Storyboard Frames</h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {resolvedStart && (
                    <div>
                      <div className="aspect-video bg-black border border-white/10 overflow-hidden mb-1">
                        <img src={resolvedStart} alt="In frame" className="w-full h-full object-cover" />
                      </div>
                      <span className="text-[9px] text-white/20 tracking-[0.15em] uppercase">In Frame</span>
                    </div>
                  )}
                  {resolvedEnd && (
                    <div>
                      <div className="aspect-video bg-black border border-white/10 overflow-hidden mb-1">
                        <img src={resolvedEnd} alt="Out frame" className="w-full h-full object-cover" />
                      </div>
                      <span className="text-[9px] text-white/20 tracking-[0.15em] uppercase">Out Frame</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Video model selector + Generate All Videos button */}
            <div className="mb-6 space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-[10px] tracking-[0.15em] uppercase text-white/30">Video Model</span>
                <div className="flex bg-[#181818] border border-white/10 overflow-hidden">
                  <button
                    onClick={() => setVideoModel("grok")}
                    className={`px-4 py-2 text-[10px] tracking-[0.1em] uppercase transition-colors ${
                      videoModel === "grok"
                        ? "bg-white text-black font-semibold"
                        : "text-white/40 hover:text-white/60"
                    }`}
                  >
                    Grok Imagine
                    <span className="block text-[8px] font-normal opacity-60 mt-0.5">Start frame only</span>
                  </button>
                  <button
                    onClick={() => setVideoModel("kling")}
                    className={`px-4 py-2 text-[10px] tracking-[0.1em] uppercase transition-colors ${
                      videoModel === "kling"
                        ? "bg-white text-black font-semibold"
                        : "text-white/40 hover:text-white/60"
                    }`}
                  >
                    Kling 3.0
                    <span className="block text-[8px] font-normal opacity-60 mt-0.5">Start + End frames</span>
                  </button>
                </div>
              </div>
              {generatingAll ? (
                <div className="w-full p-4 bg-[#181818] border border-white/10">
                  <GenerationProgress label="Generating All Videos" variant="full" />
                </div>
              ) : (
              <button
                onClick={handleGenerateAll}
                className="w-full py-3 text-[11px] font-semibold tracking-[0.15em] uppercase bg-white text-black hover:bg-white/90 transition-colors flex items-center justify-center gap-2"
              >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
                      <polygon points="5 3 19 12 5 21 5 3" />
                    </svg>
                    Generate All Videos
              </button>
            </div>

            {/* Storyboard panels */}
            <div className="mb-10">
              <h2 className="text-[12px] font-semibold tracking-[0.2em] uppercase text-white/50 mb-4">
                Storyboard
              </h2>
              <div className="space-y-3 relative">
                <div className="absolute left-[13px] top-0 bottom-0 w-px bg-gradient-to-b from-white/20 via-white/10 to-transparent" />

                {generated.storyboard.panels.map((panel, i) => {
                  const video = generated.videos[panel.id];
                  const panelImages = generated.images?.[panel.id];
                  const pStart = panelImages?.startImage;
                  const pEnd = panelImages?.endImage;
                  const isActive = activePanel === panel.id;
                  const isGenerating = generating[panel.id];

                  // Check for transition video to next panel
                  const nextPanel = generated.storyboard.panels[i + 1];
                  const transitionId = nextPanel ? `transition-${panel.id}-${nextPanel.id}` : null;
                  const transitionVideo = transitionId ? generated.videos[transitionId] : null;

                  return (
                    <div key={panel.id}>
                      <div
                        className="relative pl-10 cursor-pointer"
                        onClick={() => setActivePanel(panel.id)}
                      >
                        <div
                          className={`absolute left-[9px] top-5 w-[9px] h-[9px] rounded-full border-2 border-[#0e0e0e] ${
                            isActive ? "bg-white" : "bg-white/40"
                          }`}
                        />

                        <div
                          className={`p-5 transition-colors ${
                            isActive
                              ? "bg-[#1f1f1f] border border-white/15"
                              : "bg-[#181818] hover:bg-[#1a1a1a]"
                          }`}
                        >
                          <div className="flex items-center gap-2 mb-2">
                            <span className="text-[10px] font-semibold text-white/50 tracking-[0.15em] uppercase">
                              Panel {panel.order}
                            </span>
                            {video?.status === "done" && (
                              <span className="text-[8px] px-1.5 py-0.5 bg-green-500/10 text-green-400/60 tracking-[0.1em] uppercase">
                                Generated
                              </span>
                            )}
                            <span className="text-[9px] text-white/15">{panel.duration}s</span>
                            {panel.characters.map((c, ci) => (
                              <span key={ci} className="px-2 py-0.5 text-[9px] bg-white/5 text-white/30">
                                {c}
                              </span>
                            ))}

                            {/* Generate button */}
                            {(!video || video.status !== "done") && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleGeneratePanel(panel.id);
                                }}
                                disabled={isGenerating}
                                className="ml-auto px-3 py-1 text-[9px] font-semibold tracking-[0.1em] uppercase bg-white text-black hover:bg-white/90 transition-colors disabled:opacity-30 flex items-center gap-1.5"
                              >
                                {isGenerating ? (
                                  <GenerationProgress variant="inline" />
                                ) : (
                                  <>
                                    <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor">
                                      <polygon points="5 3 19 12 5 21 5 3" />
                                    </svg>
                                    Generate Video
                                  </>
                                )}
                              </button>
                            )}

                            {video?.status === "done" && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleGeneratePanel(panel.id);
                                }}
                                disabled={isGenerating}
                                className="ml-auto px-3 py-1 text-[9px] tracking-[0.1em] uppercase text-white/25 hover:text-white/50 border border-white/10 hover:border-white/20 transition-colors disabled:opacity-30"
                              >
                                {isGenerating ? <GenerationProgress variant="inline" /> : "Regenerate"}
                              </button>
                            )}
                          </div>

                          {/* Inline frame thumbnails */}
                          {(pStart || pEnd) && (
                            <div className="flex gap-2 mb-3">
                              {pStart && (
                                <div className="w-[120px] flex-shrink-0">
                                  <div className="aspect-video bg-black border border-white/10 overflow-hidden">
                                    <img src={pStart} alt="In" className="w-full h-full object-cover" />
                                  </div>
                                  <span className="text-[8px] text-white/15 tracking-[0.1em] uppercase">In</span>
                                </div>
                              )}
                              {pEnd && (
                                <div className="w-[120px] flex-shrink-0">
                                  <div className="aspect-video bg-black border border-white/10 overflow-hidden">
                                    <img src={pEnd} alt="Out" className="w-full h-full object-cover" />
                                  </div>
                                  <span className="text-[8px] text-white/15 tracking-[0.1em] uppercase">Out</span>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Generation progress overlay */}
                          {isGenerating && (
                            <div className="mb-3 p-4 bg-black/60 border border-white/10 backdrop-blur-sm">
                              <GenerationProgress label={`Generating Panel ${panel.order}`} variant="full" />
                            </div>
                          )}

                          {/* Inline video if generated */}
                          {!isGenerating && video?.status === "done" && video.videoUrl && (
                            <div className="mb-3 aspect-video bg-black border border-white/10 overflow-hidden">
                              <video
                                key={video.videoUrl}
                                controls
                                className="w-full h-full"
                                src={video.videoUrl}
                              />
                            </div>
                          )}

                          <p className="text-[13px] text-white/55 mb-2">
                            {panel.sceneDescription}
                          </p>
                          {panel.dialogue && (
                            <div className="pl-4 border-l border-white/15 py-1 mb-2">
                              <p className="text-[12px] italic text-white/30">
                                &ldquo;{panel.dialogue}&rdquo;
                              </p>
                            </div>
                          )}
                          <div className="flex flex-wrap gap-3 text-[10px] text-white/20">
                            <span>Camera: {panel.cameraAngle}</span>
                            <span>Movement: {panel.cameraMovement}</span>
                            <span>Mood: {panel.mood}</span>
                          </div>
                        </div>
                      </div>

                      {/* Transition video between panels */}
                      {transitionVideo?.status === "done" && transitionVideo.videoUrl && (
                        <div className="pl-10 my-2">
                          <div className="flex items-center gap-2 mb-1">
                            <div className="h-px flex-1 bg-white/10" />
                            <span className="text-[8px] text-white/20 tracking-[0.15em] uppercase">Transition</span>
                            <div className="h-px flex-1 bg-white/10" />
                          </div>
                          <div className="aspect-video bg-black border border-white/5 overflow-hidden">
                            <video
                              key={transitionVideo.videoUrl}
                              controls
                              className="w-full h-full"
                              src={transitionVideo.videoUrl}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Music */}
            {generated.storyboard.musicPrompt && (
              <div className="p-4 bg-[#181818] border border-white/5 flex items-center gap-3 mb-10">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/40">
                  <path d="M9 18V5l12-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="18" cy="16" r="3" />
                </svg>
                <div>
                  <div className="text-[11px] font-semibold">Soundtrack</div>
                  <div className="text-[10px] text-white/25">{generated.storyboard.musicPrompt}</div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <>
            {/* Original video player */}
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

            {/* Legacy text scenes */}
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
          </>
        )}
      </div>

      <div className="h-20" />
    </main>
  );
}
