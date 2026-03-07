import { NextRequest, NextResponse } from "next/server";
import * as fs from "fs";
import * as path from "path";

const BRANCHES_DIR = path.join(process.cwd(), "public", "branches");

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { branchId, showId, episodeId, title, storyboard, videos } = body;

    if (!branchId) {
      return NextResponse.json({ error: "branchId required" }, { status: 400 });
    }

    if (!fs.existsSync(BRANCHES_DIR)) {
      fs.mkdirSync(BRANCHES_DIR, { recursive: true });
    }

    const filePath = path.join(BRANCHES_DIR, `${branchId}.json`);
    fs.writeFileSync(
      filePath,
      JSON.stringify({ branchId, showId, episodeId, title, storyboard, videos }, null, 2)
    );

    return NextResponse.json({ ok: true, branchId });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
