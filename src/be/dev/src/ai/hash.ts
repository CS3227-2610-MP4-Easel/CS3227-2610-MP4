import { createHash } from "node:crypto";
import type { ContextSections } from "@agile/contracts";
import { GUARD_VERSION } from "../gateway-binding.js";
import { STANDUP_PROMPT_VERSION } from "./prompts.js";

export const sha256Hex = (text: string): string => createHash("sha256").update(text).digest("hex");

export const sectionsInputHash = (sections: ContextSections): string => sha256Hex(JSON.stringify(sections.map((s) => [s.name, s.text])));

export const standupInputHash = (date: string, sections: ContextSections, provenance: { section: string; type: string; id: string }[]): string =>
  sha256Hex(JSON.stringify([STANDUP_PROMPT_VERSION, GUARD_VERSION, date, sections.map((s) => [s.name, s.text]), provenance.map((p) => [p.section, p.type, p.id])]));
