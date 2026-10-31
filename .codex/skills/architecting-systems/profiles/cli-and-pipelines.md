# Profile: CLI tools, batch jobs and data pipelines

Specialises template sections 6–8 and 13. "Users" are people at a terminal, schedulers, or upstream and downstream systems. The core lessons still apply: field-level contracts, an error mapping, failure workflows and state tables.

## Typical first-round decisions
- Language and runtime, packaging and distribution (single binary, package manager, container)
- Storage: a local file or DB, warehouse or object store; where it lives on each OS
- Core-as-library vs logic living in the CLI layer (matters if a GUI, web dashboard or API may come later)
- Execution model: one-shot command, long-running daemon, scheduled batch, or streaming

## §6 Interface contracts
**CLI commands.** For each command:

| Field | Content |
|---|---|
| Syntax | `tool import <file> --account <name> [--dry-run]` |
| Arguments and flags | type, required, default, allowed values, env var or config fallback |
| Input formats | file formats with exact columns, encoding, date and number formats, header and footer handling |
| Output | the human format (table, colors, TTY detection) **and** a machine format (`--json` / CSV) with field-level schema |
| Side effects | what's written, and where |
| Exit codes | from the §8 mapping |
| Example | an invocation and its output |

**Pipelines.** For each stage: the input dataset and schema, the output dataset and schema, partitioning and keys, and the trigger (schedule, event, upstream completion).

**Config files and plugin or format definitions** are contracts too: give the schema, versioning, and validation errors.

## §8 Errors
- Exit-code scheme: 0 success, a distinct code per class (usage, input validation, partial success, I/O, internal), with stdout for data and stderr for diagnostics
- Mapping: condition → command → exit code → message. Decide what "partial success" means (some rows rejected) and whether it's a failure.

## Failure and re-run behavior (the pipeline version of async)
- **Atomicity:** is each run or file all-or-nothing? What happens on interruption (Ctrl-C, crash, power loss) partway through?
- **Idempotency:** can the same input be re-run safely? What's the dedup key, and what happens to genuinely identical records?
- **Re-processing:** when rules or logic change, how is past data recomputed, and which manual overrides survive?
- **Checkpoints and resume:** for long runs, a watermark or offset, and late or out-of-order data
- **Bad records:** reject the file, skip and report, or quarantine (the pipeline's dead-letter)
- **Concurrency:** two invocations at once (a lock file, DB locking, or "unsupported" *as a decision*)

## Checklist
- [ ] Cross-platform paths, line endings, console encoding and config and data directories, if multi-OS
- [ ] Schema migration for local stores (version table, backup before migrating)
- [ ] Money, units and precision (integer minor units, decimals), if numeric correctness matters
- [ ] Time zone and date parsing are explicit, never guessed
- [ ] Logging and verbosity flags; secrets never echoed
- [ ] Observability for scheduled pipelines: success and failure signals, row counts, alerting

## §13 Consumer integration
For a CLI: the human UX (prompts, confirmation for destructive commands, `--yes`, progress output), plus scripting use (stable machine output, exit codes). For a pipeline: the downstream consumers and the freshness or SLA they rely on.

## Diagrams
A data-flow diagram in place of the request sequence (sources → stages → sinks), a state diagram for record lifecycle (e.g. imported → categorized → manually overridden), and an ERD for any local store.
