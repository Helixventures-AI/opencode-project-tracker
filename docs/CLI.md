# CLI reference (`pt`)

Install once:

```sh
npm i -g ai-project-tracker
```

or run from source: `node cli/pt.mjs <command>`.

## Commands

| Command | Description |
|---|---|
| `pt init [dir]` | Initialize tracking for a directory (default: current dir) |
| `pt status [dir\|project]` | Show bilingual progress summary (phases, percentages, milestones) |
| `pt note <type> <text> [--phase <p>] [--weight <n>]` | Record a note (see types below) |
| `pt import-git [since]` | Import commits from git history (idempotent) |
| `pt report [dir\|project]` | Regenerate `report.html` + `report.md` |
| `pt open [dir\|project]` | Open the project's dashboard in the browser |
| `pt list` | List all tracked projects from the global registry |

## Examples

```sh
# start tracking the current directory
pt init

# show progress of the current project
pt status

# show progress of another project by name fragment
pt status my-app

# record a successful note (adds +1 verified, no phase score)
pt note success "payment flow works end-to-end"

# record with retroactive scoring (adds 3 points to the deploy phase)
pt note success "staging released manually" --phase deploy --weight 3

# same, alternate flag syntax
pt note success "staging released manually" --phase=deploy --weight=3

# import all past commits of the current repo into the phases
pt import-git

# import only the last two weeks of commits
pt import-git "2 weeks ago"

# regenerate and open the dashboard
pt report
pt open
```

## Note types

`success`, `error`, `warning`, `info`, `suggestion`, `solution`, `recommendation`.

- `success` → +1 verified (⭐), +1 point on the active phase unless `--phase` given
- `error` → +1 failed
- `suggestion` / `solution` / `recommendation` → shown in the 💡 Recommendations section

## Phase keys

`research`, `setup`, `coding`, `testing`, `docs`, `deploy`, `delivery` (or your custom keys from `config.json`).

## Exit codes

`0` on success, `1` on unknown command / invalid arguments / project not found (with the list of tracked projects printed).