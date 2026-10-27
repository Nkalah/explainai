import type { Tool, ToolName, ToolRegistry } from "./types";

/** In-memory registry. New tools are added by calling register() once at
 *  startup (see registerAllTools.ts) — the router itself never changes when
 *  a new tool is added. */
class InMemoryToolRegistry implements ToolRegistry {
  private tools = new Map<ToolName, Tool>();

  register(tool: Tool): void {
    if (this.tools.has(tool.metadata.name)) {
      console.warn(`Tool "${tool.metadata.name}" registered twice — overwriting.`);
    }
    this.tools.set(tool.metadata.name, tool);
  }

  get(name: ToolName): Tool | undefined {
    return this.tools.get(name);
  }

  all(): Tool[] {
    return Array.from(this.tools.values());
  }
}

export const toolRegistry: ToolRegistry = new InMemoryToolRegistry();
