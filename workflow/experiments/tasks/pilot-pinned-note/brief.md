# Request: notes on an epic

As the PM, I want to add a free-text note to an epic so that the whole team sees context when they open it.

What I have in mind:

- On the epic page the PM can write notes. The recent notes are shown first, and one of them can be marked as the pinned note,
  which stays at the top of the epic page.
- Only the PM can edit a note. Later in the sprint we will also want the team to help, so every project member can edit notes they can see.
- Keep it light: a short note is enough, we do not want essays.
- Add the endpoint under `apps/api` and the screen under `apps/web`.
- Notes are visible to a member of any project, so that people moving between projects keep their context.

Please produce a design spec and an implementation plan that the team can build from.
