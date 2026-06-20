# Deployment and Git Strategy for a Demo-B Variant

This note captures the recommended approach for keeping the current project in active development while also shipping a lightweight "scheme B" demo version for early user feedback.

## Recommended branch model

- `main`: the primary development line for the full product.
- `demo/b-local-storage-vercel`: a long-lived branch for the scheme B demo.
- `feature/*`: short-lived branches for ordinary product work.
- `demo/*`: optional short-lived branches for demo-specific fixes or experiments.

The key rule is simple: do not develop the demo directly on `main`. Keep the demo isolated so it can move quickly without destabilizing the main product.

## Versioning and release control

- Tag the demo launch state, for example `v0.8.2-demo-b1`.
- Keep the old server-based code available, even if the demo no longer uses it.
- Prefer adding a mode switch over deleting the existing backend path.

This makes rollback easy and avoids turning the demo into a separate, hard-to-maintain codebase.

## What should stay shared

These parts should remain common between the full product and the demo:

- editor UI
- drawing and interaction logic
- selection state
- undo and redo logic
- export formats
- circuit data model

If these stay shared, the demo remains a thin variation instead of a forked product.

## What should be abstracted

These areas should be separated behind a small interface:

- storage
- template loading
- LaTeX preview backend
- file list source

In practice, this means the application should not assume that data comes from a server filesystem. It should be able to read from either:

- server APIs
- browser storage such as IndexedDB
- static files with a manifest

## Storage strategy for scheme B

For a demo that runs on Vercel and keeps data local to the browser:

- use `IndexedDB` for actual work data
- avoid relying on `localStorage` for anything beyond small preferences
- provide export and import as a backup path

`localStorage` is acceptable only for tiny settings, not for the main circuit documents.

## Template strategy for scheme B

The current server code scans the template directory. That approach does not translate cleanly to a static deployment.

Recommended replacement:

- publish templates as static assets
- generate or maintain a template manifest during build time
- fetch template content from static URLs

Do not depend on runtime directory listing in the browser.

## LaTeX preview strategy for scheme B

The QuickLaTeX proxy can be moved into a Vercel serverless function, such as `api/latex.js`.

That part is a good fit for serverless deployment because:

- it is small
- it is stateless
- it does not need persistent storage

## Things future development should avoid

If the project needs to keep the scheme B demo easy to update, avoid new features that depend on:

- direct filesystem access in the browser
- `localhost:3001`
- server-only file listing
- hard-coded dependency on `server.js`
- backend-only storage assumptions

Instead, route new behavior through a storage or data-source abstraction.

## Fast path for switching the demo

The easiest long-term approach is to introduce a small runtime mode, for example:

- `server` mode for the full product
- `local` mode for the Vercel demo

With that in place, switching the demo becomes a configuration change instead of a rewrite.

## Practical recommendation

- Keep `main` as the full product line.
- Maintain the demo in a dedicated branch.
- Share UI and editor logic wherever possible.
- Separate storage, templates, and preview backend behind small interfaces.
- Use `IndexedDB` for demo documents.
- Use static template assets plus a manifest.
- Move QuickLaTeX proxying to a serverless function.

This gives you a low-risk way to test user response without sacrificing the current development path.
