# Process-Security Shell Path Classification Design

- **Status:** Draft
- **Format:** v2
- **Risk tier:** High - this changes a security control that authorizes agent shell operations.
- **Workstream:** W~1 (process-security path correction) | **Plan:** not written yet
- **Constraints consulted:** C55, W12 F8, `workflow/agent-permissions.json` default deny and protected paths, AD-32.

## 1. Problem
`scripts/agent-pre-tool-hook.mjs` classifies a shell command's paths before `mediateAgentOperation` applies the agent policy. Its `isExternalPath` ignores an absolute token if neither that path nor its parent exists, to avoid mistaking expressions such as `sed -n '/^model Project {/,/^}/p'` for paths. A nonexistent external destination or source can therefore be classified as repository scope and allowed. Four existing process-security tests reproduce this on Windows when `/tmp` does not exist. An agent can request an operation on an external path before it exists.

The desired behavior is to identify path-bearing arguments by their command role and classify paths independently of existence. Existing allowed repository operations and supported search expressions continue to work; unknown or ambiguous syntax is denied. This does not change the policy's allowed scopes or protected-path review requirements.

## 2. Goals
**Functional**
- F1 External path operands, output flag values and redirect targets are external whether or not the path or its parent exists - Accept: the cases in E1-E4 return `allowed: false`, `reason: "default-deny"` without creating a file.
- F2 Supported literal search and sed expressions are not treated as filesystem paths - Accept: E5 remains allowed under the existing repository policy, while grep/rg expression-file arguments are classified as paths and sed -f is denied (E6).
- F3 Ordinary repository operations and existing policy boundaries remain intact - Accept: E7-E9 preserve allowed repository work and deny unknown, protected, network and secret operations under the existing policy.

**Non-functional**
- N1 Classification is deterministic for a given command and repository root and does not depend on path or parent existence - Accept: E10 yields identical decisions before and after fixture creation.
- N2 Unrecognized or ambiguous syntax fails closed - Accept: E11 is denied and cannot bypass a path check.

## 3. Non-goals
- General-purpose shell parsing, changing supported command families, or relaxing C55's default-deny and protected-file review policy.
- Solving every possible symlink or shell expansion escape; path resolution remains subject to the existing mediation boundary and its limitations.
- Changing agent tool permissions, policy file, production deployment or credentials (AD-32).

## 4. Design
### 4.1 Approach
Keep the existing shell mediation entry point and policy decisions. For supported simple commands, classify filesystem arguments by their role, including positional inputs and destinations, output flag values and redirection targets; treat path-bearing tokens lexically rather than testing filesystem existence. Recognize supported command expression positions separately so a literal search or `sed` expression is not treated as a path. A token whose role cannot be determined by the supported syntax causes a denial, not an inferred repository path. Continue applying the existing deny and review-required policy after classification.

### 4.2 Data model
None: no persisted model, migration or seed changes. Rollback is reverting this code change; existing policy data is unchanged.

### 4.3 Interfaces
| Operation | Caller / role | Inputs (validation, limits) | Outputs | Errors (condition -> type/message) | Notes |
|---|---|---|---|---|---|
| `requestFromToolCall(input, root)` and `mediatePreToolUse(input, policyPath, root)` | Agent pre-tool hook, before shell execution | Existing Bash command and repository root; supported simple command syntax only | Existing operation, scope and policy decision shapes | External path -> `default-deny`; protected repository write -> `review-required`; unknown or ambiguous command -> `default-deny`; invalid hook request -> existing `invalid-request` | Decisions are made before execution; no file is created by classification. Existing non-Bash tool and network/secret handling remains. |

The supported expression forms are deliberately bounded:

- `sed`: support exactly `sed -n SCRIPT FILE...` and `sed -n -e SCRIPT FILE...`, with one script. `SCRIPT` must be a single-line `/START/,/END/p` address range, where START and END are nonempty literal regex text without slash, backslash, semicolon or newline. This includes the existing `'/^model Project {/,/^}/p'` command. No other `sed` program is classified as a read: deny `-f`, `-i`, multiple scripts, escape sequences, commands `r`, `w`, `e`, substitutions including `s///e`, and any script outside this safe subset. Denying `-f` also prevents execution of an uninspected script file.
- `grep`: accept no-argument switches `-n`, `-E`, `-F`, `-i`, `-v`, `-w`, `-x`, including combinations made only from those letters. `rg`: accept `-n`, `-i`, `-v`, `-w`, `-F`, `-x`, including combinations made only from those letters. Both accept multiple `-e PATTERN`, `-ePATTERN`, `-f FILE` and `-fFILE` in order. Every `-f` operand is a file path; every `-e` operand is an expression. Without `-e` or `-f`, the first positional argument is the pattern; with one or more of those switches, every positional argument is an input path. `--` ends option parsing: subsequent tokens are positional, including a leading dash. Missing option values, other options, or combinations that include `e` or `f` among other short switches deny by default. In particular `rg --pre` and `--pre-glob` deny by default. Literal search patterns are data, not shell commands.
- Other command families retain the explicit existing F8 test cases, provided their path roles can be classified without ambiguity. Any option whose value may be a path but whose role is not known denies by default. This does not promise every syntax previously accepted by the heuristic.

For `--output=PATH` and `--output PATH`, and for `>`, `>>`, `2>`, `2>>` and input `<`, the supplied target is a path. Input redirects are reads; output redirects are writes. Existing `/dev/null` handling and descriptor redirects remain unchanged. Unsupported redirection forms including `<<` and `<<<` deny by default. Shell variable, glob or tilde expansion whose result is not a literal known path or expression is denied before execution; command and process substitutions remain denied. Malformed quoting and syntax whose argument roles cannot be determined deny by default.

The repository root supplied to the hook must be the execution working directory for relative shell paths; where that cannot be established the request is `default-deny`. A `cd` segment is denied, whether standalone or combined with other commands, so later segments cannot use a different current directory than the one classified. This intentionally narrows existing heuristic acceptance; the exact F8 commands in E7 do not require `cd`.

On each host, absolute paths, traversal and paths inside the repository use that host's path rules; Windows drive and UNC external paths must not be reinterpreted as repository-relative paths on Windows. Before protected-path policy matching, every repository write target, including absolute and traversal spellings, redirection targets and output flag values, is normalized to a repository-relative forward-slash path. An external target remains external. A path with a symlink component is not guaranteed to resolve to its target by this change.

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
| E3 | F1 | A read command uses external `--output=PATH` or `--output PATH`, with nonexistent parent | `default-deny` | hook |
| E4 | F1 | Redirect targets an external nonexistent file, including `>`, `>>`, `2>` and `2>>` | `default-deny` | hook |
| E5 | F2 | Existing `sed -n '/^model Project {/,/^}/p'` against a repository file; `grep` and `rg` literal slash-prefixed patterns via positional argument and `-e` | allowed when no other policy restriction applies | hook |
| E6 | F2 | `sed -f`, `grep -f` or `rg -f` points to a nonexistent external expression file | `default-deny`; `sed -f` is denied regardless of its file's scope | hook |
| E7 | F3 | Exact allowed repository reads, edits, pipes and git workflows listed in the existing F8 test `pre-tool mediation allows ordinary repository work in the shell` | all those decisions remain allowed | hook |
| E8 | F3 | Write to protected `scripts/**` or a policy control; unknown command, network or secret request | existing `review-required`, `default-deny` or `denied` decision respectively | hook |
| E9 | F3 | Windows absolute drive and UNC paths outside repository, and an absolute path inside repository | external paths `default-deny`; repository path uses existing repository policy | hook on Windows |
| E10 | N1 | The same external operand with neither path nor parent present, then with its parent present | identical `default-deny` decisions | hook |
| E11 | N2 | An unsupported or ambiguous option could carry a path or an expression | `default-deny` | hook |
| E12 | F2, N2 | `sed` scripts with `r`, `w`, `e`, `s///e`, escapes, multiple commands or newlines; `sed -f` with a repository script | `default-deny`; no command executes | hook |
| E13 | F2, N2 | grep/rg `-e` and `-f`, repeated and attached forms; `--` followed by dash-prefixed names; `rg --pre` or mixed short option containing `e`/`f` | patterns and files classified by the specified roles; external files denied; preprocessor and ambiguous mixed options `default-deny` | hook |
| E14 | F1, N2 | External input redirect `<`; heredoc, here-string; unresolved variables, globs, tilde, malformed quotes | external redirect and unsupported expansions/syntax `default-deny` | hook |
| E15 | F3 | Write to `scripts/**` or another protected path via absolute, normalized relative traversal, redirect or output flag spelling | normalized repository-relative target gives `review-required` for each spelling | hook |
| E16 | N2 | `cd .. && cat missing/file`, `cd subdir; echo x > ../../outside`, standalone `cd`, or execution cwd cannot be established as the supplied root | `default-deny`; no segment executes | hook |

