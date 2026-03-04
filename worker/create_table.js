const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

async function run() {
    // Note: To cleanly create tables, we'd normally use a migration or the Supabase SQL UI.
    // However, as we can execute queries if we added an RPC function `query` before, we try this.
    // A better approach since we have the Supabase key might be inserting directly into the table,
    // which errors if it doesn't exist, prompting manual creation if needed, 
    // BUT we will try creating an aggressive migration using the REST API if possible, or just note it.

    console.log("Para crear la tabla `system_prompts`, debes ejecutar el siguiente SQL en el panel de Supabase:");
    console.log(`
CREATE TABLE IF NOT EXISTS public.system_prompts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  type text NOT NULL,
  name text NOT NULL UNIQUE,
  prompt_text text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Habilitar RLS si es necesario y permitir subscripciones
ALTER PUBLICATION supabase_realtime ADD TABLE public.system_prompts;
    `);
}

run();
