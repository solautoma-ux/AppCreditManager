# ==============================================================================
# sync-prod-to-staging.ps1
# Descripcion: Crea un backup local (snapshot de migraciones y docs) antes
#              de ejecutar cambios estructurales en produccion.
# Uso        : .\scripts\sync-prod-to-staging.ps1
# ==============================================================================

# --- 0. Configuracion general -------------------------------------------------
$str_fecha      = Get-Date -Format "yyyy-MM-dd_HH-mm"
$str_raiz       = Split-Path -Parent $PSScriptRoot
$str_backupDir  = Join-Path $str_raiz "database\backups"
$str_backupSnap = Join-Path $str_backupDir "backup_$str_fecha"

# --- 1. Crear directorio de backups si no existe ------------------------------
if (-not (Test-Path $str_backupDir)) {
    New-Item -ItemType Directory -Path $str_backupDir | Out-Null
    Write-Host "Directorio de backups creado: $str_backupDir" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "=============================================" -ForegroundColor Yellow
Write-Host "  BACKUP DE SEGURIDAD  Control de Creditos  " -ForegroundColor Yellow
Write-Host "  Fecha: $str_fecha" -ForegroundColor Yellow
Write-Host "=============================================" -ForegroundColor Yellow
Write-Host ""

# --- 2. Leer y validar variables de entorno -----------------------------------
$str_envPath = Join-Path $str_raiz "backend\.env"

if (-not (Test-Path $str_envPath)) {
    Write-Host "ERROR: No se encontro backend\.env" -ForegroundColor Red
    Write-Host "  Crea el archivo copiando backend\.env.example" -ForegroundColor Red
    exit 1
}

$bol_urlFound    = $false
$str_supabaseUrl = ""

Get-Content $str_envPath | ForEach-Object {
    if ($_ -match "^SUPABASE_URL=(.+)$") {
        $str_supabaseUrl = $Matches[1].Trim()
        $bol_urlFound    = $true
    }
}

if (-not $bol_urlFound) {
    Write-Host "ERROR: SUPABASE_URL no encontrado en backend\.env" -ForegroundColor Red
    exit 1
}

# Mascara para no loguear la URL completa (Regla PII Auditor)
$int_maskLen  = [Math]::Min(30, $str_supabaseUrl.Length)
$str_urlMask  = $str_supabaseUrl.Substring(0, $int_maskLen) + "***"
Write-Host "Proyecto Supabase detectado: $str_urlMask" -ForegroundColor Green

# --- 3. Crear snapshot local de archivos criticos ----------------------------
Write-Host ""
Write-Host "Creando snapshot local de archivos criticos..." -ForegroundColor Cyan

New-Item -ItemType Directory -Path $str_backupSnap | Out-Null

# Copiar migraciones SQL
$str_migrDir = Join-Path $str_raiz "database\migrations"
if (Test-Path $str_migrDir) {
    Copy-Item -Path $str_migrDir -Destination (Join-Path $str_backupSnap "migrations") -Recurse
    $int_total = (Get-ChildItem (Join-Path $str_backupSnap "migrations") -Filter "*.sql").Count
    Write-Host "  OK Migraciones copiadas: $int_total archivos .sql" -ForegroundColor Green
}

# Copiar documentacion de esquema
$str_schemaDoc = Join-Path $str_raiz "docs\DATABASE_SCHEMA.md"
if (Test-Path $str_schemaDoc) {
    Copy-Item -Path $str_schemaDoc -Destination $str_backupSnap
    Write-Host "  OK DATABASE_SCHEMA.md respaldado" -ForegroundColor Green
}

# Copiar plantilla de variables (NUNCA el .env real)
$str_envExample = Join-Path $str_raiz "backend\.env.example"
if (Test-Path $str_envExample) {
    Copy-Item -Path $str_envExample -Destination $str_backupSnap
    Write-Host "  OK .env.example copiado como referencia" -ForegroundColor Green
}

# --- 4. Generar manifiesto del backup ----------------------------------------
$str_manifestPath = Join-Path $str_backupSnap "BACKUP_MANIFEST.txt"

$str_linea1  = "BACKUP CONTROL DE CREDITOS"
$str_linea2  = "==========================="
$str_linea3  = "Fecha         : $str_fecha"
$str_linea4  = "Proyecto Supa : $str_urlMask"
$str_linea5  = "Generado por  : sync-prod-to-staging.ps1"
$str_linea6  = "Contenido:"
$str_linea7  = "  - /migrations/        Todas las migraciones SQL al momento del backup"
$str_linea8  = "  - DATABASE_SCHEMA.md  Documentacion del esquema vigente"
$str_linea9  = "  - .env.example        Referencia de variables requeridas (sin valores reales)"
$str_linea10 = ""
$str_linea11 = "INSTRUCCIONES PARA RESTAURAR:"
$str_linea12 = "  1. Ve a Supabase Dashboard, Project Settings, Database, Backups"
$str_linea13 = "  2. Descarga el backup puntual de produccion correspondiente a esta fecha."
$str_linea14 = "  3. Para restaurar el esquema, ejecuta las migraciones en orden en el SQL Editor."
$str_linea15 = ""
$str_linea16 = "AVISO:"
$str_linea17 = "  Este snapshot NO contiene datos de clientes ni credenciales."
$str_linea18 = "  Para un backup completo de datos (pg_dump), usa el panel de Supabase."

$arr_manifest = @(
    $str_linea1, $str_linea2, $str_linea3, $str_linea4, $str_linea5,
    $str_linea6, $str_linea7, $str_linea8, $str_linea9, $str_linea10,
    $str_linea11, $str_linea12, $str_linea13, $str_linea14, $str_linea15,
    $str_linea16, $str_linea17, $str_linea18
)

Set-Content -Path $str_manifestPath -Value $arr_manifest -Encoding UTF8
Write-Host "  OK Manifiesto de backup generado" -ForegroundColor Green

# --- 5. Resultado final -------------------------------------------------------
Write-Host ""
Write-Host "=============================================" -ForegroundColor Green
Write-Host "  BACKUP COMPLETADO EXITOSAMENTE            " -ForegroundColor Green
Write-Host "  Ubicacion: database\backups\backup_$str_fecha" -ForegroundColor Green
Write-Host "=============================================" -ForegroundColor Green
Write-Host ""
Write-Host "RECUERDA: Para backup completo de DATOS (registros de clientes," -ForegroundColor Yellow
Write-Host "  creditos, pagos), ve a:" -ForegroundColor Yellow
Write-Host "  Supabase Dashboard - Project Settings - Database - Backups" -ForegroundColor Yellow
Write-Host ""
