export function prepareStaticAuthCallback(options:{href:string;replaceUrl:(url:string)=>void}):null|{status:string;close:()=>void;consume:()=>Promise<unknown>};
