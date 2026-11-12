# Process-Security Shell Path Classification Design

- **Status:** Approved (operator, 2026-11-11)
- **Format:** v2
- **Risk tier:** High - this changes a security control that authorizes agent shell operations.
- **Workstream:** W~1 (process-security path correction) | **Plan:** not written yet
- **Constraints consulted:** C55, W12 F8, `workflow/agent-permissions.json` default deny and protected paths, AD-32.

## 1. Problem
`scripts/agent-pre-tool-hook.mjs` classifies a shell command's paths before `mediateAgentOperation` applies the agent policy. Its `isExternalPath` ignores an absolute token if neither that path nor its parent exists, to avoid mistaking expressions such as `sed -n '/^model Project {/,/^}/p'` for paths. A nonexistent external destination or source can therefore be classified as repository scope and allowed. Four existing process-security tests reproduce this on Windows when `/tmp` does not exist. An agent can request an operation on an external path before it exists.

The desired behavior is to identify path-bearing arguments by their command role and classify paths independently of existence. Existing allowed repository operations and supported search expressions continue to work; this change does not claim to recognize or deny every ambiguous shell form. This does not change the policy's allowed scopes or protected-path review requirements.

## 2. Goals
**Functional**
- F1 The literal external absolute path operands, `--output=PATH` values and `>` or `>>` redirect targets covered by E1-E4 and E6 are external whether or not the path or its parent exists - Accept: those cases return `allowed: false`, `reason: "default-deny"` without creating a file.
- F2 Supported literal search and sed expressions are not treated as filesystem paths - Accept: E5 remains allowed under the existing repository policy, while separated sed/grep/rg expression-file arguments are classified as paths (E6).
- F3 The specified existing ordinary repository operations and root-relative F8 policy checks remain intact - Accept: E7-E9 preserve allowed repository work and deny unknown, protected, network and secret operations under the existing policy.

**Non-functional**
- N1 Classification of the literal path forms covered by E1-E6 is deterministic for a given command and repository root and does not depend on path or parent existence - Accept: E10 yields identical decisions before and after fixture creation.
- N2 The explicitly supported literal expression forms remain distinguishable from the external absolute paths in E1-E6 - Accept: E5 remains allowed and E6 is denied.

## 3. Non-goals
- General-purpose shell parsing, changing supported command families, or relaxing C55's default-deny and protected-file review policy.
- Solving symlink, shell expansion, command-script, protected-target normalization or working-directory escapes; the existing mediation boundary and its limitations remain. In particular, the hook resolves relative paths against its repository root even after a shell `cd` or when the execution working directory differs, which may misclassify subsequent relative paths. Record this as a Known Gap for follow-up.
- Changing agent tool permissions, policy file, production deployment or credentials (AD-32).

## 4. Design
### 4.1 Approach
Keep the existing shell mediation entry point and policy decisions. For supported simple commands, classify filesystem arguments by their role, including positional inputs and destinations, output flag values and redirection targets; treat path-bearing tokens lexically rather than testing filesystem existence. Recognize supported command expression positions separately so a literal search or `sed` expression is not treated as a path. Distinguish only the literal expression forms stated below from path operands; behavior for unrelated shell syntax stays as it is. Continue applying the existing deny and review-required policy after classification.

### 4.2 Data model
None: no persisted model, migration or seed changes. Rollback is reverting this code change; existing policy data is unchanged.

### 4.3 Interfaces
| Operation | Caller / role | Inputs (validation, limits) | Outputs | Errors (condition -> type/message) | Notes |
|---|---|---|---|---|---|
| `requestFromToolCall(input, root)` and `mediatePreToolUse(input, policyPath, root)` | Agent pre-tool hook, before shell execution | Existing Bash command and repository root; supported simple command syntax only | Existing operation, scope and policy decision shapes | External path -> `default-deny`; protected repository write -> `review-required`; existing unknown command -> `default-deny`; invalid hook request -> existing `invalid-request` | Decisions are made before execution; no file is created by classification. Existing non-Bash tool and network/secret handling remains. |

The supported expression forms for this change are:

- `sed`: recognize the existing inline single-line address-range form `sed -n '/START/,/END/p' FILE...` as an expression. START and END are nonempty text without slash, backslash, semicolon or newline; the existing `'/^model Project {/,/^}/p'` is included. Do not classify an external absolute operand following the expression as an expression. `sed -f FILE` names a file, including when FILE does not exist.
- `grep` and `rg`: when no separated `-e PATTERN` or `-f FILE` occurs, recognize the first positional operand as the search pattern and remaining positional operands as paths. If one or more separated `-e` or `-f` occurs, every positional operand is a file path; each `-e` consumes its following argument as a pattern and each `-f` consumes its following argument as a path. Repeated separated `-e` and `-f` flags are supported. Existing `grep -n` and `grep -E` F8 examples stay allowed. Unsupported option forms retain existing behavior; they are not certified safe by this change.
- Filesystem operands, `--output=PATH`, and literal `>` and `>>` targets in the existing F8 failure cases are paths. Classify an absolute path outside the repository as external whether or not it and its parent exist, using the host's path rules. On Windows, drive and UNC external absolute paths must not be treated as repository-relative.

