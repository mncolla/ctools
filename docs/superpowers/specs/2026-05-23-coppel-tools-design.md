# CTools — Diseño Arquitectónico
**Fecha:** 2026-05-23
**Estado:** Aprobado
**Autor:** Arquitecto de sistema

---

## Contexto

Herramienta interna offline-first para una tienda. Una PC actúa como host/servidor dentro de la red local (LAN). Las demás PCs acceden vía browser apuntando a la IP del host. Internet se usa únicamente para actualizaciones del sistema y backups externos.

### Restricciones operativas
- 1 tienda, 7 PCs (1 host + 6 clientes)
- Máximo 6 usuarios concurrentes
- Red LAN (WiFi/cable), sin acceso a internet en operación normal
- Solo desarrollador: 1 persona
- Windows (todas las máquinas)
- Empaquetado como `.exe`

---

## Stack técnico

### Desktop / Packaging
| Decisión | Elección |
|---|---|
| Framework desktop | Electron via `electron-vite` |
| Bundler | Vite |
| Updater | `electron-updater` (electron-builder) |
| Installer Windows | NSIS via electron-builder |
| Update server | GitHub Releases |

### Frontend
| Decisión | Elección |
|---|---|
| Framework | Svelte 5 |
| Estilos | Tailwind CSS v4 |
| UI components | Componentes propios (evaluar shadcn-svelte después del MVP) |
| Router | svelte-routing (SPA simple) |

### Backend
| Decisión | Elección |
|---|---|
| Runtime | Node.js 20 LTS |
| Framework HTTP | Hono.js |
| ORM / Query | Drizzle ORM |
| Base de datos | SQLite via better-sqlite3 |
| Validación | Zod (schemas compartidos server ↔ frontend) |

### Infraestructura
| Decisión | Elección |
|---|---|
| Auth tokens | JWT (HS256) |
| Hash contraseñas usuarios | argon2 |
| Cifrado vault | AES-256-GCM (Node.js crypto nativo) |
| Backups externos | Cloudflare R2 via AWS SDK v3 |
| Logging | pino |

---

## Arquitectura del sistema

### Patrón: Electron shell + servidor Hono como proceso hijo

Electron actúa como contenedor operativo en la PC host. Al iniciarse, ejecuta `child_process.fork()` del servidor Hono. El servidor sirve el frontend Svelte (archivos estáticos) y la API REST. Todos los clientes — incluido el host — acceden a la app vía browser en `http://192.168.x.x:3000`.

Electron solo gestiona: system tray con estado del sistema, auto-update, startup automático con Windows, y scheduling de backups.

### Topología de red

```
┌─────────────────────────────────────┐
│           LAN 192.168.x.x           │
│                                     │
│  ┌──────────────────────────────┐   │
│  │       PC HOST                │   │
│  │  [Electron .exe]             │   │
│  │    ├── System Tray           │   │
│  │    └── fork()                │   │
│  │          ↓                   │   │
│  │  [Hono Server :3000]         │   │
│  │    ├── API REST /api/v1/*    │   │
│  │    ├── Static / (Svelte)     │   │
│  │    └── SQLite (local disk)   │   │
│  └──────────┬───────────────────┘   │
│             │ HTTP                  │
│    ┌────────┴────────┐              │
│    ↓                 ↓              │
│  [PC Cliente 1]  [PC Cliente 2]     │
│  browser →       browser →          │
│  192.168.x.10:3000                  │
└─────────────────────────────────────┘
         │ internet (solo cuando hay)
         ↓
   GitHub Releases (updates)
   Cloudflare R2 (backups)
```

### Flujo de inicio del host

```
Windows startup
  → Electron auto-start (registro en startup)
    → main.ts: fork('server/index.ts')
    → Esperar puerto :3000 listo
    → Mostrar tray icon (verde = OK)
    → Verificar update en background (si hay internet)
    → Activar scheduling de backup automático
```

