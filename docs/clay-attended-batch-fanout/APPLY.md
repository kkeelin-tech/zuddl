# Apply via Clay CLI (only after PR approval)

Workspace must be `495123`. Do **not** publish until draft tests pass.

```bash
clay workspaces switch 495123
clay whoami   # expect workspace.id 495123
```

## 1. Insert Expand after Webhook

```bash
clay workflows nodes insert wf_0toevv4PUc8oJqohAQR --input '{
  "target": { "type": "after-node", "nodeId": "wfn_0toevv5nHpUHQNQY3ZE" },
  "step": { "kind": "utility", "nodeType": "code", "name": "Expand attendance items" }
}'
```

Then set code + inputs from [`expand_attendance_items.py`](./expand_attendance_items.py) (wire `payload` / flat fields from the Webhook node). Record the new node id as `EXPAND_ID`.

## 2. Extract per-attendee function

Preferred approach (ask a Clay admin if publish-as-function tooling differs in this workspace):

1. Group nodes from `Campaign slug?` (`wfn_0toevv7a6f7G4vVp3YU`) through all terminal outcomes.
2. Publish that group as a workflow function that accepts one attendance item’s fields.
3. Apply [`NORMALIZE_PATCH.md`](./NORMALIZE_PATCH.md) inside the function’s Normalize (or map Expand fields so Normalize never sees a list).

If function Repeat is rejected (`Workflow function calls do not support Repeat yet`), stop and reassess — do not publish a half-migrated graph. Fallback is a Repeat chain of code/tool nodes only after conditionals are rewritten; that is a larger change.

## 3. Wire repeating call on the parent

Replace the edge Expand → old `Campaign slug?` with Expand → `Process attendee` (`subworkflow_call`):

```bash
clay workflows nodes update wf_0toevv4PUc8oJqohAQR <CALL_NODE_ID> --input '{
  "listMode": true,
  "listEntriesRef": { "sourceNodeId": "<EXPAND_ID>", "path": "$.items" },
  "listFailureMode": "ignore_errors"
}'
```

Map each function input from the current item (`{ "type": "item", "path": "$.event" }`, etc.).

## 4. Test draft, then publish

Follow [`TEST_PLAN.md`](./TEST_PLAN.md). Publish only after the 10-item fixture fans out:

```bash
clay workflows publish wf_0toevv4PUc8oJqohAQR --name "Fan out batched Zuddl ATTENDED payloads"
```
