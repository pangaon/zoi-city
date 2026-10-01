# Organizer inventory draft recovery

Run `node tests/browser/table-inventory-draft/verify.cjs` from the repository root.

Loads the actual inventory and child identity modules, inventory CSS, Tickets inline styles and shared theme with controlled local RPC responses. No production mutation occurs. Tests 390/1440: setup toggle retains changed price/start; stale preview disappears; identity addition keeps surviving draft rows and leaves new rows unpriced/unselected; invalid incomplete text survives; explicit Reload restores authoritative values; account change clears the draft.

Screenshots: `/tmp/table-inventory-draft-{390,1440}.png`. This tests web UI behavior, not configured event inventory, live reservations or physical devices.