### Convenciones de arquitectura
- El server nunca importa código Electron — procesos completamente separados
- El frontend (`/frontend`) nunca hace queries directas a SQLite — todo pasa por la API Hono
- Tipos compartidos en `/shared` — única fuente de verdad para DTOs
- Todas las rutas API bajo `/api/v1/*` para facilitar versioning futuro

---

## Estructura del proyecto

```
ctools/
├── electron/
│   ├── main.ts                  # Entry point, fork del server, tray
│   ├── tray.ts                  # System tray icon + menu
│   ├── updater.ts               # electron-updater logic
│   ├── backup-scheduler.ts      # Cron de backups automáticos
│   └── preload.ts               # Bridge seguro renderer ↔ main
│
├── server/
│   ├── index.ts                 # Entry point del proceso hijo
│   ├── db/
│   │   ├── schema.ts            # Drizzle schema (todas las tablas)
│   │   ├── migrations/          # Archivos de migración SQL
│   │   └── client.ts            # Instancia better-sqlite3
│   ├── routes/
│   │   ├── auth.ts
│   │   ├── cases.ts
│   │   ├── tasks.ts
│   │   ├── documents.ts
│   │   ├── vault.ts
│   │   ├── backup.ts
│   │   └── system.ts
│   ├── middleware/
│   │   ├── auth.ts              # JWT verification
│   │   ├── rbac.ts              # Role-based access control
│   │   └── audit.ts             # Registro automático de acciones
│   └── services/
│       ├── backup.ts            # Lógica R2 + backup local
│       ├── crypto.ts            # AES-256-GCM para vault
│       └── audit.ts             # Escritura de audit log
│
├── frontend/                    # Frontend Svelte
│   ├── lib/
│   │   ├── api.ts               # Cliente HTTP hacia Hono
│   │   ├── stores/              # Svelte stores (auth, ui state)
│   │   └── components/          # Componentes reutilizables
│   ├── routes/
│   │   ├── login/
│   │   ├── status/              # Dashboard de estado del sistema (público)
│   │   ├── cases/               # Público
│   │   ├── tasks/               # Público (restringidas requieren login)
│   │   ├── documents/           # Público
│   │   ├── vault/               # Requiere login
│   │   └── settings/            # Solo Admin
│   └── app.html
│
├── shared/
│   └── types.ts                 # Zod schemas + TypeScript types
│
├── resources/                   # Assets del tray
├── electron.vite.config.ts
├── electron-builder.yml
└── package.json
```

---

## Modelo de datos

Todas las fechas se almacenan como **unix timestamps** (INTEGER). El audit_log desnormaliza `username` para sobrevivir a eliminaciones de usuario.

### Usuarios y sesiones

```sql
users
  id               TEXT PK         -- uuid
  username         TEXT UNIQUE
  display_name     TEXT
  password_hash    TEXT            -- argon2
  role             TEXT            -- 'admin' | 'supervisor' | 'empleado'
  is_active        BOOLEAN
  created_at       INTEGER
  updated_at       INTEGER

sessions
  id               TEXT PK
  user_id          TEXT FK
  token_hash       TEXT            -- hash del JWT para revocación
  ip_address       TEXT
  expires_at       INTEGER
  created_at       INTEGER
```

### Casos

```sql
cases
  id               TEXT PK
  case_number      TEXT UNIQUE     -- 'CASO-2024-00001' autogenerado
  customer_name    TEXT
  customer_dni     TEXT
  customer_phone   TEXT
  customer_email   TEXT
  title            TEXT
  description      TEXT
  status           TEXT            -- 'open' | 'closed'
  created_by       TEXT FK
  assigned_to      TEXT FK
  created_at       INTEGER
  updated_at       INTEGER

case_activities                    -- append-only, nunca UPDATE/DELETE
  id               TEXT PK
  case_id          TEXT FK
  user_id          TEXT FK nullable  -- null si es visitante (no logueado)
  author_label     TEXT              -- display: display_name o 'Visitante (IP)'
  type             TEXT              -- 'comment' | 'status_change' | 'assignment'
  content          TEXT              -- texto o JSON según tipo
  created_at       INTEGER
```

