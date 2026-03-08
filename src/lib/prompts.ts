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

Generate a storyboard as JSON with exactly 2 panels.

PANEL DURATION RULES:
- Each panel should be 10-15 seconds long. This is the sweet spot for video generation models.
- Combine related beats into longer, semantically coherent chunks. Think in terms of "scenes" not "shots".
- Panel 1 = the setup and inciting moment. Panel 2 = the payoff and resolution.
- Split at the single most important narrative turning point.

FOR EACH PANEL, you must provide three distinct prompts:

1. **startFramePrompt** — A still image description of what the viewer sees at the FIRST FRAME. This is a frozen moment: character positions, expressions, environment state, camera framing, lighting. Self-contained — someone reading only this should picture the exact frame.

2. **endFramePrompt** — A still image description of what the viewer sees at the LAST FRAME. Must be visually DIFFERENT from the start frame — show what changed. Different character positions, expressions, camera framing, or environment state.

3. **transitionPrompt** — Describes what HAPPENS between start and end. This drives the video generation model to animate the change. Focus on: motion, action, emotional shift, camera movement. This is NOT a still image — it describes movement and transformation.

RULES FOR ALL PROMPTS:
- NEVER use character names. Describe by appearance: "a tall woman with silver-blonde braided hair, pale skin, wearing dark leather armor" — not "Daenerys".
- Each prompt must be self-contained. Include: subject position, background, foreground, lighting, atmosphere, color palette.
- Start and end frames MUST be visually distinct. If they look the same, the video will have no motion.

${VISUAL_REALISM_DIRECTIVE}

{
  "title": "title for this alternate branch",
  "panels": [
    {
      "id": "panel-1",
      "order": 1,
      "sceneDescription": "narrative summary of what happens in this beat",
      "characters": ["character names present"],
      "dialogue": "dialogue if any",
      "environment": "setting",
      "mood": "emotional tone",
      "duration": 12,
      "startFramePrompt": "Still image: what the first frame looks like. Specific composition, character positions, expressions, lighting.",
      "endFramePrompt": "Still image: what the last frame looks like. Must differ from start — show the change.",
      "transitionPrompt": "What happens between start and end. Motion, action, camera movement, emotional shift."
    }
  ],
  "musicPrompt": "Score description: instrumentation, tempo, key, emotional arc.",
  "totalDuration": 24
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

// ── Smart Frame Strategy ──

export function buildSmartFrameStrategyPrompt(panelDescriptions: string): string {
  return `You are a VFX supervisor deciding the best strategy for generating start/end keyframes for each panel of an alternate scene. You have two options per frame:

1. **"extract"** — Pull a frame directly from the original source video. Use this when:
   - The panel's visual state closely matches something already in the source footage
   - Same characters, same environment, similar lighting and mood
   - The panel is a slight variation of what already exists (e.g. different dialogue but same blocking)
   - The source video has a clean, well-composed frame that matches

2. **"generate"** — Create a new frame with AI image generation. Use this when:
   - The panel diverges significantly from the source (new action, new composition, new emotion)
   - Characters are in positions/states not seen in the original footage
   - The environment is altered (e.g. destroyed, transformed, different time of day)
   - New characters or objects appear that weren't in the source
   - The camera angle is dramatically different from anything in the source

For each panel, decide independently for BOTH the start frame and the end frame. A panel might extract its start frame from source but generate its end frame (or vice versa).

When choosing "extract", also provide the best timestamp (total seconds, minimum 3) from the source video.

PANELS:
${panelDescriptions}

Respond with ONLY valid JSON array:
[
  {
    "panelId": "panel-1",
    "startFrame": { "strategy": "extract", "timestamp": 10, "reason": "matches the opening composition" },
    "endFrame": { "strategy": "generate", "reason": "character emotion not present in source" }
  },
  {
    "panelId": "panel-2",
    "startFrame": { "strategy": "extract", "timestamp": 25, "reason": "same two-shot exists at this point" },
    "endFrame": { "strategy": "extract", "timestamp": 30, "reason": "embrace is visually close to source" }
  }
]`;
}

// ── Panel Image Generation ──

export function buildPanelImagePrompt(
  panel: StoryboardPanel,
  assets: ExtractedAssets,
  referenceDescriptions: string[],
  position: "start" | "end"
): string {
  // Use the panel's own prompt — Gemini already wrote it
  const scenePrompt = position === "start"
    ? (panel.startFramePrompt || panel.sceneDescription)
    : (panel.endFramePrompt || panel.sceneDescription);

  return `${scenePrompt}

Hyperrealistic, photorealistic cinematic film frame. ${assets.cameraStyle.colorGrading}. ${assets.cameraStyle.visualTone}.
Each character appears at most once — no duplicates or reflections. 16:9. No watermarks or text.`;
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
