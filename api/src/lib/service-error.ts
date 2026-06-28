import type { ContentfulStatusCode } from "hono/utils/http-status"

// Thrown by services to signal an HTTP-meaningful failure. The app's onError
// handler maps these to JSON responses; anything else becomes a 500.
export class ServiceError extends Error {
  constructor(
    message: string,
    public status: ContentfulStatusCode = 500,
  ) {
    super(message)
    this.name = "ServiceError"
  }
}
