---
trigger: always_on
---

name: full-stack-developer-rules
description: "Reglas de construcción y restricciones operativas para el Agente Desarrollador"
applied_to: ["frontend/**", "backend/**"]
---

# 💻 Reglas del Desarrollador: Sistema Control de Créditos

## 1. Restricciones de Control de Versiones (GIT)
- **Bloqueo de Escritura en Repo:** El agente tiene PROHIBIDO ejecutar los comandos: `git add`, `git commit`, `git push`, `git merge` o `git rebase`.
- **Modo de Entrega:** Los cambios deben proponerse únicamente como modificaciones de archivos locales o creación de nuevos archivos dentro del Workspace. 
- **Notificación:** Al finalizar una tarea, el agente debe listar los archivos modificados para que el usuario proceda con el commit manual.

## 2. Arquitectura del Backend (Estructura de Carpetas)
- **Controllers:** Solo deben manejar la entrada/salida HTTP y llamar a los servicios. Ruta: `backend/src/controllers/`.
- **Services (Lógica de Negocio):** Toda la lógica financiera (intereses, mora, saldos) debe residir en `backend/src/services/`.
- **Models:** Toda interacción con la base de datos debe pasar por los modelos en `backend/src/models/`. No se permiten queries "raw" (crudas) dentro de los controladores.

## 3. Arquitectura del Frontend (Responsive & Clean)
- **Componentes:** Deben ser atómicos y reutilizables en `frontend/src/components/common/`.
- **Services:** El consumo de APIs es exclusivo de `frontend/src/services/`. Está prohibido usar `fetch` o `axios` dentro de los archivos de la carpeta `pages/`.
- **UI/UX:** Se debe priorizar el uso de clases responsivas para asegurar que las pantallas de `Carteras`, `Clientes` y `Préstamos` funcionen en móviles (mínimo 360px de ancho).

## 4. Estándares de Codificación
- **Variables de Entorno:** Queda prohibido escribir URIs de base de datos o claves directamente. Se debe usar `.env` en backend y `import.meta.env` en frontend.
- **Nomenclatura de Archivos:** - Componentes React: `PascalCase.jsx` (ej. `RegistroPago.jsx`).
  - Lógica/Servicios: `camelCase.js` (ej. `calcularAmortizacion.js`).
- **Errores:** Se debe implementar obligatoriamente el uso de `backend/src/utils/errorHandler.js` en todas las funciones asíncronas.

## 5. Protocolo de Sincronización con el Auditor
- Antes de entregar cualquier funcionalidad, el Desarrollador debe declarar: *"He seguido las reglas de seguridad. Solicito revisión del @Security_Quality_Auditor"*.

## 6. Declaraciond de variables
- datos tipo String las variables deben comenzar por str_[nombre alusivo a lo que almacena] por ejm; str_nomcliente
- datos tipo Integer las variables deben comenzar por int_[nombre alusivo a lo que almacena] por ejm; int_saldoFinalCliente
- asi mismo para las tipo double, date, bolean dbl_[nombre alusivo a lo que almacena], date_[nombre alusivo a lo que almacena], bol_[nombre alusivo a lo que almacena]

## 7. No Eliminar archivos, tablas o elementos del proyecto sin autorización
- Si dentro de un cambio requieres eliminar elementos como archivos, tablas de la base de datos, o elementos del proyecto, debes informar y justificar por qué lo vas a borrar y se eliminará si el encargado del proyecto lo aprueba.

## 8. Eliminar piezas de codigo obsoletas
- quitar del proyecto funciones, piezas de codigo que ya no se usan con el fin de mantener el proyecto completamente depurado de codigo basura pero cumpliendo con lo indicado en la reglas ## 7