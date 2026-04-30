function formatMeta(meta?: unknown) {
  if (!meta) {
    return "";
  }

  if (typeof meta === "string") {
    return ` ${meta}`;
  }

  return ` ${JSON.stringify(meta)}`;
}

function write(level: "INFO" | "WARN" | "ERROR", message: string, meta?: unknown) {
  const line = `[${new Date().toISOString()}] [${level}] ${message}${formatMeta(meta)}`;

  if (level === "ERROR") {
    console.error(line);
    return;
  }

  if (level === "WARN") {
    console.warn(line);
    return;
  }

  console.log(line);
}

export const logger = {
  error(message: string, meta?: unknown) {
    write("ERROR", message, meta);
  },
  info(message: string, meta?: unknown) {
    write("INFO", message, meta);
  },
  warn(message: string, meta?: unknown) {
    write("WARN", message, meta);
  },
};
