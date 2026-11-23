# WooCommerce Feature Workflow (WLIQ)

A Claude skill for building, debugging and reviewing WooCommerce features end to end at WLIQ:
PHP, hooks, REST API, webhooks, AJAX and frontend. It includes security checks, test cases and AI time logging.

## What it does

The skill walks Claude through six modes:

1. **Breakdown**: turn a task or Orbit ticket into an approach, risks and an estimate before any code is written
2. **Build**: full files with paths, following WooCommerce CRUD/HPOS, nonce, sanitizing and escaping rules
3. **Debug**: a step-by-step checklist (logs, conflicts, caching, script concatenation, common context traps)
4. **Review**: a pass/fail table covering security, WooCommerce and code quality before PR/QA
5. **Tests**: test cases for guest and logged-in users, product types, totals, nonces, mobile and API failures
6. **Handoff**: an Orbit summary plus a time-log row (quoted vs actual AI-assisted hours)

It builds on two existing skills instead of repeating them:

- `wordpress-expert` for WooCommerce, security, coding standards and JS reference code
- `wliq-dev-baseline` for frontend standards and the §17 pre-QA self-check

## Install

In Claude, go to **Settings → Capabilities → Skills**, upload `SKILL.md` (or a zip of this folder), and turn it on.

## Prompt starters

- `Use woocommerce-feature-workflow. Here is the task: <paste>. Site runs WC <ver>, <classic/Blocks> checkout. Give me the breakdown only.`
- `Approach approved. Build it as a site plugin <slug>, prefix <prefix>_. Full files with paths.`
- `Debug mode. Symptom: <…>. Steps: <…>. debug.log says: <paste, secrets removed>.`
- `Review mode. Check this code against the review checklist: <paste>.`
- `Write test cases for: <feature summary>.`
- `Handoff mode. Orbit task <id>, quoted <x> hrs, actual <y> hrs.`

## Ground rules

- Staging only. No production credentials, API keys or customer data in AI tools.
- AI writes the first draft. The developer reviews, tests and owns the final code.

## Status

v1 is part of the WLIQ Pod B AI plan (Dec 31 goal). It will be refined after it's used on real WooCommerce tasks.