### Pendientes

```sql
tasks
  id               TEXT PK
  title            TEXT
  description      TEXT
  status           TEXT            -- 'pending' | 'in_progress' | 'resolved' | 'cancelled'
  priority         TEXT            -- 'low' | 'medium' | 'high' | 'urgent'
  visibility       TEXT            -- 'all' | 'roles' | 'users'
  visibility_data  TEXT            -- JSON: roles[] o user_ids[]
  assigned_to      TEXT FK
  created_by       TEXT FK
  due_date         INTEGER
  created_at       INTEGER
  updated_at       INTEGER

task_activities                    -- append-only
  id               TEXT PK
  task_id          TEXT FK
  user_id          TEXT FK
  field_changed    TEXT
  old_value        TEXT
  new_value        TEXT
  created_at       INTEGER
```

### Documentos

```sql
documents
  id               TEXT PK
  title            TEXT
  description      TEXT
  url              TEXT
  category         TEXT
  tags             TEXT            -- JSON: string[]
  created_by       TEXT FK
  updated_by       TEXT FK
  created_at       INTEGER
  updated_at       INTEGER
```

### Vault (contraseñas compartidas)

```sql
vault_entries
  id               TEXT PK
  title            TEXT
  username         TEXT
  encrypted_value  TEXT            -- AES-256-GCM, base64
  iv               TEXT            -- vector de inicialización, base64
  notes            TEXT
  visibility       TEXT            -- 'all' | 'roles' | 'users'
  visibility_data  TEXT            -- JSON
  created_by       TEXT FK
  updated_by       TEXT FK
  created_at       INTEGER
  updated_at       INTEGER
```

### Auditoría y configuración

```sql
audit_log                          -- append-only, nunca UPDATE/DELETE
  id               TEXT PK
  user_id          TEXT FK nullable
  username         TEXT            -- desnormalizado
  ip_address       TEXT
  action           TEXT            -- 'case.created' | 'vault.accessed' | etc.
  entity_type      TEXT
  entity_id        TEXT
  metadata         TEXT            -- JSON
  created_at       INTEGER

system_config                      -- KV store
  key              TEXT PK
  value            TEXT            -- JSON
```

### Acciones auditadas

```
auth.login_success / auth.login_failure / auth.logout
case.created / case.comment_added / case.closed
task.created / task.updated / task.status_changed
document.created / document.updated / document.deleted
vault.entry_created / vault.entry_viewed / vault.entry_updated
user.created / user.updated / user.deactivated
backup.started / backup.success / backup.failed
system.update_downloaded / system.update_applied
```

Accesos de solo lectura de bajo riesgo no se loguean para evitar ruido.

---

## Seguridad

### Autenticación
- Login: `username` + `password` → argon2 verify → JWT HS256
- JWT payload: `{ userId, username, role, iat, exp }`
- TTL: 8 horas (configurable en `system_config`)
- Tabla `sessions` permite revocación activa
- Rate limiting en `/api/v1/auth/login`: máx 10 intentos / IP / 15 minutos
- Sin refresh tokens en MVP — re-login al expirar

### Modelo de acceso: mayoría público, login opcional

La app no fuerza login al abrirse. Cualquier PC en la red puede usar las funciones operativas del día a día sin autenticarse. El login desbloquea identidad, rol, y acceso a secciones sensibles.

**Sin login (modo visitante):** acceso a status, casos (ver, crear, comentar), tareas públicas (visibility: all), documentos.
**Con login requerido:** vault, tareas restringidas (visibility: roles/users), cerrar casos, panel Admin, gestión de usuarios, backups.

Las acciones de visitantes se registran en audit_log con `user_id = null` y `username = 'visitante'` más la IP de origen.

### RBAC

