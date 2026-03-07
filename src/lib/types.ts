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

// ── Storyboard Types ──

export interface StoryboardPanel {
  id: string;
  order: number;
  sceneDescription: string;
  cameraAngle: string;
  cameraMovement: string;
  characters: string[];
  dialogue: string;
  environment: string;
  mood: string;
  duration: number; // seconds
  visualPrompt: string; // the full prompt for Veo
}

export interface Storyboard {
  title: string;
  panels: StoryboardPanel[];
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
