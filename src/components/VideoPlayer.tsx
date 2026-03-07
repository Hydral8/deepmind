"use client";

import { useRef, useState, useEffect } from "react";

export default function VideoPlayer({
  src,
  poster,
  forkPoint,
}: {
  src?: string;
  poster?: string;
  forkPoint?: string;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrent] = useState(0);
  const [duration, setDuration] = useState(0);
  const [showControls, setShowControls] = useState(true);

  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (playing) {
      timeout = setTimeout(() => setShowControls(false), 3000);
    }
    return () => clearTimeout(timeout);
  }, [playing, showControls]);

  const toggle = () => {
    if (!videoRef.current || !src) return;
    if (playing) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setPlaying(!playing);
  };

  const handleTimeUpdate = () => {
    if (videoRef.current) {
      setCurrent(videoRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (videoRef.current) {
      setDuration(videoRef.current.duration);
    }
  };

  const seek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!videoRef.current || !duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    videoRef.current.currentTime = pct * duration;
  };

  const fmt = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = Math.floor(s % 60);
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  const progress = duration ? (currentTime / duration) * 100 : 0;
  const forkPct = forkPoint && duration
    ? (() => {
        const parts = forkPoint.split(":");
        const secs = parseInt(parts[0]) * 60 + parseInt(parts[1]);
        return (secs / duration) * 100;
      })()
    : null;

  return (
    <div
      className="relative aspect-video rounded overflow-hidden bg-black cursor-pointer group"
      onMouseMove={() => setShowControls(true)}
      onClick={toggle}
    >
      {src ? (
        <video
          ref={videoRef}
          src={src}
          poster={poster}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={handleLoadedMetadata}
          onEnded={() => setPlaying(false)}
          className="w-full h-full object-contain"
          playsInline
        />
      ) : (
        <img src={poster} alt="" className="w-full h-full object-cover opacity-40" />
      )}

      {/* Center play button */}
      {!playing && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/30">
          <div className="w-16 h-16 rounded-full bg-white/15 backdrop-blur-sm flex items-center justify-center border border-white/25 hover:bg-white/25 transition-colors">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="white">
              <polygon points="6 3 20 12 6 21 6 3" />
            </svg>
          </div>
        </div>
      )}

      {/* Bottom controls */}
      <div
        className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent px-4 pb-3 pt-10 transition-opacity duration-300 ${
          showControls || !playing ? "opacity-100" : "opacity-0"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Progress bar */}
        <div
          className="w-full h-1 bg-white/15 relative cursor-pointer mb-2 group/bar"
          onClick={seek}
        >
          <div
            className="absolute inset-y-0 left-0 bg-white/80"
            style={{ width: `${progress}%` }}
          />
          {/* Playhead */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white opacity-0 group-hover/bar:opacity-100 transition-opacity"
            style={{ left: `${progress}%`, transform: "translate(-50%, -50%)" }}
          />
          {/* Fork point marker */}
          {forkPct !== null && (
            <div
              className="absolute top-1/2 -translate-y-1/2 w-2 h-4 bg-red-500 rounded-sm"
              style={{ left: `${forkPct}%`, transform: "translate(-50%, -50%)" }}
              title={`Fork point: ${forkPoint}`}
            />
          )}
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {/* Play/Pause */}
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
            {/* Time */}
            <span className="text-[11px] text-white/50 tabular-nums">
              {fmt(currentTime)} / {fmt(duration)}
            </span>
          </div>

          {/* Fullscreen */}
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

      {/* No video overlay */}
      {!src && (
        <div className="absolute inset-0 flex items-center justify-center">
          <p className="text-[11px] text-white/25">No video available</p>
        </div>
      )}
    </div>
  );
}
