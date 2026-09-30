# Private business enquiries

All RPCs return JSON `{ok:true,...}`; any SQL/API error is a failed operation. All except `inquiry_availability` require authenticated user JWT. Native/web use the same contracts. No email notifications, push notifications, attachments or realtime subscription are implemented.

- `inquiry_availability(p_listing uuid)` → `{ok,available,name?}`. Anonymous safe; requires published listing, correct owning workspace and explicitly enabled settings. Customer route `/inquiries/?listing=UUID`.
- `inquiry_settings_save(p_workspace uuid,p_listing uuid,p_enabled boolean,p_expected_version integer)` → `{ok,settings}`. Owner/admin only. New row expected version0; NULL rejected. Settings `{listing_id,workspace_id,enabled,version,updated_at}`.
- `inquiry_start(p_listing uuid,p_subject text,p_body text,p_request uuid)` → `{ok,thread}`. Subject1..120 and body1..4000 trimmed characters. Stable UUID retries return exact existing thread; changed payload rejects. Limit10 new threads/customer/rolling24h.
- `inquiry_reply(p_thread uuid,p_body text,p_request uuid)` → `{ok,message,thread}`. Stable UUID retries never create duplicate message. Body1..4000 chars. Limit10 messages/minute,100/day perauthor. Customer reply reopens thread; business reply sets waiting. Both transitions audited.
- `inquiry_thread(p_thread uuid,p_before uuid=null)` → `{ok,thread,messages,audit,operator,can_reply,older_cursor}`. Latest100 messages sorted oldest→newest; request older_cursor as p_before and prepend returned messages. Latest100 audit rows only for operators; empty array for customer. Ownership transfer/unpublication makes existing thread read-only, preserves old workspace access, never grants new workspace access to old messages.
- `inquiry_mine(p_offset integer=0)` → `{ok,threads,next_offset}`. Customer-owned threads50/page; next_offset null at end. Each includes listing_name.
- `inquiry_inbox(p_workspace uuid,p_status text=null,p_offset integer=0)` → `{ok,role,threads,listings,members,next_offset}`. Owner/admin/editor only; viewers/staff denied. Status filter null/open/waiting/resolved. Listing rows `{id,name,enabled,version}`; member rows `{profile_id,display_name,role}`.
- `inquiry_update(p_workspace uuid,p_thread uuid,p_expected_version integer,p_status text,p_assignee uuid|null)` → `{ok,thread}`. Owner/admin/editor; optimistic version required; assignee must be current owner/admin/editor in same workspace. Full before/after audit records actor/time.

Thread: `{id,listing_id,workspace_id,customer_id,request_id,subject,initial_body,status,assignee_id,version,created_at,updated_at}`. Message: `{id,thread_id,author_id,author_side:'customer'|'business',request_id,body,created_at}`. Audit: `{id,thread_id,actor_id,action,before_state,after_state,created_at}`.

Refresh reads must never send a message. No automatic send retries; retain request UUID for explicit retry of unchanged content. List refresh is explicit to avoid losing drafts. Query-string `thread=UUID` opens authenticated own/operator thread. Assignment alone does not grant access.
