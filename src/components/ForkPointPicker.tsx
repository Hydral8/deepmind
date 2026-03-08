"use client";

import { useRef, useState, useEffect } from "react";

export default function ForkPointPicker({
  src,
  poster,
  onSelect,
  initialTime,
}: {
  src: string;
  poster?: string;
  onSelect: (time: number) => void;
  initialTime?: number;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const barRef = useRef<HTMLDivElement>(null);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [selectedTime, setSelectedTime] = useState<number | null>(initialTime ?? null);
  const [playing, setPlaying] = useState(false);
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

  const handleBarClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current || !duration || !barRef.current) return;
    const rect = barRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    const time = pct * duration;

    videoRef.current.currentTime = time;

    const isMeta = e.metaKey || e.ctrlKey;
    if (isMeta) {
      // ⌘/Ctrl+click = set insert point
      setSelectedTime(time);
      videoRef.current.pause();
      setPlaying(false);
    }
    // Regular click = just seek
  };

  const handleBarHover = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!duration || !barRef.current) return;
    const rect = barRef.current.getBoundingClientRect();
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    setHoverTime(pct * duration);
    setHoverX(e.clientX - rect.left);
  };

  useEffect(() => {
    if (initialTime != null && videoRef.current) {
      videoRef.current.currentTime = initialTime;
    }
  }, [initialTime]);

  const progress = duration ? (currentTime / duration) * 100 : 0;
  const selectedPct = selectedTime != null && duration ? (selectedTime / duration) * 100 : null;
  const isMac = typeof navigator !== "undefined" && /Mac/.test(navigator.userAgent);
  const modKey = isMac ? "⌘" : "Ctrl";

  return (
    <div className="space-y-4">
      {/* Video preview */}
      <div
        className="relative aspect-video bg-black overflow-hidden cursor-pointer"
        onClick={toggle}
      >
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

        {/* Insert point badge */}
        {selectedTime != null && (
          <div className="absolute top-3 left-3 px-2.5 py-1 bg-white/10 backdrop-blur-sm border border-white/20 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
            <span className="text-[10px] font-semibold tracking-[0.1em] uppercase">
              Insert @ {fmt(selectedTime)}
            </span>
          </div>
        )}
      </div>

      {/* Timeline scrubber */}
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
            {/* Progress fill */}
            <div
              className="absolute inset-y-0 left-0 bg-white/20"
              style={{ width: `${progress}%` }}
            />

            {/* Selected insert point marker */}
            {selectedPct != null && (
              <div
                className="absolute top-1/2 -translate-y-1/2 z-10"
                style={{ left: `${selectedPct}%` }}
              >
                <div className="w-3.5 h-5 -translate-x-1/2 bg-white border-2 border-[#0e0e0e]" />
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

      {/* Confirm */}
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-white/30">
          {selectedTime != null
            ? <>Insert point set at <span className="text-white font-semibold">{fmt(selectedTime)}</span>. The generated scene will be spliced in here.</>
            : <>Click to seek and preview. <span className="text-white/50 font-medium">{modKey}+click</span> the timeline to set where the scene will be inserted.</>
          }
        </p>
        {selectedTime != null && (
          <button
            onClick={() => onSelect(selectedTime)}
            className="px-6 py-2.5 bg-white text-black text-[10px] font-semibold tracking-[0.15em] uppercase hover:bg-white/90 transition-colors flex-shrink-0 ml-4"
          >
            Confirm Insert Point
          </button>
        )}
      </div>
    </div>
  );
}
