import type { FastifyError, FastifyReply, FastifyRequest } from "fastify";
import { ZodError } from "zod";

export interface ApiErrorBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export function apiError(code: string, message: string, details?: unknown): ApiErrorBody {
  return {
    error: {
      code,
      message,
      ...(details === undefined ? {} : { details })
    }
  };
}

export function sendApiError(
  reply: FastifyReply,
  statusCode: number,
  code: string,
  message: string,
  details?: unknown
) {
  return reply.code(statusCode).send(apiError(code, message, details));
}

export function apiErrorHandler(
  error: FastifyError | Error,
  _request: FastifyRequest,
  reply: FastifyReply
) {
  if (error instanceof ZodError) {
    return sendApiError(reply, 400, "validation_failed", "Input validation failed", error.flatten());
  }

  const statusCode =
    "statusCode" in error && typeof error.statusCode === "number" && error.statusCode >= 400
      ? error.statusCode
      : 500;

  if (statusCode >= 500) {
    return sendApiError(reply, statusCode, "internal_error", "Internal Server Error");
  }

  return sendApiError(reply, statusCode, "request_failed", error.message);
}
