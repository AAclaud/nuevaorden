# Taquería Nueva Orden — POS

Sistema de punto de venta.
Multi-sucursal · Multi-dispositivo · Login por PIN · Tiempo real (SSE) · Modo Mostrador (toma express) · Reportes con PDF

Desarrollado por **AA Projects**.

---

## Archivos

```
.
├── server.js    ← Servidor Node.js
├── index.html   ← App web (React + Jost/Futura)
├── data.json    ← Base de datos (auto-generada)
└── README.md
```

---

## Iniciar (red local)

```bash
node server.js
```

Accede desde:
- Esta PC: `http://localhost:3000`
- Otros dispositivos (celular / tablet / caja) en el mismo WiFi: `http://[IP-local]:3000`

La terminal imprime la IP de red al iniciar.

---

## Multi-dispositivo

Cualquier dispositivo (celular, tablet, laptop, caja) en la misma red puede abrir la URL `http://[IP]:3000` y trabajar en simultáneo: lo que uno cambia se sincroniza en los demás en tiempo real (Server-Sent Events). No hace falta instalar nada, solo un navegador.

Vistas optimizadas:

| Dispositivo | Experiencia |
|-------------|-------------|
| Celular     | Navegación inferior, vista compacta |
| Tablet      | **Modo Mostrador** ideal — botones grandes, toma express |
| Desktop     | Navegación superior, orden + separar cuentas |

---

## Modo Mostrador (tablet / caja)

Pestaña **Mostrador**: optimizada para toma de pedidos express (típico de caja o ventanilla).
- Grid grande de productos táctil
- Ticket numerado automáticamente
- Cobro directo sin asignar mesa
- Historial rápido de últimos tickets

---

## Login por PIN

| Rol    | PIN por defecto | Acceso |
|--------|-----------------|--------|
| Cajero | `0000`          | Mesas, Mostrador, Caja, Inventario |
| Admin  | `1234`          | Todo lo anterior + Menú, Reportes, Admin |

**Cambiar PINs:** entra como Admin → pestaña Admin → Seguridad.

---

## Reportes contables

Pestaña **Reportes** (solo admin):
- Selector **Diario / Semanal / Mensual**
- KPIs: total, N° ventas, venta promedio, top producto
- Desglose mesas vs. mostrador
- Gráficas: ventas por hora (diario) o por día (semanal/mensual), mix de productos (dona)
- Botón **📄 Descargar PDF**: genera informe formateado con portada, KPIs, gráfica, tabla de ventas por producto y detalle de transacciones.

---

## Respaldo de datos

```bash
# En el servidor
cp data.json data-backup-$(date +%Y%m%d).json
```

Para **reiniciar todos los datos**: elimina `data.json` y reinicia el servidor (se recrea con valores por defecto).

---

## Cambiar puerto

```bash
PORT=8080 node server.js
```

---

## Créditos

**AA Projects** — Sistema de toma de pedidos.
