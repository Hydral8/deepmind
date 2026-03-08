"use client";

import { useRef, useState, useEffect, useCallback } from "react";

interface Segment {
  type: "original" | "generated";
  src: string;
  startTime?: number; // for original: where to start playback
  endTime?: number;   // for original: where to stop playback
  label?: string;
}

export default function CompositePlayer({
  segments,
  poster,
}: {
  segments: Segment[];
  poster?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [currentTime, setCurrentTime] = useState(0);
  const [segmentDuration, setSegmentDuration] = useState(0);
  const [loadingNext, setLoadingNext] = useState(false);

  const active = segments[activeIndex];
  const isLast = activeIndex === segments.length - 1;

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  // Load segment into video element
  const loadSegment = useCallback((index: number, autoplay: boolean) => {
    const video = videoRef.current;
    if (!video || index >= segments.length) return;

    const seg = segments[index];
    setActiveIndex(index);
    setLoadingNext(true);

    video.src = seg.src;
    video.load();

    const onLoaded = () => {
      setLoadingNext(false);
      setSegmentDuration(video.duration);
      if (seg.startTime != null) {
        video.currentTime = seg.startTime;
      }
      if (autoplay) {
        video.play().then(() => setPlaying(true)).catch(() => {});
      }
      video.removeEventListener("loadedmetadata", onLoaded);
    };

    video.addEventListener("loadedmetadata", onLoaded);
  }, [segments]);

  // Monitor time — stop original segments at endTime
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const onTimeUpdate = () => {
      setCurrentTime(video.currentTime);

      if (active?.type === "original" && active.endTime != null) {
        if (video.currentTime >= active.endTime) {
          video.pause();
          // Auto-advance to next segment
          if (!isLast) {
            loadSegment(activeIndex + 1, true);
          } else {
            setPlaying(false);
          }
        }
      }
    };

    const onEnded = () => {
      if (!isLast) {
        loadSegment(activeIndex + 1, true);
      } else {
        setPlaying(false);
      }
    };

    video.addEventListener("timeupdate", onTimeUpdate);
    video.addEventListener("ended", onEnded);
    return () => {
      video.removeEventListener("timeupdate", onTimeUpdate);
      video.removeEventListener("ended", onEnded);
    };
  }, [active, activeIndex, isLast, loadSegment]);

  // Auto-hide controls
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (playing) {
      timeout = setTimeout(() => setShowControls(false), 3000);
    }
    return () => clearTimeout(timeout);
  }, [playing, showControls]);

  // Initial load
  useEffect(() => {
    loadSegment(0, false);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const toggle = () => {
    const video = videoRef.current;
    if (!video) return;
    if (playing) {
      video.pause();
      setPlaying(false);
    } else {
      video.play().then(() => setPlaying(true)).catch(() => {});
    }
  };

  const restart = () => {
    loadSegment(0, true);
  };

  // Calculate segment visual positions for the timeline
  const segmentMeta = segments.map((seg) => {
    if (seg.type === "original" && seg.startTime != null && seg.endTime != null) {
      return { duration: seg.endTime - seg.startTime };
    }
    return { duration: 8 }; // estimate for generated clips
  });
  const totalDuration = segmentMeta.reduce((acc, s) => acc + s.duration, 0);

  return (
    <div
      className="relative aspect-video bg-black overflow-hidden cursor-pointer group"
      onMouseMove={() => setShowControls(true)}
      onClick={toggle}
    >
      <video
        ref={videoRef}
        poster={poster}
        className="w-full h-full object-contain"
        playsInline
      />

      {/* Loading overlay */}
      {loadingNext && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60">
          <div className="w-8 h-8 rounded-full border-2 border-white/20 border-t-white spin" />
        </div>
      )}

      {/* Center play button */}
      {!playing && !loadingNext && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <div className="w-16 h-16 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center border border-white/25 hover:bg-white/25 transition-colors">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
              <polygon points="6 3 20 12 6 21 6 3" />
            </svg>
          </div>
        </div>
      )}

      {/* Segment indicator */}
      <div className="absolute top-3 left-3 flex items-center gap-2">
        <div className={`px-2 py-0.5 text-[9px] font-semibold tracking-[0.1em] uppercase backdrop-blur-sm border ${
          active?.type === "original"
            ? "bg-white/10 border-white/20 text-white/70"
            : "bg-white/20 border-white/30 text-white"
        }`}>
          {active?.type === "original" ? "Original" : "Generated Insert"}
        </div>
        {active?.label && (
          <span className="text-[9px] text-white/40">{active.label}</span>
        )}
      </div>

      {/* Bottom controls */}
      <div
        className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-4 pb-3 pt-10 transition-opacity duration-300 ${
          showControls || !playing ? "opacity-100" : "opacity-0"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Segmented timeline */}
        <div className="w-full h-1.5 flex gap-[2px] mb-2">
          {segments.map((seg, i) => {
            const width = totalDuration > 0 ? (segmentMeta[i].duration / totalDuration) * 100 : 100 / segments.length;
            const isActive = i === activeIndex;
            const isPast = i < activeIndex;

            return (
              <div
                key={i}
                className="h-full relative cursor-pointer"
                style={{ width: `${width}%` }}
                onClick={() => loadSegment(i, playing)}
              >
                <div className={`w-full h-full ${
                  seg.type === "original" ? "bg-white/15" : "bg-white/25"
                }`}>
                  {(isPast || isActive) && (
                    <div
                      className={`h-full ${seg.type === "original" ? "bg-white/60" : "bg-white"}`}
                      style={{
                        width: isActive
                          ? `${segmentDuration > 0 ? ((currentTime - (active?.startTime || 0)) / (segmentMeta[i].duration)) * 100 : 0}%`
                          : "100%"
                      }}
                    />
                  )}
                </div>
                {/* Segment type indicator dot */}
                {seg.type === "generated" && (
                  <div className="absolute -top-1.5 left-0 w-1.5 h-1.5 bg-white rounded-full" />
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={toggle} className="text-white hover:text-white/80 transition-colors">
              {playing ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <rect x="6" y="4" width="4" height="16" />
                  <rect x="14" y="4" width="4" height="16" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                  <polygon points="6 3 20 12 6 21 6 3" />
                </svg>
              )}
            </button>
            <button onClick={restart} className="text-white/40 hover:text-white transition-colors" title="Restart">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="1 4 1 10 7 10" />
                <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
              </svg>
            </button>
            <span className="text-[11px] text-white/50 tabular-nums">
              {fmt(currentTime)}
            </span>
            <span className="text-[9px] text-white/25 tracking-[0.1em] uppercase">
              {activeIndex + 1}/{segments.length}
            </span>
          </div>

          <button
            onClick={() => videoRef.current?.requestFullscreen()}
            className="text-white/50 hover:text-white transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
