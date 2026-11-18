"""Proposed Clay code node: Expand attendance items.

Insert after Webhook, before the repeating Process attendee function call.
Outputs a list so listMode can run once per Zuddl attendance event.
"""


def as_dict(value):
    return value if isinstance(value, dict) else {}


def as_list(value):
    return value if isinstance(value, list) else []


def text(value):
    if value is None or isinstance(value, bool):
        return ""
    if isinstance(value, (dict, list)):
        return ""
    return str(value).strip()


def wrap_attendance(raw):
    """Normalize one Zuddl attendance object (or flat replay fields) into a stable item."""
    data = as_dict(raw)
    return {
        "event": as_dict(data.get("event")),
        "registration": as_dict(data.get("registration")),
        "action": text(data.get("action")),
        "actionCreatedAt": text(data.get("actionCreatedAt")),
        "actionId": text(data.get("actionId")),
    }


def handler(context):
    body = context.get_input("payload")
    event = as_dict(context.get_input("event"))
    registration = as_dict(context.get_input("registration"))
    action = text(context.get_input("action"))
    action_created = text(context.get_input("actionCreatedAt"))
    action_id = text(context.get_input("actionId"))

    items = []

    if isinstance(body, list):
        for entry in body:
            if isinstance(entry, dict):
                items.append(wrap_attendance(entry))
    elif isinstance(body, dict):
        items.append(wrap_attendance(body))
    elif event or registration or action:
        # Flat replay: fields pinned on the trigger instead of nested under payload.
        items.append(
            wrap_attendance(
                {
                    "event": event,
                    "registration": registration,
                    "action": action,
                    "actionCreatedAt": action_created,
                    "actionId": action_id,
                }
            )
        )

    # Drop empty shells (no registration + no action) so Repeat does not spin on junk.
    items = [
        item
        for item in items
        if item["registration"] or item["action"] or item["event"]
    ]

    return {
        "items": items,
        "item_count": len(items),
    }
