import { createClient } from "npm:@supabase/supabase-js@2";

const MODEL="gemini-3.6-flash";
const GEMINI_URL="https://generativelanguage.googleapis.com/v1beta/interactions";

const corsHeaders={
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":"authorization, x-client-info,apikey,content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status=200){
  return new Response(JSON.stringify(body),{
    status,
    headers: {...corsHeaders, "Content-Type": "application/json"}, });
  }

  const MIME_BY_EXTENSION: Record<string,string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    webp: "image/webp",
    pdf: "application/pdf",
  };

  function toBase64(bytes: Uint8Array){
    let binary="";
    const chunkSize=0x8000;
    for(let i=0; i<bytes.length; i+=chunkSize){
      const subarray=bytes.subarray(i, i+chunkSize);
      binary+=String.fromCharCode.apply(null, subarray as unknown as number[]);
    }
    return btoa(binary); 
  }

  type Column={
    key: string;
    label: string;
    description: string|null;
    data_type: string;
    db_column: string;
    required: boolean;
    sort_order: number;
  };

  function buildPrompt(templateName: string, columns: Column[],instructions: string[] ){
    const columnList=columns.map((c) => `- ${c.key}: ${c.description || c.label}`).join('\n');
    const extraRules=instructions?.map((text) => `- ${text}`).join('\n');

    return `
Analiza cuidadosamente este documento: "${templateName}".

El documento contiene estos campos:

${columnList}

Necesito digitalizar la información escrita a mano.

Reglas:
- Si el documento es una tabla, cada fila con datos escritos es un registro.
- Si el documento es un formulario de un solo registro, devuelve exactamente un elemento en records con todos sus campos.
- Mira el documento completo antes de interpretar cada campo.
- Usa el contexto de cada campo para interpretar la escritura.
- No inventes información. Si no puedes leer un campo o está vacío, usa null.
- Mantén el texto tal como está escrito cuando sea posible.
- En "campos_dudosos" pon las keys de los campos que leíste con poca seguridad.
${extraRules}`.trim();
  }

  function jsonType(dataType: string){
    if (dataType==="integer") return ["integer","null"];
    if (dataType==="number") return ["number","null"];
    if (dataType==="boolean") return ["boolean","null"];
    return ["string","null"];
  }

  function buildSchema(columns: Column[]){
    const properties: Record<string,unknown>={fila:{type:"integer"}};
    for(const c of columns){
      properties[c.key]={type: jsonType(c.data_type),description: c.description ?? c.label};
    }
    const keys=columns.map((c) => c.key);
    properties.campos_dudosos={type:"array",items:{type:"string",enum:keys},description:"Campos que fueron leídos con poca seguridad"};
  

  return{
    type: "object",
    properties: {
      records:{
        type: "array",
        items: {
          type: "object",
          properties,
          required: ["fila",...keys,"campos_dudosos"],
        },
      },
    },
required: ["records"],    
};
}

Deno.serve(async (req) => {
  if (req.method==="OPTIONS") return new Response(null,{status:204,headers:corsHeaders});
  try{
    const {scan_id} = await req.json();
    if (!scan_id) return json({error:"Missing scan_id"},400);

    const supabase=createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, 
    );
  
    const {data: scan,error:scanError}
    =await supabase.from("document_scans").select("id,file_path,template_id").eq("id",scan_id).single();
    if (scanError) return json({error:scanError.message},400);
    if (!scan) return json({error:"Scan not found"},404);

    const {data: template,error:templateError}
    =await supabase.from("document_templates").select("id,name,target_table,template_columns(*),template_instructions(*)").eq("id",scan.template_id).single();
    if (templateError) return json({error:templateError.message},400);
    if (!template) return json({error:"Template not found"},404);

    const columns=(template.template_columns as Column[])
    .sort((a,b) => a.sort_order-b.sort_order);
  const instructions=(template.template_instructions as {sort_order:number,text:string}[]).sort((a,b) => a.sort_order-b.sort_order).map((i) => i.text);

  const{data:file,error:fileError}=await supabase.storage.from("scans").download(scan.file_path);
  if (fileError || !file) return json({error:fileError?.message || "File not found"},400);

  const extension=scan.file_path.split('.').pop()?.toLowerCase()?? "";
  const mimeType=MIME_BY_EXTENSION[extension];
    if (!mimeType) return json({error:"Unsupported file type"},400);
  
    const filePart={
      type:mimeType=== "application/pdf" ? "document" : "image",
      data: toBase64(new Uint8Array(await file.arrayBuffer())),
      mime_type: mimeType,
    };

    const startedAT=Date.now();
    const response = await fetch(GEMINI_URL,{
      method: "POST",
      headers: {
        "x-goog-api-key": Deno.env.get("GEMINI_API_KEY")!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: MODEL,
        input: [
          {type: "text", text: buildPrompt(template.name,columns,instructions)},filePart],
          response_format:{
            type:"text",
            mime_type:"application/json",
            schema: buildSchema(columns),
          },
        }),
      });

    const seconds=(Date.now()-startedAT)/1000;
    if (!response.ok) {
      const errorText=await response.text();
      return json({error:`Gemini API error: ${response.status} ${response.statusText} - ${errorText}`},500);
    }

    const geminiData=await response.json();
    const outputText=
    (geminiData.steps ?? []).filter((step:{type:string})=>step.type==="model_output").flatMap((step:{content?:{type:string,text:string}[]})=>step.content ?? [])
    .filter((item:{type:string})=>item.type==="text").map((item:{text:string})=>item.text??"").join("")
    const result=outputText ? JSON.parse(outputText) : null;

    return json({scan_id:scan.id,
      template:{id:template.id,name:template.name,target_table:template.target_table},
      columns:columns.map((c) => ({key:c.key,label:c.label,data_type:c.data_type,db_column:c.db_column,required:c.required})),
      records:result?.records ?? [],
      seconds,
    });
  }catch(err){
    return json({error:err instanceof Error ? err.message:String(err)},500);
  }
}); 







