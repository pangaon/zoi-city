/** Backend exists; native unresolved-write persistence and device lifecycle are not accepted.
 * Keep private forms unmounted. Never infer readiness from RPC presence alone.
 */
export function nativeYouthReady():boolean{return false;}
