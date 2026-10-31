# Lesson File Template

Permanent `workflow/project-state/lessons/L<n>.md`, created at fold (a branch holds `L~n` blocks in
its `## Lessons` section; `ws lesson new` writes them). Loaded by `ws pack <role>` when scope is
`role:<role>` or `project`. A repeated or broadly useful lesson graduates into `conventions/` (project)
or the role's file (agent behaviour) and is marked `graduated`.

```markdown
# L<n> — <short title>

- **Date:** YYYY-MM-DD
- **Cause:** misread spec | stale assumption | skipped check | tool misuse
- **Rule:** <one line, imperative, preventing the repeat>
- **Scope:** project | role:<name>
- **Found by:** operator | reviewer | self
```
