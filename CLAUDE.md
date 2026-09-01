# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## PERSISTENT_RULES:

At start read ALL project standards files. This is MANDATORY:

**Core Standards (READ ALWAYS):**
- @docs/standards/GLOBAL-implementation-standard.md
- @docs/standards/testing-standards.md
- @docs/standards/tdd-standard.md
- @docs/standards/git-workflow-standard.md

**Backlog Tasks (ОБЯЗАТЕЛЬНО перед началом работы над задачей):**
- Перед началом работы над любой задачей из `docs/backlog/` — вызвать навык `start-task` или прочитать @docs/standards/backlog-workflow-standard.md
- Следовать чеклисту из стандарта

CRITICAL: After EVERY summarize or compacting conversation, you MUST:
1. Show message " == SUMMARIZE IS COMPLETED =="
2. Reload ALL standards files listed above
3. Focus on development rules, standards, dependency management, and code changes during compact




## Project Overview

Telegram-бот техподдержки для сайта. Пользователь общается с ботом в личных сообщениях, для каждого обращения создаётся топик в супергруппе поддержки. Бот зеркалит переписку между пользователем и сотрудниками.

**Технологии:** Node.js/TypeScript, PostgreSQL, Telegram Bot API

## Commands

```bash
# Запуск тестов (Vitest)
pnpm test                                    # Все тесты
pnpm test src/config                         # Тесты по пути
pnpm run test:watch                          # Watch mode
pnpm run test:coverage                       # С покрытием (>60%)

# Проверки
pnpm run typecheck                           # TypeScript компиляция
pnpm run lint                                # Линтинг
```

## Architecture

### Основные компоненты
- **Bot** — обработка сообщений пользователей в DM
- **Topic Manager** — создание/управление топиками в супергруппе
- **Message Mirror** — двунаправленная пересылка сообщений
- **SLA Engine** — напоминания и эскалация (10мин → 30мин → 2ч)
- **Ticket System** — управление статусами (Новый → В работе → Ждём клиента → Закрыт)

### Database Tables
- `tickets` — тикеты с привязкой к пользователю и топику
- `messages_map` — маппинг сообщений DM ↔ топик для reply
- `support_users` — зарегистрированные сотрудники поддержки

### Ключевые механики
- Payload при входе: base64url(url) + timestamp + HMAC подпись (TTL 24ч)
- Внутренние сообщения (`//` или `#internal`) не пересылаются пользователю
- Reply в топике → reply в DM на соответствующее сообщение

## Development Standards

### TDD Cycle (обязательно)
1. **RED** — тест первым, должен упасть
2. **GREEN** — минимальный код для прохождения
3. **REFACTOR** — улучшение при зелёных тестах

**Критично:** никогда не изменять тесты для устранения ошибок компиляции — изменять код под требования теста.

### Code Quality Metrics
- Cyclomatic Complexity < 10
- Function < 30 строк
- Class < 200 строк
- Parameters < 5
- Nesting < 4 уровней

### Перед завершением задачи
```bash
pnpm run lint && pnpm run typecheck && pnpm test && pnpm run test:coverage
```

## Special Rules

- Качество важнее скорости реализации
- При неуверенности — спрашивать с озвучиванием рекомендаций
- Правило 3-х альтернатив: придумать 3 решения, выбрать простейшее

## Chat Widget

**Версия:** При каждом пуше в `origin/main`, если были изменения в `chat-widget/`, увеличить patch-версию в `chat-widget/package.json`

```json
// chat-widget/package.json
"version": "0.1.x"
```

Это единственное место. Оттуда версия попадает и в подпись собранного файла, и
в `WIDGET_VERSION` внутри кода (`esbuild.config.js` подставляет её при сборке,
`vitest.config.ts` — при прогоне тестов). Правку `WIDGET_VERSION` в
`chat-widget/src/widget.ts` делать не нужно: там она больше не записана строкой.


<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:6cd5cc61 -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/SYNC_CONCEPTS.md for details and anti-patterns.

## Agent Context Profiles

The managed Beads block is task-tracking guidance, not permission to override repository, user, or orchestrator instructions.

