# Bounded public RPC check after role rollback

Exactly three independent anonymous HTTP reads were submitted after the lead confirmed the role timeout rollback (anon3s, authenticated8s, authenticator8s). No SQL, database write, DDL, configuration mutation or NOTIFY was issued. No retry or fourth request was made.

The calls used the same publishable-key/auth-header construction as the existing public zoi-core client. explore_countries started09:06:38.163Z and ended09:06:50.165Z at12002ms. explore_search (SIGNAT, limit3) started09:06:38.192Z and ended09:06:50.192Z at12000ms. explore_fresh (limit3) started09:06:38.193Z and ended09:06:50.193Z at12000ms.

Every call reached the probe's12s client deadline with no response status, body, headers or API code. These are client-deadline observations, not observed PostgreSQL57014 or PostgRESTPGRST002/PGRST003 errors. The matrix therefore does not establish schema-cache recovery, query performance or production public API health. The gateway/connection/server cause remains unknown from this bounded probe. Earlier known server failures remain separate incident evidence.

Request arguments, timestamps and safe classifications are retained in report.json. The script extracts the existing client key in memory and does not log or retain key/token values. Error-code/body classifications would have distinguished known cache, pool, statement and connection errors if a response had arrived; none did. This is one-off diagnostic evidence, not a new production timeout or retry policy.
