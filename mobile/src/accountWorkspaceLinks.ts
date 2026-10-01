/** Browser-only owner tools. No auth tokens or assumed permissions in the URL. */
export function accountWorkspaceLinks(workspace:string|null|undefined){
 if(!workspace||!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(workspace))return null;
 const query='?workspace='+encodeURIComponent(workspace.toLowerCase());
 return {settings:'https://www.zoi.city/social/settings'+query,home:'https://www.zoi.city/social/bizpage'+query};
}
