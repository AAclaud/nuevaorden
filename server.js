/**
 * Taquería Nueva Orden — POS · Servidor
 * Multi-sucursal · Multi-dispositivo · PIN Auth · SSE en tiempo real · data.json
 * Sistema por AA Projects
 *
 * node server.js
 *
 * Para producción/sucursales remotas ver README.md → sección "Nube"
 */

const http = require('http');
const fs   = require('fs');
const path = require('path');
const os   = require('os');

const PORT      = process.env.PORT || 3000;
// DATA_FILE: en Railway apuntar a un volume persistente, ej. /data/data.json
// Localmente cae a ./data.json
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, 'data.json');
const HTML_FILE = path.join(__dirname, 'index.html');

// Asegura que el directorio del archivo de datos exista (para volumes recién montados)
try {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
} catch (e) { console.warn('⚠ No se pudo crear directorio de datos:', e.message); }

// ─── Datos por defecto ────────────────────────────────────────────
function defaultMenu() {
  return [
    { id:1, nombre:'Taco de birria',  precio:45, emoji:'🌮', invId:1 },
    { id:2, nombre:'Birria +1',       precio:15, emoji:'➕', invId:1 },
    { id:3, nombre:'Taco al pastor',  precio:35, emoji:'🌮', invId:3 },
    { id:4, nombre:'Pastor +1',       precio:15, emoji:'➕', invId:3 },
    { id:5, nombre:'Birriamen',       precio:40, emoji:'🍜', invId:4 },
    { id:6, nombre:'Gaseosa',         precio:10, emoji:'🥤', invId:5 },
    { id:7, nombre:'Fresco natural',  precio:10, emoji:'🍵', invId:7 },
    { id:8, nombre:'Jarrito',         precio:20, emoji:'🫙', invId:6 },
  ];
}
function defaultInventario() {
  return [
    { id:1, nombre:'Carne de birria (kg)',  stock:5,  min:2 },
    { id:2, nombre:'Tortillas (paquetes)',  stock:8,  min:2 },
    { id:3, nombre:'Carne al pastor (kg)',  stock:4,  min:2 },
    { id:4, nombre:'Birriamen (porciones)', stock:5,  min:2 },
    { id:5, nombre:'Gaseosas (unidades)',   stock:12, min:2 },
    { id:6, nombre:'Jarritos (unidades)',   stock:6,  min:2 },
    { id:7, nombre:'Frescos naturales',     stock:8,  min:2 },
  ];
}
function defaultMesas(n=8) {
  return Array.from({ length: n }, (_, i) => ({
    id: i+1, nombre: 'Mesa '+(i+1), estado:'libre', orden:[], personas:2, cobrado:0
  }));
}

function defaultSucursal(id, nombre, ciudad) {
  return {
    id, nombre, ciudad,
    menu:        defaultMenu(),
    inventario:  defaultInventario(),
    mesas:       defaultMesas(8),
    transacciones: [],
    ventas:      {},
    _nextMenuId: 9,
    _nextInvId:  8,
    _nextMesaId: 9,
  };
}

function defaultData() {
  return {
    // Auth: PINs por rol (globales)
    pins: {
      admin:  '1234',
      cajero: '0000',
    },
    // Sucursales
    sucursales: [
      defaultSucursal(1, 'Taquería Nueva Orden — Central', 'Guatemala City'),
    ],
    _nextSucId: 2,
  };
}

