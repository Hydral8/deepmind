// End-to-end test: assets -> storyboard -> parallel video generation
const BASE = "http://localhost:3000";

async function main() {
  // Step 1: Get cached assets
  console.log("=== Step 1: Get Assets ===");
  const assetsRes = await fetch(`${BASE}/api/extract-assets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      videoPath: "/movies/got/got_daenaerys_dies.mp4",
      showTitle: "Game of Thrones",
      episodeTitle: "The Iron Throne",
    }),
  });
  const assetsData = await assetsRes.json();
  if (assetsData.error) { console.error("Assets error:", assetsData.error); return; }
  console.log(`Cached: ${assetsData.cached}`);
  console.log(`Characters: ${assetsData.assets.characters.map(c => c.name).join(", ")}`);

  // Step 2: Generate storyboard
  console.log("\n=== Step 2: Generate Storyboard ===");
  const storyboardRes = await fetch(`${BASE}/api/generate-storyboard`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      messages: [
        {
          role: "user",
          content: "I want to create an alternate ending where Jon refuses to kill Daenerys. Instead, she sees the destruction she caused and breaks down. Jon comforts her and they decide to break the wheel together by destroying the Iron Throne.",
        },
        {
          role: "assistant",
          content: "That's a powerful concept - a redemption arc for Daenerys. Key beats: Daenerys approaching the throne, then seeing the devastation, the realization hitting her, Jon catching her as she breaks down, and together destroying the throne. Should Drogon melt it?",
        },
        {
          role: "user",
          content: "Yes! Daenerys commands Drogon to destroy the Iron Throne. Make it 3 panels, keep each around 6 seconds. Very cinematic and emotional.",
        },
      ],
      assets: assetsData.assets,
      branchType: "ending",
    }),
  });
  const storyboardData = await storyboardRes.json();
  if (storyboardData.error) { console.error("Storyboard error:", storyboardData.error); return; }

  const sb = storyboardData.storyboard;
  console.log(`Title: ${sb.title}`);
  console.log(`Panels: ${sb.panels.length}, Total: ${sb.totalDuration}s`);
  for (const p of sb.panels) {
    console.log(`\n  [${p.id}] ${p.sceneDescription}`);
    console.log(`    Camera: ${p.cameraAngle} | Movement: ${p.cameraMovement}`);
    console.log(`    Mood: ${p.mood} | Duration: ${p.duration}s`);
    console.log(`    Characters: ${p.characters.join(", ")}`);
    if (p.dialogue) console.log(`    Dialogue: "${p.dialogue}"`);
    console.log(`    Visual prompt: ${p.visualPrompt.substring(0, 150)}...`);
  }

  // Step 3: Generate videos in parallel
  console.log("\n=== Step 3: Generate Videos (parallel) ===");
  const videoPromises = sb.panels.map(async (panel) => {
    console.log(`  Starting ${panel.id}...`);
    const t0 = Date.now();
    const res = await fetch(`${BASE}/api/generate-video`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        panelId: panel.id,
        visualPrompt: panel.visualPrompt,
        duration: panel.duration,
      }),
    });
    const data = await res.json();
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);
    if (data.error) {
      console.log(`  ${panel.id} FAILED (${elapsed}s): ${data.error}`);
    } else {
      console.log(`  ${panel.id} DONE (${elapsed}s) -> ${data.videoUrl}`);
    }
    return { panelId: panel.id, ...data };
  });

  const results = await Promise.all(videoPromises);

  console.log("\n=== Results ===");
  for (const r of results) {
    console.log(`${r.panelId}: ${r.videoUrl || "FAILED - " + r.error}`);
  }
}

main().catch(console.error);
