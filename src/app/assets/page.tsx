"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ExtractedAssets } from "@/lib/types";

interface CachedAsset {
  filename: string;
  videoPath: string;
  data: ExtractedAssets;
}

type Tab = "characters" | "environments" | "objects" | "plot" | "camera";

export default function AssetsPage() {
  const [assets, setAssets] = useState<CachedAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAsset, setSelectedAsset] = useState<CachedAsset | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("characters");
  const [editing, setEditing] = useState(false);
  const [editJson, setEditJson] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");

  useEffect(() => {
    fetchAssets();
  }, []);

  async function fetchAssets() {
    setLoading(true);
    const res = await fetch("/api/assets");
    const data = await res.json();
    setAssets(data.assets || []);
    if (data.assets?.length > 0 && !selectedAsset) {
      setSelectedAsset(data.assets[0]);
    }
    setLoading(false);
  }

  function startEdit() {
    if (!selectedAsset) return;
    // Edit only the active tab's data
    const section = getSection();
    setEditJson(JSON.stringify(section, null, 2));
    setEditing(true);
    setSaveMsg("");
  }

  function getSection() {
    if (!selectedAsset) return null;
    const d = selectedAsset.data;
    switch (activeTab) {
      case "characters": return d.characters;
      case "environments": return d.environments;
      case "objects": return d.objects;
      case "plot": return d.plot;
      case "camera": return d.cameraStyle;
    }
  }

  function getSectionKey(): string {
    switch (activeTab) {
      case "characters": return "characters";
      case "environments": return "environments";
      case "objects": return "objects";
      case "plot": return "plot";
      case "camera": return "cameraStyle";
    }
  }

  async function handleSave() {
    if (!selectedAsset) return;
    setSaving(true);
    setSaveMsg("");

    try {
      const parsed = JSON.parse(editJson);
      const updated = { ...selectedAsset.data, [getSectionKey()]: parsed };

      const res = await fetch("/api/assets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename: selectedAsset.filename, data: updated }),
      });

      if (!res.ok) throw new Error("Save failed");

      setSelectedAsset({ ...selectedAsset, data: updated });
      setAssets((prev) =>
        prev.map((a) =>
          a.filename === selectedAsset.filename ? { ...a, data: updated } : a
        )
      );
      setEditing(false);
      setSaveMsg("Saved");
      setTimeout(() => setSaveMsg(""), 2000);
    } catch {
      setSaveMsg("Invalid JSON");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(filename: string) {
    await fetch("/api/assets", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename }),
    });
    setAssets((prev) => prev.filter((a) => a.filename !== filename));
    if (selectedAsset?.filename === filename) {
      setSelectedAsset(null);
    }
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "characters", label: "Characters" },
    { key: "environments", label: "Environments" },
    { key: "objects", label: "Objects" },
    { key: "plot", label: "Plot" },
    { key: "camera", label: "Camera" },
  ];

  return (
    <main className="min-h-screen pt-20">
      <div className="max-w-[1200px] mx-auto px-12">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <Link
              href="/"
              className="inline-flex items-center gap-2 text-[10px] text-white/30 hover:text-white/60 transition-colors mb-4 tracking-[0.15em] uppercase"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6" />
              </svg>
              Home
            </Link>
            <h1 className="text-[28px] font-black uppercase tracking-tight">
              Extracted Assets
            </h1>
            <p className="text-[12px] text-white/30 mt-1">
              Cached scene analysis from Gemini. Edit to refine.
            </p>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-20">
            <div className="w-6 h-6 mx-auto rounded-full border border-white/20 border-t-white/80 spin" />
          </div>
        ) : assets.length === 0 ? (
          <div className="text-center py-20 text-white/30 text-[13px]">
            No cached assets yet. Go to an episode and click &ldquo;Create
            Alternate&rdquo; to extract assets.
          </div>
        ) : (
          <div className="flex gap-6">
            {/* Left sidebar: asset list */}
            <div className="w-[260px] flex-shrink-0 space-y-2">
              {assets.map((asset) => (
                <div
                  key={asset.filename}
                  className={`p-4 cursor-pointer transition-all ${
                    selectedAsset?.filename === asset.filename
                      ? "bg-white/10 border border-white/20"
                      : "bg-[#181818] border border-white/5 hover:border-white/15"
                  }`}
                  onClick={() => {
                    setSelectedAsset(asset);
                    setEditing(false);
                  }}
                >
                  <div className="text-[12px] font-semibold mb-1 truncate">
                    {asset.videoPath}
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-white/30">
                    <span>{asset.data.characters.length} chars</span>
                    <span>{asset.data.environments.length} envs</span>
                    <span>{asset.data.objects.length} objs</span>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(asset.filename);
                    }}
                    className="mt-2 text-[9px] text-red-400/50 hover:text-red-400 transition-colors tracking-[0.15em] uppercase"
                  >
                    Delete cache
                  </button>
                </div>
              ))}
            </div>

            {/* Right: detail view */}
            {selectedAsset && (
              <div className="flex-1 min-w-0">
                {/* Tabs */}
                <div className="flex gap-1 mb-6 border-b border-white/5 pb-3">
                  {tabs.map((tab) => (
                    <button
                      key={tab.key}
                      onClick={() => {
                        setActiveTab(tab.key);
                        setEditing(false);
                      }}
                      className={`px-4 py-2 text-[11px] tracking-[0.1em] uppercase transition-all ${
                        activeTab === tab.key
                          ? "bg-white text-black font-semibold"
                          : "text-white/40 hover:text-white/70"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                  <div className="flex-1" />
                  {!editing ? (
                    <button
                      onClick={startEdit}
                      className="px-4 py-2 text-[10px] text-white/30 hover:text-white border border-white/10 hover:border-white/30 transition-all tracking-[0.15em] uppercase"
                    >
                      Edit
                    </button>
                  ) : (
                    <div className="flex gap-2">
                      <button
                        onClick={() => setEditing(false)}
                        className="px-4 py-2 text-[10px] text-white/30 hover:text-white transition-colors tracking-[0.15em] uppercase"
                      >
                        Cancel
                      </button>
                      <button
                        onClick={handleSave}
                        disabled={saving}
                        className="px-4 py-2 text-[10px] bg-white text-black font-semibold tracking-[0.15em] uppercase hover:bg-white/90 transition-all disabled:opacity-50"
                      >
                        {saving ? "Saving..." : "Save"}
                      </button>
                    </div>
                  )}
                  {saveMsg && (
                    <span
                      className={`self-center text-[10px] ml-2 ${
                        saveMsg === "Saved" ? "text-green-400" : "text-red-400"
                      }`}
                    >
                      {saveMsg}
                    </span>
                  )}
                </div>

                {/* Content */}
                {editing ? (
                  <textarea
                    value={editJson}
                    onChange={(e) => setEditJson(e.target.value)}
                    className="w-full h-[500px] bg-[#0a0a0a] border border-white/10 p-4 text-[12px] font-mono text-white/80 focus:outline-none focus:border-white/25 resize-none"
                    spellCheck={false}
                  />
                ) : (
                  <div>
                    {/* Characters tab */}
                    {activeTab === "characters" && (
                      <div className="space-y-4">
                        {selectedAsset.data.characters.map((char, i) => (
                          <div key={i} className="bg-[#181818] border border-white/5 overflow-hidden">
                            <div className="flex">
                              {char.imagePath && (
                                <div className="w-[200px] flex-shrink-0 bg-black">
                                  <img
                                    src={char.imagePath}
                                    alt={char.name}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              )}
                              <div className="flex-1 p-5">
                                <div className="flex items-center gap-3 mb-2">
                                  <h3 className="text-[14px] font-semibold">{char.name}</h3>
                                  <span className="text-[9px] px-2 py-0.5 bg-white/5 text-white/30 tracking-[0.1em] uppercase">
                                    {char.role}
                                  </span>
                                </div>
                                <p className="text-[12px] text-white/50 mb-2">{char.description}</p>
                                <div className="mb-2">
                                  <span className="text-[9px] text-white/25 tracking-[0.15em] uppercase">Multiview</span>
                                  <p className="text-[11px] text-white/40 mt-0.5">{char.multiviewDescription}</p>
                                </div>
                                <div className="flex flex-wrap gap-1.5">
                                  {char.keyTraits.map((trait, j) => (
                                    <span key={j} className="px-2 py-0.5 text-[10px] bg-white/5 text-white/30">
                                      {trait}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Environments tab */}
                    {activeTab === "environments" && (
                      <div className="space-y-4">
                        {selectedAsset.data.environments.map((env, i) => (
                          <div key={i} className="bg-[#181818] border border-white/5 overflow-hidden">
                            {env.imagePath && (
                              <div className="aspect-[21/9] bg-black">
                                <img
                                  src={env.imagePath}
                                  alt={env.name}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            )}
                            <div className="p-5">
                              <h3 className="text-[14px] font-semibold mb-2">{env.name}</h3>
                              <p className="text-[12px] text-white/50 mb-3">{env.description}</p>
                              <div className="grid grid-cols-3 gap-4">
                                <div>
                                  <span className="text-[9px] text-white/25 tracking-[0.15em] uppercase">Lighting</span>
                                  <p className="text-[11px] text-white/40 mt-0.5">{env.lighting}</p>
                                </div>
                                <div>
                                  <span className="text-[9px] text-white/25 tracking-[0.15em] uppercase">Time</span>
                                  <p className="text-[11px] text-white/40 mt-0.5">{env.timeOfDay}</p>
                                </div>
                                <div>
                                  <span className="text-[9px] text-white/25 tracking-[0.15em] uppercase">Mood</span>
                                  <p className="text-[11px] text-white/40 mt-0.5">{env.mood}</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Objects tab */}
                    {activeTab === "objects" && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {selectedAsset.data.objects.map((obj, i) => (
                          <div key={i} className="bg-[#181818] border border-white/5 overflow-hidden">
                            {obj.imagePath && (
                              <div className="aspect-video bg-black">
                                <img
                                  src={obj.imagePath}
                                  alt={obj.name}
                                  className="w-full h-full object-cover"
                                />
                              </div>
                            )}
                            <div className="p-5">
                              <h3 className="text-[14px] font-semibold mb-1">{obj.name}</h3>
                              <p className="text-[12px] text-white/50 mb-2">{obj.description}</p>
                              <div>
                                <span className="text-[9px] text-white/25 tracking-[0.15em] uppercase">Significance</span>
                                <p className="text-[11px] text-white/40 mt-0.5">{obj.significance}</p>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Plot tab */}
                    {activeTab === "plot" && (
                      <div className="space-y-4">
                        <div className="bg-[#181818] border border-white/5 p-5">
                          <h3 className="text-[10px] text-white/25 tracking-[0.15em] uppercase mb-2">Summary</h3>
                          <p className="text-[13px] text-white/60 leading-relaxed">{selectedAsset.data.plot.summary}</p>
                        </div>
                        <div className="bg-[#181818] border border-white/5 p-5">
                          <h3 className="text-[10px] text-white/25 tracking-[0.15em] uppercase mb-2">Current Arc</h3>
                          <p className="text-[13px] text-white/60">{selectedAsset.data.plot.currentArc}</p>
                        </div>
                        <div className="bg-[#181818] border border-white/5 p-5">
                          <h3 className="text-[10px] text-white/25 tracking-[0.15em] uppercase mb-2">Key Events</h3>
                          <ul className="space-y-1.5">
                            {selectedAsset.data.plot.keyEvents.map((evt, i) => (
                              <li key={i} className="text-[12px] text-white/50 flex gap-2">
                                <span className="text-white/20">{i + 1}.</span> {evt}
                              </li>
                            ))}
                          </ul>
                        </div>
                        <div className="bg-[#181818] border border-white/5 p-5">
                          <h3 className="text-[10px] text-white/25 tracking-[0.15em] uppercase mb-2">Themes</h3>
                          <div className="flex flex-wrap gap-2">
                            {selectedAsset.data.plot.themes.map((theme, i) => (
                              <span key={i} className="px-3 py-1 text-[11px] bg-white/5 text-white/40">
                                {theme}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="bg-[#181818] border border-white/5 p-5">
                          <h3 className="text-[10px] text-white/25 tracking-[0.15em] uppercase mb-3">Series Context</h3>
                          <div className="grid grid-cols-2 gap-4">
                            {Object.entries(selectedAsset.data.seriesContext).map(([key, val]) => (
                              <div key={key}>
                                <span className="text-[9px] text-white/25 tracking-[0.15em] uppercase">{key}</span>
                                <p className="text-[11px] text-white/50 mt-0.5">{val}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Camera tab */}
                    {activeTab === "camera" && (
                      <div className="space-y-4">
                        <div className="bg-[#181818] border border-white/5 p-5">
                          <h3 className="text-[10px] text-white/25 tracking-[0.15em] uppercase mb-3">Common Angles</h3>
                          <div className="flex flex-wrap gap-2">
                            {selectedAsset.data.cameraStyle.commonAngles.map((angle, i) => (
                              <span key={i} className="px-3 py-1.5 text-[11px] bg-white/5 text-white/50 border border-white/5">
                                {angle}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                          {[
                            ["Movement", selectedAsset.data.cameraStyle.movementStyle],
                            ["Color Grading", selectedAsset.data.cameraStyle.colorGrading],
                            ["Visual Tone", selectedAsset.data.cameraStyle.visualTone],
                            ["Aspect Ratio", selectedAsset.data.cameraStyle.aspectRatio],
                          ].map(([label, value]) => (
                            <div key={label} className="bg-[#181818] border border-white/5 p-5">
                              <span className="text-[9px] text-white/25 tracking-[0.15em] uppercase">{label}</span>
                              <p className="text-[12px] text-white/50 mt-1">{value}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
      <div className="h-20" />
    </main>
  );
}
