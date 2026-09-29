#!/usr/bin/env node
// Bounded production incident operations, authorized through manual dispatch.
// inspect/recover are read-only. restart submits at most ONE restart request.
// Official contract: supabase/supabase apps/docs/spec/api_v1_openapi.json.
const ref = 'csebihpaychdkanjjsmz';
const mode = process.argv[2] || 'inspect';
if (!['inspect', 'restart', 'recover'].includes(mode)) throw new Error('Invalid recovery mode');
const token = process.env.SUPABASE_ACCESS_TOKEN;
if (!token) throw new Error('SUPABASE_ACCESS_TOKEN is required');
if (process.env.GITHUB_ACTIONS) console.log(`::add-mask::${token}`);
const root = `https://api.supabase.com/v1/projects/${ref}`;
async function request(path, body) {
  const started = Date.now();
  try {
    const response = await fetch(root + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      signal: AbortSignal.timeout(25000),
    });
    const text = await response.text();
    console.log(JSON.stringify({path, status:response.status, milliseconds:Date.now()-started}));
    // Do not print uncontrolled API error bodies or credential-bearing content.
    return {ok:response.ok, text:response.ok ? text : '', status:response.status};
  } catch (error) {
    console.log(JSON.stringify({path, error:error.name, milliseconds:Date.now()-started}));
    return {ok:false, text:'', status:null};
  }
}
function json(text) { try { return JSON.parse(text); } catch { return null; } }
async function health() {
  const result=await request('/health?services=auth,db,db_postgres_user,pooler,rest&timeout_ms=5000');
  const rows=json(result.text);
  console.log(JSON.stringify({service_health:Array.isArray(rows)?rows.map(r=>({name:r.name,status:r.status})):null}));
  return result;
}
await health();
const metrics=await request('/analytics/endpoints/metrics');
if (metrics.ok) {
  // Exclude query-level series and labels that may contain application content.
  const allowed=/^(?:node_(?:memory_|cpu_seconds_total|load[0-9]|disk_(?:io_time_seconds_total|read_bytes_total|written_bytes_total)|filesystem_(?:avail_bytes|size_bytes))|pg_(?:stat_activity_count|settings_max_connections|database_size_bytes|stat_database_(?:numbackends|deadlocks|temp_bytes|blks_read|blks_hit)))/;
  const selected=metrics.text.split('\n').filter(line=>allowed.test(line)&&!/(?:query|statement|token|password|secret)=/.test(line));
  console.log('# Resource metric sample; cumulative CPU/I/O counters are not utilization rates');
  console.log(selected.join('\n'));
  console.log(JSON.stringify({selected_series:selected.length}));
}
if (mode==='restart') {
  // This response can be ambiguous on timeout. Never automatically retry it.
  const result=await request('/restart', {});
  if (!result.ok) {
    console.error('Restart was not confirmed. Check control-plane status before any further action. No retry attempted.');
    process.exitCode=1;
  } else {
    console.log('One restart request accepted. Run recover separately after the service has restarted.');
  }
} else {
  const query = `select jsonb_build_object(
    'checked_at',now(),
    'connections',(select jsonb_agg(x) from (select usename,state,wait_event_type,wait_event,count(*) as connections from pg_stat_activity where datname=current_database() group by usename,state,wait_event_type,wait_event) x),
    'active',(select jsonb_agg(x) from (select pid,usename,state,wait_event_type,wait_event,extract(epoch from now()-query_start)::int as seconds,pg_blocking_pids(pid) as blockers,case when query ilike '%run_maintenance%' then 'maintenance' when query ilike '%enrich_%' then 'enrichment' when query ilike '%seo_entity%' then 'entity' when query ilike '%explore_%' then 'explore' else 'other' end as kind from pg_stat_activity where datname=current_database() and state <> 'idle' and pid<>pg_backend_pid() order by query_start limit 25) x),
    'cron',(select jsonb_agg(x) from (select jobid,jobname,schedule,active,case when command ilike '%run_maintenance%' then 'maintenance' when command ilike '%zoi-enrich%' then 'enrichment' when command ilike '%social-publish%' then 'social-publish' else 'other' end as kind from cron.job order by jobid) x),
    'listings',(select jsonb_agg(x) from (select n_live_tup,n_dead_tup,n_tup_upd,n_tup_hot_upd,last_autovacuum,last_autoanalyze,pg_total_relation_size(relid) as total_bytes from pg_stat_user_tables where schemaname='zoi' and relname='listings') x)
  ) as diagnostics;`;
  const result=await request('/database/query',{query,read_only:true});
  const parsed=json(result.text);
  if(result.ok&&Array.isArray(parsed)) console.log(JSON.stringify({database_diagnostics:parsed}));
  else {console.error('Database diagnostic query did not complete successfully.');process.exitCode=1;}
}
