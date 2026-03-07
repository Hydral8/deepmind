// Generate all video chunks with Veo 3.1 (text-to-video with asset-grounded prompts)
// Then concatenate into one full cohesive video.
// Each panel prompt describes exact visual continuity with adjacent panels.
import fs from "fs";
import { execSync } from "child_process";

const BASE = "http://localhost:3000";
const ASSETS_KEY = "movies--got--got_daenaerys_dies";

async function main() {
  const branchData = JSON.parse(fs.readFileSync("public/branches/got-b1.json", "utf-8"));
  const panels = branchData.storyboard.panels;

  const assets = JSON.parse(fs.readFileSync(`public/assets/${ASSETS_KEY}.json`, "utf-8"));

  // Build detailed character/env descriptions from extracted assets
  const charDescriptions = {};
  for (const c of assets.characters || []) {
    charDescriptions[c.name] = `${c.description}. ${c.multiviewDescription}. Key traits: ${c.keyTraits.join(", ")}`;
  }
  const envDesc = assets.environments?.[0]
    ? `${assets.environments[0].name}: ${assets.environments[0].description}. Lighting: ${assets.environments[0].lighting}. Time: ${assets.environments[0].timeOfDay}. Mood: ${assets.environments[0].mood}.`
    : "";
  const styleDesc = `Color grading: ${assets.cameraStyle?.colorGrading}. Tone: ${assets.cameraStyle?.visualTone}. Camera style: ${assets.cameraStyle?.movementStyle}.`;

  console.log(`\n=== Generating ${panels.length} video clips (parallel) + concatenating ===\n`);

  // Build enriched prompts with cross-panel continuity
  const enrichedPrompts = panels.map((panel, i) => {
    const chars = panel.characters
      .map((name) => {
        const desc = charDescriptions[name];
        return desc ? `${name} (${desc})` : name;
      })
      .join("\n");

    // Describe the exact visual state at start and end for continuity
    let continuity = "";
    if (i > 0) {
      continuity += `VISUAL CONTINUITY - This clip starts EXACTLY where the previous scene ended: ${panels[i - 1].sceneDescription}. `;
    }
    if (i < panels.length - 1) {
      continuity += `This clip must end in a state that leads into: ${panels[i + 1].sceneDescription}. `;
    }

    return `${continuity}

SCENE: ${panel.sceneDescription}
${panel.dialogue ? `DIALOGUE: "${panel.dialogue}"` : ""}

CHARACTERS IN SCENE:
${chars}

ENVIRONMENT: ${envDesc}

CAMERA: ${panel.cameraAngle}. Movement: ${panel.cameraMovement}.
MOOD: ${panel.mood}

VISUAL STYLE: ${styleDesc}

This must look like a high-budget HBO Game of Thrones scene. Photorealistic live-action, cinematic lighting, film grain, shallow depth of field. Dark, desaturated blue-grey palette with warm highlights. 16:9 widescreen composition.`;
  });

  // Generate all in parallel
  console.log("--- Starting parallel generation ---\n");

  const videoResults = {};
  const orderedUrls = new Array(panels.length).fill(null);

  const images = branchData.images || {};

  const promises = panels.map(async (panel, i) => {
    const panelImages = images[panel.id];
    const firstFramePath = panelImages?.startImage || null;
    const lastFramePath = panelImages?.endImage || null;

    console.log(`  [${panel.id}] Generating (${panel.duration}s)${firstFramePath ? ' with start/end frames (image-to-video)' : ' text-to-video'}...`);
    try {
      const res = await fetch(`${BASE}/api/generate-video`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          panelId: panel.id,
          visualPrompt: enrichedPrompts[i],
          duration: panel.duration,
          firstFramePath,
          lastFramePath,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        console.error(`  [${panel.id}] FAILED: ${data.error}`);
        videoResults[panel.id] = { videoUrl: "", status: "error" };
      } else {
        console.log(`  [${panel.id}] DONE -> ${data.videoUrl}`);
        videoResults[panel.id] = { videoUrl: data.videoUrl, status: "done" };
        orderedUrls[i] = data.videoUrl;
      }
    } catch (err) {
      console.error(`  [${panel.id}] ERROR: ${err.message}`);
      videoResults[panel.id] = { videoUrl: "", status: "error" };
    }
  });

  await Promise.all(promises);

  // Update branch JSON
  branchData.videos = videoResults;
  fs.writeFileSync("public/branches/got-b1.json", JSON.stringify(branchData, null, 2));
  console.log("\nBranch JSON updated.");

  // Concatenate all clips into one full video
  const validUrls = orderedUrls.filter(Boolean);
  if (validUrls.length > 1) {
    console.log(`\n--- Concatenating ${validUrls.length} clips into full video ---`);
    const fullVideoPath = "public/generated/got-b1-full.mp4";

    try {
      // Re-encode all clips to same format then concat
      const inputs = validUrls.map((u) => `-i "public${u}"`).join(" ");
      const filterComplex = validUrls.map((_, i) => `[${i}:v]`).join("") +
        `concat=n=${validUrls.length}:v=1:a=0[outv]`;
      execSync(
        `ffmpeg -y ${inputs} -filter_complex "${filterComplex}" -map "[outv]" -c:v libx264 -preset fast "${fullVideoPath}" 2>/dev/null`,
        { timeout: 60000 }
      );

      const stats = fs.statSync(fullVideoPath);
      console.log(`Full video: /generated/got-b1-full.mp4 (${(stats.size / 1024 / 1024).toFixed(1)}MB)`);

      branchData.fullVideo = "/generated/got-b1-full.mp4";
      fs.writeFileSync("public/branches/got-b1.json", JSON.stringify(branchData, null, 2));
    } catch (err) {
      console.error("Concatenation failed:", err.message);
    }
  } else if (validUrls.length === 1) {
    branchData.fullVideo = validUrls[0];
    fs.writeFileSync("public/branches/got-b1.json", JSON.stringify(branchData, null, 2));
  }

  console.log("\n=== Done! ===");
  console.log("View at: http://localhost:3000/show/game-of-thrones/episode/got-s8-clip/branch/got-b1");
}

main().catch(console.error);
