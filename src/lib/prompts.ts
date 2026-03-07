import { ExtractedAssets, StoryboardPanel } from "./types";

// ── Core Style Directives ──
// These anchor every prompt to avoid glossy/AI-looking output

const VISUAL_REALISM_DIRECTIVE = `ABSOLUTE REQUIREMENTS FOR VISUAL CONSISTENCY:
- Match the SOURCE MATERIAL exactly. This is not an artistic reinterpretation — it is an alternate take shot on the SAME set, with the SAME actors, the SAME wardrobe, the SAME cameras.
- Skin has pores, imperfections, subsurface scattering. Hair has flyaways. Fabric has weave texture and wrinkles. Metal has scratches. Wood has grain.
- NO glossy, plastic, or airbrushed skin. NO overly saturated colors. NO HDR bloom or lens flare unless the source material uses them.
- Lighting must match the source: if the original is dim and desaturated, the output must be dim and desaturated. Do NOT "improve" or brighten the lighting.
- Film grain, motion blur, and depth of field should match the source camera system. If the source is shot on 35mm, emulate 35mm characteristics. If digital, match that sensor's look.
- Color grading must be an exact match. If the source has teal-orange grading, use teal-orange. If it's monochrome and cool, stay monochrome and cool. Never introduce warmth or saturation the original doesn't have.`;

const ANTI_AI_ARTIFACTS = `AVOID THESE AI TELLS AT ALL COSTS:
- Symmetrical faces or perfectly smooth skin
- Overly clean or pristine environments (real sets have dust, wear, lived-in details)
- Plastic-looking hair or clothing
- Unrealistic eye reflections or catchlights
- Hands with wrong finger counts or proportions
- Text or signage that is garbled or nonsensical
- Backgrounds that dissolve into vague painterly blurs
- Uncanny valley expressions — if the emotion doesn't read as genuine, it's wrong
- Over-sharpened edges or halos around subjects`;

// ── Asset Extraction ──

export function buildAssetExtractionPrompt(showTitle: string, episodeTitle: string): string {
  return `You are a senior cinematographer and VFX supervisor analyzing footage from "${showTitle}" — episode "${episodeTitle}".

Your job: extract every visual asset needed to recreate scenes from this footage with frame-perfect fidelity. The output will drive a video generation pipeline, so precision matters more than poetry.

${VISUAL_REALISM_DIRECTIVE}

Extract ALL of the following as a JSON object. Be forensically detailed — describe what you SEE, not what you know from cultural context.

TIMESTAMP RULES:
- "bestTimestamp" must be a NUMBER in TOTAL SECONDS (e.g. 45 means 0:45, 90 means 1:30). Never MM:SS format.
- NEVER use a timestamp < 3. First frames are black/fades.
- Pick the frame where the subject is MOST CLEARLY VISIBLE: well-lit, in focus, facing camera (for characters), widest shot (for environments).
- Cross-reference your knowledge of "${showTitle}" to confirm you are identifying the correct character at that timestamp.

{
  "characters": [
    {
      "name": "character name (actual name if recognizable, else descriptive)",
      "description": "FORENSIC visual detail: exact skin tone, hair color/length/style, facial structure (jaw shape, brow, nose), eye color, build, height relative to others. Exact clothing: fabric type, color, wear/damage, accessories. Scars, tattoos, piercings, prosthetics.",
      "role": "protagonist/antagonist/supporting/background",
      "keyTraits": ["trait1", "trait2"],
      "multiviewDescription": "Describe every angle shown in footage: front (face geometry, expression lines), profile (nose bridge, jaw angle, ear position), 3/4 view, back (hair from behind, shoulder width, posture). Include gait and body language if visible.",
      "bestTimestamp": 12.5
    }
  ],
  "environments": [
    {
      "name": "location name",
      "description": "Exact materials (stone type, wood finish, metal patina), architectural style, spatial dimensions, clutter/props visible, ground surface texture, ceiling/sky, background elements. What does this place SMELL like based on what you see?",
      "lighting": "Light source direction, color temperature (Kelvin estimate), hard vs soft shadows, practical lights visible, ambient fill level, specular highlights on surfaces",
      "timeOfDay": "time of day with sky color if exterior",
      "mood": "atmospheric mood derived from lighting + set dressing + weather",
      "bestTimestamp": 5.0
    }
  ],
  "objects": [
    {
      "name": "notable object",
      "description": "Material, condition (new/worn/damaged), size relative to characters, color, reflectivity, texture detail",
      "significance": "narrative significance",
      "bestTimestamp": 8.0
    }
  ],
  "plot": {
    "summary": "what happens in this clip — beat by beat",
    "currentArc": "where this falls in the larger story",
    "keyEvents": ["event1", "event2"],
    "themes": ["theme1", "theme2"]
  },
  "seriesContext": {
    "genre": "genre classification",
    "era": "time period/setting era",
    "worldRules": "physics, magic systems, technology level, social structures — anything that constrains what CAN happen in this world",
    "tone": "overall tone — be specific: 'bleak nihilistic realism' not just 'dark'"
  },
  "cameraStyle": {
    "commonAngles": ["specific angles observed, e.g. 'low angle hero shot', 'dutch tilt', 'eye-level two-shot'"],
    "movementStyle": "handheld shake level, steadicam smoothness, crane usage, dolly vs zoom, whip pans, rack focuses observed",
    "colorGrading": "EXACT color science: lifted blacks or crushed? Highlight rolloff? Dominant color cast in shadows/mids/highlights? Saturation level? Contrast ratio?",
    "visualTone": "overall texture — grain structure (fine/coarse), sharpness level, halation, lens characteristics (anamorphic stretch, barrel distortion, bokeh shape)",
    "aspectRatio": "estimated aspect ratio (e.g. 2.39:1, 16:9, 4:3)"
  }
}

Return ONLY valid JSON, no markdown fences.`;
}

