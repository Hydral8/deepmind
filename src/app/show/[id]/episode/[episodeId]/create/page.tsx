"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { getShow, getEpisode } from "@/lib/data";
import {
  ExtractedAssets,
  ChatMessage,
  Storyboard,
  StoryboardPanel,
} from "@/lib/types";

export default function CreatePage() {
  const params = useParams();
  const showId = params.id as string;
  const episodeId = params.episodeId as string;

  const show = getShow(showId);
  const episode = getEpisode(showId, episodeId);

  // ── Stage control ──
  const [stage, setStage] = useState<
    "select-type" | "extracting" | "chat" | "storyboard" | "generating" | "done"
  >("select-type");
  const [branchType, setBranchType] = useState("");
  const [error, setError] = useState("");

  // ── Stage 1: Asset extraction ──
  const [assets, setAssets] = useState<ExtractedAssets | null>(null);
  const [extractionStep, setExtractionStep] = useState("");

  // ── Stage 2: Multi-turn chat ──
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [readyForStoryboard, setReadyForStoryboard] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // ── Stage 3: Storyboard ──
  const [storyboard, setStoryboard] = useState<Storyboard | null>(null);
  const [storyboardLoading, setStoryboardLoading] = useState(false);

  // ── Stage 4: Video generation ──
  const [generatedVideos, setGeneratedVideos] = useState<
    Record<string, { status: string; videoData?: string; videoUrl?: string; error?: string }>
  >({});
  const [allDone, setAllDone] = useState(false);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!show || !episode) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-white/30">Not found</p>
      </div>
    );
  }

  // ── Handlers ──

  async function handleSelectType(type: string) {
    setBranchType(type);
    setStage("extracting");
    setError("");

    if (!episode?.videoUrl) {
      setError("No video available for this episode.");
      setStage("select-type");
      return;
    }

    try {
      setExtractionStep("Uploading video to Gemini...");
      const res = await fetch("/api/extract-assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoPath: episode.videoUrl,
          showTitle: show?.title,
          episodeTitle: episode.title,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Extraction failed");
      }

      setExtractionStep("Parsing assets...");
      const data = await res.json();
      setAssets(data.assets);
      setStage("chat");

      // Send initial greeting
      const greeting = `I want to create an alternate ${type} for "${episode.title}". What are my options given the characters and setting?`;
      await sendChatMessage(greeting, data.assets, type);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg);
      setStage("select-type");
    }
  }

  async function sendChatMessage(
    text: string,
    overrideAssets?: ExtractedAssets,
    overrideBranchType?: string
  ) {
    const newMessages: ChatMessage[] = [
      ...messages,
      { role: "user", content: text },
    ];
    setMessages(newMessages);
    setChatInput("");
    setChatLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages,
          assets: overrideAssets || assets,
          branchType: overrideBranchType || branchType,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Chat failed");
      }

      const data = await res.json();
      setMessages([
        ...newMessages,
        { role: "assistant", content: data.message },
      ]);
      if (data.readyForStoryboard) {
        setReadyForStoryboard(true);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setMessages([
        ...newMessages,
        { role: "assistant", content: `Error: ${msg}` },
      ]);
    } finally {
      setChatLoading(false);
    }
  }

  async function handleGenerateStoryboard() {
    setStoryboardLoading(true);
    setStage("storyboard");

    try {
      const res = await fetch("/api/generate-storyboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages, assets, branchType }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Storyboard generation failed");
      }

      const data = await res.json();
      setStoryboard(data.storyboard);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg);
      setStage("chat");
    } finally {
      setStoryboardLoading(false);
    }
  }

  async function handleGenerateVideos() {
    if (!storyboard) return;
    setStage("generating");

    // Initialize all panels as pending
    const initial: Record<string, { status: string }> = {};
    for (const panel of storyboard.panels) {
      initial[panel.id] = { status: "generating" };
    }
    setGeneratedVideos(initial);

    // Fire all video generations in parallel
    const promises = storyboard.panels.map(async (panel: StoryboardPanel) => {
      try {
        const res = await fetch("/api/generate-video", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            panelId: panel.id,
            visualPrompt: panel.visualPrompt,
            duration: panel.duration,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          setGeneratedVideos((prev) => ({
            ...prev,
            [panel.id]: { status: "error", error: data.error },
          }));
        } else {
          setGeneratedVideos((prev) => ({
            ...prev,
            [panel.id]: {
              status: "done",
              videoData: data.videoData,
              videoUrl: data.videoUrl,
            },
          }));
        }
      } catch {
        setGeneratedVideos((prev) => ({
          ...prev,
          [panel.id]: { status: "error", error: "Network error" },
        }));
      }
    });

    await Promise.all(promises);
    setAllDone(true);
    setStage("done");
  }

  // ── Render ──

  const stageIndex =
    stage === "select-type"
      ? 0
      : stage === "extracting"
        ? 1
        : stage === "chat"
          ? 2
          : stage === "storyboard"
            ? 3
            : stage === "generating" || stage === "done"
              ? 4
              : 0;

  const stageLabels = [
    "Branch Type",
    "Analyze",
    "Design",
    "Storyboard",
    "Generate",
  ];

  return (
    <main className="min-h-screen pt-20">
      <div className="max-w-[900px] mx-auto px-12">
        {/* Back */}
        <Link
          href={`/show/${showId}`}
          className="inline-flex items-center gap-2 text-[10px] text-white/30 hover:text-white/60 transition-colors mb-8 tracking-[0.15em] uppercase"
        >
          <svg
            width="10"
            height="10"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <polyline points="15 18 9 12 15 6" />
          </svg>
          {show.title} &middot; S{episode.season}E{episode.number}
        </Link>

        <div className="mb-10">
          <h1 className="text-[28px] font-black uppercase tracking-tight mb-1.5">
            Create Alternate
          </h1>
          <p className="text-[12px] text-white/30">
            {episode.title} &middot; {episode.duration}
          </p>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 mb-10">
          {stageLabels.map((label, i) => (
            <div key={i} className="flex items-center gap-2 flex-1">
              <div className="flex flex-col items-center gap-1">
                <div
                  className={`w-7 h-7 flex items-center justify-center text-[11px] font-bold transition-all ${
                    stageIndex >= i
                      ? "bg-white text-black"
                      : "bg-white/5 text-white/25 border border-white/10"
                  }`}
                >
                  {stageIndex > i ? (
                    <svg
                      width="12"
                      height="12"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  ) : (
                    i + 1
                  )}
                </div>
                <span className="text-[8px] text-white/25 tracking-[0.1em] uppercase">
                  {label}
                </span>
              </div>
              {i < stageLabels.length - 1 && (
                <div
                  className={`flex-1 h-px mb-4 ${stageIndex > i ? "bg-white/40" : "bg-white/10"}`}
                />
              )}
            </div>
          ))}
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-400 text-[12px]">
            {error}
          </div>
        )}

        {/* ── Stage: Select Type ── */}
        {stage === "select-type" && (
          <div className="fade-up">
            <h2 className="text-[15px] font-bold mb-1">
              What would you like to create?
            </h2>
            <p className="text-[11px] text-white/30 mb-6">
              Choose how to branch from the original.
            </p>

            <div className="grid grid-cols-3 gap-3 mb-8">
              {[
                {
                  id: "continue",
                  title: "Continue Differently",
                  desc: "New direction from a specific scene",
                },
                {
                  id: "insert",
                  title: "Insert Scene",
                  desc: "Add a scene between existing ones",
                },
                {
                  id: "ending",
                  title: "Alternate Ending",
                  desc: "Reimagine how it concludes",
                },
              ].map((type) => (
                <button
                  key={type.id}
                  onClick={() => handleSelectType(type.id)}
                  className="text-left p-5 bg-[#181818] border border-white/5 hover:border-white/20 hover:bg-[#1f1f1f] transition-all"
                >
                  <h3 className="text-[13px] font-semibold mb-1">
                    {type.title}
                  </h3>
                  <p className="text-[11px] text-white/25">{type.desc}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Stage: Extracting Assets ── */}
        {stage === "extracting" && (
          <div className="fade-up text-center py-20">
            <div className="relative w-16 h-16 mx-auto mb-6">
              <div className="absolute inset-0 rounded-full border border-white/10" />
              <div className="absolute inset-0 rounded-full border border-transparent border-t-white spin" />
            </div>
            <h2 className="text-[18px] font-bold mb-2">
              Analyzing Scene
            </h2>
            <p className="text-[11px] text-white/30 mb-4">
              {extractionStep || "Preparing..."}
            </p>
            <div className="max-w-xs mx-auto space-y-2">
              {[
                "Uploading video to Gemini",
                "Detecting characters & appearances",
                "Extracting environments & objects",
                "Analyzing plot & camera style",
              ].map((label, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 px-4 py-2.5 bg-[#181818]"
                >
                  <div className="w-3 h-3 rounded-full border border-white/20 border-t-white/80 spin" />
                  <span className="text-[11px] flex-1 text-left text-white/50">
                    {label}
                  </span>
                  <span className="text-[9px] text-white/15 tracking-[0.15em] uppercase">
                    Gemini
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Stage: Chat ── */}
        {stage === "chat" && assets && (
          <div className="fade-up">
            {/* Extracted assets summary */}
            <div className="mb-6 p-5 bg-[#181818] border border-white/5">
              <h3 className="text-[10px] tracking-[0.2em] uppercase text-white/40 mb-3">
                Extracted Assets
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <div className="text-[20px] font-bold">
                    {assets.characters.length}
                  </div>
                  <div className="text-[9px] text-white/25 tracking-[0.15em] uppercase">
                    Characters
                  </div>
                </div>
                <div>
                  <div className="text-[20px] font-bold">
                    {assets.environments.length}
                  </div>
                  <div className="text-[9px] text-white/25 tracking-[0.15em] uppercase">
                    Environments
                  </div>
                </div>
                <div>
                  <div className="text-[20px] font-bold">
                    {assets.objects.length}
                  </div>
                  <div className="text-[9px] text-white/25 tracking-[0.15em] uppercase">
                    Objects
                  </div>
                </div>
              </div>

              {/* Character chips */}
              <div className="flex flex-wrap gap-2 mt-4">
                {assets.characters.map((c, i) => (
                  <span
                    key={i}
                    className="px-3 py-1.5 text-[11px] bg-white/5 border border-white/10 text-white/60"
                  >
                    {c.name}{" "}
                    <span className="text-white/20">({c.role})</span>
                  </span>
                ))}
              </div>
            </div>

            {/* Chat messages */}
            <div className="mb-4 max-h-[400px] overflow-y-auto space-y-3 pr-2">
              {messages.map((msg, i) => (
                <div
                  key={i}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  <div
                    className={`max-w-[80%] px-4 py-3 text-[13px] leading-relaxed ${
                      msg.role === "user"
                        ? "bg-white text-black"
                        : "bg-[#1f1f1f] border border-white/10 text-white/80"
                    }`}
                  >
                    {msg.content}
                  </div>
                </div>
              ))}
              {chatLoading && (
                <div className="flex justify-start">
                  <div className="px-4 py-3 bg-[#1f1f1f] border border-white/10">
                    <div className="flex gap-1">
                      <div className="w-2 h-2 rounded-full bg-white/30 animate-pulse" />
                      <div
                        className="w-2 h-2 rounded-full bg-white/30 animate-pulse"
                        style={{ animationDelay: "0.2s" }}
                      />
                      <div
                        className="w-2 h-2 rounded-full bg-white/30 animate-pulse"
                        style={{ animationDelay: "0.4s" }}
                      />
                    </div>
                  </div>
                </div>
              )}
              <div ref={chatEndRef} />
            </div>

            {/* Chat input */}
            <div className="flex gap-3 mb-6">
              <input
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && chatInput.trim() && !chatLoading) {
                    sendChatMessage(chatInput.trim());
                  }
                }}
                placeholder="Describe your alternate scene idea..."
                className="flex-1 bg-[#181818] border border-white/10 px-4 py-3 text-[13px] text-white placeholder:text-white/15 focus:outline-none focus:border-white/25 transition-colors"
              />
              <button
                onClick={() => {
                  if (chatInput.trim() && !chatLoading)
                    sendChatMessage(chatInput.trim());
                }}
                disabled={!chatInput.trim() || chatLoading}
                className="px-5 py-3 bg-white text-black text-[10px] font-semibold tracking-[0.15em] uppercase hover:bg-white/90 transition-colors disabled:opacity-30"
              >
                Send
              </button>
            </div>

            {/* Generate storyboard button */}
            {readyForStoryboard && (
              <div className="text-center py-4 border-t border-white/5">
                <p className="text-[11px] text-white/40 mb-3">
                  Ready to create your storyboard
                </p>
                <button
                  onClick={handleGenerateStoryboard}
                  className="px-10 py-3 bg-white text-black text-[11px] font-semibold tracking-[0.15em] uppercase hover:bg-white/90 transition-all"
                >
                  Generate Storyboard
                </button>
              </div>
            )}

            {/* Skip to storyboard if user wants */}
            {!readyForStoryboard && messages.length >= 4 && (
              <div className="text-center pt-2">
                <button
                  onClick={handleGenerateStoryboard}
                  className="text-[10px] text-white/25 hover:text-white/50 transition-colors tracking-[0.15em] uppercase"
                >
                  Skip to storyboard &rarr;
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── Stage: Storyboard ── */}
        {stage === "storyboard" && (
          <div className="fade-up">
            {storyboardLoading ? (
              <div className="text-center py-20">
                <div className="relative w-16 h-16 mx-auto mb-6">
                  <div className="absolute inset-0 rounded-full border border-white/10" />
                  <div className="absolute inset-0 rounded-full border border-transparent border-t-white spin" />
                </div>
                <h2 className="text-[18px] font-bold mb-2">
                  Creating Storyboard
                </h2>
                <p className="text-[11px] text-white/30">
                  Converting your ideas into visual panels...
                </p>
              </div>
            ) : storyboard ? (
              <div>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-[18px] font-bold mb-1">
                      {storyboard.title}
                    </h2>
                    <p className="text-[11px] text-white/30">
                      {storyboard.panels.length} panels &middot;{" "}
                      {storyboard.totalDuration}s total
                    </p>
                  </div>
                  <button
                    onClick={handleGenerateVideos}
                    className="px-8 py-3 bg-white text-black text-[11px] font-semibold tracking-[0.15em] uppercase hover:bg-white/90 transition-all"
                  >
                    Generate All Videos
                  </button>
                </div>

                <div className="space-y-4">
                  {storyboard.panels.map((panel) => (
                    <div
                      key={panel.id}
                      className="bg-[#181818] border border-white/5 p-5"
                    >
                      <div className="flex items-start gap-4">
                        <div className="w-8 h-8 flex items-center justify-center bg-white/5 text-[12px] font-bold text-white/40 flex-shrink-0">
                          {panel.order}
                        </div>
                        <div className="flex-1">
                          <p className="text-[13px] text-white/80 mb-2">
                            {panel.sceneDescription}
                          </p>
                          {panel.dialogue && (
                            <p className="text-[12px] text-white/40 italic mb-2">
                              &ldquo;{panel.dialogue}&rdquo;
                            </p>
                          )}
                          <div className="flex flex-wrap gap-3 text-[10px] text-white/25">
                            <span>
                              Camera: {panel.cameraAngle}
                            </span>
                            <span>
                              Movement: {panel.cameraMovement}
                            </span>
                            <span>Mood: {panel.mood}</span>
                            <span>{panel.duration}s</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {panel.characters.map((c, i) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 text-[9px] bg-white/5 text-white/40"
                              >
                                {c}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {storyboard.musicPrompt && (
                  <div className="mt-4 p-4 bg-[#181818] border border-white/5 flex items-center gap-3">
                    <svg
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      className="text-white/40"
                    >
                      <path d="M9 18V5l12-2v13" />
                      <circle cx="6" cy="18" r="3" />
                      <circle cx="18" cy="16" r="3" />
                    </svg>
                    <div>
                      <div className="text-[11px] font-semibold">
                        Music
                      </div>
                      <div className="text-[10px] text-white/25">
                        {storyboard.musicPrompt}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>
        )}

        {/* ── Stage: Generating Videos ── */}
        {(stage === "generating" || stage === "done") && storyboard && (
          <div className="fade-up">
            <div className="text-center mb-8">
              <h2 className="text-[18px] font-bold mb-2">
                {allDone ? "Generation Complete" : "Generating Videos"}
              </h2>
              <p className="text-[11px] text-white/30">
                {allDone
                  ? "All panels generated. Your alternate scene is ready."
                  : `Generating ${storyboard.panels.length} panels in parallel with Veo...`}
              </p>
            </div>

            <div className="space-y-4">
              {storyboard.panels.map((panel) => {
                const vid = generatedVideos[panel.id];
                return (
                  <div
                    key={panel.id}
                    className="bg-[#181818] border border-white/5 p-5"
                  >
                    <div className="flex items-start gap-4">
                      <div className="w-8 h-8 flex items-center justify-center bg-white/5 text-[12px] font-bold text-white/40 flex-shrink-0">
                        {panel.order}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <p className="text-[13px] text-white/80 flex-1">
                            {panel.sceneDescription}
                          </p>
                          {vid?.status === "generating" && (
                            <div className="w-4 h-4 rounded-full border border-white/20 border-t-white/80 spin flex-shrink-0" />
                          )}
                          {vid?.status === "done" && (
                            <svg
                              width="14"
                              height="14"
                              viewBox="0 0 24 24"
                              fill="none"
                              stroke="white"
                              strokeWidth="3"
                              className="flex-shrink-0"
                            >
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                          {vid?.status === "error" && (
                            <span className="text-[10px] text-red-400 flex-shrink-0">
                              Error
                            </span>
                          )}
                        </div>

                        {vid?.status === "done" && (vid.videoUrl || vid.videoData) && (
                          <div className="mt-3 aspect-video bg-black overflow-hidden border border-white/10">
                            <video
                              controls
                              className="w-full h-full"
                              src={vid.videoUrl || `data:video/mp4;base64,${vid.videoData}`}
                            />
                          </div>
                        )}

                        {vid?.status === "error" && vid.error && (
                          <p className="text-[11px] text-red-400/60 mt-1">
                            {vid.error}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {allDone && (
              <div className="flex justify-center gap-3 mt-8">
                <Link
                  href={`/show/${showId}`}
                  className="px-8 py-2.5 bg-white text-black text-[10px] font-semibold tracking-[0.15em] uppercase hover:bg-white/90 transition-all"
                >
                  View Episode
                </Link>
                <button
                  onClick={() => {
                    setStage("select-type");
                    setBranchType("");
                    setAssets(null);
                    setMessages([]);
                    setStoryboard(null);
                    setGeneratedVideos({});
                    setAllDone(false);
                    setReadyForStoryboard(false);
                    setError("");
                  }}
                  className="px-8 py-2.5 bg-white/5 text-white text-[10px] font-semibold tracking-[0.15em] uppercase hover:bg-white/10 transition-colors border border-white/10"
                >
                  Create Another
                </button>
              </div>
            )}
          </div>
        )}
      </div>
      <div className="h-20" />
    </main>
  );
}
