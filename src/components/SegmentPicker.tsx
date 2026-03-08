"use client";

import { useRef, useState, useEffect } from "react";

export default function SegmentPicker({
  src,
  poster,
  onSelect,
  initialStart,
  initialEnd,
}: {
  src: string;
  poster?: string;
  onSelect: (startTime: number, endTime: number) => void;
  initialStart?: number;
  initialEnd?: number;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [startMark, setStartMark] = useState<number | null>(initialStart ?? null);
  const [endMark, setEndMark] = useState<number | null>(initialEnd ?? null);
  const [hovering, setHovering] = useState(false);
  const [hoverTime, setHoverTime] = useState(0);
  const [hoverX, setHoverX] = useState(0);

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const toggle = () => {
    if (!videoRef.current) return;
    if (playing) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setPlaying(!playing);
  };

  const getTimeFromEvent = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!duration || !barRef.current) return null;
    const rect = barRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    return pct * duration;
  };

  const handleBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const time = getTimeFromEvent(e);
    if (time == null || !videoRef.current) return;

    const isMeta = e.metaKey || e.ctrlKey;

    if (!isMeta) {
      // Regular click = seek only
      videoRef.current.currentTime = time;
      return;
    }

    // ⌘/Ctrl+click = set marker
    videoRef.current.currentTime = time;
    videoRef.current.pause();
    setPlaying(false);

    if (startMark == null || (startMark != null && endMark != null)) {
      // No start yet, or both set (restart) → set start
      setStartMark(time);
      setEndMark(null);
    } else {
      // Start is set, setting end
      if (time > startMark) {
        setEndMark(time);
      } else {
        // Clicked before start → swap
        setEndMark(startMark);
        setStartMark(time);
      }
    }
  };

  const handleBarHover = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!duration || !barRef.current) return;
    const rect = barRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverTime(pct * duration);
    setHoverX(e.clientX - rect.left);
  };

  // Seek to initial start when video loads
  useEffect(() => {
    if (initialStart != null && videoRef.current) {
      videoRef.current.currentTime = initialStart;
    }
  }, [initialStart]);

  // Loop preview of selected segment during playback
  useEffect(() => {
    if (!videoRef.current || startMark == null || endMark == null || !playing) return;
    if (currentTime >= endMark) {
      videoRef.current.currentTime = startMark;
    }
  }, [currentTime, startMark, endMark, playing]);

  const progress = duration ? (currentTime / duration) * 100 : 0;
  const startPct = startMark != null && duration ? (startMark / duration) * 100 : null;
  const endPct = endMark != null && duration ? (endMark / duration) * 100 : null;
  const segDuration = startMark != null && endMark != null ? endMark - startMark : null;
  const isMac = typeof navigator !== "undefined" && /Mac/.test(navigator.userAgent);
  const modKey = isMac ? "⌘" : "Ctrl";

  return (
    <div className="space-y-4">
      {/* Video preview */}
      <div className="relative aspect-video bg-black overflow-hidden cursor-pointer" onClick={toggle}>
        <video
          ref={videoRef}
          src={src}
          poster={poster}
          onTimeUpdate={() => videoRef.current && setCurrentTime(videoRef.current.currentTime)}
          onLoadedMetadata={() => videoRef.current && setDuration(videoRef.current.duration)}
          onEnded={() => setPlaying(false)}
          className="w-full h-full object-contain"
          playsInline
        />
        {!playing && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <div className="w-14 h-14 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center border border-white/25">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                <polygon points="6 3 20 12 6 21 6 3" />
              </svg>
            </div>
          </div>
        )}

        {/* Range badge */}
        {startMark != null && (
          <div className="absolute top-3 left-3 px-2.5 py-1 bg-white/10 backdrop-blur-sm border border-white/20 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
            <span className="text-[10px] font-semibold tracking-[0.1em] uppercase">
              {endMark != null
                ? `Replace ${fmt(startMark)} → ${fmt(endMark)} (${segDuration!.toFixed(1)}s)`
                : `Start: ${fmt(startMark)} — ${modKey}+click timeline to set end`
              }
            </span>
          </div>
        )}
      </div>

      {/* Timeline with range selection */}
      <div className="px-1">
        <div
          ref={barRef}
          className="relative h-8 cursor-pointer group"
          onClick={handleBarClick}
          onMouseMove={handleBarHover}
          onMouseEnter={() => setHovering(true)}
          onMouseLeave={() => setHovering(false)}
        >
          {/* Track background */}
          <div className="absolute top-3 left-0 right-0 h-2 bg-white/[0.06]">
            {/* Progress */}
            <div className="absolute inset-y-0 left-0 bg-white/15" style={{ width: `${progress}%` }} />

            {/* Selected range highlight */}
            {startPct != null && endPct != null && (
              <div
                className="absolute inset-y-0 bg-white/20 border-l border-r border-white/40"
                style={{ left: `${startPct}%`, width: `${endPct - startPct}%` }}
              />
            )}

            {/* Pending range preview (start set, hovering for end) */}
            {startPct != null && endPct == null && hovering && (
              <div
                className="absolute inset-y-0 bg-white/10 border-l border-white/30"
                style={{
                  left: `${Math.min(startPct, (hoverTime / duration) * 100)}%`,
                  width: `${Math.abs((hoverTime / duration) * 100 - startPct)}%`,
                }}
              />
            )}

            {/* Start marker */}
            {startPct != null && (
              <div className="absolute top-1/2 -translate-y-1/2 z-10" style={{ left: `${startPct}%` }}>
                <div className="w-1 h-6 -translate-x-1/2 bg-white" />
              </div>
            )}

            {/* End marker */}
            {endPct != null && (
              <div className="absolute top-1/2 -translate-y-1/2 z-10" style={{ left: `${endPct}%` }}>
                <div className="w-1 h-6 -translate-x-1/2 bg-white" />
              </div>
            )}

            {/* Playhead */}
            <div
              className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white opacity-0 group-hover:opacity-100 transition-opacity z-20"
              style={{ left: `${progress}%`, transform: "translate(-50%, -50%)" }}
            />
          </div>

          {/* Hover tooltip */}
          {hovering && (
            <div
              className="absolute -top-7 -translate-x-1/2 px-2 py-0.5 bg-white text-black text-[10px] font-mono pointer-events-none"
              style={{ left: hoverX }}
            >
              {fmt(hoverTime)}
            </div>
          )}
        </div>

        {/* Time labels */}
        <div className="flex items-center justify-between text-[10px] text-white/30 tabular-nums -mt-1">
          <span>{fmt(currentTime)}</span>
          <span>{fmt(duration)}</span>
        </div>
      </div>

      {/* Instructions + actions */}
      <div className="flex items-center justify-between">
        <div className="flex-1">
          {startMark == null ? (
            <p className="text-[11px] text-white/30">
              Click to seek. <span className="text-white/50 font-medium">{modKey}+click</span> to set the <span className="text-white/50 font-medium">start</span> of the segment.
            </p>
          ) : endMark == null ? (
            <p className="text-[11px] text-white/30">
              Start at <span className="text-white font-semibold">{fmt(startMark)}</span>. Click to preview, <span className="text-white/50 font-medium">{modKey}+click</span> to set the <span className="text-white/50 font-medium">end</span>.
            </p>
          ) : (
            <p className="text-[11px] text-white/30">
              Replacing <span className="text-white font-semibold">{fmt(startMark)}</span> → <span className="text-white font-semibold">{fmt(endMark)}</span> ({segDuration!.toFixed(1)}s). The generated scene will replace this segment.
            </p>
          )}
        </div>

        <div className="flex items-center gap-2 ml-4 flex-shrink-0">
          {startMark != null && (
            <button
              onClick={() => { setStartMark(null); setEndMark(null); }}
              className="px-4 py-2 text-[10px] text-white/40 hover:text-white/70 tracking-[0.1em] uppercase transition-colors"
            >
              Reset
            </button>
          )}
          {startMark != null && endMark != null && (
            <button
              onClick={() => onSelect(startMark, endMark)}
              className="px-6 py-2.5 bg-white text-black text-[10px] font-semibold tracking-[0.15em] uppercase hover:bg-white/90 transition-colors"
            >
              Confirm Segment
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
