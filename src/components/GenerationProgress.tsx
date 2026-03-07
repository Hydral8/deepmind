"use client";

import { useEffect, useState } from "react";

interface GenerationProgressProps {
  label?: string;
  variant?: "inline" | "full";
}

export default function GenerationProgress({ label = "Generating", variant = "inline" }: GenerationProgressProps) {
  const [progress, setProgress] = useState(0);
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    // Artificial progress that slows down as it approaches 95%
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev < 30) return prev + Math.random() * 3;
        if (prev < 60) return prev + Math.random() * 1.5;
        if (prev < 80) return prev + Math.random() * 0.6;
        if (prev < 95) return prev + Math.random() * 0.2;
        return prev;
      });
    }, 200);

    // Cycle through color phases
    const phaseInterval = setInterval(() => {
      setPhase((prev) => (prev + 1) % 4);
    }, 3000);

    return () => {
      clearInterval(interval);
      clearInterval(phaseInterval);
    };
  }, []);

  const gradients = [
    "from-blue-500 via-purple-500 to-pink-500",
    "from-purple-500 via-pink-500 to-orange-500",
    "from-pink-500 via-orange-500 to-yellow-500",
    "from-orange-500 via-yellow-500 to-blue-500",
  ];

  if (variant === "full") {
    return (
      <div className="w-full">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[10px] tracking-[0.15em] uppercase text-white/40">{label}</span>
          <span className="text-[10px] text-white/20 tabular-nums">{Math.round(progress)}%</span>
        </div>
        <div className="h-1.5 bg-white/5 overflow-hidden relative">
          {/* Animated gradient bar */}
          <div
            className={`h-full bg-gradient-to-r ${gradients[phase]} transition-all duration-[400ms] ease-out relative`}
            style={{ width: `${progress}%` }}
          >
            {/* Shimmer effect */}
            <div className="absolute inset-0 overflow-hidden">
              <div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"
                style={{ animationDuration: "1.5s" }}
              />
            </div>
          </div>
          {/* Glow pulse at the leading edge */}
          <div
            className="absolute top-1/2 -translate-y-1/2 w-8 h-4 blur-md transition-all duration-[400ms]"
            style={{
              left: `calc(${progress}% - 16px)`,
              background: phase === 0 ? "#8b5cf6" : phase === 1 ? "#ec4899" : phase === 2 ? "#f97316" : "#3b82f6",
            }}
          />
        </div>
        {/* Subtle status text */}
        <div className="mt-2 flex items-center gap-2">
          <div className="flex gap-0.5">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="w-1 h-1 rounded-full bg-white/30 animate-pulse"
                style={{ animationDelay: `${i * 200}ms` }}
              />
            ))}
          </div>
          <span className="text-[9px] text-white/20">
            {progress < 20 ? "Uploading frames..." : progress < 50 ? "Model is rendering..." : progress < 80 ? "Refining details..." : "Almost there..."}
          </span>
        </div>
      </div>
    );
  }

  // Inline variant (for buttons / compact spaces)
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex-1 h-1 bg-white/5 overflow-hidden relative">
        <div
          className={`h-full bg-gradient-to-r ${gradients[phase]} transition-all duration-[400ms] ease-out relative`}
          style={{ width: `${progress}%` }}
        >
          <div className="absolute inset-0 overflow-hidden">
            <div
              className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent animate-shimmer"
              style={{ animationDuration: "1.5s" }}
            />
          </div>
        </div>
      </div>
      <span className="text-[9px] text-white/30 tabular-nums flex-shrink-0">{Math.round(progress)}%</span>
    </div>
  );
}
