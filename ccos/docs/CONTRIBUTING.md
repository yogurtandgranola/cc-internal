# Who can edit this, and how

## Give a teammate access (the owner does this, about 3 minutes each)
1. GitHub: open the repository `yogurtandgranola/cc-internal`, then Settings, Collaborators, Add people. Choose the **Write** role. Write can open pull requests and push branches. Only Admin can change settings.
2. Vercel: open team `cc-5748`, then Settings, Members, Invite. Choose **Developer** (can deploy and see logs) or **Member**. Keep **Owner** for the owner only. Billing stays with the owner.
3. Turn on branch protection on `main`: Settings, Branches, require a pull request and a passing CI check before merge. Then no one, including the owner, can break the live site by accident.

Today (2026-11-11) the repository has one collaborator and the Vercel team has one member. Nobody else can edit yet.

## How a teammate makes a change
1. Create a branch from `main`. Do not push to `main`.
2. Make the change inside `ccos/`. Read `ccos/AGENTS.md` first.
3. Run `npm run check` and, for page or permission changes, `npm run test:e2e`.
4. Open a pull request. Vercel builds a preview link for it. CI must pass.
5. Someone else reads it and merges. Merging to `main` updates the live site.

## What never goes into git
Passwords, API keys, tenant data, investor data, real financial figures. Put keys in Vercel Environment Variables.

## Using AI to edit
Any AI tool can work in this repo. Give it `ccos/docs/HANDOFF.md` and `ccos/AGENTS.md`. The rules there apply to people and AI equally.
