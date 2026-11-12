# Source of this plugin copy

An unmodified copy of the `superpowers` plugin, used by the `superpowers` experiment arm. Never edit it:
its contents feed the arm's approval hash, so an edit invalidates the approval and changes results.

- **Origin:** https://github.com/obra/superpowers (marketplace `superpowers-dev`)
- **Version:** 5.1.0, git commit `f2cbfbefebbfef77321e4c9abc9e949826bea9d7`
- **Copied:** 2026-11-03 from the installed plugin cache (`~/.claude/plugins/cache/superpowers-dev/superpowers/5.1.0`)
- **Licence:** MIT, see `LICENSE` in this folder
- **Left out:** the transient `.in_use` marker directory of the plugin cache. Nothing else was changed.
- **Line endings:** the plugin's own `.gitattributes` fixes LF for scripts, markdown and JSON; other files follow the repository's
  settings, so a checkout with `core.autocrlf=true` may change their bytes and with them the approval hash. Re-approve if so.
