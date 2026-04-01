# 📘 Manual de Operaciones de Despliegue
# Sistema Control de Créditos

> **Autor:** DevOps Agent  
> **Última actualización:** 2026-02-09  
> **Repo:** `solautoma-ux/AppCreditManager`

---

## Tabla de Contenidos

1. [Visión General de Ambientes](#1-visión-general-de-ambientes)
2. [Prerequisitos](#2-prerequisitos)
3. [Configuración Inicial (Solo una vez)](#3-configuración-inicial-solo-una-vez)
4. [Flujo de Trabajo Diario](#4-flujo-de-trabajo-diario)
5. [Mover Cambios entre Ambientes](#5-mover-cambios-entre-ambientes)
6. [Despliegue Manual por Ambiente](#6-despliegue-manual-por-ambiente)
7. [Variables de Entorno por Ambiente](#7-variables-de-entorno-por-ambiente)
8. [Migraciones de Base de Datos](#8-migraciones-de-base-de-datos)
9. [Rollback (Revertir Cambios)](#9-rollback-revertir-cambios)
10. [Troubleshooting](#10-troubleshooting)
11. [Checklist de Despliegue](#11-checklist-de-despliegue)
12. [Supabase: Límites del Plan Gratuito y Cuándo se Cobra](#12-supabase-límites-del-plan-gratuito-y-cuándo-se-cobra)
13. [Replicar Datos de Producción a Staging](#13-replicar-datos-de-producción-a-staging)

---

## 1. Visión General de Ambientes

```
┌─────────────────────────────────────────────────────────────────────┐
│                     FLUJO DE DESPLIEGUE                            │
│                                                                     │
│   Tu PC            GitHub              Staging           Production │
│   ┌─────┐         ┌────────┐         ┌─────────┐       ┌─────────┐│
│   │ Dev │──push──>│staging │──auto──>│ Render  │       │ Render  ││
│   │     │  branch │ branch │ deploy  │ Vercel  │       │ Vercel  ││
│   └─────┘         │        │         └─────────┘       └─────────┘│
│                    │  main  │──────────────────auto───>│ Render  ││
│                    │ branch │             deploy        │ Vercel  ││
│                    └────────┘                           └─────────┘│
└─────────────────────────────────────────────────────────────────────┘
```

| Ambiente | Propósito | Backend URL | Frontend URL | Base de Datos |
|---|---|---|---|---|
| **Development** | Tu PC local para programar | `localhost:3000` | `localhost:5173` | Supabase Staging |
| **Staging** | Pruebas antes de salir a producción | `credit-api-staging.onrender.com` | `app-staging.vercel.app` | Supabase Staging |
| **Production** | Los usuarios reales usan esto | `credit-api.onrender.com` | `app.vercel.app` | Supabase Production |

---

## 2. Prerequisitos

### Software necesario en tu PC
```bash
# Verificar que tienes todo instalado:
node --version     # Requiere Node.js 18+
npm --version      # Viene con Node.js
git --version      # Requiere Git 2.x+
```

### Cuentas necesarias (todas gratuitas)
- [x] **GitHub** → [github.com](https://github.com) — Ya tienes: `solautoma-ux`
- [ ] **Render** → [render.com](https://render.com) — Crear cuenta con GitHub
- [ ] **Vercel** → [vercel.com](https://vercel.com) — Crear cuenta con GitHub
- [ ] **Supabase Staging** → [supabase.com](https://supabase.com) — Crear segundo proyecto

---

## 3. Configuración Inicial (Solo una vez)

### Paso 3.1: Configurar Git y subir al repositorio

```bash
# Desde la raíz del proyecto: c:\Antigravity\control_Creditos

# 1. Inicializar Git (si no lo has hecho)
git init

# 2. Conectar con tu repositorio de GitHub
git remote add origin https://github.com/solautoma-ux/AppCreditManager.git

# 3. Crear las ramas de trabajo
git checkout -b main          # Rama de producción
git checkout -b staging       # Rama de staging/pruebas
git checkout -b develop       # Rama de desarrollo diario

# 4. Primer commit (asegúrate de que .gitignore ya existe)
git add .
git commit -m "feat: initial project setup"
git push -u origin main
git push -u origin staging
git push -u origin develop
```

### Paso 3.2: Crear proyecto Supabase de Staging

1. Ir a [app.supabase.com](https://app.supabase.com)
2. Click **"New Project"**
3. Nombre: `credit-manager-staging`
4. Región: La más cercana a tus usuarios (ej: `South America - São Paulo`)
5. Guardar la contraseña de la base de datos
6. Una vez creado, ir a **Settings → API** y copiar:
   - `Project URL` → será tu `SUPABASE_URL` de staging
   - `service_role key` → será tu `SUPABASE_SERVICE_ROLE_KEY` de staging
   - `anon public key` → será tu `VITE_SUPABASE_ANON_KEY` de staging
7. **Ejecutar todas las migraciones** (ver [sección 8](#8-migraciones-de-base-de-datos))

### Paso 3.3: Configurar Render (Backend)

1. Ir a [render.com](https://render.com) → Sign up con GitHub
2. Click **"New +"** → **"Web Service"**
3. Conectar el repo `solautoma-ux/AppCreditManager`
4. Configurar:
   - **Name:** `credit-api-staging` (para staging) o `credit-api` (para prod)
   - **Region:** Oregon o la más cercana
   - **Branch:** `staging` (para staging) o `main` (para prod)
   - **Root Directory:** `backend`
   - **Runtime:** `Node`
   - **Build Command:** `npm install`
   - **Start Command:** `npm start`
   - **Plan:** Starter ($7/mes)
5. En la pestaña **"Environment"**, agregar TODAS las variables:

   | Key | Value |
   |---|---|
   | `NODE_ENV` | `staging` (o `production`) |
   | `PORT` | `3000` |
   | `FRONTEND_URL` | URL de Vercel (se completa después) |
   | `JWT_SECRET` | Un string secreto de 32+ caracteres |
   | `SUPABASE_URL` | URL del proyecto Supabase correspondiente |
   | `SUPABASE_SERVICE_ROLE_KEY` | Key del proyecto Supabase |
   | `EMAIL_HOST` | `smtp.gmail.com` |
   | `EMAIL_PORT` | `587` |
   | `EMAIL_USER` | Tu email |
   | `EMAIL_PASS` | Tu app password de Gmail |

6. Click **"Create Web Service"**
7. Esperar a que haga el build (2-3 minutos)
8. Copiar la URL que te da (ej: `https://credit-api-staging.onrender.com`)

### Paso 3.4: Configurar Vercel (Frontend)

1. Ir a [vercel.com](https://vercel.com) → Sign up con GitHub
2. Click **"Add New..."** → **"Project"**
3. Importar: `solautoma-ux/AppCreditManager`
4. Configurar:
   - **Framework Preset:** Vite
   - **Root Directory:** `frontend` ← ⚠️ Importante: cambiar la raíz
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
5. En **"Environment Variables"**, agregar:

   | Key | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | URL de Supabase del ambiente |
   | `VITE_SUPABASE_ANON_KEY` | Anon key de Supabase del ambiente |
   | `VITE_API_URL` | URL de Render (ej: `https://credit-api-staging.onrender.com/api`) |

6. Click **"Deploy"**
7. Copiar la URL que te da (ej: `https://appcreditmanager.vercel.app`)
8. **Volver a Render** y actualizar `FRONTEND_URL` con esta URL

> **Repetir pasos 3.3 y 3.4** para crear los servicios de **Production** (apuntando a branch `main` y Supabase prod).

---

## 4. Flujo de Trabajo Diario

### Tu ciclo normal de trabajo:

```
1. Programas en tu PC        → branch "develop"
2. Pruebas localmente        → localhost:5173 + localhost:3000
3. Si funciona, subes a staging → merge a branch "staging"
4. Pruebas en staging         → URLs de staging
5. Si todo OK, subes a prod   → merge a branch "main"
```

### Comandos día a día:

```bash
# ── Trabajar en tu código (desarrollo diario) ──
git checkout develop
# ... haces tus cambios ...
git add .
git commit -m "feat: descripción del cambio"
git push origin develop

# ── Cuando el cambio está listo para probar en staging ──
git checkout staging
git merge develop
git push origin staging
# ↑ Esto dispara el deploy automático en Render + Vercel (staging)

# ── Cuando staging está probado y aprobado ──
git checkout main
git merge staging
git push origin main
# ↑ Esto dispara el deploy automático en Render + Vercel (producción)
```

---

## 5. Mover Cambios entre Ambientes

### Diagrama de flujo de código:

```
develop ──merge──> staging ──merge──> main
  (Tu PC)          (Pruebas)         (Producción)
```

### Caso 1: Mover un cambio de Desarrollo → Staging

```bash
# 1. Asegúrate de estar en develop y que tu código funcione localmente
git checkout develop
npm run dev  # Probar que todo funcione

# 2. Commit de tus cambios
git add .
git commit -m "feat: nueva funcionalidad de pagos"

# 3. Cambiar a staging y traer los cambios
git checkout staging
git merge develop

# 4. Subir a GitHub (dispara auto-deploy en staging)
git push origin staging

# 5. Esperar 2-3 minutos y verificar en las URLs de staging
```

### Caso 2: Mover de Staging → Producción

```bash
# 1. Verificar que staging funcione correctamente
# Revisar: login, crear crédito, registrar pago, etc.

# 2. Cambiar a main y traer los cambios probados
git checkout main
git merge staging

# 3. Subir a GitHub (dispara auto-deploy en producción)
git push origin main

# 4. Verificar en las URLs de producción
```

### Caso 3: Hotfix de emergencia en Producción

```bash
# 1. Crear rama de hotfix desde main
git checkout main
git checkout -b hotfix/fix-calculo-mora

# 2. Hacer la corrección
# ... editar archivos ...
git add .
git commit -m "hotfix: corregir cálculo de mora en cuotas vencidas"

# 3. Merge directo a main (producción)
git checkout main
git merge hotfix/fix-calculo-mora
git push origin main

# 4. También llevar el fix a staging y develop
git checkout staging
git merge main
git push origin staging

git checkout develop
git merge main
git push origin develop

# 5. Eliminar la rama de hotfix
git branch -d hotfix/fix-calculo-mora
```

---

## 6. Despliegue Manual por Ambiente

### 6.1 Ambiente Development (Tu PC)

```bash
# Terminal 1: Backend
cd backend
npm install      # Solo si hay dependencias nuevas
npm run dev      # Arranca con nodemon (hot-reload)

# Terminal 2: Frontend
cd frontend
npm install      # Solo si hay dependencias nuevas
npm run dev      # Arranca Vite en localhost:5173
```

**Verificar que funciona:**
- Abrir `http://localhost:5173` → Debe cargar la app
- Abrir `http://localhost:3000/health` → Debe responder `{ status: 'ok' }`

### 6.2 Ambiente Staging (Automático vía GitHub)

| Paso | Acción | Resultado |
|---|---|---|
| 1 | `git push origin staging` | GitHub recibe el código |
| 2 | Render detecta el push | Hace `npm install` + `npm start` automático |
| 3 | Vercel detecta el push | Hace `npm run build` automático |
| 4 | Esperar ~3 min | Ambos servicios actualizados |

**Verificar que funciona:**
- Abrir `https://[tu-app].vercel.app` → Debe cargar la app
- Abrir `https://[tu-api].onrender.com/health` → Debe responder OK

### 6.3 Ambiente Production (Automático vía GitHub)

Igual que Staging pero con branch `main`:

| Paso | Acción |
|---|---|
| 1 | `git push origin main` |
| 2-4 | Mismo proceso automático |

> ⚠️ **REGLA DE ORO:** Nunca hagas push directo a `main`. Siempre pasa por `staging` primero.

---

## 7. Variables de Entorno por Ambiente

### Backend (Express.js)

| Variable | Development (.env local) | Staging (Dashboard Render) | Production (Dashboard Render) |
|---|---|---|---|
| `NODE_ENV` | `development` | `staging` | `production` |
| `PORT` | `3000` | `3000` | `3000` |
| `FRONTEND_URL` | `http://localhost:5173` | `https://[staging].vercel.app` | `https://[prod].vercel.app` |
| `JWT_SECRET` | `tu_secreto_dev` | Secreto único staging | Secreto único producción |
| `SUPABASE_URL` | URL staging | URL staging | URL producción |
| `SUPABASE_SERVICE_ROLE_KEY` | Key staging | Key staging | Key producción |
| `EMAIL_HOST` | `smtp.gmail.com` | `smtp.gmail.com` | `smtp.gmail.com` |
| `EMAIL_PORT` | `587` | `587` | `587` |
| `EMAIL_USER` | Tu email | Tu email | Tu email |
| `EMAIL_PASS` | Tu app password | Tu app password | Tu app password |

### Frontend (Vite/React)

| Variable | Development (.env local) | Staging (Dashboard Vercel) | Production (Dashboard Vercel) |
|---|---|---|---|
| `VITE_SUPABASE_URL` | URL staging | URL staging | URL producción |
| `VITE_SUPABASE_ANON_KEY` | Anon key staging | Anon key staging | Anon key producción |
| `VITE_API_URL` | `http://localhost:3000/api` | `https://[staging].onrender.com/api` | `https://[prod].onrender.com/api` |

### ¿Dónde se configuran?

- **Development:** Archivo `.env` en tu PC (ya lo tienes)
- **Staging/Production:** Dashboard web de cada plataforma
  - Render: Tu servicio → Environment → Add Environment Variable
  - Vercel: Tu proyecto → Settings → Environment Variables

---

## 8. Migraciones de Base de Datos

### Aplicar migraciones a un nuevo proyecto Supabase

```bash
# 1. Ir al SQL Editor del nuevo proyecto Supabase (Dashboard web)
# 2. Ejecutar cada archivo de migración en orden numérico:
#    database/migrations/001_xxx.sql
#    database/migrations/002_xxx.sql
#    ... hasta la 164_xxx.sql
```

### Opción automatizada (recomendada):

```bash
# Usar el script existente del proyecto
node backend/apply_migration.js
```

> ⚠️ Antes de ejecutar migraciones en **producción**, siempre ejecutarlas primero en **staging** y verificar que no rompan nada.

### Orden de migraciones para nueva BD:
1. Ejecutar migraciones en **Staging** primero
2. Probar la aplicación en staging
3. Si todo funciona, ejecutar las mismas migraciones en **Production**

---

## 9. Rollback (Revertir Cambios)

### Si algo sale mal en Staging:

```bash
# Opción 1: Revertir el último commit
git checkout staging
git revert HEAD
git push origin staging
# ↑ Crea un nuevo commit que deshace el anterior

# Opción 2: Volver a un commit específico
git checkout staging
git log --oneline -10          # Ver los últimos 10 commits
git revert <hash-del-commit>   # Revertir uno específico
git push origin staging
```

### Si algo sale mal en Producción:

```bash
# 1. Revertir inmediatamente
git checkout main
git revert HEAD
git push origin main
# ↑ Esto disparará un re-deploy automático con el código anterior

# 2. Investigar el problema en develop/staging
```

### Rollback desde el Dashboard de Render:

1. Ir a tu servicio en Render
2. Click en **"Events"** (historial de deploys)
3. Buscar el deploy anterior que funcionaba
4. Click **"Rollback to this deploy"**

### Rollback desde el Dashboard de Vercel:

1. Ir a tu proyecto en Vercel
2. Click en **"Deployments"**
3. Buscar el deploy anterior que funcionaba
4. Click en los **"..."** → **"Promote to Production"**

---

## 10. Troubleshooting

### Problema: "El deploy falló en Render"

1. Ir a Render → Tu servicio → **"Logs"**
2. Buscar el error (usualmente `npm install` o `npm start`)
3. Causas comunes:
   - Falta una variable de entorno → Agregar en Environment
   - Algún `require` quebrado → Verificar imports en el código
   - Puerto incorrecto → Verificar que `PORT` esté configurado

### Problema: "El frontend carga pero no conecta al backend"

1. Abrir DevTools del navegador (F12) → Network
2. Ver si las peticiones al API dan error
3. Causas comunes:
   - `VITE_API_URL` apunta a `localhost` en vez de la URL de Render
   - CORS bloqueando → Verificar `FRONTEND_URL` en las vars del backend
   - Backend caído → Verificar `/health` del backend

### Problema: "Login con Google no funciona en staging/prod"

1. Ir a la consola de Google Cloud → Credenciales OAuth
2. Agregar las nuevas URLs de Vercel y Render a:
   - **Authorized JavaScript origins:** `https://[tu-app].vercel.app`
   - **Authorized redirect URIs:** `https://[tu-app].vercel.app/callback`
3. También configurar en Supabase:
   - Dashboard → Authentication → URL Configuration
   - Agregar Site URL y Redirect URLs con los dominios de staging/prod

### Problema: "Free tier de Render se duerme"

- En el plan gratuito de Render, el servicio se "duerme" tras 15 min de inactividad
- La primera petición tarda ~30 segundos en "despertar"
- **Solución:** Contratar el plan Starter ($7/mes) que mantiene el servicio activo 24/7

---

## 11. Checklist de Despliegue

### ✅ Antes de desplegar a Staging:

- [ ] El código compila sin errores localmente (`npm run build`)
- [ ] Health check local responde OK (`localhost:3000/health`)
- [ ] Los cambios están commiteados en `develop`
- [ ] Se hizo merge de `develop` → `staging`
- [ ] Si hay migraciones nuevas, se ejecutaron en Supabase Staging

### ✅ Antes de desplegar a Producción:

- [ ] Todo lo anterior fue verificado en Staging
- [ ] Se probó manualmente en staging:
  - [ ] Login funciona
  - [ ] Crear/editar créditos funciona
  - [ ] Registrar pagos funciona
  - [ ] Las pantallas se ven correctas en móvil
- [ ] Si hay migraciones nuevas, se ejecutaron en Supabase Production
- [ ] Se hizo merge de `staging` → `main`
- [ ] Se verificó en producción después del deploy

### ✅ Después de desplegar a Producción:

- [ ] `/health` responde OK
- [ ] Login funciona
- [ ] Navegación general funciona
- [ ] No hay errores en la consola del navegador
- [ ] Se notificó al equipo del despliegue exitoso

---

## 12. Supabase: Límites del Plan Gratuito y Cuándo se Cobra

### ¿Qué incluye el plan gratuito?

| Recurso | Límite Gratuito | ¿Qué pasa si lo superas? |
|---|---|---|
| **Base de datos** | **500 MB** por proyecto | ⛔ La BD se pone en **modo solo lectura** (no puedes insertar ni actualizar datos) |
| **Almacenamiento de archivos** | 1 GB (Supabase Storage) | ⛔ No puedes subir más archivos |
| **Ancho de banda** | 2 GB de transferencia/mes | ⛔ Las peticiones se bloquean |
| **Usuarios autenticados** | 50,000 MAU (usuarios activos/mes) | ⛔ Nuevos logins fallan |
| **Edge Functions** | 500,000 invocaciones/mes | ⛔ Las funciones dejan de ejecutarse |
| **Proyectos activos** | 2 proyectos | Pausa automática de proyectos extras |
| **Inactividad** | 1 semana sin uso | ⏸️ **El proyecto se PAUSA automáticamente** |

### ⚠️ Alerta crítica: ¿Cuándo deja de funcionar tu app?

```
                    ESCALA DE RIESGO - BASE DE DATOS (500 MB)
    ┌─────────────────────────────────────────────────────────────┐
    │  0 MB          250 MB          400 MB    475 MB    500 MB  │
    │  ├──────────────┼───────────────┼─────────┼─────────┤      │
    │  │   ✅ SEGURO  │  ✅ NORMAL    │ ⚠️ ATEN │ 🔴 CRIT │ ⛔   │
    │  │              │               │  CIÓN   │  ICO    │LLENO │
    └─────────────────────────────────────────────────────────────┘
    
    ⛔ A los 500 MB: Tu app NO PUEDE guardar datos nuevos
       → Los usuarios NO pueden crear créditos, registrar pagos, etc.
       → La app seguirá mostrando datos existentes (solo lectura)
```

### ¿Cuánto espacio usa tu app? (Estimación)

| Dato | Tamaño aprox. por registro | Para 500 MB puedes tener aprox. |
|---|---|---|
| 1 cliente | ~0.5 KB | ~1,000,000 clientes |
| 1 crédito + amortización | ~5 KB | ~100,000 créditos |
| 1 pago | ~0.3 KB | ~1,600,000 pagos |

> **Conclusión:** Con un negocio de préstamos mediano (200-500 clientes activos), el plan gratuito te puede durar **meses o incluso un par de años** antes de llegar a los 500 MB.

### ¿Cuánto cuesta si necesitas más?

| Plan | Precio | Base de datos | Storage | Lo que incluye |
|---|---|---|---|---|
| **Free** | $0 | 500 MB | 1 GB | Lo que ya tienes |
| **Pro** | **$25/mes** por proyecto | **8 GB** | 100 GB | Backups diarios, sin pausa por inactividad |
| **Team** | $599/mes | 8 GB + extensible | 100 GB | SOC2, Priority support |

### Recomendación para tu caso

```
AHORA  →  Free (2 proyectos: staging + prod)
           ✅ Suficiente para arrancar y los primeros meses

FUTURO →  Pro ($25/mes) cuando:
           • Tu BD supere los 300 MB (para tener margen)
           • Tengas clientes reales que NO pueden perder servicio
           • Necesites backups automáticos diarios
```

### ¿Cómo monitorear cuánto espacio estás usando?

1. Ir a tu proyecto en [app.supabase.com](https://app.supabase.com)
2. Click en **"Settings"** (⚙️) → **"Infrastructure"**
3. Ver la sección **"Database size"**
4. O ejecutar esta consulta en el **SQL Editor**:

```sql
-- Ver el tamaño total de la base de datos
SELECT pg_size_pretty(pg_database_size(current_database())) AS tamanio_total;

-- Ver el tamaño por tabla
SELECT 
    schemaname || '.' || tablename AS tabla,
    pg_size_pretty(pg_total_relation_size(schemaname || '.' || tablename)) AS tamanio
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname || '.' || tablename) DESC;
```

### ¿Qué pasa con la pausa por inactividad?

- Si nadie usa la app durante **1 semana**, Supabase **PAUSA** el proyecto gratuito
- Cuando alguien intente acceder, la BD tardará ~1 minuto en "despertar"
- **En el plan Pro ($25/mes)** esto NO pasa: la BD está siempre activa

---

## 13. Replicar Datos de Producción a Staging

### ¿Por qué hacerlo?

Cuando quieras probar una nueva funcionalidad con datos reales sin riesgo de dañar la producción.

```
    PRODUCCIÓN                    STAGING
    ┌──────────────┐   COPIA    ┌──────────────┐
    │ Datos reales │ ────────►  │ Copia de los │
    │ 200 clientes │            │ datos reales │
    │ 500 créditos │            │ Para probar  │
    └──────────────┘            └──────────────┘
         NO SE TOCA                SE PUEDE ROMPER
                                   SIN PROBLEMA
```

### Prerequisitos

Necesitas instalar las herramientas de PostgreSQL en tu PC:

**Opción A - Instalar solo las herramientas de línea de comandos:**

```powershell
# En PowerShell como Administrador
# Instalar con winget (Windows Package Manager)
winget install PostgreSQL.PostgreSQL.16

# O descargar desde: https://www.postgresql.org/download/windows/
# Durante la instalación, solo selecciona "Command Line Tools"
```

**Verificar que se instaló correctamente:**

```powershell
pg_dump --version
# Debe mostrar algo como: pg_dump (PostgreSQL) 16.x
```

### Obtener las credenciales de conexión

1. Ir a **Supabase Dashboard** → Tu proyecto
2. Click **"Settings"** → **"Database"**
3. Buscar la sección **"Connection string"** → Pestaña **"URI"**
4. Copiar la **URI de conexión** (se ve así):
   ```
   postgresql://postgres.[ref]:[password]@aws-0-[region].pooler.supabase.com:5432/postgres
   ```
5. Necesitarás la URI tanto del proyecto **Producción** como del proyecto **Staging**

### Paso a Paso: Copiar datos de Producción a Staging

#### Paso 1: Exportar los datos de Producción

```powershell
# Reemplaza [URI_PRODUCCION] con la URI de conexión de tu proyecto de producción
# Esto crea un archivo con todos los datos

pg_dump "[URI_PRODUCCION]" `
  --data-only `
  --no-owner `
  --no-privileges `
  --exclude-table="auth.*" `
  --exclude-table="storage.*" `
  --exclude-table="_realtime.*" `
  --exclude-table="supabase_*" `
  --file="database/backups/prod_data_backup.sql"
```

> Este comando exporta SOLO los datos de tus tablas (`carteras`, `clientes`, `creditos`, `pagos`, etc.), sin tocar las tablas internas de Supabase.

#### Paso 2: Limpiar los datos existentes en Staging

```sql
-- Ejecutar en el SQL Editor de Supabase STAGING
-- ⚠️ CUIDADO: Esto borra TODOS los datos de staging

-- Desactivar restricciones de foreign keys temporalmente
SET session_replication_role = 'replica';

-- Limpiar tablas en orden (de las que dependen a las independientes)
TRUNCATE TABLE pagos CASCADE;
TRUNCATE TABLE amortizaciones CASCADE;
TRUNCATE TABLE creditos CASCADE;
TRUNCATE TABLE clientes CASCADE;
TRUNCATE TABLE carteras CASCADE;
-- Agrega aquí otras tablas personalizadas si las tienes

-- Reactivar restricciones
SET session_replication_role = 'origin';
```

#### Paso 3: Importar los datos a Staging

```powershell
# Reemplaza [URI_STAGING] con la URI de conexión de tu proyecto de staging

psql "[URI_STAGING]" -f "database/backups/prod_data_backup.sql"
```

#### Paso 4: Verificar

```sql
-- Ejecutar en el SQL Editor de Supabase STAGING
-- Verificar que los datos se copiaron correctamente

SELECT 'carteras' AS tabla, COUNT(*) AS registros FROM carteras
UNION ALL
SELECT 'clientes', COUNT(*) FROM clientes
UNION ALL
SELECT 'creditos', COUNT(*) FROM creditos
UNION ALL
SELECT 'pagos', COUNT(*) FROM pagos
UNION ALL
SELECT 'amortizaciones', COUNT(*) FROM amortizaciones;
```

### Script Automatizado (Recomendado)

Para no tener que recordar todos los pasos, puedes usar este script:

```powershell
# Archivo: scripts/sync-prod-to-staging.ps1
# Uso: .\scripts\sync-prod-to-staging.ps1

# ---- CONFIGURAR ESTAS VARIABLES ----
$PROD_URI = "postgresql://postgres.[ref-prod]:[password]@aws-0-us-east-1.pooler.supabase.com:5432/postgres"
$STAGING_URI = "postgresql://postgres.[ref-staging]:[password]@aws-0-us-east-1.pooler.supabase.com:5432/postgres"
# -------------------------------------

$BACKUP_DIR = "database\backups"
$BACKUP_FILE = "$BACKUP_DIR\prod_data_$(Get-Date -Format 'yyyy-MM-dd_HHmm').sql"

# Crear directorio de backups si no existe
if (!(Test-Path $BACKUP_DIR)) { New-Item -ItemType Directory -Path $BACKUP_DIR }

Write-Host "=== SINCRONIZACION PRODUCCION -> STAGING ===" -ForegroundColor Cyan
Write-Host ""

# Paso 1: Exportar produccion
Write-Host "[1/3] Exportando datos de produccion..." -ForegroundColor Yellow
pg_dump $PROD_URI `
  --data-only `
  --no-owner `
  --no-privileges `
  --exclude-schema="auth" `
  --exclude-schema="storage" `
  --exclude-schema="_realtime" `
  --file=$BACKUP_FILE

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Fallo la exportacion" -ForegroundColor Red
    exit 1
}
Write-Host "   Backup guardado en: $BACKUP_FILE" -ForegroundColor Green

# Paso 2: Limpiar staging
Write-Host "[2/3] Limpiando datos de staging..." -ForegroundColor Yellow
$CLEAN_SQL = @"
SET session_replication_role = 'replica';
TRUNCATE TABLE pagos CASCADE;
TRUNCATE TABLE amortizaciones CASCADE;
TRUNCATE TABLE creditos CASCADE;
TRUNCATE TABLE clientes CASCADE;
TRUNCATE TABLE carteras CASCADE;
SET session_replication_role = 'origin';
"@
echo $CLEAN_SQL | psql $STAGING_URI

# Paso 3: Importar a staging
Write-Host "[3/3] Importando datos a staging..." -ForegroundColor Yellow
psql $STAGING_URI -f $BACKUP_FILE

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "COMPLETADO: Datos de produccion replicados a staging" -ForegroundColor Green
    Write-Host "Archivo de backup: $BACKUP_FILE" -ForegroundColor Gray
} else {
    Write-Host "ERROR: Fallo la importacion" -ForegroundColor Red
}
```

### ⚠️ Consideraciones Importantes

| Aspecto | Detalle |
|---|---|
| **Usuarios (auth)** | Los usuarios de Supabase Auth NO se copian. Deberás crear usuarios de prueba manualmente en staging |
| **Archivos (storage)** | Los archivos de Supabase Storage NO se copian. Solo se copian datos de tablas |
| **UUIDs** | Los IDs se mantienen iguales, así que las relaciones entre tablas se conservan |
| **Frecuencia** | Hazlo solo cuando necesites probar con datos frescos. No es necesario hacerlo cada vez |
| **Backups** | Cada ejecución del script crea un archivo con fecha. Puedes usarlos como backups manuales |