The existing policy still decides whether repository operations are allowed or require review. Other shell parsing behavior, including `cd`, input redirects, expansions, sed script semantics and normalization of absolute protected output targets, is unchanged. The existing root-relative F8 protected-path cases and exact F8 ordinary-work examples remain unchanged; no guarantee is made for all forms of shell syntax or for path resolution through symlinks.

### 4.4 UI
None: no user interface changes.

### 4.5 Conventions
C55 keeps ordinary repository work available while policy, hook and other process-control paths remain review-required. No new dependency or permission is introduced.

### 4.6 Sequencing constraints
Run regression and adversarial tests before modifying the hook. Changes to `scripts/**` require the existing security review before merge. Do not change the protected policy files to make tests pass.

## 5. Edge cases
| ID | Req | Scenario | Expected behaviour (exact) | Test layer |
|---|---|---|---|---|
| E1 | F1 | `mv` or `mkdir -p` targets a nonexistent external absolute path whose parent does not exist | `default-deny`; no command executes | hook |
| E2 | F1 | `cat` or `find` reads a nonexistent external absolute path | `default-deny` | hook |
| E3 | F1 | A read command uses external `--output=PATH`, with nonexistent parent | `default-deny` | hook |
| E4 | F1 | Literal `>` or `>>` redirect targets an external nonexistent absolute file | `default-deny` | hook |
| E5 | F2, N2 | Existing `sed -n '/^model Project {/,/^}/p'` against a repository file; `grep` and `rg` literal slash-prefixed patterns via positional argument and `-e` | allowed when no other policy restriction applies | hook |
| E6 | F2, N2 | Separated `sed -f FILE`, `grep -f FILE` or `rg -f FILE` points to a nonexistent external absolute expression file | `default-deny` | hook |
| E7 | F3 | Exact allowed repository reads, edits, pipes and git workflows listed in the existing F8 test `pre-tool mediation allows ordinary repository work in the shell` | all those decisions remain allowed | hook |
| E8 | F3 | Existing F8 root-relative write cases targeting `scripts/**` or a policy control; existing F8 unknown command, network or secret requests | existing `review-required`, `default-deny` or `denied` decision respectively | hook |
| E9 | F3 | Windows absolute drive and UNC paths outside repository, and an absolute path inside repository | external paths `default-deny`; repository path uses existing repository policy | hook on Windows |
| E10 | N1 | The same external operand with neither path nor parent present, then with its parent present | identical `default-deny` decisions | hook |
| E11 | F1, F2 | `rg -e pattern /external/missing`, `rg -f repo-patterns /external/missing`, and repeated separated `-e` / `-f` flags with an external absolute file operand | external file operand is a path and yields `default-deny`, even when its parent does not exist | hook |


**What could corrupt data:** E1, E3 and E4 cover unintended external writes and E8 covers writes to protected controls; classification runs before command execution, so no rollback of a denied operation is needed.

## 6. Security
Principal: the agent invoking the Bash tool. The pre-tool hook classifies the request, and `mediateAgentOperation` applies C55 and `agent-permissions.json`; it is not a replacement for the host filesystem sandbox. There is no tenancy boundary or new log content. Existing secret and network denial rules and protected-path reviewer requirements remain. The hook must not execute the requested command while classifying it.

| Actor and abuse | Mitigation | Coverage |
|---|---|---|
| Agent supplies a nonexistent external read or write target, including a flag or redirect, to evade scope detection | Classify path arguments regardless of existence; external scope defaults to deny | E1-E4, E10 |
| Agent uses a separated expression-file argument to read an external absolute file that does not exist | Classify separated `-f` values as paths | E6 |
| Agent uses the existing root-relative F8 cases to target a protected control or request network/secret access | Preserve existing policy decisions | E8 |
| Agent uses Windows drive or UNC spelling to disguise an external target | Use absolute path handling for the host operating system | E9 |


The hook does not add a file mutation transaction; the denied operation has no side effects. For the covered literal absolute paths, the existence of the path or parent does not affect classification. Existing symlink, cwd, shell-expansion, command-script and protected-target normalization limitations remain outside this change and must not be represented as solved.

## 7. Open questions
| ID | Question | Blocks | Owner |
|---|---|---|---|

## 8. Decisions made in this spec
| ID | Decision | Why / rejected alternative | Asked by |
|---|---|---|---|
| SD1 | Separate the specified literal expressions from absolute path operands. | Existence-based classification fails open; treating every expression as a path breaks ordinary repository inspection. | Operator requested fixing failing process-security tests, 2026-11-11. |
| SD2 | Defer the additional `cd` and execution-cwd mismatch issue as a Known Gap. | The operator directed that the cwd issue be logged separately and the requested fixes continue. | Operator, 2026-11-11. |

## 9. Review record
Lenses: Implementer, Tester, Maintainer and Attacker (security boundary) | Rounds: 2; reviewers identified broader shell parsing, protected-target normalization and cwd risks. Operator narrowed the scope and directed the cwd issue be logged as a Known Gap; narrowed scope re-reviewed by all four lenses, findings resolved | Rejected findings: broader shell parsing and protected-target normalization deferred as outside this correction, not claimed resolved.
