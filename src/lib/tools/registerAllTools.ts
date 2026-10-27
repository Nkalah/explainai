import { toolRegistry } from "./registry";
import { trustedSourcesRetriever } from "./implementations/trustedSourcesRetriever";
import { searchEngine } from "./implementations/searchEngine";
import { dateCalculator } from "./implementations/dateCalculator";
import { calculator } from "./implementations/calculator";
import { confidenceEvaluator } from "./implementations/confidenceEvaluator";
import { stubTools } from "./implementations/stubs";

let registered = false;

/** Idempotent registration — safe to call multiple times (e.g. once per
 *  server function invocation) without duplicate warnings. Adding a new real
 *  tool later means: write it in implementations/, import + register it
 *  here. The router (router.ts) never needs to change for this. */
export function registerAllTools() {
  if (registered) return;
  [
    trustedSourcesRetriever,
    searchEngine,
    dateCalculator,
    calculator,
    confidenceEvaluator,
    ...stubTools,
  ].forEach((t) => toolRegistry.register(t));
  registered = true;
}
