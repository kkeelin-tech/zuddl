# Fix: Zuddl ATTENDED webhooks drop every contact after the first

**Clay workspace:** `495123` (Figma)  
**Workflow:** [`LIVE - Zuddl - Attended Processing`](https://app.clay.com/workspaces/495123/terracotta/tc-workflows/wf_0toevv4PUc8oJqohAQR) (`wf_0toevv4PUc8oJqohAQR`)  
**Status:** Proposal only — **do not publish** until this PR is approved.

## Incident

On `2026-11-18T17:19:21Z`, run `wfr_d3d2016eafe43a57ddda12de45a67092` received a Zuddl webhook whose `payload` was an **array of 10** `ATTENDED` events for webinar *How to design with code in Figma*.

| # | Email | Processed? |
|---|-------|------------|
| 0 | `hi.alvesdasilva@gmail.com` | Yes (stopped as already Attended) |
| 1 | `kurtis@securesave.com` | **Dropped** |
| 2 | `annelismit@pa.gov` | **Dropped** |
| 3–9 | (7 more) | **Dropped** |

`annelismit@pa.gov` (Annelise Smith, Commonwealth of Pennsylvania) never got a Salesforce / Customer.io write from this workflow. Her registration id (`0f05abdc-…`) only appears in that webhook payload.

## Root cause

`Normalize` (`wfn_0toevv6hua9rbDTmt2J`) unwraps only the first array element:

```python
# Live Zuddl posts one object inside payload. The flat replay keeps the fields on top.
if isinstance(body, list) and body and isinstance(body[0], dict) and not event:
    wrapped = body[0]
```

The rest of the graph is built for **one** attendance record. Clay’s old map/reduce nodes are retired; **conditionals cannot use list mode (Repeat)**, so enabling Repeat only on `Normalize` would hand an aggregated list into `Campaign slug?` and break routing.

## Proposed fix

Fan out with a **repeating workflow function call** (Clay list mode / Repeat):

```text
Webhook
  → Expand attendance items   (code: normalize payload → items[])
  → Process attendee          (subworkflow_call, listMode=true over $.items)
       └─ child function = today’s per-person path
          (Campaign slug? → SF member update / create → CIO → terminals)
```

Why a function (not a Repeat chain on the canvas):

- Per Clay workflows skill: conditionals / triggers do not support list mode.
- A repeating `subworkflow_call` runs the full branchy per-person graph once per item, with isolated step traces.
- Prefer `listFailureMode: "ignore_errors"` so one bad email does not block the rest of a batch (attendance writes are independently valuable).

### Expand node behavior

- Accept `payload` as object **or** list (and flat replay fields).
- Output `items`: array of the same shape Normalize currently expects as a single wrapped attendance object (`event`, `registration`, `action`, `actionCreatedAt`, `actionId`).
- Output `item_count` for observability.
- Keep single-object / flat-replay inputs working (`items` length 1).

### Child function

- Build for **one** item (no Repeat inside the function).
- Move the existing nodes from `Campaign slug?` through all terminal “Stop / Done / Customer.io” nodes into the function (or duplicate into a new function workflow and swap the parent edges).
- Map call inputs from the current item via `inputMappingConfig` `item` paths.

### Parent call

```json
{
  "listMode": true,
  "listEntriesRef": {
    "sourceNodeId": "<Expand node id>",
    "path": "$.items"
  },
  "listFailureMode": "ignore_errors"
}
```

### Optional stopgap (not a substitute)

If fan-out cannot ship immediately, update `Normalize` to emit `batch_size` / `dropped_emails` and route `batch_size > 1` to a loud terminal so drops are visible. That still loses attendance — ship fan-out as soon as possible.

## Out of scope (follow-ups)

- Confirm the same `body[0]` pattern on **LIVE - Zuddl - Registration Processing** and sandbox twins; apply the same pattern if they batch.
- Ask Zuddl whether webhooks can be configured to one HTTP request per attendance event (defense in depth, not required if Clay fans out correctly).
- Backfill the nine dropped emails from run `wfr_d3d2016eafe43a57ddda12de45a67092` after the fix is live.

## Test plan

See [TEST_PLAN.md](./TEST_PLAN.md).

## Apply after approval

See [APPLY.md](./APPLY.md). Do **not** run those Clay CLI mutations until this PR is approved.
