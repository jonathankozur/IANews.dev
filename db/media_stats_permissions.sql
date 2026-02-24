-- Arreglar permisos para la tabla media_stats
-- El RLS permite la política, pero el rol 'anon' necesita permiso de SELECT en la tabla.

GRANT SELECT ON public.media_stats TO anon;
GRANT SELECT ON public.media_stats TO authenticated;

-- Por seguridad, aseguramos que RLS esté activo y la política sea correcta
ALTER TABLE public.media_stats ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read-only access on media_stats" ON public.media_stats;
CREATE POLICY "Allow public read-only access on media_stats" 
ON public.media_stats FOR SELECT 
USING (true);
