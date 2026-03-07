// Generate start/end frame images for the GoT alternate storyboard
import fs from "fs";

const BASE = "http://localhost:3000";

async function main() {
  // Load the cached assets
  const assetsRes = await fetch(`${BASE}/api/extract-assets`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      videoPath: "/movies/got/got_daenaerys_dies.mp4",
      showTitle: "Game of Thrones",
      episodeTitle: "The Iron Throne",
    }),
  });
  const { assets } = await assetsRes.json();

  // Load existing branch data
  const branchData = JSON.parse(fs.readFileSync("public/branches/got-b1.json", "utf-8"));
  const panels = branchData.storyboard.panels;

  console.log(`Generating images for ${panels.length} panels...`);

  // Generate images in parallel
  const imageResults = {};
  const promises = panels.map(async (panel) => {
    console.log(`  Starting images for ${panel.id}...`);
    const res = await fetch(`${BASE}/api/generate-panel-images`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        panel,
        assets,
        videoPath: "/movies/got/got_daenaerys_dies.mp4",
        branchId: "got-b1",
      }),
    });
    const data = await res.json();
    console.log(`  ${panel.id}: start=${data.startImage || "none"}, end=${data.endImage || "none"} (${data.source})`);
    imageResults[panel.id] = { startImage: data.startImage, endImage: data.endImage };
  });

  await Promise.all(promises);

  // Update branch JSON with images
  branchData.images = imageResults;
  fs.writeFileSync("public/branches/got-b1.json", JSON.stringify(branchData, null, 2));
  console.log("\nBranch JSON updated with image paths.");
}

main().catch(console.error);
