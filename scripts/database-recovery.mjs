#!/usr/bin/env node
// Bounded production incident operations, authorized through manual dispatch.
// inspect/recover are read-only. restart submits at most ONE restart request.
// Official contract: supabase/supabase apps/docs/spec/api_v1_openapi.json.
const ref = 'csebihpaychdkanjjsmz';
let mode = process.argv[2] || 'inspect';
if (mode === 'request') {
  const { readFileSync } = await import('node:fs');
  const request = JSON.parse(readFileSync('ops/database-recovery-request.json', 'utf8'));
  const expires = Date.parse(request.expires_at);
  if (!Number.isFinite(expires) || expires < Date.now() || expires > Date.now() + 3600000) throw new Error('Recovery request is expired or outside its one-hour execution window');
  if (process.env.GITHUB_RUN_ATTEMPT && process.env.GITHUB_RUN_ATTEMPT !== '1') throw new Error('Committed recovery requests cannot be automatically replayed');
  mode = request.action;
}
if (!['inspect', 'resources', 'restart', 'recover', 'review'].includes(mode)) throw new Error('Invalid recovery mode');
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
    // Only a short machine error code may leave an unsuccessful response.
    if (!response.ok) {
      const parsed = json(text);
      const code = parsed?.code ?? parsed?.error_code;
      if (typeof code === 'string' && /^[A-Z][A-Z0-9_]{0,63}$/.test(code)) console.log(JSON.stringify({path, error_code: code}));
    }
    // Do not print uncontrolled API error bodies or credential-bearing content.
    return {ok:response.ok, text:response.ok ? text : '', status:response.status};
  } catch (error) {
    console.log(JSON.stringify({path, error:error.name, milliseconds:Date.now()-started}));
    return {ok:false, text:'', status:null};
  }
}
function json(text) { try { return JSON.parse(text); } catch { return null; } }
async function health() {
  // The Management API documents repeated services parameters as its array encoding.
  // All values are documented enums; a 400 alone does not establish an unhealthy service.
  const params = new URLSearchParams();
  if (mode === 'resources') params.set('services', 'db,auth,rest');
  else for (const service of ['db', 'auth', 'rest']) params.append('services', service);
  params.set('timeout_ms', '5000');
  const result=await request('/health?' + params.toString());
  const rows=json(result.text);
  const required = ['db', 'auth', 'rest'];
  const statuses = ['COMING_UP', 'ACTIVE_HEALTHY', 'UNHEALTHY'];
  const complete = Array.isArray(rows) && required.every(name => rows.filter(r => r?.name === name).length === 1 && rows.find(r => r?.name === name)?.status === 'ACTIVE_HEALTHY');
  console.log(JSON.stringify({service_health:Array.isArray(rows)?rows.filter(r=>required.includes(r?.name)).map(r=>({name:r.name,status:statuses.includes(r.status)?r.status:'INVALID'})):null, health_complete:complete}));
  return {...result, ok:result.ok && complete};
}
const healthResult = await health();
if (!healthResult.ok) process.exitCode = 1;
const metrics=await request('/analytics/endpoints/metrics');
if (!metrics.ok) process.exitCode = 1;
if (metrics.ok) {
  // Exclude query-level series and labels that may contain application content.
  const allowed=/^(?:node_(?:memory_|cpu_seconds_total|load[0-9]|disk_(?:io_time_seconds_total|read_bytes_total|written_bytes_total)|filesystem_(?:avail_bytes|size_bytes))|pg_(?:stat_activity_count|settings_max_connections|database_size_bytes|stat_database_(?:numbackends|deadlocks|temp_bytes|blks_read|blks_hit)))/;
  const selected=metrics.text.split('\n').filter(line=>allowed.test(line)&&!/(?:query|statement|token|password|secret)=/.test(line));
  // Require an actual finite numeric sample, not comments, HTML, or a metric name alone.
  const valid = selected.filter(line => {
    const match = line.match(/^[a-zA-Z_:][a-zA-Z0-9_:]*(?:\{[^\r\n]*\})?\s+([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)(?:\s+\d+)?\s*$/);
    return match && Number.isFinite(Number(match[1]));
  });
  console.log('# Resource metric sample; cumulative CPU/I/O counters are not utilization rates');
  // Labels can contain arbitrary application content even on resource series.
  // Emit numeric observations without any provider-controlled label values.
  const samples = valid.map(line => ({metric:line.match(/^[a-zA-Z_:][a-zA-Z0-9_:]*/)[0],value:Number(line.match(/^[a-zA-Z_:][a-zA-Z0-9_:]*(?:\{[^\r\n]*\})?\s+([+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?)/)[1])}));
  console.log(JSON.stringify({resource_samples:samples}));
  console.log(JSON.stringify({selected_series:valid.length}));
  if (!valid.length) {console.error('Resource metrics contain no usable resource samples.');process.exitCode=1;}
}
if (mode==='resources') {
  // Alternative documented health encoding and disk control-plane reads only.
  // No SQL query, restart, resizing, configuration write, or request retry.
  const utilization = await request('/config/disk/util');
  const value = json(utilization.text), fields = ['fs_size_bytes','fs_avail_bytes','fs_used_bytes'];
  const timestamp = Date.parse(value?.timestamp);
  const usable = utilization.ok && Number.isFinite(timestamp) && fields.every(k => typeof value?.metrics?.[k] === 'number' && Number.isFinite(value.metrics[k]) && value.metrics[k] >= 0) && value.metrics.fs_size_bytes > 0 && value.metrics.fs_avail_bytes <= value.metrics.fs_size_bytes && value.metrics.fs_used_bytes <= value.metrics.fs_size_bytes;
  console.log(JSON.stringify({disk_utilization:usable ? {timestamp:new Date(timestamp).toISOString(), ...Object.fromEntries(fields.map(k=>[k,value.metrics[k]]))} : null}));
  if (!usable) process.exitCode = 1;
  const configuration = await request('/config/disk'), attributes = json(configuration.text)?.attributes;
  const configured = configuration.ok && ['gp3','io2'].includes(attributes?.type) && ['iops','size_gb'].every(k=>Number.isSafeInteger(attributes?.[k]) && attributes[k] > 0) && (attributes.throughput_mibps === undefined || Number.isSafeInteger(attributes.throughput_mibps) && attributes.throughput_mibps > 0);
  console.log(JSON.stringify({disk_configuration:configured ? {type:attributes.type,iops:attributes.iops,size_gb:attributes.size_gb,...(attributes.throughput_mibps === undefined ? {} : {throughput_mibps:attributes.throughput_mibps})} : null}));
  if (!configured) process.exitCode = 1;
} else if (mode==='restart') {
  // This response can be ambiguous on timeout. Never automatically retry it.
  const result=await request('/restart', {});
  if (!result.ok) {
    console.error('Restart was not confirmed. Check control-plane status before any further action. No retry attempted.');
    process.exitCode=1;
  } else {
    console.log('One restart request accepted. Run recover separately after the service has restarted.');
  }
} else {
  const query = mode === 'review' ? (await import('node:fs')).readFileSync('ops/database-review.sql','utf8') : `select jsonb_build_object(
    'checked_at',clock_timestamp(),
    'connections',(select jsonb_agg(x) from (select usename,state,wait_event_type,wait_event,count(*) as connections from pg_stat_activity where datname=current_database() group by usename,state,wait_event_type,wait_event) x),
    'active',(select jsonb_agg(x) from (select pid,usename,state,wait_event_type,wait_event,extract(epoch from clock_timestamp()-query_start)::int as seconds,pg_blocking_pids(pid) as blockers,substring(query from '(?i)((?:public|zoi)[.][a-z_][a-z0-9_]*)(?:[[:space:]]*[(])') as operation,(query ilike '%pg_stat_activity%' or query ilike '%pg_stat_user_tables%' or query ilike '%pg_blocking_pids%') as is_diagnostic,case when query ilike '%pg_stat_activity%' or query ilike '%pg_stat_user_tables%' or query ilike '%pg_blocking_pids%' then 'diagnostic' when query ilike '%run_maintenance%' then 'maintenance' when query ilike '%enrich_%' then 'enrichment' when query ilike '%seo_entity%' then 'entity' when query ilike '%explore_%' then 'explore' else 'other' end as kind from pg_stat_activity where datname=current_database() and state <> 'idle' and pid<>pg_backend_pid() order by query_start limit 25) x),
    'cron',(select jsonb_agg(x) from (select jobid,jobname,schedule,active,case when command ilike '%run_maintenance%' then 'maintenance' when command ilike '%zoi-enrich%' then 'enrichment' when command ilike '%social-publish%' then 'social-publish' else 'other' end as kind from cron.job order by jobid) x),
    'listings',(select jsonb_agg(x) from (select n_live_tup,n_dead_tup,n_tup_upd,n_tup_hot_upd,last_autovacuum,last_autoanalyze,pg_total_relation_size(relid) as total_bytes from pg_stat_user_tables where schemaname='zoi' and relname='listings') x)
  ) as diagnostics;`;
  const result=await request('/database/query',{query,read_only:true});
  const parsed=json(result.text);
  if(result.ok&&Array.isArray(parsed)) console.log(JSON.stringify({database_diagnostics:parsed}));
  else {console.error('Database diagnostic query did not complete successfully.');process.exitCode=1;}
}
