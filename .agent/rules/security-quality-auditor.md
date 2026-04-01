---
trigger: always_on
---

name: security-quality-auditor
description: "Reglas críticas de auditoría para el sistema de préstamos y carteras"
applied_to: ["backend/src/**", "frontend/src/**"]
---

# 🛡️ Reglas de Auditoría: Sistema Control de Créditos

## 1. Seguridad de la Información (Prioridad 1)
- **Cero Secretos:** Queda terminantemente prohibido el "hardcoding" de credenciales. El Auditor debe marcar error si detecta strings de conexión, API Keys o contraseñas en archivos `.js` o `.jsx`.
- **Variables de Entorno:** Se exige el uso de `process.env` (backend) o `import.meta.env` (Vite/frontend).
- **Protección de PII:** Los números de móvil de clientes en `backend/src/services/whatsapp/` no deben ser logueados en texto plano; deben usar la utilidad `logger.js` con máscara.
- **Middleware Obligatorio:** Toda nueva ruta en `backend/src/routes/` debe integrar `authMiddleware.js`.

## 2. Estándares de Arquitectura y Carpetas
- **Capa de Servicios:** La lógica de base de datos solo puede existir en `backend/src/services/`. Los controladores (`controllers/`) solo orquestan.
- **Frontend Modular:** Los componentes en `frontend/src/components/` no pueden usar `axios` o `fetch` directamente. Deben llamar a las funciones en `frontend/src/services/`.
- **Nomenclatura:** - Componentes React: `PascalCase` (ej. `TablaAmortizacion.jsx`).
  - Lógica y Utilidades: `camelCase` (ej. `calcularMora.js`).

## 3. Integridad de Lógica Financiera
- **Cálculo de Cuotas:** Cualquier modificación en `backend/src/services/credito/calcularAmortizacion.js` debe ser validada mediante el **Code Interpreter** para asegurar que la suma de cuotas sea igual al `Capital + Interés`.
- **Validación de Fondos:** La función `crearCredito.js` debe realizar obligatoriamente una consulta previa al saldo de la cartera origen antes de registrar el préstamo.

## 4. Calidad del Código
- **Manejo de Errores:** No se permiten bloques `catch` vacíos. Se debe usar obligatoriamente `backend/src/utils/errorHandler.js`.
- **Responsive Design:** Todo nuevo componente en `frontend/src/components/` debe incluir clases de diseño responsivo (CSS/Tailwind) para asegurar visualización en móviles.

## 5. Documentacion del código
- **Funciones:** Cada funcion debe estar documentada indicando que es lo que hace.
- **Bloques de código:** Los bloques de código que no sean funcion deben estar documentados explicando que hace esa pieza de código.
- **Código Css:** Cada pieza de css debe estar documentada sobre que estilo se aplica y a que elemento.

## 6. Integridad de Referencias y Limpieza de Código (Anti-Zombies)
- **Búsqueda Obligatoria Post-Refactor: Siempre que se elimine una columna de la base de datos o se renombre una variable de negocio (ej. capital_inicial vs monto_inicial), el desarrollador DEBE ejecutar una búsqueda global (grep) del término antiguo en todo el proyecto.
- **Tolerancia Cero a Referencias Muertas: El auditor rechazará cambios si detecta que el Frontend intenta acceder a propiedades que ya no existen en el Backend, evitando errores de "undefined" o visualizaciones incorrectas en producción.
- **Validación Cruzada:** Antes de cerrar una tarea de refactorización, se debe verificar que `DATABASE_SCHEMA.md` coincida exactamente con las propiedades usadas en los componentes React.
- **Eliminación de Código Muerto:** El auditor debe marcar error obligatoriamente si encuentra variables declaradas pero no usadas, funciones inaccesibles o bloques de código comentados sin justificación ("TODO"). Se exige limpieza total de "zombies", no acumulación.

## 7. Actualiza el plan de implementacion siempre con las modificaciones incluidas pero nunca lo reescribas completo, solo cambia las partes que se modifiquen

## 8. El archivo de task solo actuliza las partes que se soliciten modificar, nunca lo reescribas o borres por completo

## 9. Prevención de Código Duplicado (Principio DRY)
- **Detección de Patrones Repetitivos:** El Auditor debe realizar un escaneo cruzado en el Workspace para identificar bloques de lógica idénticos o funcionalmente equivalentes. Se debe prestar especial atención a las validaciones de formularios y transformaciones de datos.
- **Umbral de Duplicidad:** Cualquier lógica de negocio, cálculo o estructura de UI que supere las 5 líneas de código y se encuentre en más de un archivo será marcada como una "Infracción de Limpieza".
- **Centralización de Lógica Financiera:** Queda estrictamente prohibido duplicar las fórmulas de cálculo de intereses, mora o amortización. Estas deben residir únicamente en `backend/src/services/credito/` o `backend/src/utils/` y ser importadas por los controladores o servicios que las requieran.
- **Abstracción de Componentes UI:** Si se detectan estructuras de JSX/HTML repetitivas en la carpeta `frontend/src/components/`, el Auditor debe exigir la creación de un componente base en `frontend/src/components/common/`.
- **Protocolo de Refactorización:** Ante un hallazgo de duplicidad, el Auditor no aprobará el código y deberá generar un reporte indicando:
    1. Las rutas de los archivos afectados.
    2. El bloque de código duplicado.
    3. La ubicación sugerida para centralizar la lógica (ej. `frontend/src/hooks/` o `backend/src/utils/`).
    4. Informar estos hallazgos, no ejecutar o modificar nada