export function buildAssetVerificationPrompt(showTitle: string, charSummary: string): string {
  return `You previously identified these characters in this video from "${showTitle}":

${charSummary}

VERIFY each one by checking the actual frame at the given timestamp:
1. Go to each timestamp — does that frame clearly show the named character's FACE in focus?
2. Cross-reference against "${showTitle}" — is this actually that character? Does hair color, clothing, and features match?
3. Is the frame well-lit, not black/dark/obscured, not mid-transition/fade?
4. If the character is only shown from behind, partially occluded, or in deep shadow — that's NOT a good frame.

For any that fail, suggest a BETTER timestamp (total seconds, minimum 3) where that character's face is clearly visible in a close-up or medium shot with good lighting.

Return a JSON array:
[
  { "index": 0, "correct": true },
  { "index": 1, "correct": false, "reason": "frame is too dark / wrong character / back of head only", "suggestedTimestamp": 45 }
]

Return ONLY valid JSON, no markdown.`;
}

// ── Alternate Suggestions ──

export function buildSuggestionsPrompt(assets: ExtractedAssets, branchType: string): string {
  const characterList = assets.characters
    .map((c) => `- ${c.name} (${c.role}): ${c.description}`)
    .join("\n");

  return `You are a showrunner for this production. Based on the extracted assets, generate exactly 4 compelling alternate ${branchType} ideas that fans would actually want to see.

SOURCE MATERIAL:
Characters: ${characterList}
Plot: ${assets.plot.summary}
Key events: ${assets.plot.keyEvents.join(", ")}
Themes: ${assets.plot.themes.join(", ")}
Genre: ${assets.seriesContext.genre}
Tone: ${assets.seriesContext.tone}
World rules: ${assets.seriesContext.worldRules}

RULES:
- Each suggestion must be specific and filmable — not vague "what if" hand-waving
- Root every idea in existing characters, relationships, and world rules
- Vary the emotional range: one darker, one hopeful, one surprising, one that subverts expectations
- Each should feel like a legitimate creative choice the writers' room debated
- Keep titles punchy (2-5 words)
- Descriptions should be 1-2 sentences that hook the reader immediately

Return ONLY valid JSON:
[
  {
    "id": "suggestion-1",
    "title": "Short punchy title",
    "description": "1-2 sentence hook that makes the viewer NEED to see this version",
    "characters": ["main characters involved"],
    "tone": "emotional tone in 1-2 words",
    "icon": "one of: diverge, reverse, add, twist"
  }
]`;
}

// ── Chat / Creative Direction ──

