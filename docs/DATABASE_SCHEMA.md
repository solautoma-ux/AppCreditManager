# 🗄️ Database Schema Documentation

## Tables

### 1. `carteras`
- **id**: UUID (PK)
- **nombre**: VARCHAR
- **codigo**: VARCHAR (Unique)
- **estado**: VARCHAR ('activa', 'inactiva', 'archivada')
- **encargado_id**: UUID (FK to users, Nullable)
- **admin_id**: UUID (FK to users)
- **saldo_prestado**: DECIMAL (Calculated sum of active loans)
- **saldo_actual**: DECIMAL (Available cash)
- **monto_inicial**: DECIMAL

### 2. `clientes`
- **id**: UUID (PK)
- **admin_id**: UUID
- **nombre**: VARCHAR
- **apellido**: VARCHAR
- **cedula**: VARCHAR
- **movil**: VARCHAR
- **score**: INTEGER (Default 5)

### 3. `creditos`
- **id**: UUID (PK)
- **cartera_id**: UUID (FK)
- **cliente_id**: UUID (FK)
- **monto_capital**: DECIMAL
- **saldo_capital_pendiente**: DECIMAL
- **saldo_interes_pendiente**: DECIMAL
- **estado**: VARCHAR ('activo', 'vencido', 'pagado', 'interrumpido', 'refinanciado', 'archivado')
- **fecha_inicio**: DATE
- **fecha_vencimiento**: DATE

### 4. `pagos`
- **id**: UUID (PK)
- **credito_id**: UUID (FK)
- **monto_total**: DECIMAL (Allows negative values explicitly for Reversals/Undo system)
- **monto_a_capital**: DECIMAL
- **monto_a_interes**: DECIMAL
- **fecha_pago**: DATE
- **registrado_por_id**: UUID (FK)
- **notas**: TEXT

### 5. `amortizaciones`
- **id**: UUID (PK)
- **credito_id**: UUID (FK)
- **numero_cuota**: INTEGER
- **fecha_vencimiento**: DATE
- **valor_cuota**: DECIMAL
- **estado**: VARCHAR ('pendiente', 'pagada', 'parcial', 'mora', 'liquidada')

### 6. `usuarios` (Extension of auth.users)
- **id**: UUID (PK, References auth.users)
- **rol**: VARCHAR ('admin', 'superadmin', 'cobrador', 'encargado')
- **estado**: VARCHAR ('activo', 'inactivo', 'pendiente')
- **whatsapp_mensaje_custom**: TEXT (Custom suffix for WhatsApp messages)

### 7. `audit_log`
- **id**: UUID (PK)
- **usuario_id**: UUID (FK to usuarios)
- **accion**: VARCHAR ('crear', 'actualizar', 'eliminar', 'habilitar', 'inhabilitar', 'retiro')
- **tabla_afectada**: VARCHAR
- **registro_id**: UUID
- **campo_modificado**: VARCHAR
- **valor_anterior**: TEXT
- **valor_nuevo**: TEXT
- **created_at**: TIMESTAMP

### 8. `movimientos_cartera`
- **id**: UUID (PK)
- **cartera_id**: UUID (FK to carteras)
- **tipo_movimiento**: VARCHAR ('retiro_utilidad', 'inversion_adicional')
- **monto**: DECIMAL
- **registrado_por_id**: UUID (FK to usuarios)
- **notas**: TEXT
- **fecha**: TIMESTAMP

---

## RPC Functions (Backend Logic)

### `registrar_pago_completo`
- **Description**: Atomic transaction to register a payment, update credit balances using `GREATEST(0, ...)` safety, update wallet balances, and handle status transition to 'pagado'.
- **Inputs**: `p_credito_id`, `p_monto_total`, `p_monto_a_capital`, `p_monto_a_interes`, `p_fecha_pago`, `p_registrado_por` (UUID), `p_notas`.

### `deshacer_pago`
- **Description**: Atomic transaction to reverse a payment. Validates the LIFO rule, returns balances to the wallet, restores credit balances, recalculates installments state ('pendiente'/'mora'), and generates a negative double-entry accounting record.
- **Rules**: 
  - Fails if payment is older than 24 hours.
  - Fails if another valid positive payment exists after it.
  - Prevents infinite reversals by flagging original payment as `(Reversado)`.

### `archivar_cartera_seguro`
- **Description**: Soft-deletes a wallet by setting status to 'archivada'.
- **Constraint**: Fails if the wallet has any active credits.

### `archivar_credito_seguro`
- **Description**: Soft-deletes a credit by setting status to 'archivado'.
- **Usage**: RESERVED for cascading actions (e.g. when archiving a Cartera/Admin).
- **Logic**: Reverses the capital to the wallet's `saldo_actual` and reduces `saldo_prestado`.
- **Constraint**: Fails if the credit has any associated payments.

### `eliminar_credito_seguro` (Standard Delete)
- **Description**: Permanently removes a credit.
- **Rule**: Primary method for removing loans with NO payments (`count_pagos = 0`).
- **Update**: Fixed logic to prevent negative `saldo_prestado` using `GREATEST(0, ...)`.

### `reprogramar_fecha_inicio_credito`
- **Description**: Updates the start date of a credit and recalculates amortization due dates.
- **Constraint**: Only allowed if the credit has NO payments recorded.
- **Logic**: Shifts all payment dates based on the new start date and the defined payment frequency.

### `refinanciar_credito`
- **Description**: Atomic transaction to close an existing loan and create a new one with consolidated debt (capital + interest).
- **Rules**:
  - Marks the original credit as 'refinanciado' and sets its balances to 0.
  - Recognizes the **pending interest of the original loan** as an income inflow to the wallet (capitalization).
  - Deducts the new loan principal from the wallet's `saldo_actual`.
  - Creates the new credit record and its full amortization schedule in a single transaction.

---

## Constraints & Business Rules
- **Wallet Balance**: `saldo_prestado` should reflect the sum of `saldo_capital_pendiente` of all active/overdue loans.
- **Archive Rules**: Archiving preserves data integrity; entities are hidden from default lists but remain in the database for history.