// ─── Cargar / guardar ─────────────────────────────────────────────
function loadData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      const parsed = JSON.parse(raw);

      // ── Detectar formato VIEJO (v4 flat) y migrar ──────────────
      // El formato viejo tiene {menu, inventario, mesas, transacciones, ventas}
      // El formato nuevo tiene {sucursales: [...], pins}
      if (!parsed.sucursales && parsed.menu) {
        console.log('⚠ Detectado data.json formato anterior (v4). Migrando automáticamente...');
        const suc = defaultSucursal(1, 'Taquería Nueva Orden — Central', '');
        // Copiar datos del formato viejo a la sucursal 1
        if (parsed.menu)          suc.menu          = parsed.menu;
        if (parsed.inventario)    suc.inventario    = parsed.inventario;
        if (parsed.mesas)         suc.mesas         = parsed.mesas.map(m => ({
          nombre: 'Mesa ' + m.id, cobrado: 0, ...m
        }));
        if (parsed.transacciones) suc.transacciones = parsed.transacciones;
        if (parsed.ventas)        suc.ventas        = parsed.ventas;
        if (parsed._nextMenuId)   suc._nextMenuId   = parsed._nextMenuId;
        if (parsed._nextInvId)    suc._nextInvId    = parsed._nextInvId;
        const migrated = defaultData();
        migrated.sucursales = [suc];
        console.log('✅ Migración completada. Guardando nuevo formato...');
        fs.writeFileSync(DATA_FILE, JSON.stringify(migrated, null, 2), 'utf8');
        return migrated;
      }

      // ── Formato nuevo (v5) ──────────────────────────────────────
      const def = defaultData();
      if (!parsed.pins)       parsed.pins       = def.pins;
      if (!parsed._nextSucId) parsed._nextSucId = parsed.sucursales ? parsed.sucursales.length + 1 : 2;

      if (!Array.isArray(parsed.sucursales) || parsed.sucursales.length === 0) {
        console.warn('⚠ sucursales vacío o inválido, usando defaults');
        parsed.sucursales = def.sucursales;
      } else {
        parsed.sucursales = parsed.sucursales.map(s => {
          const ds = defaultSucursal(s.id || 1, s.nombre || 'Sucursal', s.ciudad || '');
          return { ...ds, ...s };
        });
      }
      return parsed;
    }
  } catch(e) {
    console.error('⚠ Error leyendo data.json:', e.message);
    // Renombrar el archivo corrupto para no perder datos
    try {
      const backup = DATA_FILE + '.backup-' + Date.now();
      fs.renameSync(DATA_FILE, backup);
      console.log('⚠ Archivo renombrado a:', backup);
    } catch(_) {}
  }
  return defaultData();
}

function saveData() {
  try { fs.writeFileSync(DATA_FILE, JSON.stringify(db, null, 2), 'utf8'); }
  catch(e) { console.error('⚠ Error guardando:', e.message); }
}

let db = loadData();
console.log(`✅ Datos cargados · ${db.sucursales.length} sucursal(es)`);

// ─── SSE ──────────────────────────────────────────────────────────
// Map: sucId → Set<res>
const sseClients = new Map();

function broadcast(sucId, event, payload) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  // Enviar a clientes de esta sucursal
  if (sseClients.has(sucId)) {
    sseClients.get(sucId).forEach(res => { try { res.write(msg); } catch(_){} });
  }
  // También enviar a admins globales (sucId=0)
  if (sseClients.has(0)) {
    sseClients.get(0).forEach(res => { try { res.write(msg); } catch(_){} });
  }
}

// ─── Helpers ─────────────────────────────────────────────────────
function readBody(req) {
  return new Promise((res, rej) => {
    let b=''; req.on('data',c=>b+=c);
    req.on('end', () => { try{res(JSON.parse(b||'{}'))}catch(e){rej(e)} });
    req.on('error', rej);
  });
}

function cors() {
  return {
    'Content-Type':'application/json',
    'Access-Control-Allow-Origin':'*',
    'Access-Control-Allow-Methods':'GET,POST,PUT,DELETE,OPTIONS',
    'Access-Control-Allow-Headers':'Content-Type,X-Pin,X-Suc',
  };
}

function json(res, status, data) {
  res.writeHead(status, cors()); res.end(JSON.stringify(data));
}

function getSuc(id) { return db.sucursales.find(s=>s.id===id); }

