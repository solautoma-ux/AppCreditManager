---
trigger: always_on
---

name: database-production-safety-rules
description: "Reglas de protección de esquema de base de datos en ambientes productivos"
applied_to: ["database/**", "backend/src/models/**", "backend/src/services/**"]
---

# 🔒 Reglas de Seguridad de Base de Datos en Producción

## 1. Prohibición de Cambios Destructivos en Tablas

- **NUNCA renombrar columnas existentes** en una tabla que ya esté en producción. Si se necesita un nombre diferente, se debe:
  1. Crear una nueva columna con el nombre correcto.
  2. Escribir una migración que copie los datos de la columna vieja a la nueva.
  3. Actualizar todo el código (backend + frontend) para que use la nueva columna.
  4. Verificar en staging que no haya referencias rotas.
  5. Solo después de la verificación completa, marcar la columna vieja como deprecada (NO eliminarla inmediatamente).
  6. Eliminar la columna vieja en una migración futura separada, previa autorización explícita del encargado del proyecto.

- **NUNCA eliminar columnas directamente.** Toda eliminación de columna debe seguir el proceso de deprecación descrito arriba.

- **NUNCA cambiar el tipo de dato de una columna** que ya contiene datos en producción. En su lugar:
  1. Crear una nueva columna con el tipo correcto.
  2. Migrar los datos con conversión segura.
  3. Validar integridad de los datos migrados.
  4. Deprecar la columna original.

## 2. Migraciones Obligatorias

- **Todo cambio** al esquema de base de datos (nuevas tablas, columnas, índices, triggers, funciones RPC) debe realizarse a través de un archivo de migración en `database/migrations/`.
- **Numeración secuencial:** El archivo debe seguir el formato `NNN_descripcion_del_cambio.sql` (ej: `165_add_column_fecha_pago_real.sql`).
- **Nunca modificar migraciones ya ejecutadas.** Si una migración tiene un error, se debe crear una nueva migración correctiva.
- **Ejecutar primero en Staging, luego en Producción.** Queda prohibido ejecutar migraciones directamente en producción sin haberlas validado en staging.

## 3. Validación Cruzada Post-Migración

- Después de cada migración, se debe ejecutar una búsqueda global (`grep`) del nombre de las columnas afectadas para garantizar que:
  - El frontend no acceda a propiedades que ya no existen.
  - Los servicios del backend no referencien columnas deprecadas.
  - El archivo `docs/DATABASE_SCHEMA.md` esté actualizado.

## 4. Backups Antes de Cambios Estructurales

- **Antes de ejecutar cualquier migración en Producción**, se debe crear un backup de los datos usando `pg_dump` o el script `scripts/sync-prod-to-staging.ps1`.
- El backup debe almacenarse en `database/backups/` con la fecha del backup.

## 5. Resumen de Regla de Oro

```
❌ PROHIBIDO EN PRODUCCIÓN:
   • ALTER TABLE ... RENAME COLUMN ...
   • ALTER TABLE ... DROP COLUMN ...
   • ALTER TABLE ... ALTER COLUMN ... TYPE ...
   • DROP TABLE ...
   • Ejecutar migraciones sin probar en staging

✅ PERMITIDO EN PRODUCCIÓN:
   • ALTER TABLE ... ADD COLUMN ... (agregar columnas nuevas)
   • CREATE TABLE ... (crear tablas nuevas)
   • CREATE INDEX ... (crear índices nuevos)
   • Migraciones ya validadas en staging
```
