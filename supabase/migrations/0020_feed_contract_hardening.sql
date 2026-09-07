-- Remove the defaulted overload that makes PostgREST unable to route feed_list
-- calls which omit p_scope. The four-argument function is the live client
-- contract used by /community and by the contract suite.

BEGIN;

DROP FUNCTION IF EXISTS public.feed_list(integer, integer, text, uuid, text);

COMMENT ON FUNCTION public.feed_list(integer, integer, text, uuid) IS
  'Canonical public community-feed read contract. Keep this name free of defaulted overloads.';

COMMIT;
