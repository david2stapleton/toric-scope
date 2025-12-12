export interface Point {
  x: number;
  y: number;
}

export type BlinkShape = 'circle' | 'line' | 'region';

export interface BlinkDrawInfo {
  canvasPosition?: Point;  // For circles
  size?: number;           // Radius for circles
  shape: BlinkShape;
  // For lines/edges
  startPoint?: Point;
  endPoint?: Point;
  // For regions/strata
  points?: Point[];
}

export interface BlinkableFeature {
  id: string;              // Unique identifier
  type: string;            // 'vertex', 'edge', 'stratum', etc.
  latticePoint?: Point;    // Original lattice coordinates (for vertices)
  latticePoints?: Point[]; // Original lattice coordinates (for edges/regions)
  shape: BlinkShape;
}

export interface BlinkState {
  features: BlinkableFeature[];
  currentIndex: number;
  blinkRate: number;  // milliseconds between blinks
  isPersistent: boolean;  // true for select, false for blink
}
