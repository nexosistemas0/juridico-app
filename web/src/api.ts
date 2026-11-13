export class RequestError extends Error {constructor(public status:number,message:string){super(message)}}
export async function api<T=any>(path:string,method='GET',body?:unknown):Promise<T>{
  const form=body instanceof FormData;
  let response:Response;
  try { response=await fetch(`/api${path}`,{method,credentials:'same-origin',headers:{'X-Requested-With':'juridico-app',...(!form&&body?{'Content-Type':'application/json'}:{})},body:body?(form?body:JSON.stringify(body)):undefined,signal:AbortSignal.timeout(25000)}); }
  catch {throw new RequestError(0,'Não foi possível conectar. Confira sua conexão e tente novamente.');}
  if(response.status===204)return undefined as T;
  const data=await response.json().catch(()=>({message:'O servidor retornou uma resposta inválida.'}));
  if(!response.ok){if(response.status===401&&!path.startsWith('/auth/'))window.dispatchEvent(new Event('session-expired'));throw new RequestError(response.status,data.message||'Não foi possível concluir.');}
  return data;
}
export type Row=Record<string,any>;
export const date=(value:string|undefined)=>value?new Date(value.length===10?`${value}T12:00:00`:value).toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo'}):'Não informada';
export const cnj=(s:string)=>s?.replace(/^(\d{7})(\d{2})(\d{4})(\d)(\d{2})(\d{4})$/,'$1-$2.$3.$4.$5.$6')||s;