export function buildChatSystemPrompt(assets: ExtractedAssets, branchType: string): string {
  const characterList = assets.characters
    .map((c) => `- ${c.name} (${c.role}): ${c.description}`)
    .join("\n");
  const envList = assets.environments
    .map((e) => `- ${e.name}: ${e.description} [Lighting: ${e.lighting}] [Mood: ${e.mood}]`)
    .join("\n");
  const objectList = assets.objects
    .map((o) => `- ${o.name}: ${o.description} (${o.significance})`)
    .join("\n");

  return `You are a showrunner and head writer helping a viewer create an alternate ${branchType} for a scene they just watched.

You have deep knowledge of this production's visual language and narrative DNA. Your suggestions must feel like they BELONG in this world — not fan fiction, but a legitimate alternate cut that the original creators might have considered.

SOURCE MATERIAL:

CHARACTERS:
${characterList}

ENVIRONMENTS:
${envList}

KEY OBJECTS:
${objectList}

PLOT:
${assets.plot.summary}
Arc position: ${assets.plot.currentArc}
Themes: ${assets.plot.themes.join(", ")}
Key events: ${assets.plot.keyEvents.join(", ")}

WORLD:
Genre: ${assets.seriesContext.genre}
Era: ${assets.seriesContext.era}
Rules: ${assets.seriesContext.worldRules}
Tone: ${assets.seriesContext.tone}

VISUAL LANGUAGE:
Camera: ${assets.cameraStyle.commonAngles.join(", ")} | ${assets.cameraStyle.movementStyle}
Color: ${assets.cameraStyle.colorGrading}
Texture: ${assets.cameraStyle.visualTone}

YOUR ROLE:
- Guide the user to develop a specific, filmable alternate scene
- Ask focused questions about: what diverges and why, which characters drive the change, the emotional core, key visual moments, how it resolves
- Push back if ideas break the world's established rules or feel tonally wrong for this series
- Keep responses concise: 2-4 sentences + one targeted question
- After 2-3 exchanges when the vision is clear, confirm you have enough detail and suggest proceeding to storyboard. End that message with: "[READY_FOR_STORYBOARD]"
- Stay in the tone of the series. If it's bleak, be bleak. If it's whimsical, be whimsical. Mirror the source.`;
}

// ── Storyboard Generation ──

export function buildStoryboardPrompt(
  assets: ExtractedAssets,
  conversationSummary: string,
  branchType: string
): string {
  return `You are a storyboard artist and cinematographer creating a shot-by-shot breakdown for an alternate ${branchType}.

CREATIVE BRIEF (from conversation with the viewer):
${conversationSummary}

SOURCE MATERIAL ASSETS:
Characters: ${JSON.stringify(assets.characters.map((c) => ({ name: c.name, appearance: c.description, multiview: c.multiviewDescription })))}
Environments: ${JSON.stringify(assets.environments.map((e) => ({ name: e.name, description: e.description, lighting: e.lighting, mood: e.mood })))}
Objects: ${JSON.stringify(assets.objects.map((o) => ({ name: o.name, description: o.description })))}

ORIGINAL CAMERA LANGUAGE:
Angles: ${assets.cameraStyle.commonAngles.join(", ")}
Movement: ${assets.cameraStyle.movementStyle}
Color grading: ${assets.cameraStyle.colorGrading}
Visual texture: ${assets.cameraStyle.visualTone}
Aspect ratio: ${assets.cameraStyle.aspectRatio}

WORLD RULES:
${assets.seriesContext.worldRules}
Tone: ${assets.seriesContext.tone}

Generate a storyboard as JSON with 3-6 panels.

CRITICAL RULES FOR visualPrompt:
${VISUAL_REALISM_DIRECTIVE}

${ANTI_AI_ARTIFACTS}

- NEVER use character names in visualPrompt. Describe them by exact physical appearance: "a tall woman with silver-blonde braided hair, pale skin, wearing a black leather coat with dragon-scale embossing" — not "Daenerys".
- Each visualPrompt must be a self-contained scene description. A person reading ONLY the visualPrompt (with no other context) should be able to picture the exact frame.
- Include: subject position in frame, background detail, foreground elements, lighting direction and quality, atmospheric effects (fog, dust, smoke), color palette, lens characteristics.
- Describe motion: what is moving, in what direction, at what speed.
- Describe sound design cues in the dialogue field if relevant (ambient sounds that affect the mood).

{
  "title": "title for this alternate branch",
  "panels": [
    {
      "id": "panel-1",
      "order": 1,
      "sceneDescription": "narrative beat — what happens emotionally and physically",
      "cameraAngle": "specific angle matching the source material's visual language",
      "cameraMovement": "specific movement (e.g. 'slow dolly in from medium to close-up over 3 seconds')",
      "characters": ["character names present in this panel"],
      "dialogue": "exact dialogue and/or key sound design",
      "environment": "specific setting with lighting and atmosphere",
      "mood": "emotional tone of this specific beat",
      "duration": 5,
      "visualPrompt": "FULL self-contained visual description. [See rules above]"
    }
  ],
  "musicPrompt": "Describe the score: instrumentation, tempo, key, emotional arc across the full sequence. Reference the source material's musical language. Avoid generic descriptions like 'epic orchestral' — be specific: 'low cello drone in D minor, sparse piano in upper register, building to dissonant brass stabs'.",
  "totalDuration": 20
}

Return ONLY valid JSON, no markdown fences.`;
}

// ── Frame Planning ──