- **Conservative (default)**: Use `bd` for task tracking. Do not run git commits, git pushes, or Dolt remote sync unless explicitly asked. At handoff, report changed files, validation, and suggested next commands.
- **Minimal**: Keep tool instruction files as pointers to `bd prime`; use the same conservative git policy unless active instructions say otherwise.
- **Team-maintainer**: Only when the repository explicitly opts in, agents may close beads, run quality gates, commit, and push as part of session close. A current "do not commit" or "do not push" instruction still wins.

## Session Completion

This protocol applies when ending a Beads implementation workflow. It is subordinate to explicit user, repository, and orchestrator instructions.

1. **File issues for remaining work** - Create beads for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **Handle git/sync by active profile**:
   ```bash
   # Conservative/minimal/default: report status and proposed commands; wait for approval.
   git status

   # Team-maintainer opt-in only, unless current instructions forbid it:
   git pull --rebase
   git push
   git status
   ```
5. **Hand off** - Summarize changes, validation, issue status, and any blocked sync/commit/push step

**Critical rules:**
- Explicit user or orchestrator instructions override this Beads block.
- Do not commit or push without clear authority from the active profile or the current user request.
- If a required sync or push is blocked, stop and report the exact command and error.
<!-- END BEADS INTEGRATION -->


---

# Beads Orchestration

# Telegram Support Bot

## Project Overview

<!-- UPDATE: 1-2 sentences describing what this project does -->

## Tech Stack

<!-- Populated by /project-discovery or manually -->

## Your Identity

**You are an orchestrator and co-pilot.**

- **Investigate first** — use Glob, Grep, Read before delegating. Never dispatch without reading the actual source file.
- **Co-pilot** — discuss before acting. Summarize proposed plan. Wait for user confirmation before dispatching.
- **Delegate implementation** — use `Task(subagent_type="general-purpose")` for implementation work. Project conventions from `.claude/rules/` are auto-loaded.

## Workflow

**Beads = single source of truth.** Every task, bug, tech debt, and follow-up goes into beads. Context gets compacted — beads persist. See `.claude/rules/beads-workflow.md` for when/how.

### Standalone (single task)

1. **Investigate** — Read relevant files. Identify specific file:line.
2. **Discuss** — Present findings, propose plan, highlight trade-offs.
3. **User confirms** approach.
4. **Create bead** — `bd create "Task" -d "Details"`
5. **Log investigation** — `bd comments add {ID} "INVESTIGATION: root cause at file:line, fix is..."`
6. **Dispatch** — `Task(subagent_type="general-purpose", prompt="BEAD_ID: {id}\n\n{brief summary}")`

### Epic (cross-domain features)

Use when: multiple files/domains, "first X then Y", DB + API + frontend.

1. `bd create "Feature" -d "..." --type epic` → {EPIC_ID} (full `--type` list: `bd create --help`)
2. Create children with `--parent {EPIC_ID}` and `--deps` for ordering
3. `bd ready` → dispatch ALL unblocked children in parallel
4. Repeat as children complete
5. `bd close {EPIC_ID}` when all merged

### Quick Fix (<10 lines, feature branch only)

1. `git checkout -b quick-fix-description` (must be off main)
2. Investigate, implement, commit immediately
3. **On main:** Hard blocked. Must use bead workflow.

## Investigation Before Delegation

**Lead with evidence, not assumptions.**

- Read the actual code — don't grep for keywords only
- Identify specific file, function, line number
- Understand root cause — don't guess
- Log findings to bead so the implementer has full context

**Hard constraints:**
- Never dispatch without reading the actual source file
- Never create a bead with a vague description
- No guessing at fixes — investigate more or ask

## Bug Fixes & Follow-Up

Closed beads stay closed. For follow-up:

```bash
bd create "Fix: [desc]" -d "Follow-up to {OLD_ID}: [details]"
bd dep relate {NEW_ID} {OLD_ID}
```

## Agents

- code-reviewer — adversarial review with DEMO verification
- merge-supervisor — conflict resolution

## Current State

<!-- Update as project evolves: active work, decisions, known issues -->
