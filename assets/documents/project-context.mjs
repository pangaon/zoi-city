const uuid=value=>typeof value==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
/** Restricts an existing authorized document read to an active project; grants no access. */
/** @param {any} value @param {string} workspace @param {string|null} requestedProject */
export function documentProjectContext(value,workspace,requestedProject=null){
 if(!uuid(workspace)||requestedProject!==null&&!uuid(requestedProject)||value?.ok!==true||!['owner','admin','editor'].includes(value.role)||!Array.isArray(value.documents)||!Array.isArray(value.projects)||value.projects.some(p=>!uuid(p.id)||typeof p.title!=='string'||!p.title.trim()||p.archived_at||p.workspace_id&&p.workspace_id!==workspace)||new Set(value.projects.map(p=>p.id)).size!==value.projects.length||new Set(value.documents.map(d=>d.id)).size!==value.documents.length||value.documents.some(d=>!uuid(d.id)||d.workspace_id!==workspace||!uuid(d.project_id)||!Number.isInteger(d.current_version)||d.current_version<0||requestedProject&&d.project_id!==requestedProject))throw Error('Private project document records could not be verified.');
 const project=requestedProject?value.projects.find(p=>p.id===requestedProject):null;
 if(requestedProject&&!project)throw Error('This project is no longer active in the current workspace.');
 return{...value,projects:project?[project]:value.projects,project};
}
