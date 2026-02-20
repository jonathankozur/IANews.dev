# IANews.dev - Portal de Noticias Autogestionado por IA

Bienvenido a **IANews.dev**, un proyecto de portal de noticias que emplea la Inteligencia Artificial para buscar tendencias, redactar noticias y presentarlas al usuario desde 3 posturas políticas diferentes (Izquierda, Centro y Derecha) con un enfoque de fricción cero.

Este proyecto sigue una arquitectura **Zero-Budget**, utilizando herramientas gratuitas para el MVP.

---

## 🏗️ Arquitectura del Proyecto

El proyecto está dividido en 3 componentes principales dentro de este monorepositorio:

1. **`db/` - Base de Datos (Supabase / PostgreSQL)**
   - Contiene el esquema SQL inicial (`schema.sql`) para crear las tablas y políticas de seguridad (RLS).
2. **`worker/` - IA Worker (Node.js)**
   - Servicio encargado de buscar las noticias/tendencias, conectarse con la IA para generar las 3 perspectivas y guardarlas en Supabase.
3. **`webapp/` - Frontend (Next.js 14+)**
   - Portal web construido con Next.js (App Router) y Tailwind CSS. Implementa Server-Side Rendering (SSR) y un diseño minimalista sin fricción en el cambio de perspectivas.

Para más información sobre las decisiones arquitectónicas del proyecto, revisa la carpeta [`docs/`](./docs/).

---

## 🚀 Guía de Instalación (Setup Local)

Sigue estos pasos si acabas de clonar el proyecto en una nueva computadora y necesitas que funcione localmente.

### Pre-requisitos
- **Node.js**: Versión 18+ instalada.
- **Git**: Para control de versiones.
- Cuenta en **Supabase** (puedes usar el proyecto que ya creaste previamente).

### Paso 1: Clonar el Repositorio

```bash
git clone https://github.com/jonathankozur/IANews.dev.git
cd IANews.dev
```

### Paso 2: Configurar la Base de Datos (Supabase)

Si ya ejecutaste este paso anteriormente, puedes omitirlo. De lo contrario:
1. Ve a [Supabase](https://supabase.com/) y crea un proyecto nuevo (o usa el existente).
2. Entra al **SQL Editor** y ejecuta el script completo que está en `db/schema.sql`.

### Paso 3: Configurar Entorno del Webapp (Next.js)

```bash
cd webapp
npm install
```

Luego, crea un archivo `.env.local` dentro de la carpeta `webapp` (ya tienes un archivo de ejemplo `.env.example`) y configura las siguientes variables con las credenciales de tu proyecto Supabase (en la sección Project Settings > API):

```env
# webapp/.env.local
NEXT_PUBLIC_SUPABASE_URL=tu_url_de_proyecto_supabase
NEXT_PUBLIC_SUPABASE_ANON_KEY=tu_anon_key_publica
```

Para encender el servidor frontend:
```bash
npm run dev
```
El sitio web estará disponible en [http://localhost:3000](http://localhost:3000).

### Paso 4: Configurar Entorno del IA Worker

Abre una nueva terminal para configurar el worker:

```bash
cd worker
npm install
```

Crea un archivo `.env` dentro de la carpeta `worker` (ya tienes el archivo `.env.example` como guía) y completa con tus credenciales:

```env
# worker/.env
SUPABASE_URL=tu_url_de_proyecto_supabase
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key_secreto
# AI_API_KEY=tu_api_key_del_modelo_de_ia (Próximamente)
```
> ⚠️ **Atención:** A diferencia del `webapp`, el Worker usa el `SERVICE_ROLE_KEY` que tiene privilegios de administrador para saltear las restricciones del RLS e insertar datos libremente. **NUNCA expongas esta key al frontend.**

Para ejecutar el worker localmente y poblar de noticias falsas (pruebas de concepto) la base de datos:
```bash
node index.js
```

---

## 📄 Notas Adicionales del Documentador
- Asegúrate de nunca subir los archivos `.env` o `.env.local` al repositorio. Ya están añadidos al `.gitignore` en la raíz.
- El Worker actualmente tiene datos de simulación (mock data), en futuras iteraciones se conectará a APIs como las de Google Trends y Gemini para funcionar automáticamente.

¡Listo! Ya tienes el entorno armado y funcionando en tu computadora.