| Recurso | Visitante | Empleado | Supervisor | Admin |
|---|---|---|---|---|
| Ver status del sistema | ✅ | ✅ | ✅ | ✅ |
| Ver / crear / comentar casos | ✅ | ✅ | ✅ | ✅ |
| Cerrar casos | ❌ | ❌ | ✅ | ✅ |
| Ver tareas (visibility: all) | ✅ | ✅ | ✅ | ✅ |
| Ver tareas (visibility: restringida) | ❌ | según config | según config | ✅ |
| Crear / editar tareas | ❌ | ❌ | ✅ | ✅ |
| Ver / crear documentos | ✅ | ✅ | ✅ | ✅ |
| Ver vault (visibility: all) | ❌ | ✅ | ✅ | ✅ |
| Ver / crear vault (restringido) | ❌ | ❌ | ✅ | ✅ |
| Audit log | ❌ | ❌ | ❌ | ✅ |
| Gestión de usuarios | ❌ | ❌ | ❌ | ✅ |
| Backups manuales | ❌ | ❌ | ❌ | ✅ |
| Configuración del sistema | ❌ | ❌ | ❌ | ✅ |

### Cifrado del vault
```
Clave maestra = PBKDF2(MASTER_SECRET, salt, 100_000 iter, SHA-256)
Por cada entrada:
  iv = crypto.randomBytes(12)           -- 96 bits, único por entrada
  encrypted = AES-256-GCM(valor, clave_maestra, iv)
  stored: encrypted (base64) + iv (base64) + auth_tag
```

`MASTER_SECRET` se genera aleatoriamente en la primera ejecución del sistema y se almacena en `system_config` como `vault.master_secret`. En el mismo setup inicial, se genera una **clave de recuperación** (mnemónico de 12 palabras o base64 de 32 bytes) que se muestra al Admin una única vez — si `MASTER_SECRET` se pierde sin clave de recuperación, los datos del vault son irrecuperables. La clave de recuperación no se almacena en la app.

### Hardening LAN
- Headers de seguridad en Hono: `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`
- Sin HTTPS en MVP (LAN interna, complejidad de certs auto-firmados no justificada)
- Puerto 3000 no expuesto a internet — sin port forwarding en router
- Credenciales R2 cifradas en `system_config`, nunca en logs

---

## Estrategia de updates

### Flujo
```
App inicia
  → background: GET github.com/releases/latest (si hay internet)
    ├── versión == actual → sin acción
    └── versión > actual → tray badge "Actualización disponible"
          → Admin confirma → electron-updater descarga .exe
          → Progreso en tray
          → "Reiniciar para actualizar"
          → Reinicio → nueva versión activa
```

### Rollback
- `electron-updater` retiene la versión anterior hasta confirmar arranque exitoso
- Si la app nueva no levanta en 30s → rollback automático

### Frecuencia de chequeo
- Automático: cada 4 horas si hay internet (configurable)
- Manual: botón en tray y en panel Admin

---

## Estrategia de backups

### Qué se respalda
El archivo `ctools.db` — todo el estado de la app en un único archivo SQLite.

### Backup local (siempre activo)
```
Cada 6 horas (configurable)
  → database.backup('ctools-YYYY-MM-DD-HHmm.db')
  → Carpeta: %APPDATA%/ctools/backups/
  → Retener últimos 7, eliminar más antiguos
```

### Backup externo R2
```
Mismo trigger (o schedule independiente)
  → Comprimir con zlib (gzip)
  → Upload a R2: backups/YYYY/MM/ctools-YYYY-MM-DD-HHmm.db.gz
  → Registrar en system_config:
      backup.last_success_at, backup.last_success_size, backup.last_error
```

### Restauración (MVP)
Manual: Admin descarga `.db.gz` desde R2, detiene servidor, reemplaza archivo, reinicia. Proceso documentado paso a paso en el README del repo.

### Indicadores en UI (Admin)
```
Estado backup:  ✅ Hace 2 horas (23/05 14:30)
Próximo:        En 4 horas
Destino:        R2 + Local
```

---

## Roadmap incremental

### E0 — Scaffold y setup *(1–2 días)*
Repositorio, electron-vite configurado, estructura de carpetas, TypeScript, Tailwind, Hono corriendo, Drizzle conectado, primera migration vacía. GitHub Actions genera el `.exe`.

