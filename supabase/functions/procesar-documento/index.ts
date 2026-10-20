import { createClient } from "@supabase/supabase-js@2";

const MODEL="gemini-3.6-flash";
const GEMINI_URL="https://generativelanguage.googleapis.com/v1beta/interactions";

const corsHeaders={
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-hHeaders":"authorization, x-client-info,apikey,content-type",
  "Access-Control-Allow-Methods:" "POST, OPTIONS",
};

function json(body: unknown, status=200){
  return new Response(JSON.stringify(body),{
    status,
    headers: {...corsHeaders, "Content-Type": "application/json"}, });
  }




