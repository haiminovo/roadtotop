import { NextResponse } from "next/server";
import { logger } from "@/lib/server/logger";

const corsHeaders = {
  "Access-Control-Allow-Credentials": "true",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Access-Control-Allow-Origin": "*",
};

export class ApiError extends Error {
  status: number;
  details?: unknown;

  constructor(message: string, status = 400, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.details = details;
  }
}

export function jsonOk(payload: unknown, status = 200) {
  return NextResponse.json(
    {
      ok: true,
      ...((payload && typeof payload === "object" ? payload : { data: payload }) as object),
    },
    {
      headers: corsHeaders,
      status,
    },
  );
}

export function jsonError(error: unknown) {
  const message = error instanceof Error ? error.message : "服务端处理失败。";
  const status = error instanceof ApiError ? error.status : 500;
  const details = error instanceof ApiError ? error.details : undefined;

  if (status >= 500) {
    logger.error("Game API failed.", {
      message,
      stack: error instanceof Error ? error.stack : undefined,
    });
  }

  return NextResponse.json(
    {
      error: message,
      ok: false,
      ...(details && typeof details === "object" ? details as object : details !== undefined ? { details } : {}),
    },
    {
      headers: corsHeaders,
      status,
    },
  );
}

export async function readJson<T>(request: Request) {
  try {
    return (await request.json()) as T;
  } catch {
    throw new ApiError("请求体不是合法 JSON。", 400);
  }
}

export function getTokenFromRequest(request: Request) {
  const tokenFromHeader = request.headers.get("x-guest-token");

  if (tokenFromHeader?.trim()) {
    return tokenFromHeader.trim();
  }

  const { searchParams } = new URL(request.url);
  const tokenFromQuery = searchParams.get("guestToken");
  return tokenFromQuery?.trim() || null;
}

export function optionsResponse() {
  return new NextResponse(null, {
    headers: corsHeaders,
    status: 204,
  });
}
