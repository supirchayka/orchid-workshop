export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new ApiError(payload?.message ?? "Ошибка запроса", response.status);
  }

  return (await response.json()) as T;
}

export function apiGet<T>(url: string): Promise<T> {
  return request<T>(url, { method: "GET" });
}

export function apiPost<T>(url: string, body?: unknown): Promise<T> {
  return request<T>(url, {
    method: "POST",
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

export function apiPatch<T>(url: string, body?: unknown): Promise<T> {
  return request<T>(url, {
    method: "PATCH",
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
}

export function apiDelete<T>(url: string): Promise<T> {
  return request<T>(url, { method: "DELETE" });
}
