# Package runner workflow

Phase 1 was carried out with this orchestration. Each package goes through an implementing agent, then an independent sceptical reviewer that re-runs the gate and a mutation check, then at most two fix-and-review rounds. Packages run strictly in order in one working tree, and the run stops at the first package that doesn't pass.

To use it in a Claude Code session that has the Workflow tool:

1. Copy the script below into a file such as `/tmp/refactor-packages.js`.
2. Run it with `Workflow({ scriptPath: "/tmp/refactor-packages.js", args: { packages: [...], golden_files: [...] } })`.
3. Pass one phase's packages at a time, for example `["P3-10", "P3-11", "P3-12", "P3-13", "P3-14", "P3-15"]`, and pass the golden file list from [HANDOVER.md](HANDOVER.md).
4. Between phases, run the full release gate yourself and look over the diff.

If the Workflow tool isn't available, follow the same loop by hand or with subagents: implement, review independently, then fix.

```js
export const meta = {
  name: 'refactor-packages',
  description: 'Implement refactor packages in order; each is independently reviewed and fixed before the next one starts',
  phases: [
    { title: 'Implement', detail: 'one engineer per package, steps in order' },
    { title: 'Review', detail: 'independent sceptical review + re-run of the gate' },
    { title: 'Fix', detail: 'address review issues, at most two rounds' },
  ],
}

const SNAP = 'bash .claude/handover/snapshot.sh'
const PACKAGES = args.packages
const GOLDEN_FILES = args.golden_files || []
const MAX_FIX_ROUNDS = 2

const COMMON = `You work in the Hawker Balance repository (the current working directory) on the branch refactor/structural-tech-debt. Before you do anything, read .claude/handover/BRIEF.md and .claude/handover/HANDOVER.md in full. The brief is binding and overrides the plan wherever they conflict.
Golden files that must NOT change (they pin pre-refactor behaviour): ${GOLDEN_FILES.join(', ') || '(see HANDOVER.md)'}.
Git rules: never commit, stash, reset, restore, switch, merge, rebase, push or clean. The only checkout allowed is \`git checkout -- public/sw.js\` after a build. git mv, git diff and git status are fine.`

const IMPL_SCHEMA = {
  type: 'object',
  properties: {
    package_id: { type: 'string' },
    steps: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          status: { type: 'string', enum: ['done', 'partial', 'skipped'] },
          summary: { type: 'string' },
          deviations: { type: 'string' },
          verification_run: { type: 'string' },
        },
        required: ['id', 'status', 'summary', 'deviations', 'verification_run'],
      },
    },
    files_changed: { type: 'array', items: { type: 'string' } },
    final_gate: { type: 'string' },
    snapshot_stat: { type: 'string' },
    notes_for_reviewer: { type: 'string' },
  },
  required: ['package_id', 'steps', 'files_changed', 'final_gate', 'snapshot_stat', 'notes_for_reviewer'],
}

const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    package_id: { type: 'string' },
    verdict: { type: 'string', enum: ['pass', 'needs_fixes', 'blocked'] },
    gate: { type: 'string' },
    issues: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          severity: { type: 'string', enum: ['blocker', 'major', 'minor'] },
          step_id: { type: 'string' },
          file: { type: 'string' },
          problem: { type: 'string' },
          required_fix: { type: 'string' },
        },
        required: ['severity', 'step_id', 'file', 'problem', 'required_fix'],
      },
    },
    notes: { type: 'string' },
  },
  required: ['package_id', 'verdict', 'gate', 'issues', 'notes'],
}

const FIX_SCHEMA = {
  type: 'object',
  properties: {
    fixed: { type: 'array', items: { type: 'string' } },
    not_fixed: {
      type: 'array',
      items: {
        type: 'object',
        properties: { issue: { type: 'string' }, reason: { type: 'string' } },
        required: ['issue', 'reason'],
      },
    },
    final_gate: { type: 'string' },
    snapshot_stat: { type: 'string' },
  },
  required: ['fixed', 'not_fixed', 'final_gate', 'snapshot_stat'],
}

