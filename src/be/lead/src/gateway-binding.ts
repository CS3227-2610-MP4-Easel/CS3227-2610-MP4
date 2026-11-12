import type { LlmGateway } from "@agile/contracts";
import type { GatewaySessions, TransactionSessionCloser } from "@agile/llm-gateway";
export type LeadGatewayBinding = { gateway: LlmGateway; sessions: Pick<GatewaySessions, "open" | "close">; sessionCloser?: TransactionSessionCloser };