**What could corrupt data:** E1, E3 and E4 cover unintended external writes and E8 covers writes to protected controls; classification runs before command execution, so no rollback of a denied operation is needed.

## 6. Security
Principal: the agent invoking the Bash tool. The pre-tool hook classifies the request, and `mediateAgentOperation` applies C55 and `agent-permissions.json`; it is not a replacement for the host filesystem sandbox. There is no tenancy boundary or new log content. Existing secret and network denial rules and protected-path reviewer requirements remain. The hook must not execute the requested command while classifying it.

| Actor and abuse | Mitigation | Coverage |
|---|---|---|
| Agent supplies a nonexistent external read or write target, including a flag or redirect, to evade scope detection | Classify path arguments regardless of existence; external scope defaults to deny | E1-E4, E10 |
| Agent hides a file path as an expression file or ambiguous option | Classify `-f` values as paths; deny ambiguous syntax | E6, E11 |
| Agent targets a protected repository control or bypasses policy with a network/secret command | Preserve existing policy decisions | E8 |
| Agent uses Windows drive or UNC spelling to disguise an external target | Use absolute path handling for the host operating system | E9 |
| Agent embeds a file read, write or command execution in a sed script, or uses a search preprocessor | Allow only the bounded sed form; deny script files and search preprocessors | E12, E13 |
| Agent hides paths through redirection or unexpanded shell syntax, or disguises protected paths with absolute spelling | Classify literal redirections, deny unresolved syntax and normalize repository write targets | E14, E15 |
| Agent changes directory before using a relative path | Deny `cd` and any request with unknown or mismatched execution working directory | E16 |

The hook does not add a file mutation transaction; the denied operation has no side effects. Concurrent changes to the filesystem do not alter lexical classification, but existing symlink and shell-parsing limitations remain outside this change and must not be represented as solved.

## 7. Open questions
| ID | Question | Blocks | Owner |
|---|---|---|---|
| Q1 | How does the hook obtain a trusted shell execution cwd, or what commands should be denied when it cannot? | E7, E16 and approval | Operator |

## 8. Decisions made in this spec
| ID | Decision | Why / rejected alternative | Asked by |
|---|---|---|---|
| SD1 | Separate expression arguments from path-bearing arguments; deny unknown roles. | Existence-based classification fails open; treating every expression as a path breaks ordinary repository inspection. | Operator requested fixing failing process-security tests, 2026-11-11. |

## 9. Review record
Lenses: Implementer, Tester, Maintainer and Attacker (security boundary) | Rounds: 2; sed, search, expansion, redirection, cd and protected-target findings incorporated. Implementer and Maintainer report unresolved trusted-cwd and supported-syntax questions (Q1) | Rejected findings: none.
