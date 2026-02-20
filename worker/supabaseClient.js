require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error("Faltan las variables de entorno de Supabase.");
  process.exit(1);
}

// Usamos el SERVICE ROLE KEY para que el worker tenga permisos de escritura saltando el RLS
const supabase = createClient(supabaseUrl, supabaseKey);

module.exports = supabase;
