// The API answers failures with { error: string }, so surface that message so
// callers can render it, and fall back to the status when the body isn't JSON.
export async function assertOk(res: Response) {
  if (res.ok) return;

  const body = (await res.json().catch(() => null)) as {
    error?: string;
  } | null;

  throw new Error(body?.error ?? `Request failed (${res.status})`);
}
