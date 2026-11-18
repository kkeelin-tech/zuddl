# Normalize unwrap patch (inside the per-attendee function)

Replace the live unwrap that always takes `body[0]`:

```python
# Live Zuddl posts one object inside payload. The flat replay keeps the fields on top.
if isinstance(body, list) and body and isinstance(body[0], dict) and not event:
    wrapped = body[0]
    event = as_dict(wrapped.get("event"))
    registration = as_dict(wrapped.get("registration"))
    action = action or text(wrapped.get("action"))
    action_created = action_created or text(wrapped.get("actionCreatedAt"))
    action_id = action_id or text(wrapped.get("actionId"))
```

With:

```python
# Batches are expanded upstream. Refuse silent multi-item drops here.
if isinstance(body, list):
    if len(body) > 1:
        raise ValueError(
            "Normalize received a multi-item payload; Expand + Repeat must "
            "fan this out before Normalize. item_count=%s" % len(body)
        )
    if body and isinstance(body[0], dict) and not event:
        wrapped = body[0]
        event = as_dict(wrapped.get("event"))
        registration = as_dict(wrapped.get("registration"))
        action = action or text(wrapped.get("action"))
        action_created = action_created or text(wrapped.get("actionCreatedAt"))
        action_id = action_id or text(wrapped.get("actionId"))
elif isinstance(body, dict) and not event:
    event = as_dict(body.get("event"))
    registration = as_dict(body.get("registration")) or registration
    action = action or text(body.get("action"))
    action_created = action_created or text(body.get("actionCreatedAt"))
    action_id = action_id or text(body.get("actionId"))
```

Preferred wiring for the child: map Expand item fields (`event`, `registration`, `action`, …) into Normalize via `inputSchema`, so `payload` is unused in the happy path.
