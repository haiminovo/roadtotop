const { spawn, spawnSync } = require("child_process");
const path = require("path");

const DEFAULT_PORT = Number(process.env.WS_PORT || 8080);
const PROJECT_ROOT = process.cwd();
const WS_ENTRY = path.join(PROJECT_ROOT, "server", "websocket.js");
const PORT_RELEASE_TIMEOUT_MS = 5000;
const PORT_RELEASE_POLL_MS = 200;

function sleep(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function runCommand(command, args) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0 && result.status !== 1) {
    throw new Error(result.stderr || `${command} ${args.join(" ")} failed`);
  }

  return result.stdout.trim();
}

function getListeningPids(port) {
  const output = runCommand("lsof", ["-nP", `-tiTCP:${port}`, "-sTCP:LISTEN"]);

  if (!output) {
    return [];
  }

  return output
    .split("\n")
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isInteger(value) && value > 0);
}

function getProcessCommand(pid) {
  return runCommand("ps", ["-p", String(pid), "-o", "command="]);
}

function getProcessCwd(pid) {
  const output = runCommand("lsof", ["-a", "-p", String(pid), "-d", "cwd", "-Fn"]);
  const cwdLine = output
    .split("\n")
    .find((line) => line.startsWith("n"));

  return cwdLine ? cwdLine.slice(1).trim() : "";
}

function isProjectWebSocketProcess(pid) {
  try {
    const command = getProcessCommand(pid);
    const cwd = getProcessCwd(pid);
    const normalizedCommand = command.replaceAll("\\", "/");
    const normalizedCwd = cwd.replaceAll("\\", "/");
    const normalizedRoot = PROJECT_ROOT.replaceAll("\\", "/");

    return normalizedCwd === normalizedRoot
      && normalizedCommand.includes("node")
      && normalizedCommand.includes("server/websocket.js");
  } catch {
    return false;
  }
}

async function waitForPortToRelease(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    if (getListeningPids(port).length === 0) {
      return true;
    }

    await sleep(PORT_RELEASE_POLL_MS);
  }

  return getListeningPids(port).length === 0;
}

async function stopProcess(pid, port) {
  process.kill(pid, "SIGTERM");

  if (await waitForPortToRelease(port, PORT_RELEASE_TIMEOUT_MS)) {
    return;
  }

  process.kill(pid, "SIGKILL");
  await waitForPortToRelease(port, 1000);
}

async function cleanupStaleWebSocketProcess(port) {
  const pids = getListeningPids(port);

  if (pids.length === 0) {
    return;
  }

  const stalePids = pids.filter((pid) => isProjectWebSocketProcess(pid));

  if (stalePids.length === 0) {
    const processDescriptions = pids.map((pid) => {
      try {
        return `${pid}: ${getProcessCommand(pid)}`;
      } catch {
        return String(pid);
      }
    });

    console.warn(`Port ${port} is occupied by another process. Keeping it alive and using auto port fallback.`);
    console.warn(processDescriptions.join("\n"));
    return;
  }

  for (const pid of stalePids) {
    console.warn(`Detected stale project websocket process on port ${port}, stopping PID ${pid} before restart.`);
    await stopProcess(pid, port);
  }
}

async function main() {
  await cleanupStaleWebSocketProcess(DEFAULT_PORT);

  const child = spawn(process.execPath, [WS_ENTRY], {
    env: process.env,
    stdio: "inherit",
  });

  const forwardSignal = (signal) => {
    if (!child.killed) {
      child.kill(signal);
    }
  };

  process.on("SIGINT", () => {
    forwardSignal("SIGINT");
  });

  process.on("SIGTERM", () => {
    forwardSignal("SIGTERM");
  });

  child.on("exit", (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
      return;
    }

    process.exit(code ?? 0);
  });
}

main().catch((error) => {
  console.error("Failed to prepare websocket dev server.");
  console.error(error);
  process.exit(1);
});