function impl_prompt(id) {
  return `${COMMON}

You are the engineer implementing package ${id}: the section "## ${id}" of .claude/handover/PLAN.md. Implement its steps strictly in the order listed.
1. First run: ${SNAP} begin ${id}
2. For each step, implement it as described, subject to the brief. Then run the definition of done (npm run typecheck && npm run lint && npm test) and the step's own verification, including its mutation checks (apply, confirm the failure, revert exactly). Get everything green before moving to the next step.
3. After the last step, run the full definition of done once more. If the package touched app/, package.json, config or SSR-visible output, also run: npm run build && npm run test:ssr && git checkout -- public/sw.js
4. Finally run: ${SNAP} diff ${id} and put its stat in snapshot_stat.
Report honestly. Mark any skipped or partial step and give the reason. Never leave the tree red.`
}

function review_prompt(id, impl, history) {
  const prior = history.length ? `\nPrevious review and fix rounds:\n${JSON.stringify(history)}\nConfirm that every earlier issue is resolved.` : ''
  return `${COMMON}

You are an independent, sceptical reviewer of package ${id} (the "## ${id}" section of .claude/handover/PLAN.md). You did not write this code. Do NOT edit any file. You may run commands, but run git checkout -- public/sw.js after any build.
Implementer's report: ${JSON.stringify(impl)}${prior}
1. Run ${SNAP} diff ${id} and read the patch file it prints. For a large patch, use the stat plus \`git diff -M --color-moved=zebra <base-tree> <current-tree> -- <file>\` so you can tell moved lines from changed ones.
2. Run the gate yourself: npm run typecheck, npm run lint and npm test. Run golden suites with CI=true. If the package touches app/, package.json, config or SSR-visible output, also run npm run build && npm run test:ssr, then git checkout -- public/sw.js.
3. Check each of these:
   (a) every step is implemented as specified, or the deviation is justified;
   (b) behaviour is preserved under the brief's hard constraints: look for logic edits hidden inside moves, a changed iteration or RNG order, a changed spread order in digested state, changed persisted shapes, and changed draw calls, DOM, CSS or copy;
   (c) the golden files are untouched: git diff --stat <base-tree> <current-tree> -- <golden files> must be empty;
   (d) the conventions in the brief are followed: snake_case for new functions and variables, no renames, JSDoc, module names, mirrored tests, no swallowed errors, no lint or type suppressions, no leftovers, nothing that was descoped;
   (e) new tests have teeth: re-run one mutation check from the spec, then revert it exactly;
   (f) there are no unrelated changes.
Verdict: "pass" only if there are no blocker or major issues and no convention violations. Otherwise give "needs_fixes" with a precise required_fix for each issue. Use "blocked" only when a decision from the user is required.`
}

function fix_prompt(id, review) {
  return `${COMMON}

You are fixing the review issues for package ${id} (the "## ${id}" section of .claude/handover/PLAN.md). Review: ${JSON.stringify(review)}
Fix every blocker, major issue and convention violation with the smallest correct change. Never edit goldens to make them pass. Then run the definition of done (npm run typecheck && npm run lint && npm test). If relevant, also run npm run build && npm run test:ssr && git checkout -- public/sw.js. Finish by running ${SNAP} diff ${id}. List anything you could not fix in not_fixed, with the reason.`
}

const results = []
for (const id of PACKAGES) {
  const impl = await agent(impl_prompt(id), { label: `impl:${id}`, phase: 'Implement', schema: IMPL_SCHEMA })
  if (!impl) {
    results.push({ id, passed: false, reason: 'implementer failed' })
    return { results, stopped_at: id }
  }
  const history = []
  let review = await agent(review_prompt(id, impl, history), { label: `review:${id}`, phase: 'Review', schema: REVIEW_SCHEMA, effort: 'high' })
  let round = 0
  while (review && review.verdict === 'needs_fixes' && round < MAX_FIX_ROUNDS) {
    round += 1
    const fix = await agent(fix_prompt(id, review), { label: `fix:${id}#${round}`, phase: 'Fix', schema: FIX_SCHEMA })
    history.push({ round, review, fix })
    review = await agent(review_prompt(id, impl, history), { label: `review:${id}#${round}`, phase: 'Review', schema: REVIEW_SCHEMA, effort: 'high' })
  }
  const passed = Boolean(review) && review.verdict === 'pass'
  results.push({ id, passed, impl, final_review: review, history })
  log(`${id}: ${passed ? 'passed' : 'NOT passed'} after ${round} fix round(s)`)
  if (!passed) return { results, stopped_at: id }
}
return { results, stopped_at: null }
```
