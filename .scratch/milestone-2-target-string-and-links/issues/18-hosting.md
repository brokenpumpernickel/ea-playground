# 18 Publish to GitHub Pages

Status: open
Type: task (needs instructor go-ahead)
Blocked by: 04
Spec: ../spec.md

## What to build

A documented build-and-publish workflow so a copied link opens for anyone: a GitHub Actions workflow that builds the single-file app and publishes it to GitHub Pages, and a short note in the README (how it is published, what URL the links use, that opening from a folder still works and gives links valid on that machine only).

**Publishing is outward-facing.** Add the workflow and push only after the instructor says so explicitly, and confirm the repository, branch and visibility first.

## Done when

- The workflow runs green from a clean checkout and the published page works: a copied link opens in a fresh browser on another network and gives the same run.
- The README note exists and the instructor has approved the publication.

## Comments

## Notes (not started: waiting for the instructor)

This repository has no git remote yet (`git remote -v` is empty; the only branch is `master`, while the brief names `main`). Before I add a workflow or push anything I need: which GitHub repository (new or existing, and under which account or organisation), its visibility (public or private; Pages from a private repository needs a paid plan), and which branch to publish from. The workflow itself is small (install, `npm run check`, `npm run build`, upload `dist/` as the Pages artifact, deploy), and the README note would say that links use the published address while opening `dist/index.html` from a folder still works and gives links valid on that machine only.
