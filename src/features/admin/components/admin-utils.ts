export type RequestErrorPayload = {
  details?: unknown;
  error?: string;
  ok: boolean;
};

export type RequestFailure = Error & {
  details?: unknown;
};

export async function requestJson<T>(input: RequestInfo, init?: RequestInit) {
  const response = await fetch(input, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const payload = await response.json() as T & RequestErrorPayload;

  if (!response.ok || !payload.ok) {
    const requestError = new Error(payload.error ?? "请求失败。") as RequestFailure;

    if (payload.details !== undefined) {
      requestError.details = payload.details;
    }

    throw requestError;
  }

  return payload;
}

export function formatDateTime(value: number | null) {
  if (!value) {
    return "-";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(value);
}
