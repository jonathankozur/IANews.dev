# Stack Tecnológico Zero-Budget (Presupuesto Cero)

Para mantener los costos de operación en cero mientras el proyecto escala, utilizaremos una combinación de plataformas con Tiers Gratuitos (Free Tiers) muy generosos, enfocados en Serverless y Edge computing.

## 1. Frontend & API (Next.js + Vercel)
*   **Servicio:** [Vercel](https://vercel.com/) (Free Tier)
*   **Tecnología:** Next.js (React).
*   **Por qué:** Vercel ofrece alojamiento gratuito para sitios Next.js con soporte nativo para SSR (Server-Side Rendering) y SSG (Static Site Generation), lo cual es crítico para SEO y GEO. Las "Serverless Functions" de Next.js servirán como nuestra API backend.
*   **Estilos:** Tailwind CSS (eficiente, carga rápida, ideal para diseño funcional).

## 2. Base de Datos (Supabase / PostgreSQL)
*   **Servicio:** [Supabase](https://supabase.com/) (Free Tier)
*   **Tecnología:** PostgreSQL.
*   **Por qué:** Supabase ofrece una base de datos Postgres real de forma gratuita (hasta 500MB y 2GB de ancho de banda mensual, suficiente para noticias de texto). Incluye API REST/GraphQL automática, autenticación y soporte para `pgvector` en caso de que necesitemos búsquedas semánticas para recomendaciones de IA en el futuro.

## 3. Autenticación y Gestión de Usuarios
*   **Servicio:** Cookies del Navegador / LocalStorage + Supabase Auth.
*   **Estrategia "Fricción Cero":** Inicialmente almacenaremos un ID de sesión anónimo (UUID) en las cookies o LocalStorage del usuario. Toda la interacción y modelado de preferencias (tracking de qué enfoque lee más) se asociará a este UUID.
*   **Onboarding Futuro:** Si el usuario decide crear una cuenta para guardar sus preferencias, usaremos Supabase Auth (gratuito hasta 50,000 MAU) para convertir su sesión anónima en un perfil estable.

## 4. IA Worker (Cron & Procesamiento en Segundo Plano)
*   **Servicio:** [GitHub Actions](https://github.com/features/actions) (Free Tier) + LLM APIs.
*   **Tecnología:** Scripts en Node.js o Python.
*   **Por qué:** GitHub ofrece 2,000 minutos de ejecución gratuitos al mes en repositorios privados (incontables en públicos). Podemos configurar un proceso Cron (ej. cada 4 horas) que despierte, busque las tendencias vía APIs gratuitas (como las de Google Trends, o feeds RSS de Reddit/Twitter), se comunique con una API de IA y genere las noticias.
*   **Motor de IA:** Usaremos APIs de IA con capas gratuitas o créditos iniciales vastos (ej. Google Gemini API free tier, Groq, o Cohere) para realizar el parseo de hechos objetivos y la redacción de las tres posturas.

## 5. Storage de Imágenes (Opcional pero Recomendado)
*   **Servicio:** Cloudinary o Supabase Storage (Free Tiers).
*   **Por qué:** Si las noticias llevan miniaturas (thumbnails), no las alojaremos en el mismo respositorio. Usaremos las cuotas gratuitas de estos servicios de CDN para asegurar la máxima velocidad.