**Criterio:** `npm run build` produce un `.exe` instalable que levanta el servidor.

---

### E1 — MVP Técnico *(3–5 días)*
- Electron lanza Hono como proceso hijo
- Tray icon con estado del servidor
- **Pantalla de status del sistema** (visible sin login): estado servidor, versión, último backup, IP local del host, indicador de actualización disponible
- **Pantalla de login** funcional (usuario Admin hardcodeado temporalmente)
- Frontend accesible desde otras PCs vía IP:puerto
- SQLite operativa con schema inicial
- `electron-updater` configurado con GitHub Releases
- Backup manual a R2 funcionando
- Backup local funcionando
- Logging con Pino activo
- Endpoint `/api/v1/health`

**Criterio:** desde segunda PC, abrir browser en IP del host y ver pantalla de status con datos reales. Backup manual exitoso visible en R2 y en la UI.

---

### E2 — Auth y roles *(3–4 días)*
- Setup inicial (primer Admin en primera ejecución)
- Login / logout con JWT
- Middleware RBAC en todas las rutas
- Gestión de usuarios (Admin)
- Pantalla de perfil básica

---

### E3 — Gestión de Casos *(4–5 días)*
- CRUD de casos
- Timeline de actividades inmutable
- Filtros abiertos / cerrados
- Búsqueda por DNI, nombre, número, keywords
- Asignación, cierre, auditoría automática

---

### E4 — Gestión de Pendientes *(3–4 días)*
- CRUD con prioridad y estados
- Visibilidad configurable (all / roles / users)
- Indicadores visuales de tareas atrasadas
- Historial de cambios, auditoría automática

---

### E5 — Índice de Documentos *(2–3 días)*
- CRUD con tags y categorías
- Full-text search (SQLite FTS5)
- Filtros, auditoría automática

---

### E6 — Vault de Contraseñas *(3–4 días)*
- CRUD cifrado con AES-256-GCM
- Visibilidad configurable
- Reveal on demand
- Auditoría de cada acceso
- Setup de clave maestra en primera ejecución

---

### E7 — UX / Testing / Release final *(3–4 días)*
- Revisión UX completa: flujos, feedback de errores, loading states
- Smoke tests en rutas críticas (auth, creación de caso, backup) — no tests exhaustivos
- Instalador NSIS pulido con startup automático
- Documentación de uso interno (README operativo)
- Primera release estable en GitHub

---

**Tiempo estimado total:** 6–8 semanas (un solo desarrollador)

---

### Versiones futuras (fuera de scope actual)
- Panel de auditoría completo para Admin
- Rate limiting en login
- Backup automático por schedule (solo manual en MVP)
- Hardening de seguridad (HTTPS, headers, CSP)
- Tests de integración completos
- Restauración automatizada de backups

---

## Riesgos técnicos

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| IP del host cambia en la LAN | Media | Alto | Documentar cómo asignar IP estática/reserva DHCP en el router |
| SQLite corrupción por corte de luz | Baja | Alto | WAL mode activo + backups cada 6h |
| Puerto 3000 bloqueado por firewall Windows | Media | Alto | Documentar regla de firewall en instalación |
| electron-updater falla en rollback | Baja | Medio | Mantener backup manual del .exe anterior en carpeta local |
| Clave maestra del vault perdida | Baja | Crítico | Generar y mostrar clave de recuperación al Admin en setup |

---

## Decisiones descartadas

- **PostgreSQL:** innecesario para 6 usuarios, agrega complejidad operativa
- **WebSockets:** no justificado, polling es suficiente para este volumen
- **HTTPS en LAN:** complejidad de certificados auto-firmados no justificada para MVP en red interna controlada
- **SSO / Google OAuth:** evaluable a futuro, no en MVP
- **shadcn-svelte:** evaluar después del MVP cuando los componentes propios sean un cuello de botella
- **Prisma ORM:** agrega latencia en contexto Electron, Drizzle es más adecuado
