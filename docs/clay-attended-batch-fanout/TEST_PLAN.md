# Test plan

## Local (this PR)

```bash
python3 -m unittest docs/clay-attended-batch-fanout/test_expand_attendance_items.py
```

Covers: batch of N → N items; single object; flat replay; empty shells dropped; emails preserved including `annelismit@pa.gov` in a 10-item fixture shaped like the incident webhook.

## Clay draft (after APPLY, before publish)

1. Replay the incident batch against the **draft** (not `--live`):

   ```bash
   clay workflows runs test wf_0toevv4PUc8oJqohAQR --inputs incident-batch.json
   ```

   Use a redacted copy of the webhook `payload` array from run `wfr_d3d2016eafe43a57ddda12de45a67092` (10 ATTENDED objects). Prefer sandbox Salesforce / CIO flags if the draft still points at prod writes.

2. Confirm Expand reports `item_count: 10`.
3. Confirm the repeating function starts **10** child runs (or 10 entry steps).
4. Spot-check child outcomes for:
   - `hi.alvesdasilva@gmail.com` (already Attended → stop reason `status_already_set` is OK)
   - `annelismit@pa.gov` (must leave Expand and enter Process attendee — not only sit in webhook JSON)
5. Confirm no child still unwraps via silent `body[0]` (multi-item Normalize should error if mis-wired).

## After publish

1. `clay workflows publish wf_0toevv4PUc8oJqohAQR --name "Fan out batched Zuddl ATTENDED payloads"`
2. Wait for a real multi-attendee webhook during a live webinar, or redeliver a known batch.
3. Backfill the nine dropped emails from the incident run once write paths are verified.
