import { NextRequest, NextResponse } from "next/server";
import { getGeminiClient } from "@/lib/gemini";
import { ChatMessage, ExtractedAssets, Storyboard } from "@/lib/types";
import { buildStoryboardPrompt } from "@/lib/prompts";

export async function POST(req: NextRequest) {
  try {
    const {
      messages,
      assets,
      branchType,
      videoDurationSeconds,
      insertPoint,
      replaceStart,
      replaceEnd,
    } = (await req.json()) as {
      messages: ChatMessage[];
      assets: ExtractedAssets;
      branchType: string;
      videoDurationSeconds?: number;
      insertPoint?: number | null;
      replaceStart?: number | null;
      replaceEnd?: number | null;
    };

    const ai = getGeminiClient();

    const conversationSummary = messages
      .map((m) => `${m.role}: ${m.content}`)
      .join("\n");

    const prompt = buildStoryboardPrompt(
      assets,
      conversationSummary,
      branchType,
      videoDurationSeconds,
      insertPoint,
      replaceStart,
      replaceEnd
    );

    const response = await ai.models.generateContent({
      model: "gemini-3.1-pro-preview",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    const text = response.text?.trim() || "";
    const cleaned = text.replace(/^```json?\s*/, "").replace(/\s*```$/, "");
    const storyboard: Storyboard = JSON.parse(cleaned);

    // Ensure IDs exist
    storyboard.panels = storyboard.panels.map((p, i) => ({
      ...p,
      id: p.id || `panel-${i + 1}`,
      order: i + 1,
    }));

    // Default spliceStrategy if not provided
    if (!storyboard.spliceStrategy) {
      storyboard.spliceStrategy = {
        type: "standalone",
        reason: "No splice strategy specified by model",
      };
    }

    // Default frame strategies if not provided
    storyboard.panels = storyboard.panels.map((p) => ({
      ...p,
      startFrameStrategy: p.startFrameStrategy || { strategy: "generate", reason: "default" },
      endFrameStrategy: p.endFrameStrategy || { strategy: "generate", reason: "default" },
    }));

    return NextResponse.json({ storyboard });
  } catch (error: unknown) {
    console.error("Storyboard error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
