/** Fixed operational categories only. Never persist raw browser logs, headers,
 * URLs, response bodies or provider error strings as the failure reason. */
export function sourceFailureReason(error){
 const message=String(error?.message||''),code=String(error?.code||'');
 if(/no usable sandbox|apparmor|failed to move to new namespace|operation not permitted.*namespace|suid sandbox/i.test(message))return'browser_sandbox_unavailable';
 if(/executable doesn.t exist|browser.*not found/i.test(message))return'browser_runtime_missing';
 if(/host system is missing dependencies|error while loading shared libraries/i.test(message))return'browser_dependencies_missing';
 if(['EPROTO','CERT_HAS_EXPIRED','ERR_TLS_CERT_ALTNAME_INVALID','UNABLE_TO_VERIFY_LEAF_SIGNATURE'].includes(code)||/certificate|tls handshake|ssl routines/i.test(message))return'source_tls_failure';
 if(['ENOTFOUND','EAI_AGAIN'].includes(code))return'source_dns_unavailable';
 if(['ECONNRESET','ECONNREFUSED','EHOSTUNREACH','ENETUNREACH'].includes(code))return'source_connection_failure';
 if(/timeout|timed out/i.test(message)||code==='ETIMEDOUT')return'source_render_timeout';
 if(/^(?:invalid_source_url|unsafe_source_(?:dns|url)|robots_(?:disallow|unavailable)|javascript_render_unresolved|rendered_document_too_large|source_(?:challenge|cross_host_navigation|http_[0-9]{3}|byte_budget|cross_host_redirect|dns_timeout|redirect_limit|request_budget|time_budget|timeout|too_large))$/.test(message))return message;
 return error?.source_stage==='browser_launch'?'browser_launch_failed':error?.source_stage==='browser_navigation'?'source_navigation_failed':'source_capture_failed';
}
