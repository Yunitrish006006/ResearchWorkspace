import path from "node:path";
import { spawn } from "node:child_process";
import { workspaceRoot } from "./research-knowledge.mjs";

const VALID_SANDBOX = new Set(["read-only","workspace-write"]);

export function adapterConfiguration(env = process.env) {
  const enabled = env.RESEARCH_AGENT_ADAPTER === "codex";
  const cwd = path.resolve(env.RESEARCH_CODEX_CWD || workspaceRoot);
  const sandbox = VALID_SANDBOX.has(env.RESEARCH_CODEX_SANDBOX) ? env.RESEARCH_CODEX_SANDBOX : "workspace-write";
  const model = env.RESEARCH_CODEX_MODEL || null;
  return Object.freeze({ enabled, adapter:enabled ? "codex" : "disabled", cwd, sandbox, model });
}

export function buildCodexArgs({ prompt, config = adapterConfiguration() }) {
  if (!config.enabled) throw new Error("Codex adapter is not enabled");
  const args = ["exec","--json","--skip-git-repo-check","--sandbox",config.sandbox,"--cd",config.cwd];
  if (config.model) args.push("--model",config.model);
  args.push("-");
  if (args.includes("--full-auto") || args.some((x) => /dangerously|bypass/i.test(x))) {
    throw new Error("Unsafe Codex flag rejected");
  }
  return Object.freeze({ executable:"codex", args, stdin:String(prompt) });
}

export function agentAdapterStatus(env = process.env) {
  const config = adapterConfiguration(env);
  return Object.freeze({
    enabled:config.enabled,
    adapter:config.adapter,
    sandbox:config.sandbox,
    cwdConfigured:Boolean(config.cwd),
    modelConfigured:Boolean(config.model),
    execution:config.enabled ? "opt-in-ready" : "prompt-intake-only"
  });
}

export function runCodexTask({ prompt, onEvent = () => {}, config = adapterConfiguration() }) {
  const command = buildCodexArgs({ prompt, config });
  return new Promise((resolve, reject) => {
    const child = spawn(command.executable, command.args, {
      cwd:config.cwd,
      stdio:["pipe","pipe","pipe"],
      shell:false,
      env:{ ...process.env }
    });
    let stderr = "";
    let buffer = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      buffer += chunk;
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        if (!line.trim()) continue;
        try { onEvent(JSON.parse(line)); } catch { onEvent({ type:"stdout", text:line }); }
      }
    });
    child.stderr.on("data", (chunk) => { stderr += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (buffer.trim()) {
        try { onEvent(JSON.parse(buffer)); } catch { onEvent({ type:"stdout", text:buffer }); }
      }
      if (code === 0) resolve({ code, stderr });
      else reject(new Error(`codex exited with code ${code}: ${stderr.slice(-2000)}`));
    });
    child.stdin.end(command.stdin);
  });
}
