# 🚀 Auto Manager - Sistema de Gestión de Flotas

Sistema de administración integral (Full-Stack) diseñado para la operación y logística de Auto Manager. Este panel gestiona el ciclo de vida completo de los activos (vehículos), el capital (inversionistas) y los operadores (conductores), conectando las finanzas con las operaciones diarias.

---

### 🧠 Lógica de Negocio (El "Cerebro")

Este sistema está construido sobre 3 modelos de negocio principales que operan en paralelo:

1.  **Modelo "Socio Dueño" (SD):**
    * El conductor adquiere el vehículo.
    * El sistema calcula una "Corrida Financiera" (Costo del Activo + Utilidad) que se guarda en la tabla `vehiculos` como la deuda total del conductor.

2.  **Modelo "Socio Inversionista" (SI):**
    * El modelo "antiguo" (1 inversionista = 1 vehículo).
    * La rentabilidad es un pago fijo (ej. $8,000/mes) al inversionista, y el contrato está atado a un `vehiculo_id` específico en `inversiones_vehiculos`.

3.  **Modelo "Fondo/Pool" (SA - PLUS 60 / SMART 40):**
    * El modelo "nuevo" (Múltiples inversionistas -> Fondo general).
    * Los inversionistas invierten en el "Fondo" y sus contratos **no** están atados a un vehículo (`vehiculo_id = NULL`).
    * La rentabilidad de los vehículos "SA" va a un fondo común, y los pagos a inversionistas salen de ese fondo.

---

### ✨ Lógicas "Inteligentes" Implementadas

Este panel incluye flujos de trabajo automatizados para reducir errores manuales:

* **Flujo de Rentas (Dos Cubetas):** Cada pago de conductor (ej. $450) se divide automáticamente en **"Renta"** (ganancia de la empresa, ej. $400) y **"Abono a Póliza"** (ahorro/cobertura del conductor, ej. $50).
* **Plan de Carrera (Conductores):** Los nuevos conductores inician como "Oro", se les asigna un modelo de póliza y pueden ser promovidos o amonestados.
* **Póliza Mecánica (Dos Modelos):** El sistema gestiona dos tipos de póliza:
    1.  **Ahorro (Modelo Viejo):** El `saldo_poliza_mecanica` empieza en $0 y se *incrementa* con cada abono.
    2.  **Cobertura (Modelo Nuevo):** El `saldo_poliza_mecanica` empieza en $50,000 y se *decrementa* con cada gasto.
* **Conexión Taller-Finanzas:**
    * `Siniestro` -> genera una `Orden de Mantenimiento`.
    * `Mantenimiento` -> al "Finalizar", se descuenta el costo automáticamente del `saldo_poliza_mecanica` del conductor.

---

### 🛠️ Stack Tecnológico

* **Frontend:** React (con Vite), TailwindCSS, React Router, Recharts.
* **Backend:** Node.js, Express, PostgreSQL (con Knex.js).
* **Autenticación:** JSON Web Tokens (JWT).
* **Almacenamiento de Archivos:** Cloudinary (Siniestros, Documentos de Conductores).
* **Gestión de BD:** Migraciones con Knex.

---

### 📂 Estructura del Proyecto (Resumen)

auto-manager-sistema/ ├── backend/ │ ├── controllers/ # Cerebros (lógica de cada endpoint) │ │ ├── admin/ │ │ │ ├── conductoresAdminController.js │ │ │ ├── mantenimientosAdminController.js │ │ │ ├── pagosRentasAdminController.js │ │ │ ├── siniestrosAdminController.js │ │ │ ├── vehiculosController.js │ │ │ ├── inversionistasController.js │ │ │ └── ... │ │ ├── conductor/ # Endpoints para la App del Conductor │ │ └── solicitudController.js # Endpoint público de captación │ ├── services/ │ │ ├── postgresService.js # Lógica de BD (Knex) │ │ ├── inversionesService.js │ │ └── auditService.js │ ├── routes/ # Definición de rutas de la API │ ├── middleware/ # (Auth, Uploads, Auditoría) │ └── knexfile.js # Configuración de Migraciones ├── frontend/ │ ├── src/ │ │ ├── pages/ # Vistas principales │ │ │ ├── admin/ # (Dashboard, Vehiculos, Conductores, etc.) │ │ │ ├── conductor/ # (DriverDashboard, Pagos) │ │ │ └── public/ # (PortalSolicitud, PortalInversion) │ │ ├── components/ # Componentes reutilizables (Modales, Gráficos) │ │ ├── contexts/ # Manejo de estado global (AuthContext, etc.) │ │ ├── services/ # Conexión del Frontend con el Backend │ │ └── App.jsx # Enrutador principal ├── migrations/ # Historial de cambios de la BD ├── .gitignore ├── LICENSE.md # Licencia (Ver abajo) └── README.md # (Este archivo)


