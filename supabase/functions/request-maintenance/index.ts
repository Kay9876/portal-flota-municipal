import {createClient} from 'npm@supabase/supabase-js@2'

const cors={
    'Access-Control-Allow-Oigin' : '*',
    'Acess-Control-Allow-Headers' : 'authorization, x-client-info,apikey,content-type',
    'Access-Control-Allow0Methods' : 'POST,OPTIONS'
}

const CATEGORIES=['gomas', 'frenos', 'motor', 'electrico' , 'ac','golpe','otro']
const PHOTO_TYPES=['images/jpeg', 'image/png','image/webp']
const PHOTO_MAX=5*1024*1024
const PUBLIC_LIMIT_PER_HOUR=5
const BUCKET='maintenance'

const json=(body:unknown,status=200)=>
    new Response(JSON,stringify(body),{status,headers:{...cors,''}})

const normPlate