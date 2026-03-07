import { NextRequest, NextResponse } from "next/server";
import { getGeminiClient } from "@/lib/gemini";
import { ExtractedAssets } from "@/lib/types";
import { buildSuggestionsPrompt } from "@/lib/prompts";

export interface AlternateSuggestion {
  id: string;
  title: string;
  description: string;
  characters: string[];
  tone: string;
  icon: "diverge" | "reverse" | "add" | "twist";
}

export async function POST(req: NextRequest) {
  try {
    const { assets, branchType } = (await req.json()) as {
      assets: ExtractedAssets;
      branchType: string;
    };

    const ai = getGeminiClient();
    const prompt = buildSuggestionsPrompt(assets, branchType);

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: [{ role: "user", parts: [{ text: prompt }] }],
    });

    const text = response.text?.trim() || "";
    const cleaned = text.replace(/^```json?\s*/, "").replace(/\s*```$/, "");
    const suggestions: AlternateSuggestion[] = JSON.parse(cleaned);

    return NextResponse.json({ suggestions });
  } catch (error: unknown) {
    console.error("Suggestions error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
