# SAVI Demo · Sistema de inventario y ventas

Demo comercial en **Astro 5** con backend SSR, base de datos **Turso (libSQL)** y despliegue en **Netlify**. Cubre inventario, ventas, créditos, reportes, presupuestos y gestión de usuarios con roles.

---

## Requisitos previos

Instalá estas herramientas **antes** de empezar:

| Herramienta | Versión recomendada | Para qué |
|-------------|---------------------|----------|
| [Node.js](https://nodejs.org/) | 18 o superior | Runtime del proyecto |
| [pnpm](https://pnpm.io/installation) | 9+ | Gestor de paquetes |
| [Turso CLI](https://docs.turso.tech/cli) | Última | Crear BD y ejecutar SQL *(opcional si usás la consola web)* |
| Cuenta [Turso](https://turso.tech/) | — | Base de datos en la nube |
| Cuenta [Netlify](https://www.netlify.com/) | — | Despliegue en producción |

```bash
# Verificar instalación
node -v
pnpm -v
turso --version   # opcional
```

---

## Dependencias del proyecto

Se instalan automáticamente con `pnpm install`. Referencia principal:

| Paquete | Uso |
|---------|-----|
| `astro` | Framework y SSR |
| `@astrojs/netlify` | Adapter para producción (Netlify) |
| `@astrojs/node` | Adapter para desarrollo local en Windows |
| `@libsql/client` | Conexión a Turso |
| `bcrypt` | Hash de contraseñas |
| `jsonwebtoken` | Autenticación por JWT |
| `chart.js` | Gráficos del dashboard |
| `xlsx` | Carga masiva de productos (Excel) |
| `html-to-image` | Exportar / imprimir documentos |
| `dotenv` | Variables de entorno (seed local) |

---

## Guía: cliente nuevo (de cero a demo)

Cada cliente debe tener **su propia base de datos Turso** y **su propio `.env`**. No compartas credenciales entre clientes.

```mermaid
flowchart TD
    A[Clonar repo] --> B[pnpm install]
    B --> C[Crear BD en Turso]
    C --> D[Ejecutar db.sql]
    D --> E[Configurar .env]
    E --> F[pnpm seed]
    F --> G[Personalizar marca]
    G --> H[pnpm dev]
    H --> I[Probar flujos]
    I --> J[Deploy Netlify]
```

### Paso 1 · Clonar e instalar

```bash
git clone <url-del-repo>
cd sistema-demo-inventario
pnpm install
```

### Paso 2 · Crear la base de datos en Turso

```bash
# Crear base de datos (nombre único por cliente)
turso db create cliente-xyz-demo

# Obtener URL y token
turso db show cliente-xyz-demo --url
turso db tokens create cliente-xyz-demo
```

También podés crear la BD desde el [dashboard de Turso](https://turso.tech/app).

### Paso 3 · Crear tablas

Ejecutá el esquema completo contra la BD nueva:

```bash
turso db shell cliente-xyz-demo < src/lib/db.sql
```

O copiá y pegá el contenido de `src/lib/db.sql` en la consola SQL de Turso.

> Los índices del final del archivo son opcionales (rendimiento). Las tablas y el `INSERT` de seed **no** van en este archivo; el seed se hace en el paso 5.

### Paso 4 · Configurar variables de entorno

Creá un archivo `.env` en la raíz del proyecto (está en `.gitignore`, **no se sube al repo**):

```env
DATABASE_URL=libsql://tu-base.turso.io
DATABASE_AUTH_TOKEN=tu_token_de_turso
JWT_SECRET=secreto_largo_y_unico_por_cliente

# Datos iniciales para pnpm seed
SEED_ADMIN_USER=admin
SEED_ADMIN_PASSWORD=cambiar_por_clave_segura
SEED_ADMIN_NOMBRE=Administrador
SEED_TASA=4000
```

| Variable | Obligatoria | Descripción |
|----------|-------------|-------------|
| `DATABASE_URL` | Sí | URL de la BD Turso |
| `DATABASE_AUTH_TOKEN` | Sí | Token de acceso a Turso |
| `JWT_SECRET` | Sí | Secreto para firmar sesiones |
| `SEED_ADMIN_USER` | No | Usuario admin inicial (default: `admin`) |
| `SEED_ADMIN_PASSWORD` | No | Contraseña del admin inicial |
| `SEED_ADMIN_NOMBRE` | No | Nombre visible del admin |
| `SEED_TASA` | No | Tasa USD → COP inicial |

### Paso 5 · Semilla inicial

Inserta el **primer administrador** y la **tasa del día**:

```bash
pnpm seed
```

Salida esperada:

```text
Admin "admin" creado.
Tasa inicial: 4000
Seed completado.
```

El script es **idempotente**: si el usuario ya existe, no lo duplica.

### Paso 6 · Personalizar la marca del cliente

| Archivo | Qué editar |
|---------|------------|
| `src/data/empresa.json` | Nombre, RIF, teléfono, dirección, email |
| `public/logo.svg` | Logo en login e impresiones |
| `public/favicon.svg` | Icono del navegador *(opcional)* |

### Paso 7 · Desarrollo local

```bash
pnpm dev
```

Abrí [http://localhost:4321](http://localhost:4321), iniciá sesión con el admin del seed y verificá:

- [ ] Login y cierre de sesión
- [ ] Tasa del día
- [ ] Alta de producto y cliente
- [ ] Registro de venta (contado y crédito)
- [ ] Reportes (como admin)

### Paso 8 · Datos de demo *(recomendado)*

Entrá como admin y prepará el escenario:

1. Ajustá la **tasa real** en *Tasa del Día*
2. Cargá productos (manual o **carga masiva** `.xlsx` en *Productos*)
3. Creá 1–2 clientes de prueba
4. Registrá una venta de ejemplo

### Paso 9 · Despliegue en Netlify

1. Conectá el repositorio en Netlify
2. **Build command:** `pnpm build`
3. **Publish directory:** `dist` *(Netlify lo detecta con el adapter)*
4. Agregá las variables de entorno en el panel:

   - `DATABASE_URL`
   - `DATABASE_AUTH_TOKEN`
   - `JWT_SECRET`

   > No hace falta `SEED_*` en Netlify si ya ejecutaste `pnpm seed` contra esa BD.

5. Desplegá y probá login en la URL de producción

En Windows el proyecto usa el adapter **Node** en local; en Netlify usa **Netlify** automáticamente (`astro.config.mjs`).

---

## Comandos disponibles

| Comando | Descripción |
|---------|-------------|
| `pnpm install` | Instala dependencias |
| `pnpm dev` | Servidor de desarrollo en `localhost:4321` |
| `pnpm dev:force` | Dev forzando recompilación |
| `pnpm build` | Build de producción en `./dist/` |
| `pnpm preview` | Preview del build local |
| `pnpm seed` | Inserta admin + tasa inicial en Turso |
| `pnpm astro ...` | CLI de Astro |

---

## Módulos del sistema

| Módulo | Ruta | Rol |
|--------|------|-----|
| Dashboard | `/` | Todos |
| Tasa del día | `/tasa` | Todos |
| Clientes | `/clientes` | Todos |
| Ventas | `/ventas` | Todos |
| Créditos | `/creditos` | Todos |
| Presupuestos | `/presupuestos` | Todos |
| Productos | `/productos` | Admin |
| Cargas de factura | `/cargas` | Admin |
| Reportes | `/reportes` | Admin |
| Usuarios | `/usuarios` | Admin |

---

## Estructura del proyecto

```text
/
├── public/              # Assets estáticos (logo, favicon)
├── scripts/
│   └── seed.js          # Semilla: admin + tasa
├── src/
│   ├── components/      # Navbar, encabezados de empresa
│   ├── data/
│   │   └── empresa.json # Datos de marca del cliente
│   ├── layouts/
│   ├── lib/
│   │   └── db.sql       # Esquema completo de la BD
│   ├── pages/           # Vistas Astro + API routes
│   └── utils/           # Auth, transacciones, validaciones
├── astro.config.mjs
├── package.json
└── .env                 # Local, no commitear
```

---

## Resumen por cliente

| Elemento | ¿Único por cliente? |
|----------|---------------------|
| Código del repo | Compartido |
| BD Turso | **Sí — una por cliente** |
| `.env` / vars Netlify | **Sí** |
| `pnpm seed` | **Sí — una vez por BD** |
| `empresa.json` + logos | **Sí** |
| Productos / clientes demo | **Sí — opcional** |

---

## Solución de problemas

**`pnpm seed` → Falta DATABASE_URL**  
Creá el `.env` en la raíz con las credenciales de Turso.

**Error al hacer seed / login**  
Verificá que `db.sql` se haya ejecutado completo antes del seed.

**Login falla después del seed**  
La contraseña debe coincidir con `SEED_ADMIN_PASSWORD` del `.env` usado al correr el seed.

**Build falla en Netlify**  
Confirmá que `DATABASE_URL`, `DATABASE_AUTH_TOKEN` y `JWT_SECRET` estén en las variables de entorno del sitio.

---

## Licencia y uso

Proyecto demo comercial · SAVI. Uso interno y presentación a clientes.