// ─── Servidor ────────────────────────────────────────────────────
const server = http.createServer(async (req, res) => {
  const url    = req.url.split('?')[0];
  const method = req.method;

  if (method==='OPTIONS') {
    res.writeHead(204, cors()); return res.end();
  }

  // ── Healthcheck (Railway / uptime monitors) ──
  if (method==='GET' && url==='/health') {
    return json(res, 200, { ok:true, sucursales: db.sucursales.length });
  }

  // ── Archivos estáticos ──
  if (method==='GET' && (url==='/'||url==='/index.html')) {
    try {
      const html = fs.readFileSync(HTML_FILE,'utf8');
      res.writeHead(200,{
        'Content-Type':'text/html;charset=utf-8',
        'Cache-Control':'no-store, no-cache, must-revalidate',
        'Pragma':'no-cache',
      });
      return res.end(html);
    } catch { res.writeHead(404); return res.end('index.html not found'); }
  }

  // ── SSE /events?suc=ID ──
  if (method==='GET' && url.startsWith('/events')) {
    const sucId = parseInt(new URL('http://x'+req.url).searchParams.get('suc')||'0');
    res.writeHead(200,{
      'Content-Type':'text/event-stream','Cache-Control':'no-cache',
      'Connection':'keep-alive','Access-Control-Allow-Origin':'*',
    });
    const payload = sucId>0 ? getSuc(sucId) : db;
    res.write(`event: init\ndata: ${JSON.stringify(payload)}\n\n`);
    if (!sseClients.has(sucId)) sseClients.set(sucId, new Set());
    sseClients.get(sucId).add(res);
    req.on('close', () => sseClients.get(sucId)?.delete(res));
    return;
  }

  // ── Auth: POST /api/auth ──
  if (method==='POST' && url==='/api/auth') {
    const { pin, rol } = await readBody(req);
    if (db.pins[rol] && db.pins[rol]===String(pin)) {
      return json(res, 200, { ok:true, rol });
    }
    return json(res, 401, { ok:false, error:'PIN incorrecto' });
  }

  // ── GET /api/data?suc=ID ──
  if (method==='GET' && url.startsWith('/api/data')) {
    const sucId = parseInt(new URL('http://x'+req.url).searchParams.get('suc')||'0');
    if (sucId>0) {
      const s = getSuc(sucId);
      return s ? json(res,200,s) : json(res,404,{error:'Sucursal no encontrada'});
    }
    return json(res,200,db);
  }

  // ── Sucursales ──
  if (method==='GET' && url==='/api/sucursales') {
    return json(res,200, db.sucursales.map(s=>({id:s.id,nombre:s.nombre,ciudad:s.ciudad})));
  }
  if (method==='POST' && url==='/api/sucursales') {
    const body = await readBody(req);
    const s = defaultSucursal(db._nextSucId++, body.nombre||'Nueva Sucursal', body.ciudad||'');
    db.sucursales.push(s);
    saveData(); broadcast(0,'update',db);
    return json(res,201,s);
  }
  const sucEditMatch = url.match(/^\/api\/sucursales\/(\d+)$/);
  if (method==='PUT' && sucEditMatch) {
    const id=parseInt(sucEditMatch[1]); const body=await readBody(req);
    db.sucursales=db.sucursales.map(s=>s.id===id?{...s,nombre:body.nombre??s.nombre,ciudad:body.ciudad??s.ciudad}:s);
    saveData(); broadcast(0,'update',db);
    return json(res,200,getSuc(id));
  }
  if (method==='DELETE' && sucEditMatch) {
    const id=parseInt(sucEditMatch[1]);
    if(db.sucursales.length<=1){return json(res,400,{error:'Debe haber al menos una sucursal'});}
    db.sucursales=db.sucursales.filter(s=>s.id!==id);
    saveData(); broadcast(0,'update',db);
    return json(res,200,{ok:true});
  }

  // ── Cambiar PINs (solo admin) ──
  if (method==='PUT' && url==='/api/pins') {
    const body=await readBody(req);
    if(body.admin) db.pins.admin=String(body.admin);
    if(body.cajero) db.pins.cajero=String(body.cajero);
    saveData();
    return json(res,200,{ok:true});
  }

  // ── Extraer sucId de rutas /api/suc/:id/... ──
  const sucMatch = url.match(/^\/api\/suc\/(\d+)(\/.*)$/);
  if (!sucMatch) { res.writeHead(404); return res.end('Not found'); }

  const sucId   = parseInt(sucMatch[1]);
  const subPath = sucMatch[2]; // ej: /menu, /mesas/3, /cobrar
  const suc     = getSuc(sucId);
  if (!suc) return json(res,404,{error:'Sucursal no encontrada'});

  function save() { saveData(); broadcast(sucId,'update',suc); }

  // ── Menú ──
  if (method==='GET' && subPath==='/menu') return json(res,200,suc.menu);
  if (method==='POST' && subPath==='/menu') {
    const b=await readBody(req);
    const item={id:suc._nextMenuId++,nombre:b.nombre||'Ítem',precio:Number(b.precio)||0,emoji:b.emoji||'🍽',invId:b.invId||null};
    suc.menu.push(item); save(); return json(res,201,item);
  }
  const menuMatch=subPath.match(/^\/menu\/(\d+)$/);
  if (menuMatch) {
    const id=parseInt(menuMatch[1]);
    if (method==='PUT') { const b=await readBody(req); suc.menu=suc.menu.map(m=>m.id===id?{...m,...b,id}:m); save(); return json(res,200,suc.menu.find(m=>m.id===id)); }
    if (method==='DELETE') { suc.menu=suc.menu.filter(m=>m.id!==id); save(); return json(res,200,{ok:true}); }
  }

  // ── Inventario ──
  if (method==='GET' && subPath==='/inventario') return json(res,200,suc.inventario);
  if (method==='POST' && subPath==='/inventario') {
    const b=await readBody(req);
    const item={id:suc._nextInvId++,nombre:b.nombre||'Producto',stock:Number(b.stock)||0,min:Number(b.min)||2};
    suc.inventario.push(item); save(); return json(res,201,item);
  }
  const invMatch=subPath.match(/^\/inventario\/(\d+)$/);
  if (invMatch) {
    const id=parseInt(invMatch[1]);
    if (method==='PUT') { const b=await readBody(req); suc.inventario=suc.inventario.map(i=>i.id===id?{...i,...b,id}:i); save(); return json(res,200,suc.inventario.find(i=>i.id===id)); }
    if (method==='DELETE') { suc.inventario=suc.inventario.filter(i=>i.id!==id); save(); return json(res,200,{ok:true}); }
  }

  // ── Mesas ──
  if (method==='GET' && subPath==='/mesas') return json(res,200,suc.mesas);
  if (method==='POST' && subPath==='/mesas') {
    const b=await readBody(req);
    const mesa={id:suc._nextMesaId++,nombre:b.nombre||'Mesa '+suc._nextMesaId,estado:'libre',orden:[],personas:2,cobrado:0};
    suc.mesas.push(mesa); save(); return json(res,201,mesa);
  }
  const mesaMatch=subPath.match(/^\/mesas\/(\d+)$/);
  if (mesaMatch) {
    const id=parseInt(mesaMatch[1]);
    if (method==='PUT') { const b=await readBody(req); suc.mesas=suc.mesas.map(m=>m.id===id?{...m,...b,id}:m); save(); return json(res,200,suc.mesas.find(m=>m.id===id)); }
    if (method==='DELETE') { suc.mesas=suc.mesas.filter(m=>m.id!==id); save(); return json(res,200,{ok:true}); }
  }

  // ── Cobrar ──
  if (method==='POST' && subPath==='/cobrar') {
    const { mesaId, orden, detalle, cobradoParcial, mostrador } = await readBody(req);
    const total=orden.reduce((s,l)=>s+l.precio*l.qty,0);
    const now=new Date();
    const hora=now.toLocaleTimeString('es-GT',{hour:'2-digit',minute:'2-digit'});
    const fecha=now.toLocaleDateString('es-GT');
    const ts=now.getTime();
    orden.forEach(l=>{ suc.ventas[l.nombre]=(suc.ventas[l.nombre]||0)+l.qty; });
    orden.forEach(l=>{
      const mi=suc.menu.find(m=>m.id===l.id);
      if(!mi||!mi.invId) return;
      const inv=suc.inventario.find(i=>i.id===mi.invId);
      if(inv) inv.stock=Math.max(0,inv.stock-l.qty);
    });

    // ── Mostrador (toma express, sin mesa) ──
    if (mostrador) {
      const ticketNum=(suc.transacciones.filter(t=>t.mostrador).length)+1;
      suc.transacciones.unshift({
        mesaId:0, mesaNombre:'Mostrador · Ticket #'+ticketNum,
        total, hora, fecha, ts,
        detalle: detalle||('Ticket #'+ticketNum),
        orden:[...orden], mostrador:true
      });
      save(); return json(res,200,{ok:true,total,ticket:ticketNum});
    }

    const mesaObj=suc.mesas.find(m=>m.id===mesaId);
    const mesaNombre=mesaObj?mesaObj.nombre:'Mesa '+mesaId;
    suc.transacciones.unshift({mesaId,mesaNombre,total,hora,fecha,ts,detalle:detalle||'Cuenta completa',orden:[...orden]});
    if(!cobradoParcial) {
      suc.mesas=suc.mesas.map(m=>m.id===mesaId?{...m,orden:[],estado:'libre',cobrado:0}:m);
    } else {
      suc.mesas=suc.mesas.map(m=>m.id===mesaId?{...m,cobrado:(m.cobrado||0)+total}:m);
    }
    save(); return json(res,200,{ok:true,total});
  }

  res.writeHead(404); res.end('Not found');
});

server.listen(PORT,'0.0.0.0',()=>{
  console.log('\n  TAQUERÍA NUEVA ORDEN — POS\n  Sistema por AA Projects\n');
  console.log(`   Local:  http://localhost:${PORT}`);
  const ifaces=os.networkInterfaces();
  Object.values(ifaces).flat().forEach(i=>{
    if(i.family==='IPv4'&&!i.internal)
      console.log(`   Red:    http://${i.address}:${PORT}  ← otros dispositivos`);
  });
  console.log(`\n   Datos:  ${DATA_FILE}`);
  console.log('   Ctrl+C para detener\n');
});

process.on('SIGINT', ()=>{ saveData(); console.log('\n💾 Guardado. ¡Hasta luego!'); process.exit(); });
process.on('SIGTERM',()=>{ saveData(); process.exit(); });
