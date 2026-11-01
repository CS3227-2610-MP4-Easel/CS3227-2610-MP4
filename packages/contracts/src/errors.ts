import { z } from "zod";

export const ErrorCodeSchema = z.enum([
  "BAD_REQUEST", "UNAUTHENTICATED", "USER_NOT_REGISTERED", "FORBIDDEN_ROLE", "NOT_FOUND",
  "VALIDATION_FAILED", "CONFLICT_VERSION", "CONFLICT_STATE", "REGISTRATION_CODE_INVALID",
  "ALREADY_REGISTERED", "RATE_LIMITED", "PAYLOAD_TOO_LARGE", "REQUEST_REFUSED", "AI_BUSY",
  "AI_UNAVAILABLE", "AI_DISABLED", "BLOCKED_INPUT", "ROLE_DENIED", "INTERNAL_ERROR",
]);
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

export const ErrorDetailSchema = z.object({ field: z.string().min(1), message: z.string().min(1) }).strict();
export const ErrorSchema = z.object({
  code: ErrorCodeSchema,
  message: z.string().min(1),
  details: z.array(ErrorDetailSchema).optional(),
  requestId: z.string().uuid(),
}).strict();
export const ErrorEnvelopeSchema = z.object({ error: ErrorSchema }).strict();
export type ErrorEnvelope = z.infer<typeof ErrorEnvelopeSchema>;

export class NotMember extends Error {
  constructor() {
    super("The requested resource was not found.");
    this.name = "NotMember";
  }
}
