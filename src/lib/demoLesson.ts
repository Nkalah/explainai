import type { EngineLesson } from "./engineTypes";

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
      objects: [
        { id: "eq1", type: "equation", position: { x: 50, y: 40 }, text: "3x + 7 = 22", animation: { type: "write", start: 0, duration: 1 } },
      ],
    },
    {
      id: 2,
      title: "Circle the constant",
      duration: 4,
      camera: { zoom: 1.15, panX: -5, panY: -8 },
      narration: "First, we subtract seven from both sides to isolate the term with x.",
      transcript: "Subtract 7 from both sides.",
      objects: [
        { id: "eq1", type: "equation", position: { x: 50, y: 40 }, text: "3x + 7 = 22", animation: { type: "fadeIn", start: 0, duration: 0.3 } },
        { id: "hl1", type: "highlightBox", position: { x: 63, y: 40 }, width: 18, height: 18, color: "brand", animation: { type: "circle", start: 0.3, duration: 0.6 } },
        { id: "note1", type: "label", position: { x: 82, y: 60 }, text: "−7 both sides", color: "brand", animation: { type: "fadeIn", start: 1, duration: 0.4 } },
      ],
    },
    {
      id: 3,
      title: "Simplify",
      duration: 4,
      camera: { zoom: 1, panX: 0, panY: 0 },
      narration: "That gives us three x equals fifteen.",
      transcript: "3x = 15.",
      objects: [
        { id: "eq2", type: "equation", position: { x: 50, y: 40 }, text: "3x = 15", animation: { type: "write", start: 0, duration: 1 } },
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
      objects: [
        { id: "eq3", type: "equation", position: { x: 40, y: 40 }, text: "x = 5", animation: { type: "pulse", start: 0.3, duration: 0.8 } },
        { id: "box1", type: "rectangle", position: { x: 40, y: 40 }, width: 24, height: 16, color: "brand", animation: { type: "draw", start: 0, duration: 0.6 } },
      ],
    },
  ],
};