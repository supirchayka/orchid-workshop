export function httpError(status: number, message: string, extra?: unknown): Response {
  const body: Record<string, unknown> = {
    ok: false,
    message,
  };

  if (extra && typeof extra === "object" && !Array.isArray(extra)) {
    Object.assign(body, extra);
  } else if (extra !== undefined) {
    body.extra = extra;
  }

  return Response.json(body, { status });
}

export function toHttpError(error: unknown): Response {
  if (error instanceof Response) return error;
  return httpError(500, "Внутренняя ошибка");
}
