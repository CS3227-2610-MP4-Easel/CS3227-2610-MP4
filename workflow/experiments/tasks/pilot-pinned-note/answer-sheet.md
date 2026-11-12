# Answer sheet for the notes request

Answer only what is covered here. Anything not covered is not decided: the agent must state its own assumption.

- **Who is the PM?** The user whose role is `PM` in the existing users table; there is one PM role, as in the rest of the app.
- **Epic ids:** UUIDs, like every other id in the API.
- **Where does the note appear?** At the top of the epic detail page, above the task list.
- **Authentication:** the existing Firebase session; the API reads the caller and role from the users table as it does for other routes.
- **Note text:** plain text, no formatting, no attachments.
- **Who sees the epic page?** The people who already see it today.
- **Order of the screen work:** the endpoint comes first, then the screen.