export function buildFramePlanningPrompt(panelDescriptions: string): string {
  return `You are analyzing source footage to find the best visual anchor frames for an alternate scene. These frames will be used as start/end keyframes for AI video generation — the generated video must seamlessly match the look and feel of these source frames.

For each panel, pick:
- startTimestamp: frame that best matches the OPENING visual state (environment, characters present, mood, lighting)
- endTimestamp: frame that best matches the CLOSING visual state (scene resolution, character positions, emotional beat)

RULES:
- Timestamps must be total seconds (NUMBER), not MM:SS
- Minimum timestamp is 3 (first frames are often black/fades)
- Pick frames where subjects are clearly visible, well-lit, and IN FOCUS
- Start and end must be DIFFERENT timestamps (at least 1 second apart)
- Prioritize frames that match the panel's described mood and composition
- Avoid frames mid-transition (dissolves, whip pans, motion blur)
- Prefer frames with clean composition that a video generation model can extend naturally

PANELS:
${panelDescriptions}

Respond with ONLY valid JSON array:
[
  { "panelId": "panel-1", "startTimestamp": 10, "endTimestamp": 15 },
  ...
]`;
}

// ── Panel Image Generation ──

export function buildPanelImagePrompt(
  panel: StoryboardPanel,
  assets: ExtractedAssets,
  referenceDescriptions: string[],
  position: "start" | "end"
): string {
  const positionContext = position === "start"
    ? "This is the OPENING frame — the first thing the viewer sees in this beat."
    : `This is the CLOSING frame — the final moment of this beat.${panel.dialogue ? ` The scene lands on: "${panel.dialogue}"` : ""} Show the resolution/reaction.`;

  const assetContext = referenceDescriptions.length > 0
    ? `\nREFERENCE ASSETS (attached images — you MUST match these EXACTLY):
${referenceDescriptions.join("\n")}

These reference images are your ground truth. The output must look like it was shot on the same set, same day, same camera, same lighting setup. Match skin tones, fabric textures, environment materials, and color grading precisely.`
    : "";

  return `Generate a single photorealistic cinematic film frame. NOT a painting, NOT concept art, NOT an illustration. A frame that could be pulled from a real camera's sensor output.

${positionContext}

SCENE: ${panel.sceneDescription}
${panel.visualPrompt}
${assetContext}

CAMERA: ${panel.cameraAngle} | ${panel.cameraMovement}
MOOD: ${panel.mood}
ENVIRONMENT: ${panel.environment}

STYLE MATCH:
- Color grading: ${assets.cameraStyle.colorGrading}
- Visual texture: ${assets.cameraStyle.visualTone}
- Aspect ratio: ${assets.cameraStyle.aspectRatio}

${VISUAL_REALISM_DIRECTIVE}

${ANTI_AI_ARTIFACTS}

CRITICAL: Each character may appear AT MOST ONCE in the frame. NEVER show the same person twice. No mirrors, reflections, clones, or duplicate figures of any character.

Output: 16:9 aspect ratio. Photorealistic. No watermarks. No text overlays. No borders.`;
}

// ── Video Generation (Veo) ──

export function buildVideoPrompt(
  panel: StoryboardPanel,
  assets: ExtractedAssets
): string {
  return `${panel.visualPrompt}

Cinematic video. Shot on ${assets.cameraStyle.visualTone.includes("anamorphic") ? "anamorphic lenses" : "spherical cinema lenses"}.
Camera: ${panel.cameraAngle}, ${panel.cameraMovement}.
Color science: ${assets.cameraStyle.colorGrading}.
Texture: ${assets.cameraStyle.visualTone}.
Mood: ${panel.mood}.

${VISUAL_REALISM_DIRECTIVE}

Hyperrealistic. Real film grain. Natural motion blur. Photorealistic skin and materials. No AI artifacts. No glossy or plastic textures. Match the look of high-end episodic television / theatrical film.`;
}

// ── Music Generation (Lyria) ──

export function buildMusicPrompt(
  musicDescription: string,
  assets: ExtractedAssets
): string {
  return `${musicDescription}

Style context: This score accompanies a ${assets.seriesContext.genre} production set in ${assets.seriesContext.era}. The tone is ${assets.seriesContext.tone}.

The music must feel like it belongs to the same scoring session as the original production. Match the emotional register and instrumentation palette. Avoid generic stock-music energy — this should feel composed for this specific scene, with dynamics that breathe and evolve rather than looping or sitting at one intensity level.

No synthetic or obviously AI-generated timbres. Use realistic instrument modeling with natural performance characteristics: slight timing imperfections, dynamic variation, room ambience. If using vocals, they should be diegetically motivated or match the source material's use of voice.`;
}
