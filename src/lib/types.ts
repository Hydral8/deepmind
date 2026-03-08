// ── Asset Extraction Types ──

export interface ExtractedCharacter {
  name: string;
  description: string; // visual appearance
  role: string; // protagonist, antagonist, supporting, etc.
  keyTraits: string[];
  multiviewDescription: string; // how they look from different angles
  bestTimestamp: number; // seconds into video where character is best visible
  imagePath?: string; // path to extracted frame image
}

export interface ExtractedEnvironment {
  name: string;
  description: string;
  lighting: string;
  timeOfDay: string;
  mood: string;
  bestTimestamp: number; // seconds into video where environment is best visible
  imagePath?: string; // path to extracted frame image
}

export interface ExtractedObject {
  name: string;
  description: string;
  significance: string;
  bestTimestamp: number;
  imagePath?: string;
}

export interface CameraStyle {
  commonAngles: string[];
  movementStyle: string; // handheld, steady, crane, etc.
  colorGrading: string;
  visualTone: string;
  aspectRatio: string;
}

export interface ExtractedAssets {
  characters: ExtractedCharacter[];
  environments: ExtractedEnvironment[];
  objects: ExtractedObject[];
  plot: {
    summary: string;
    currentArc: string;
    keyEvents: string[];
    themes: string[];
  };
  seriesContext: {
    genre: string;
    era: string;
    worldRules: string; // e.g. "magic exists", "set in space", etc.
    tone: string;
  };
  cameraStyle: CameraStyle;
}

// ── Frame Strategy Types ──

export interface FrameStrategy {
  strategy: "extract" | "generate";
  timestamp?: number;  // only when strategy is "extract"
  reason: string;
}

// ── Storyboard Types ──

export interface StoryboardPanel {
  id: string;
  order: number;
  sceneDescription: string;
  characters: string[];
  dialogue: string;
  environment: string;
  mood: string;
  duration: number;
  startFramePrompt: string;  // still image: what the first frame looks like
  endFramePrompt: string;    // still image: what the last frame looks like
  transitionPrompt: string;  // what changes between start and end (drives video gen)
  startFrameStrategy: FrameStrategy;
  endFrameStrategy: FrameStrategy;
  // Legacy / optional
  visualPrompt?: string;
  cameraAngle?: string;
  cameraMovement?: string;
  startFrame?: string;
  endFrame?: string;
}

export interface SpliceStrategy {
  type: "replace" | "insert_after" | "standalone";
  startTime?: number;  // seconds into original video (for replace/insert)
  endTime?: number;    // seconds into original video (for replace)
  reason: string;
}

export interface Storyboard {
  title: string;
  panels: StoryboardPanel[];
  spliceStrategy: SpliceStrategy;
  musicPrompt: string;
  totalDuration: number;
}

// ── Chat Types ──

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

// ── Video Generation Types ──

export interface GeneratedClip {
  panelId: string;
  videoUrl: string;
  status: "pending" | "generating" | "done" | "error";
  error?: string;
}
