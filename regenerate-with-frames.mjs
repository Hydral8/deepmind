// Regenerate GoT alternate videos using frame interpolation from the source video.
// Pipeline: plan-frames (Gemini picks timestamps) → extract frames → Veo 3.1 with first/last frame + reference images
import fs from "fs";

const BASE = "http://localhost:3000";
const VIDEO_PATH = "/movies/got/got_daenaerys_dies.mp4";
const BRANCH_ID = "got-b1";
const ASSETS_KEY = "movies--got--got_daenaerys_dies";

async function main() {
  // 1. Load branch data + storyboard
  const branchData = JSON.parse(fs.readFileSync("public/branches/got-b1.json", "utf-8"));
  const panels = branchData.storyboard.panels;
  console.log(`\n=== Regenerating ${panels.length} panels with frame interpolation ===\n`);

  // 2. Load cached assets to get reference images
  const assetsPath = `public/assets/${ASSETS_KEY}.json`;
  let referenceImagePaths = [];
  if (fs.existsSync(assetsPath)) {
    const assets = JSON.parse(fs.readFileSync(assetsPath, "utf-8"));
    // Collect character + environment images as references
    for (const char of assets.characters || []) {
      if (char.imagePath) referenceImagePaths.push(char.imagePath);
    }
    for (const env of assets.environments || []) {
      if (env.imagePath) referenceImagePaths.push(env.imagePath);
    }
    console.log(`Reference images: ${referenceImagePaths.length}`);
    referenceImagePaths.forEach((p) => console.log(`  ${p}`));
  }

  // 3. Ask Gemini to plan which frames from the source video to use
  console.log("\n--- Step 1: Planning frames with Gemini ---");
  const planRes = await fetch(`${BASE}/api/plan-frames`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      panels,
      videoPath: VIDEO_PATH,
      branchId: BRANCH_ID,
    }),
  });

  if (!planRes.ok) {
    const err = await planRes.text();
    console.error("Frame planning failed:", err);
    process.exit(1);
  }

  const { framePlan } = await planRes.json();
  console.log("\nFrame plan from Gemini:");
  for (const [panelId, plan] of Object.entries(framePlan)) {
    console.log(`  ${panelId}: start=${plan.startTimestamp}s → ${plan.startFrame}, end=${plan.endTimestamp}s → ${plan.endFrame}`);
  }

  // 4. Generate videos in parallel with frame interpolation + reference images
  console.log("\n--- Step 2: Generating videos with Veo 3.1 (frame interpolation) ---");
  const videoResults = {};

  const promises = panels.map(async (panel) => {
    const plan = framePlan[panel.id];
    if (!plan) {
      console.log(`  ${panel.id}: No frame plan, skipping`);
      return;
    }

    console.log(`  ${panel.id}: Starting Veo generation (${plan.startFrame} → ${plan.endFrame})...`);

    const res = await fetch(`${BASE}/api/generate-video`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        panelId: panel.id,
        visualPrompt: panel.visualPrompt || panel.sceneDescription,
        duration: panel.duration,
        firstFramePath: plan.startFrame,
        lastFramePath: plan.endFrame,
        referenceImagePaths,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      console.error(`  ${panel.id}: FAILED - ${err}`);
      videoResults[panel.id] = { videoUrl: "", status: "error" };
      return;
    }

    const data = await res.json();
    console.log(`  ${panel.id}: DONE → ${data.videoUrl}`);
    videoResults[panel.id] = { videoUrl: data.videoUrl, status: "done" };
  });

  await Promise.all(promises);

  // 5. Update branch JSON with new videos + frame data
  branchData.videos = videoResults;
  branchData.frames = framePlan;
  fs.writeFileSync("public/branches/got-b1.json", JSON.stringify(branchData, null, 2));
  console.log("\n=== Branch JSON updated with new videos + frame data ===");
  console.log("Done! View at: http://localhost:3000/show/game-of-thrones/episode/got-s8-clip/branch/got-b1");
}

main().catch(console.error);
