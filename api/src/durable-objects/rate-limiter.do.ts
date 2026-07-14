type Counter = { count: number; resetAt: number };

type HitRequest = {
  action: "hit";
  windowSeconds: number;
};

// One instance per user (via idFromName). The Workers runtime serializes
// fetch handlers within an instance, so read-modify-write on state.storage
// is atomic -- no race between concurrent requests.
export class RateLimiterDurableObject implements DurableObject {
  constructor(private state: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    let body: HitRequest;
    try {
      body = (await request.json()) as HitRequest;
    } catch {
      return Response.json({ error: "Invalid JSON" }, { status: 400 });
    }

    if (body.action !== "hit") {
      return Response.json({ error: "Unknown action" }, { status: 400 });
    }

    // The DO is scoped to one user, so the storage key only needs the
    // window length -- no user id prefix.
    const storageKey = `counter:${body.windowSeconds}`;
    const now = Math.floor(Date.now() / 1000);

    const existing = await this.state.storage.get<Counter>(storageKey);
    let counter: Counter;

    if (!existing || existing.resetAt <= now) {
      counter = { count: 1, resetAt: now + body.windowSeconds };
    } else {
      counter = {
        count: existing.count + 1,
        resetAt: existing.resetAt,
      };
    }

    await this.state.storage.put(storageKey, counter);

    return Response.json({ count: counter.count, resetAt: counter.resetAt });
  }
}
