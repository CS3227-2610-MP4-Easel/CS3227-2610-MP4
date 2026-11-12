import { getLlmGateway, getSessions } from "@agile/llm-gateway";

/** The only place the runtime touches the gateway package, kept apart from the database imports (W6 source scan, rule 1). */
export const gatewayParts = () => ({ gateway: getLlmGateway(), sessions: getSessions() });
