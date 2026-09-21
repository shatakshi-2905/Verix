import { api } from "../api";

export async function analyzeDocument({ data }: { data: { document_id: string } }) { return api<{ok:true;analysis:any;findings:any[];protected_text:string} | {ok:false;message:string}>("/api/analyze", { method:"POST", body:JSON.stringify(data) }).catch(e=>({ok:false as const,message:e.message})); }
export async function generateContent({ data }: { data: any }) { return api<any>("/api/generate", { method:"POST", body:JSON.stringify(data) }).catch(e=>({ok:false as const,message:e.message})); }
export async function protectDocument(data: { document_id: string; findings?: any[] }) { return api<any>("/api/protect", { method:"POST", body:JSON.stringify(data) }); }
export async function ingestUrl({ data }: { data: { url:string } }) { return api<any>("/api/ingest-url", { method:"POST", body:JSON.stringify(data) }).catch(e=>({ok:false as const,message:e.message})); }
export async function createDocument(data:any){ return api<any>("/api/documents",{method:"POST",body:JSON.stringify(data)}); }
export async function createTransformation(data:any){ return api<any>("/api/transformations",{method:"POST",body:JSON.stringify(data)}); }
export async function uploadDocument(file:File){ const form=new FormData(); form.append("file",file); return api<any>("/api/documents/upload",{method:"POST",body:form}); }
export async function updateOutput(id:string, data:{status:string;content?:string}){ return api<any>(`/api/outputs/${id}`,{method:"PATCH",body:JSON.stringify(data)}); }
