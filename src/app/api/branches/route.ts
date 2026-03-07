import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

const BRANCHES_DIR = path.join(process.cwd(), "public", "branches");

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { branchId, showId, episodeId, title, storyboard, videos, images, frames, fullVideo } = body;

    if (!branchId) {
      return NextResponse.json({ error: "branchId required" }, { status: 400 });
    }

    if (!fs.existsSync(BRANCHES_DIR)) {
      fs.mkdirSync(BRANCHES_DIR, { recursive: true });
    }

    const filePath = path.join(BRANCHES_DIR, `${branchId}.json`);

    // Merge with existing data if file exists
    let existing: Record<string, unknown> = {};
    if (fs.existsSync(filePath)) {
      existing = JSON.parse(fs.readFileSync(filePath, "utf-8"));
    }

    const merged = {
      ...existing,
      branchId,
      ...(showId && { showId }),
      ...(episodeId && { episodeId }),
      ...(title && { title }),
      ...(storyboard && { storyboard }),
      ...(videos !== undefined && { videos }),
      ...(images !== undefined && { images }),
      ...(frames !== undefined && { frames }),
      ...(fullVideo !== undefined && { fullVideo }),
    };

    fs.writeFileSync(filePath, JSON.stringify(merged, null, 2));

    return NextResponse.json({ ok: true, branchId });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
