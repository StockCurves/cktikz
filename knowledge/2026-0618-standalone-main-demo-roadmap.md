# Main Standalone and Demo Deployment Roadmap

This note captures the working strategy for keeping `main` as the full product line while maintaining a lightweight demo branch that can be updated quickly from `main`.

## Product Lines

- `main`: full product development line, with the long-term target of a standalone desktop app.
- `demo/b-local-storage-vercel`: lightweight demo line for quick user feedback and Vercel-style deployment.
- `feature/*`: short-lived branches for ordinary product work, merged into `main`.
- `demo/*`: short-lived branches for demo-specific hotfixes or deployment experiments.

The key rule: build product features on `main`; keep demo-specific behavior thin and isolated.

## Main Roadmap: Standalone App

`main` should continue toward a full standalone app.

Current foundation:

- `package.json` already has Electron/Forge scripts: `standalone`, `electron`, `package`, and `make`.
- `forge.config.js` already configures Electron Forge packaging.
- `server.js` already provides local filesystem-backed APIs for templates, work files, and QuickLaTeX proxying.

Recommended next steps:

- Keep the server-backed storage path available for the full product.
- Decide whether standalone mode should keep running `server.js` internally or move equivalent filesystem/API behavior into the Electron main process.
- Move standalone user data out of the repo-local `work/` directory and into an app/user-data directory.
- Update app identity in `forge.config.js`; current names still include older naming such as `circutikz-pwa` and `circuitikz designer`.
- Add a repeatable release check for standalone builds: `npm.cmd test`, `npm.cmd run build`, then `npm.cmd run make`.

Main should not depend on Vercel-specific assumptions.

## Demo Roadmap: Fast Sync From Main

The demo should remain a thin deployment variant, not a forked product.

Demo-specific responsibilities:

- Runtime mode selection.
- Browser-local work storage via IndexedDB.
- Static template assets plus a build-time manifest.
- Stateless Vercel-compatible `/api/latex` proxy.

Shared responsibilities that should stay common with `main`:

- Editor UI.
- Drawing and interaction logic.
- Selection state.
- Undo/redo.
- Export formats.
- Circuit data model.
- Parser and builder logic.

The demo should not add direct dependencies on:

- Runtime filesystem access.
- `localhost:3001`.
- Server-only directory listing.
- Hard-coded `server.js` assumptions.

## Sync Workflow

When `main` has changes that should go into the demo:

```powershell
git switch demo/b-local-storage-vercel
git merge main
npm.cmd test
npm.cmd run build
```

If merge conflicts appear near storage/template/preview code:

- Keep the shared editor/UI behavior from `main`.
- Preserve demo's `local` mode behavior for storage and templates.
- Keep server-backed behavior available for `main`.
- Route new storage/template/file-list behavior through service interfaces instead of controllers.

## Current Demo Baseline Work

The current demo branch has in-progress Scheme B implementation work:

- Runtime mode factory.
- `LocalTemplateFileService`.
- IndexedDB `workFiles` store.
- Static template generation script and generated template assets.
- Vercel-compatible `api/latex.js`.
- Tests for local-mode storage and runtime selection.

Before future demo work, review and commit this as the demo baseline.

Suggested commit message:

```text
feat: add local-storage Vercel demo mode
```

## Release Strategy

For demo releases:

- Keep the demo branch long-lived.
- Tag meaningful demo states, for example `v0.8.2-demo-b1`.
- Prefer small demo releases after sync from `main` plus build/test verification.

For main releases:

- Keep semantic product versions in `package.json`.
- Use Electron Forge output as the standalone app artifact.
- Validate the standalone app can read/write user data outside the repo.

## Practical Next Steps

1. Commit the current demo Scheme B implementation as a baseline.
2. Switch back to `main` after the demo baseline is stable.
3. Create a standalone-focused branch from `main`.
4. Clean up Electron app naming and packaging metadata.
5. Define the standalone user-data storage location.
6. Verify `npm.cmd run make` on the target platform.
7. Use the fixed sync workflow whenever demo needs updates from `main`.
