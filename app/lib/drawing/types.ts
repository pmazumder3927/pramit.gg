// Canonical types for the drawing engine. The legacy
// `app/lib/confessional-captcha.ts` re-exports these so server code keeps
// working with imports it already has.

export type BrushId =
  | "pen"
  | "pencil"
  | "fineliner"
  | "marker"
  | "brush"
  | "charcoal"
  | "watercolor"
  | "spray"
  | "eraser";

export type DrawingPoint = {
  x: number;
  y: number;
  // Pressure 0..1 from PointerEvent.pressure (mouse fakes 0.5; touch usually
  // reports 0 or 1). Optional for legacy rows.
  p?: number;
  // Milliseconds since the stroke started. Used to drive replay in the
  // council easel.
  t?: number;
};

export type DrawingStroke = {
  points: DrawingPoint[];
  color?: string;
  width?: number;
  opacity?: number;
  // Legacy v1 marker — kept so old rows render correctly. New code should
  // prefer `brush` instead.
  tool?: "spray";
  brush?: BrushId;
  // Seed for the deterministic stamp jitter so re-renders match.
  seed?: number;
};
