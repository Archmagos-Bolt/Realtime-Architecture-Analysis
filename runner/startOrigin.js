import { spawn } from "child_process";

export function startOrigins({ startPort = 3000, count = 1 }) {
  const children = [];

  for (let i = 0; i < count; i += 1) {
    const port = startPort + i;

    const child = spawn(
      process.execPath,
      ["app/server/index.js"],
      {
        stdio: "inherit",
        env: {
          ...process.env,
          PORT: String(port)
        }
      }
    );

    children.push(child);
  }

  return children;
}

export function stopOrigins(children) {
  for (const child of children) {
    try {
      child.kill();
    } catch {}
  }
}