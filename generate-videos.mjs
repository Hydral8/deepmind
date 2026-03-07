// Generate video chunks using Veo 3.1 with video extension chaining.
// Panel 1: text-to-video. Panel 2+: extend previous panel's video with new prompt.
// This creates naturally cohesive transitions between chunks.
// Finally concatenates all into one full video.
import fs from "fs";
import { execSync } from "child_process";

const BASE = "http://localhost:3000";
const ASSETS_KEY = "movies--got--got_daenaerys_dies";

async function main() {
  const branchData = JSON.parse(fs.readFileSync("public/branches/got-b1.json", "utf-8"));
  const panels = branchData.storyboard.panels;

  const assets = JSON.parse(fs.readFileSync(`public/assets/${ASSETS_KEY}.json`, "utf-8"));

  // Build rich character descriptions
  const charDescriptions = {};
  for (const c of assets.characters || []) {
    charDescriptions[c.name] = `${c.description}. ${c.multiviewDescription}`;
  }
  const envDesc = assets.environments?.[0]
    ? `${assets.environments[0].description}. Lighting: ${assets.environments[0].lighting}.`
    : "";
  const styleDesc = `${assets.cameraStyle?.colorGrading || "dark cinematic"}, ${assets.cameraStyle?.visualTone || "dramatic"}`;

  console.log(`\n=== Generating ${panels.length} chained video clips ===\n`);

  const videoResults = {};
  const videoUrls = [];

  // Generate sequentially: each panel extends the previous one
  for (let i = 0; i < panels.length; i++) {
    const panel = panels[i];
    const chars = panel.characters
      .map((name) => charDescriptions[name] || name)
      .join(". ");

    const prompt = `${panel.sceneDescription}

Characters: ${chars}
${panel.dialogue ? `Dialogue: "${panel.dialogue}"` : ""}
Environment: ${envDesc}
Camera: ${panel.cameraAngle}, ${panel.cameraMovement}
Mood: ${panel.mood}
Style: ${styleDesc}
High-budget HBO television scene. Photorealistic, cinematic lighting. 16:9.`;

    const body = {
      panelId: panel.id,
      visualPrompt: prompt,
      duration: panel.duration,
    };

    // For panel 2+, pass the previous video for extension
    if (i > 0 && videoUrls[i - 1]) {
      body.previousVideoPath = videoUrls[i - 1];
    }

    console.log(`[${panel.id}] Panel ${i + 1}/${panels.length}${i > 0 ? " (extending previous)" : " (first clip)"}...`);

    try {
      const res = await fetch(`${BASE}/api/generate-video`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) {
        console.error(`  FAILED: ${data.error}`);
        videoResults[panel.id] = { videoUrl: "", status: "error" };
        videoUrls.push(null);
      } else {
        console.log(`  DONE -> ${data.videoUrl}`);
        videoResults[panel.id] = { videoUrl: data.videoUrl, status: "done" };
        videoUrls.push(data.videoUrl);
      }
    } catch (err) {
      console.error(`  ERROR: ${err.message}`);
      videoResults[panel.id] = { videoUrl: "", status: "error" };
      videoUrls.push(null);
    }
  }

  // Update branch JSON
  branchData.videos = videoResults;
  fs.writeFileSync("public/branches/got-b1.json", JSON.stringify(branchData, null, 2));
  console.log("\nBranch JSON updated.");

  // Concatenate all clips into full video
  const validUrls = videoUrls.filter(Boolean);
  if (validUrls.length > 1) {
    console.log(`\n--- Concatenating ${validUrls.length} clips ---`);
    const fullVideoPath = "public/generated/got-b1-full.mp4";
    try {
      const inputs = validUrls.map((u) => `-i "public${u}"`).join(" ");
      const filterComplex = validUrls.map((_, i) => `[${i}:v]`).join("") +
        `concat=n=${validUrls.length}:v=1:a=0[outv]`;
      execSync(
        `ffmpeg -y ${inputs} -filter_complex "${filterComplex}" -map "[outv]" -c:v libx264 "${fullVideoPath}" 2>/dev/null`,
        { timeout: 60000 }
      );
      console.log(`Full video: /generated/got-b1-full.mp4`);
      branchData.fullVideo = "/generated/got-b1-full.mp4";
      fs.writeFileSync("public/branches/got-b1.json", JSON.stringify(branchData, null, 2));
    } catch (err) {
      console.error("Concatenation failed:", err.message);
    }
  }

  console.log("\n=== Done! ===");
  console.log("View at: http://localhost:3000/show/game-of-thrones/episode/got-s8-clip/branch/got-b1");
}

main().catch(console.error);
