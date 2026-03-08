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
import ForkPointPicker from "@/components/ForkPointPicker";
import SegmentPicker from "@/components/SegmentPicker";
import CompositePlayer from "@/components/CompositePlayer";

export default function CreatePage() {
  const params = useParams();
  const showId = params.id as string;
  const episodeId = params.episodeId as string;

  const show = getShow(showId);
  const episode = getEpisode(showId, episodeId);

  // ── Stage control ──
  const [stage, setStage] = useState<
    "select-type" | "pick-insert" | "pick-replace" | "confirm-replace" | "extracting" | "suggestions" | "chat" | "storyboard" | "generating" | "done"
  >("select-type");
  const [branchType, setBranchType] = useState("");
  const [error, setError] = useState("");
  const [insertPoint, setInsertPoint] = useState<number | null>(null);
  const [replaceStart, setReplaceStart] = useState<number | null>(null);
  const [replaceEnd, setReplaceEnd] = useState<number | null>(null);
  const [replacePrompt, setReplacePrompt] = useState("");
  const [findingSegment, setFindingSegment] = useState(false);
  const [foundSegmentInfo, setFoundSegmentInfo] = useState<{ description: string; confidence: string } | null>(null);

  // ── Stage 1: Asset extraction ──
  const [assets, setAssets] = useState<ExtractedAssets | null>(null);
  const [extractionStep, setExtractionStep] = useState("");

  // ── Stage 1.5: Suggestions ──
  const [suggestions, setSuggestions] = useState<
    Array<{ id: string; title: string; description: string; characters: string[]; tone: string; icon: string }>
  >([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);

  // ── Stage 2: Multi-turn chat ──
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [readyForStoryboard, setReadyForStoryboard] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // ── Stage 3: Storyboard ──
  const [storyboard, setStoryboard] = useState<Storyboard | null>(null);
  const [storyboardLoading, setStoryboardLoading] = useState(false);

  // ── Stage 3.5: Generation mode + frame planning ──
  const [generationMode, setGenerationMode] = useState<"interpolate" | "generate" | "smart">("smart");
  const [framePlan, setFramePlan] = useState<Record<string, { startFrame: string; endFrame: string; startTimestamp: number; endTimestamp: number }> | null>(null);
  const [planningFrames, setPlanningFrames] = useState(false);

  // Cache frame results per mode so switching tabs preserves work
  const [frameCache, setFrameCache] = useState<Record<string, {
    framePlan?: typeof framePlan;
    smartImages?: Record<string, { startImage?: string; endImage?: string }>;
  }>>({});

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
    setError("");

    // For insert, pick the insert point first
    if (type === "insert" && episode?.videoUrl) {
      setStage("pick-insert");
      return;
    }

    // For replace, pick the segment first
    if (type === "replace" && episode?.videoUrl) {
      setStage("pick-replace");
      return;
    }

    startExtraction(type);
  }

  function handleInsertPointSelected(time: number) {
    setInsertPoint(time);
    startExtraction(branchType);
  }

  function handleReplaceSegmentSelected(start: number, end: number) {
    setReplaceStart(start);
    setReplaceEnd(end);
    startExtraction(branchType);
  }

  async function handleSmartReplace() {
    if (!replacePrompt.trim() || !episode?.videoUrl) return;
    setFindingSegment(true);
    setError("");

    try {
      // First extract assets (needed for context)
      const extractRes = await fetch("/api/extract-assets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoPath: episode.videoUrl,
          showTitle: show?.title,
          episodeTitle: episode.title,
        }),
      });

      if (!extractRes.ok) throw new Error("Extraction failed");
      const extractData = await extractRes.json();
      setAssets(extractData.assets);

      // Ask Gemini to find the segment
      const findRes = await fetch("/api/find-segment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoPath: episode.videoUrl,
          description: replacePrompt.trim(),
          showTitle: show?.title,
          episodeTitle: episode.title,
        }),
      });

      if (!findRes.ok) throw new Error("Could not find matching segment");
      const findData = await findRes.json();

      setReplaceStart(findData.startTime);
      setReplaceEnd(findData.endTime);
      setFoundSegmentInfo({ description: findData.description, confidence: findData.confidence });

      // Show the found segment for confirmation before proceeding
      setStage("confirm-replace");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg);
    } finally {
      setFindingSegment(false);
    }
  }

  async function handleConfirmFoundSegment() {
    // Assets already extracted during smart replace — go to suggestions
    setStage("suggestions");
    setSuggestionsLoading(true);
    try {
      const sugRes = await fetch("/api/suggest-alternates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ assets, branchType: "replace" }),
      });
      if (sugRes.ok) {
        const sugData = await sugRes.json();
        setSuggestions(sugData.suggestions || []);
      }
    } catch { /* ok */ } finally {
      setSuggestionsLoading(false);
    }
  }

  async function startExtraction(type: string) {
    setStage("extracting");

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

      // Fetch suggestions
      setStage("suggestions");
      setSuggestionsLoading(true);
      try {
        const sugRes = await fetch("/api/suggest-alternates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ assets: data.assets, branchType: type }),
        });
        if (sugRes.ok) {
          const sugData = await sugRes.json();
          setSuggestions(sugData.suggestions || []);
        }
      } catch {
        // Suggestions failed — that's okay, user can still go custom
      } finally {
        setSuggestionsLoading(false);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      setError(msg);
      setStage("select-type");
    }
  }

  async function handlePickSuggestion(suggestion: { title: string; description: string }) {
    setStage("chat");
    let timeCtx = "";
    if (branchType === "insert" && insertPoint != null) {
      timeCtx = ` The scene should be inserted at the ${fmtTime(insertPoint)} mark in the original video.`;
    } else if (branchType === "replace" && replaceStart != null && replaceEnd != null) {
      timeCtx = ` This replaces the segment from ${fmtTime(replaceStart)} to ${fmtTime(replaceEnd)} in the original video.`;
    }
    const message = `I want to create: "${suggestion.title}" — ${suggestion.description}${timeCtx}`;
    await sendChatMessage(message, assets!, branchType);
  }

  function handleCustomIdea() {
    setStage("chat");
  }

  function fmtTime(s: number) {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
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

  async function handlePlanFrames() {
    if (!storyboard || !episode?.videoUrl) return;
    setPlanningFrames(true);
    try {
      const branchId = `new-${Date.now()}`;
      const res = await fetch("/api/plan-frames", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          panels: storyboard.panels,
          videoPath: episode.videoUrl,
          branchId,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setFramePlan(data.framePlan);
      }
    } catch {
      // Fall through - will generate without frames
    } finally {
      setPlanningFrames(false);
    }
  }

  // Collect reference image paths from extracted assets
  function getReferenceImagePaths(): string[] {
    if (!assets) return [];
    const paths: string[] = [];
    for (const c of assets.characters) {
      if (c.imagePath) paths.push(c.imagePath);
    }
    for (const e of assets.environments) {
      if (e.imagePath) paths.push(e.imagePath);
    }
    return paths;
  }

  async function handleGenerateVideos() {
    if (!storyboard) return;
    setStage("generating");

    // Check cache first
    let smartImages: Record<string, { startImage?: string; endImage?: string }> | null = frameCache.smart?.smartImages || null;
    let currentFramePlan = frameCache.interpolate?.framePlan || framePlan;

    // Smart mode: let Gemini decide per-frame whether to extract or generate
    if (generationMode === "smart" && !smartImages && episode?.videoUrl && assets) {
      setPlanningFrames(true);
      try {
        const brId = `new-${Date.now()}`;
        const res = await fetch("/api/smart-frames", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            panels: storyboard.panels,
            assets,
            videoPath: episode.videoUrl,
            branchId: brId,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          smartImages = data.images;
          // Cache the result
          setFrameCache((prev) => ({ ...prev, smart: { smartImages: data.images } }));
        }
      } catch {
        // Continue without smart frames
      } finally {
        setPlanningFrames(false);
      }
    }

    // Interpolate mode: extract all frames from source video
    if (generationMode === "interpolate" && !currentFramePlan && episode?.videoUrl) {
      setPlanningFrames(true);
      try {
        const branchId = `new-${Date.now()}`;
        const res = await fetch("/api/plan-frames", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            panels: storyboard.panels,
            videoPath: episode.videoUrl,
            branchId,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          currentFramePlan = data.framePlan;
          setFramePlan(data.framePlan);
          // Cache the result
          setFrameCache((prev) => ({ ...prev, interpolate: { framePlan: data.framePlan } }));
        }
      } catch {
        // Continue without frames
      } finally {
        setPlanningFrames(false);
      }
    }

    const referenceImagePaths = getReferenceImagePaths();

    // Initialize all panels as pending
    const initial: Record<string, { status: string }> = {};
    for (const panel of storyboard.panels) {
      initial[panel.id] = { status: "generating" };
    }
    setGeneratedVideos(initial);

    // Fire all video generations in parallel
    const promises = storyboard.panels.map(async (panel: StoryboardPanel) => {
      try {
        const panelFrame = currentFramePlan?.[panel.id];
        const smartFrame = smartImages?.[panel.id];

        // Determine frame paths based on mode
        let firstFramePath: string | undefined;
        let lastFramePath: string | undefined;

        if (generationMode === "smart" && smartFrame) {
          firstFramePath = smartFrame.startImage;
          lastFramePath = smartFrame.endImage;
        } else if (generationMode === "interpolate" && panelFrame) {
          firstFramePath = panelFrame.startFrame;
          lastFramePath = panelFrame.endFrame;
        }

        const res = await fetch("/api/generate-video", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            panelId: panel.id,
            visualPrompt: panel.transitionPrompt || panel.visualPrompt || panel.sceneDescription,
            panel,
            assets,
            duration: panel.duration,
            firstFramePath,
            lastFramePath,
            referenceImagePaths,
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
    stage === "select-type" || stage === "pick-insert" || stage === "pick-replace" || stage === "confirm-replace"
      ? 0
      : stage === "extracting"
        ? 1
        : stage === "suggestions" || stage === "chat"
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

            <div className="grid grid-cols-2 gap-3 mb-8">
              {[
                {
                  id: "continue",
                  title: "Continue Differently",
                  desc: "New direction from a specific scene",
                  icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><path d="M7 3v18M3 7l4-4 4 4M17 3v18M13 17l4 4 4-4" /></svg>,
                },
                {
                  id: "insert",
                  title: "Insert Scene",
                  desc: "Add a scene between existing ones",
                  icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>,
                },
                {
                  id: "replace",
                  title: "Replace Segment",
                  desc: "Swap a section with a new version",
                  icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><polyline points="17 1 21 5 17 9" /><path d="M3 11V9a4 4 0 0 1 4-4h14" /><polyline points="7 23 3 19 7 15" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></svg>,
                },
                {
                  id: "ending",
                  title: "Alternate Ending",
                  desc: "Reimagine how it concludes",
                  icon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>,
                },
              ].map((type) => (
                <button
                  key={type.id}
                  onClick={() => handleSelectType(type.id)}
                  className="text-left p-5 bg-[#181818] border border-white/5 hover:border-white/20 hover:bg-[#1f1f1f] transition-all group"
                >
                  <div className="w-8 h-8 flex items-center justify-center bg-white/[0.04] text-white/30 group-hover:text-white/60 mb-3 transition-colors">
                    {type.icon}
                  </div>
                  <h3 className="text-[13px] font-semibold mb-1">
                    {type.title}
                  </h3>
                  <p className="text-[11px] text-white/25">{type.desc}</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Stage: Pick Insert Point ── */}
        {stage === "pick-insert" && episode?.videoUrl && (
          <div className="fade-up">
            <h2 className="text-[15px] font-bold mb-1">
              Where should the scene be inserted?
            </h2>
            <p className="text-[11px] text-white/30 mb-6">
              Play or scrub the video, then click the timeline to set the insert point.
            </p>
            <ForkPointPicker
              src={episode.videoUrl}
              poster={episode.thumbnail}
              onSelect={handleInsertPointSelected}
              initialTime={insertPoint ?? undefined}
            />
          </div>
        )}

        {/* ── Stage: Pick Replace Segment ── */}
        {stage === "pick-replace" && episode?.videoUrl && (
          <div className="fade-up">
            <h2 className="text-[15px] font-bold mb-1">
              Which segment should be replaced?
            </h2>
            <p className="text-[11px] text-white/30 mb-6">
              Pick the segment visually, or describe what you want to change and we&apos;ll find it.
            </p>

            {/* Smart find option */}
            <div className="mb-6 p-5 bg-[#141414] border border-white/[0.06]">
              <div className="flex items-center gap-2 mb-3">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/40">
                  <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
                </svg>
                <span className="text-[11px] font-semibold text-white/60">Describe what to change</span>
              </div>
              <div className="flex gap-3">
                <input
                  type="text"
                  value={replacePrompt}
                  onChange={(e) => setReplacePrompt(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && replacePrompt.trim() && !findingSegment) handleSmartReplace();
                  }}
                  placeholder='e.g. "the part where they argue" or "the chase scene"'
                  className="flex-1 bg-[#0e0e0e] border border-white/10 px-4 py-2.5 text-[12px] text-white placeholder:text-white/15 focus:outline-none focus:border-white/25 transition-colors"
                />
                <button
                  onClick={handleSmartReplace}
                  disabled={!replacePrompt.trim() || findingSegment}
                  className="px-5 py-2.5 bg-white text-black text-[10px] font-semibold tracking-[0.15em] uppercase hover:bg-white/90 transition-colors disabled:opacity-30"
                >
                  {findingSegment ? "Finding..." : "Find & Replace"}
                </button>
              </div>
              {findingSegment && (
                <div className="flex items-center gap-2 mt-3">
                  <div className="w-3 h-3 rounded-full border border-white/20 border-t-white/80 spin" />
                  <span className="text-[10px] text-white/30">Analyzing video to find matching segment...</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 mb-5">
              <div className="flex-1 h-px bg-white/[0.06]" />
              <span className="text-[9px] text-white/20 tracking-[0.2em] uppercase">or select manually</span>
              <div className="flex-1 h-px bg-white/[0.06]" />
            </div>

            <SegmentPicker
              src={episode.videoUrl}
              poster={episode.thumbnail}
              onSelect={handleReplaceSegmentSelected}
            />
          </div>
        )}

        {/* ── Stage: Confirm Found Segment ── */}
        {stage === "confirm-replace" && episode?.videoUrl && replaceStart != null && replaceEnd != null && (
          <div className="fade-up">
            <h2 className="text-[15px] font-bold mb-1">
              Segment Found
            </h2>
            <p className="text-[11px] text-white/30 mb-6">
              Review the detected segment below. Confirm to proceed or go back to adjust.
            </p>

            {/* Found segment info */}
            <div className="mb-5 p-5 bg-[#141414] border border-white/[0.06]">
              <div className="flex items-start gap-4">
                <div className="flex-1">
                  {foundSegmentInfo && (
                    <p className="text-[12px] text-white/70 mb-3">
                      {foundSegmentInfo.description}
                    </p>
                  )}
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-white/30 tracking-[0.1em] uppercase">Start</span>
                      <span className="text-[13px] font-mono font-semibold text-white">
                        {Math.floor(replaceStart / 60)}:{Math.floor(replaceStart % 60).toString().padStart(2, "0")}
                      </span>
                    </div>
                    <svg width="16" height="8" viewBox="0 0 16 8" className="text-white/20">
                      <path d="M0 4h14M10 0l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.5" />
                    </svg>
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] text-white/30 tracking-[0.1em] uppercase">End</span>
                      <span className="text-[13px] font-mono font-semibold text-white">
                        {Math.floor(replaceEnd / 60)}:{Math.floor(replaceEnd % 60).toString().padStart(2, "0")}
                      </span>
                    </div>
                    <span className="text-[11px] text-white/30">
                      ({(replaceEnd - replaceStart).toFixed(1)}s)
                    </span>
                    {foundSegmentInfo && (
                      <span className={`ml-auto text-[9px] tracking-[0.1em] uppercase px-2 py-0.5 border ${
                        foundSegmentInfo.confidence === "high"
                          ? "text-green-400/80 border-green-400/20 bg-green-400/5"
                          : foundSegmentInfo.confidence === "medium"
                            ? "text-yellow-400/80 border-yellow-400/20 bg-yellow-400/5"
                            : "text-red-400/80 border-red-400/20 bg-red-400/5"
                      }`}>
                        {foundSegmentInfo.confidence} confidence
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Video preview with segment */}
            <SegmentPicker
              src={episode.videoUrl}
              poster={episode.thumbnail}
              onSelect={(start, end) => {
                setReplaceStart(start);
                setReplaceEnd(end);
              }}
              initialStart={replaceStart}
              initialEnd={replaceEnd}
            />

            {/* Action buttons */}
            <div className="flex items-center justify-between mt-5">
              <button
                onClick={() => {
                  setReplaceStart(null);
                  setReplaceEnd(null);
                  setFoundSegmentInfo(null);
                  setStage("pick-replace");
                }}
                className="px-4 py-2 text-[10px] text-white/40 hover:text-white/70 tracking-[0.1em] uppercase transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleConfirmFoundSegment}
                className="px-6 py-2.5 bg-white text-black text-[10px] font-semibold tracking-[0.15em] uppercase hover:bg-white/90 transition-colors"
              >
                Confirm &amp; Continue
              </button>
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

        {/* ── Stage: Suggestions ── */}
        {stage === "suggestions" && assets && (
          <div className="fade-up">
            {/* Compact assets summary */}
            <div className="mb-8 flex items-center gap-4 text-[11px] text-white/30">
              <span className="flex items-center gap-1.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                {assets.characters.length} characters
              </span>
              <span className="flex items-center gap-1.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18"/></svg>
                {assets.environments.length} environments
              </span>
              <span className="flex items-center gap-1.5">
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                {assets.objects.length} objects
              </span>
            </div>

            <h2 className="text-[18px] font-bold mb-1">Choose a direction</h2>
            <p className="text-[11px] text-white/30 mb-6">
              Pick a suggested alternate, or write your own from scratch.
            </p>

            {suggestionsLoading ? (
              <div className="grid grid-cols-2 gap-3">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="h-[140px] bg-[#181818] border border-white/5 shimmer" />
                ))}
              </div>
            ) : (
              <div className="grid grid-cols-2 gap-3 mb-4">
                {suggestions.map((s) => {
                  const iconMap: Record<string, React.ReactNode> = {
                    diverge: (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M7 3v18M3 7l4-4 4 4M17 3v18M13 17l4 4 4-4" />
                      </svg>
                    ),
                    reverse: (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <polyline points="1 4 1 10 7 10" /><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
                      </svg>
                    ),
                    add: (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                    ),
                    twist: (
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                      </svg>
                    ),
                  };

                  return (
                    <button
                      key={s.id}
                      onClick={() => handlePickSuggestion(s)}
                      className="group relative text-left p-5 bg-[#141414] border border-white/[0.06] hover:border-white/20 hover:bg-[#1a1a1a] transition-all overflow-hidden"
                    >
                      {/* Subtle gradient accent on hover */}
                      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />

                      <div className="relative">
                        <div className="flex items-center gap-2.5 mb-3">
                          <div className="w-7 h-7 flex items-center justify-center bg-white/[0.06] text-white/40 group-hover:bg-white/10 group-hover:text-white/70 transition-all">
                            {iconMap[s.icon] || iconMap.diverge}
                          </div>
                          <span className="text-[9px] tracking-[0.15em] uppercase text-white/20 group-hover:text-white/40 transition-colors">
                            {s.tone}
                          </span>
                        </div>

                        <h3 className="text-[14px] font-bold mb-1.5 group-hover:text-white transition-colors">
                          {s.title}
                        </h3>
                        <p className="text-[11px] text-white/35 leading-relaxed mb-3 group-hover:text-white/50 transition-colors">
                          {s.description}
                        </p>

                        <div className="flex flex-wrap gap-1.5">
                          {s.characters.slice(0, 3).map((c, i) => (
                            <span key={i} className="px-2 py-0.5 text-[9px] bg-white/[0.04] text-white/25 group-hover:bg-white/[0.08] group-hover:text-white/40 transition-colors">
                              {c}
                            </span>
                          ))}
                        </div>
                      </div>

                      {/* Arrow indicator */}
                      <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-all translate-x-1 group-hover:translate-x-0">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/40">
                          <polyline points="9 18 15 12 9 6" />
                        </svg>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Custom idea option */}
            <button
              onClick={handleCustomIdea}
              className="w-full group flex items-center gap-4 p-4 bg-[#111] border border-dashed border-white/[0.08] hover:border-white/20 hover:bg-[#161616] transition-all"
            >
              <div className="w-9 h-9 flex items-center justify-center bg-white/[0.04] group-hover:bg-white/10 transition-colors">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="text-white/30 group-hover:text-white/60 transition-colors">
                  <path d="M12 20h9" /><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />
                </svg>
              </div>
              <div className="text-left flex-1">
                <div className="text-[13px] font-semibold text-white/60 group-hover:text-white/90 transition-colors">
                  Write your own
                </div>
                <div className="text-[10px] text-white/20 group-hover:text-white/35 transition-colors">
                  Describe a custom alternate in the chat
                </div>
              </div>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-white/15 group-hover:text-white/40 transition-colors">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
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
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-4">
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
                      disabled={planningFrames}
                      className="px-8 py-3 bg-white text-black text-[11px] font-semibold tracking-[0.15em] uppercase hover:bg-white/90 transition-all disabled:opacity-30"
                    >
                      {planningFrames ? "Planning Frames..." : "Generate All Videos"}
                    </button>
                  </div>

                  {/* Generation mode selector */}
                  <div className="flex gap-3 mb-4">
                    <button
                      onClick={() => { setGenerationMode("smart"); setFramePlan(null); }}
                      className={`flex-1 p-3 text-left transition-all ${
                        generationMode === "smart"
                          ? "bg-emerald-500/10 border border-emerald-500/30"
                          : "bg-[#181818] border border-white/5 hover:border-white/15"
                      }`}
                    >
                      <div className="text-[11px] font-semibold mb-0.5">Smart <span className="text-[8px] font-normal text-emerald-400/60 ml-1">Recommended</span></div>
                      <p className="text-[9px] text-white/30">
                        Gemini analyzes each frame — extracts from source when possible, generates new when the scene diverges.
                      </p>
                    </button>
                    <button
                      onClick={() => { setGenerationMode("interpolate"); setFramePlan(null); }}
                      className={`flex-1 p-3 text-left transition-all ${
                        generationMode === "interpolate"
                          ? "bg-blue-500/10 border border-blue-500/30"
                          : "bg-[#181818] border border-white/5 hover:border-white/15"
                      }`}
                    >
                      <div className="text-[11px] font-semibold mb-0.5">Extract from Source</div>
                      <p className="text-[9px] text-white/30">
                        All frames pulled from the original video at timestamps Gemini selects.
                      </p>
                    </button>
                    <button
                      onClick={() => { setGenerationMode("generate"); setFramePlan(null); }}
                      className={`flex-1 p-3 text-left transition-all ${
                        generationMode === "generate"
                          ? "bg-purple-500/10 border border-purple-500/30"
                          : "bg-[#181818] border border-white/5 hover:border-white/15"
                      }`}
                    >
                      <div className="text-[11px] font-semibold mb-0.5">Generate All New</div>
                      <p className="text-[9px] text-white/30">
                        Create entirely new frames with AI image generation using extracted assets as reference.
                      </p>
                    </button>
                  </div>

                  {/* Frame plan preview button */}
                  {(generationMode === "interpolate" || generationMode === "smart") && !framePlan && episode?.videoUrl && (
                    <button
                      onClick={handlePlanFrames}
                      disabled={planningFrames}
                      className="w-full p-3 mb-4 bg-[#181818] border border-white/10 hover:border-white/20 text-[10px] text-white/40 tracking-[0.1em] uppercase transition-colors disabled:opacity-30"
                    >
                      {planningFrames ? "Analyzing video for best frames..." : "Preview Frame Plan"}
                    </button>
                  )}

                  {/* Frame plan preview */}
                  {framePlan && (
                    <div className="mb-4 p-4 bg-[#181818] border border-blue-500/10">
                      <h3 className="text-[10px] tracking-[0.2em] uppercase text-blue-400/60 mb-3">Frame Plan (from source video)</h3>
                      <div className="space-y-3">
                        {storyboard.panels.map((panel) => {
                          const plan = framePlan[panel.id];
                          if (!plan) return null;
                          return (
                            <div key={panel.id} className="flex items-center gap-3">
                              <span className="text-[10px] text-white/30 w-16 flex-shrink-0">Panel {panel.order}</span>
                              <div className="flex gap-2">
                                <div className="w-[80px]">
                                  <div className="aspect-video bg-black border border-white/10 overflow-hidden">
                                    <img src={plan.startFrame} alt="In" className="w-full h-full object-cover" />
                                  </div>
                                  <span className="text-[8px] text-white/15">In @ {plan.startTimestamp}s</span>
                                </div>
                                <div className="flex items-center text-white/15">
                                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
                                </div>
                                <div className="w-[80px]">
                                  <div className="aspect-video bg-black border border-white/10 overflow-hidden">
                                    <img src={plan.endFrame} alt="Out" className="w-full h-full object-cover" />
                                  </div>
                                  <span className="text-[8px] text-white/15">Out @ {plan.endTimestamp}s</span>
                                </div>
                              </div>
                              <p className="text-[10px] text-white/30 flex-1 line-clamp-1">{panel.sceneDescription}</p>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Reference assets info */}
                  {assets && getReferenceImagePaths().length > 0 && (
                    <div className="p-3 bg-[#181818] border border-white/5 mb-4 flex items-center gap-3">
                      <span className="text-[9px] text-white/25 tracking-[0.1em] uppercase">Reference Assets:</span>
                      <div className="flex gap-1.5">
                        {getReferenceImagePaths().map((p, i) => (
                          <div key={i} className="w-8 h-8 bg-black border border-white/10 overflow-hidden">
                            <img src={p} alt="" className="w-full h-full object-cover" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-4">
                  {storyboard.panels.map((panel) => {
                    const plan = framePlan?.[panel.id];
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
                            {/* Inline frame thumbnails if available */}
                            {plan && (
                              <div className="flex gap-2 mb-3">
                                <div className="w-[100px] flex-shrink-0">
                                  <div className="aspect-video bg-black border border-white/10 overflow-hidden">
                                    <img src={plan.startFrame} alt="In" className="w-full h-full object-cover" />
                                  </div>
                                  <span className="text-[8px] text-white/15">In @ {plan.startTimestamp}s</span>
                                </div>
                                <div className="flex items-center text-white/10">
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
                                </div>
                                <div className="w-[100px] flex-shrink-0">
                                  <div className="aspect-video bg-black border border-white/10 overflow-hidden">
                                    <img src={plan.endFrame} alt="Out" className="w-full h-full object-cover" />
                                  </div>
                                  <span className="text-[8px] text-white/15">Out @ {plan.endTimestamp}s</span>
                                </div>
                              </div>
                            )}
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
                    );
                  })}
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

            {/* Composite player for insert/replace mode */}
            {allDone && episode?.videoUrl && (branchType === "insert" || branchType === "replace") && (() => {
              const generatedClipUrls = storyboard.panels
                .map((p) => generatedVideos[p.id])
                .filter((v) => v?.status === "done" && (v.videoUrl || v.videoData))
                .map((v, i) => ({
                  type: "generated" as const,
                  src: v!.videoUrl || `data:video/mp4;base64,${v!.videoData}`,
                  label: `Panel ${i + 1}`,
                }));

              if (generatedClipUrls.length === 0) return null;

              let segments;
              let description;

              if (branchType === "insert" && insertPoint != null) {
                segments = [
                  { type: "original" as const, src: episode.videoUrl!, startTime: 0, endTime: insertPoint, label: "Before insert" },
                  ...generatedClipUrls,
                  { type: "original" as const, src: episode.videoUrl!, startTime: insertPoint, label: "After insert" },
                ];
                description = <>Original &rarr; Insert @ {fmtTime(insertPoint)} &rarr; Original continues</>;
              } else if (branchType === "replace" && replaceStart != null && replaceEnd != null) {
                segments = [
                  { type: "original" as const, src: episode.videoUrl!, startTime: 0, endTime: replaceStart, label: "Before" },
                  ...generatedClipUrls,
                  { type: "original" as const, src: episode.videoUrl!, startTime: replaceEnd, label: "After" },
                ];
                description = <>Original &rarr; Replaced {fmtTime(replaceStart)}–{fmtTime(replaceEnd)} &rarr; Original continues</>;
              } else {
                return null;
              }

              return (
                <div className="mt-6 mb-6">
                  <h3 className="text-[11px] font-semibold tracking-[0.2em] uppercase text-white/40 mb-3">
                    Composite Preview
                  </h3>
                  <p className="text-[10px] text-white/25 mb-3">{description}</p>
                  <CompositePlayer
                    segments={segments}
                    poster={episode.thumbnail}
                  />
                </div>
              );
            })()}

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
                    setInsertPoint(null);
                    setReplaceStart(null);
                    setReplaceEnd(null);
                    setReplacePrompt("");
                    setAssets(null);
                    setSuggestions([]);
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
