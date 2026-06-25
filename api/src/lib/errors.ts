import { HTTPException } from 'hono/http-exception'

export function notFound(message = 'Resource not found') {
  return new HTTPException(404, { message })
}

export function badRequest(message = 'Bad request') {
  return new HTTPException(400, { message })
}

export function unauthorized(message = 'Unauthorized') {
  return new HTTPException(401, { message })
}

export function internalServerError(message = 'Internal server error') {
  return new HTTPException(500, { message })
}