import { NextRequest, NextResponse } from "next/server";
import { getGeminiClient } from "@/lib/gemini";
import { ChatMessage, ExtractedAssets, Storyboard } from "@/lib/types";
import { buildStoryboardPrompt } from "@/lib/prompts";

export async function POST(req: NextRequest) {
  try {
    const { messages, assets, branchType } = (await req.json()) as {
      messages: ChatMessage[];
      assets: ExtractedAssets;
      branchType: string;
    };

    const ai = getGeminiClient();

    const conversationSummary = messages
      .map((m) => `${m.role}: ${m.content}`)
      .join("\n");

    const prompt = buildStoryboardPrompt(assets, conversationSummary, branchType);

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

    return NextResponse.json({ storyboard });
  } catch (error: unknown) {
    console.error("Storyboard error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
