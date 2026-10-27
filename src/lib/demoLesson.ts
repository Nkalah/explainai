import type { EngineLesson, SceneImage } from "./engineTypes";

function buildEquationSvg(title: string, equation: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 160">
    <rect width="400" height="160" fill="#f8f9fa" rx="12"/>
    <rect x="20" y="20" width="360" height="44" fill="#16213e" rx="8"/>
    <text x="200" y="46" text-anchor="middle" fill="#ffffff" font-family="sans-serif" font-size="18" font-weight="600">${escapeXml(title)}</text>
    <rect x="40" y="80" width="320" height="60" fill="#ffffff" rx="8" stroke="#e94560" stroke-width="2"/>
    <text x="200" y="118" text-anchor="middle" fill="#1a1a2e" font-family="serif" font-size="24" font-weight="500">${escapeXml(equation)}</text>
  </svg>`;
}

function escapeXml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const equationImage: SceneImage = {
  url: `data:image/svg+xml;base64,${btoa(buildEquationSvg("The equation", "3x + 7 = 22"))}`,
  prompt: "Clean educational whiteboard showing equation 3x + 7 = 22",
  alt: "Equation 3x + 7 = 22",
  source: "generated-svg",
  strategy: "whiteboard-only",
};

export const demoLesson: EngineLesson = {
  title: "Solving 3x + 7 = 22",
  objective: "Understand how to isolate a variable in a linear equation.",
  scenes: [
    {
      id: 1,
      title: "The equation",
      duration: 4,
      camera: { zoom: 1, panX: 0, panY: 0 },
      narration: "Let's solve three x plus seven equals twenty two.",
      transcript: "Let's solve 3x + 7 = 22.",
      image: equationImage,
      visualStrategy: "whiteboard-only",
      objects: [
        {
          id: "eq1",
          type: "equation",
          position: { x: 50, y: 45 },
          text: "3x + 7 = 22",
          animation: { type: "write", start: 0, duration: 1 },
        },
      ],
    },
    {
      id: 2,
      title: "Circle the constant",
      duration: 4,
      camera: { zoom: 1.15, panX: -5, panY: -8 },
      narration: "First, we subtract seven from both sides to isolate the term with x.",
      transcript: "Subtract 7 from both sides.",
      visualStrategy: "image-annotation",
      image: equationImage,
      annotations: [
        {
          id: "ann1",
          type: "arrow",
          position: { x: 72, y: 55 },
          targetPosition: { x: 62, y: 42 },
          text: "subtract 7",
          color: "brand",
          animation: { type: "fadeIn", start: 0.8, duration: 0.5 },
        },
      ],
      objects: [
        {
          id: "eq1",
          type: "equation",
          position: { x: 50, y: 40 },
          text: "3x + 7 = 22",
          animation: { type: "fadeIn", start: 0, duration: 0.3 },
        },
        {
          id: "hl1",
          type: "highlightBox",
          position: { x: 63, y: 40 },
          width: 18,
          height: 18,
          color: "brand",
          animation: { type: "circle", start: 0.3, duration: 0.6 },
        },
        {
          id: "note1",
          type: "label",
          position: { x: 82, y: 60 },
          text: "−7 both sides",
          color: "brand",
          animation: { type: "fadeIn", start: 1, duration: 0.4 },
        },
      ],
    },
    {
      id: 3,
      title: "Simplify",
      duration: 4,
      camera: { zoom: 1, panX: 0, panY: 0 },
      narration: "That gives us three x equals fifteen.",
      transcript: "3x = 15.",
      image: equationImage,
      visualStrategy: "whiteboard-only",
      objects: [
        {
          id: "eq2",
          type: "equation",
          position: { x: 50, y: 40 },
          text: "3x = 15",
          animation: { type: "write", start: 0, duration: 1 },
        },
      ],
    },
    {
      id: 4,
      title: "Divide",
      duration: 5,
      camera: { zoom: 1, panX: 0, panY: 0 },
      narration: "Now divide both sides by three, and we get x equals five.",
      transcript: "Divide both sides by 3. x = 5.",
      waitForUser: true,
      image: equationImage,
      visualStrategy: "image-primary",
      annotations: [
        {
          id: "ann2",
          type: "label",
          position: { x: 72, y: 30 },
          text: "÷ 3",
          color: "brand",
          animation: { type: "fadeIn", start: 1.2, duration: 0.4 },
        },
      ],
      objects: [
        {
          id: "eq3",
          type: "equation",
          position: { x: 40, y: 40 },
          text: "x = 5",
          animation: { type: "pulse", start: 0.3, duration: 0.8 },
        },
        {
          id: "box1",
          type: "rectangle",
          position: { x: 40, y: 40 },
          width: 24,
          height: 16,
          color: "brand",
          animation: { type: "draw", start: 0, duration: 0.6 },
        },
      ],
    },
  ],
};