---

### 🏁 Cómo Empezar (Instalación Local)

Sigue estos pasos para levantar el entorno de desarrollo.

#### 1. Backend (API)

```bash
# 1. Navegar a la carpeta del backend
cd backend

# 2. Instalar dependencias
npm install

# 3. Crear el archivo .env (copiar de .env.example)
cp .env.example .env

# 4. Llenar las variables de .env (BD, JWT, Cloudinary)

# 5. Correr las migraciones de la base de datos
npx knex migrate:latest

# 6. Iniciar el servidor (en http://localhost:3001)
npm run dev


# 1. (En una nueva terminal) Navegar a la carpeta del frontend
cd frontend

# 2. Instalar dependencias
npm install

# 3. Crear el archivo .env (copiar de .env.example)
cp .env.example .env

# 4. Iniciar la aplicación (en http://localhost:5173)
npm run dev

¡Perfecto! El comando tree funcionó exactamente como esperábamos.

Ahora tengo el "mapa" completo de tu proyecto (tree -I "node_modules"). Tu arquitectura "monorepo" está muy bien organizada (frontend/, backend/, migrations/).

También veo que ya creaste los archivos LICENSE.md y README.md en la raíz. ¡Excelente!

Aquí está el PASO 2.

🚀 PASO 2: Rellenar tu README.md (El Manual Profesional)

Como me dijiste que tu README.md estaba vacío, aquí tienes el contenido "profesional" y "hecho a medida" que explica el paquete completo (la lógica de negocio y la estructura de carpetas) para tu cliente o para futuros programadores.

Tu Tarea: Abre tu archivo README.md (el que está en la raíz, junto a frontend/ y backend/) y pega este contenido adentro:

Markdown
# 🚀 Auto Manager - Sistema de Gestión de Flotas

Sistema de administración integral (Full-Stack) diseñado para la operación y logística de Auto Manager. Este panel gestiona el ciclo de vida completo de los activos (vehículos), el capital (inversionistas) y los operadores (conductores), conectando las finanzas con las operaciones diarias.

---

### 🧠 Lógica de Negocio (El "Cerebro")

Este sistema está construido sobre 3 modelos de negocio principales que operan en paralelo:

1.  **Modelo "Socio Dueño" (SD):**
    * El conductor adquiere el vehículo.
    * El sistema calcula una "Corrida Financiera" (Costo del Activo + Utilidad) que se guarda en la tabla `vehiculos` como la deuda total del conductor.

2.  **Modelo "Socio Inversionista" (SI):**
    * El modelo "antiguo" (1 inversionista = 1 vehículo).
    * La rentabilidad es un pago fijo (ej. $8,000/mes) al inversionista, y el contrato está atado a un `vehiculo_id` específico en `inversiones_vehiculos`.

3.  **Modelo "Fondo/Pool" (SA - PLUS 60 / SMART 40):**
    * El modelo "nuevo" (Múltiples inversionistas -> Fondo general).
    * Los inversionistas invierten en el "Fondo" y sus contratos **no** están atados a un vehículo (`vehiculo_id = NULL`).
    * La rentabilidad de los vehículos "SA" va a un fondo común, y los pagos a inversionistas salen de ese fondo.

---

### ✨ Lógicas "Inteligentes" Implementadas

Este panel incluye flujos de trabajo automatizados para reducir errores manuales:

* **Flujo de Rentas (Dos Cubetas):** Cada pago de conductor (ej. $450) se divide automáticamente en **"Renta"** (ganancia de la empresa, ej. $400) y **"Abono a Póliza"** (ahorro/cobertura del conductor, ej. $50).
* **Plan de Carrera (Conductores):** Los nuevos conductores inician como "Oro", se les asigna un modelo de póliza y pueden ser promovidos o amonestados.
* **Póliza Mecánica (Dos Modelos):** El sistema gestiona dos tipos de póliza:
    1.  **Ahorro (Modelo Viejo):** El `saldo_poliza_mecanica` empieza en $0 y se *incrementa* con cada abono.
    2.  **Cobertura (Modelo Nuevo):** El `saldo_poliza_mecanica` empieza en $50,000 y se *decrementa* con cada gasto.
* **Conexión Taller-Finanzas:**
    * `Siniestro` -> genera una `Orden de Mantenimiento`.
    * `Mantenimiento` -> al "Finalizar", se descuenta el costo automáticamente del `saldo_poliza_mecanica` del conductor.

---

### 🛠️ Stack Tecnológico

* **Frontend:** React (con Vite), TailwindCSS, React Router, Recharts.
* **Backend:** Node.js, Express, PostgreSQL (con Knex.js).
* **Autenticación:** JSON Web Tokens (JWT).
* **Almacenamiento de Archivos:** Cloudinary (Siniestros, Documentos de Conductores).
* **Gestión de BD:** Migraciones con Knex.

---

### 📂 Estructura del Proyecto (Resumen)

Tu `tree` muestra esta arquitectura:

auto-manager-sistema/ ├── backend/ │ ├── controllers/ # Cerebros (lógica de cada endpoint) │ │ ├── admin/ │ │ │ ├── conductoresAdminController.js │ │ │ ├── mantenimientosAdminController.js │ │ │ ├── pagosRentasAdminController.js │ │ │ ├── siniestrosAdminController.js │ │ │ ├── vehiculosController.js │ │ │ ├── inversionistasController.js │ │ │ └── ... │ │ ├── conductor/ # Endpoints para la App del Conductor │ │ └── solicitudController.js # Endpoint público de captación │ ├── services/ │ │ ├── postgresService.js # Lógica de BD (Knex) │ │ ├── inversionesService.js │ │ └── auditService.js │ ├── routes/ # Definición de rutas de la API │ ├── middleware/ # (Auth, Uploads, Auditoría) │ └── knexfile.js # Configuración de Migraciones ├── frontend/ │ ├── src/ │ │ ├── pages/ # Vistas principales │ │ │ ├── admin/ # (Dashboard, Vehiculos, Conductores, etc.) │ │ │ ├── conductor/ # (DriverDashboard, Pagos) │ │ │ └── public/ # (PortalSolicitud, PortalInversion) │ │ ├── components/ # Componentes reutilizables (Modales, Gráficos) │ │ ├── contexts/ # Manejo de estado global (AuthContext, etc.) │ │ ├── services/ # Conexión del Frontend con el Backend │ │ └── App.jsx # Enrutador principal ├── migrations/ # Historial de cambios de la BD ├── .gitignore ├── LICENSE.md # Licencia (Ver abajo) └── README.md # (Este archivo)


---

### 🏁 Cómo Empezar (Instalación Local)

Sigue estos pasos para levantar el entorno de desarrollo.

#### 1. Backend (API)

```bash
# 1. Navegar a la carpeta del backend
cd backend

# 2. Instalar dependencias
npm install

# 3. Crear el archivo .env (copiar de .env.example)
cp .env.example .env

# 4. Llenar las variables de .env (BD, JWT, Cloudinary)

# 5. Correr las migraciones de la base de datos
npx knex migrate:latest

# 6. Iniciar el servidor (en http://localhost:3001)
npm run dev
2. Frontend (Panel de Admin)

Bash
# 1. (En una nueva terminal) Navegar a la carpeta del frontend
cd frontend

# 2. Instalar dependencias
npm install

# 3. Crear el archivo .env (copiar de .env.example)
cp .env.example .env

# 4. Iniciar la aplicación (en http://localhost:5173)
npm run dev
📜 Licencia

Este es un software comercial y propietario con licencia de uso restringida. Copyright (c) 2025 somoslazaro.marketing. Todos los derechos reservados.

Consulte el archivo LICENSE.md para más detalles sobre los términos de uso.