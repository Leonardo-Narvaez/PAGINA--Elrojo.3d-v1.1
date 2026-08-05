// ===== Dashboard: datos reales desde Supabase =====
// Reutiliza cargarPedidos() y formatoMoney() de js/pedidos.js.
// No se toca ni el HTML ni el CSS existentes: solo se rellenan por id.

function inicioDelDia() {
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  return hoy;
}

function inicioDelMes() {
  const hoy = new Date();
  return new Date(hoy.getFullYear(), hoy.getMonth(), 1);
}

async function cargarRolActual() {
  if (typeof supabaseClient === "undefined" || !supabaseClient) return null;

  const { data: userData } = await supabaseClient.auth.getUser();
  if (!userData || !userData.user) return null;

  const { data, error } = await supabaseClient
    .from("usuarios")
    .select("nombre, rol")
    .eq("id", userData.user.id)
    .single();

  if (error) {
    console.error("No se pudo obtener el rol:", error);
    return null;
  }
  return data;
}

async function cargarFilamentosStockCritico() {
  if (typeof supabaseClient === "undefined" || !supabaseClient) return [];

  const { data, error } = await supabaseClient.from("filamentos").select("peso, disponible");

  if (error) {
    // Normal si el rol actual (ej. Ventas) no tiene permiso de leer filamentos.
    console.warn("No se pudo leer filamentos (puede ser normal según el rol):", error.message);
    return null;
  }
  return data;
}

async function inicializarDashboard() {
  const usuario = await cargarRolActual();

  if (usuario) {
    document.getElementById("saludoUsuario").textContent = `¡Hola, ${usuario.nombre || "de nuevo"}! 👋`;
    document.getElementById("subtituloRol").textContent = `Bienvenido a tu panel de control · ${usuario.rol}`;
  }

  await refrescarDatosDashboard();

  // ===== Actividad reciente (campana) =====
  iniciarNotificacionesCampana();
}

async function refrescarDatosDashboard() {
  const usuario = await cargarRolActual();
  const pedidos = await cargarPedidos();

  // ===== Pedidos y Producción (visibles para todos los roles) =====
  document.getElementById("statPedidos").textContent = pedidos.filter((p) => p.estado !== "Entregado").length;
  document.getElementById("statProduccion").textContent = pedidos.filter((p) => p.estado === "En producción").length;

  // ===== Ventas de hoy e Ingresos del mes (solo Administrador y Ventas) =====
  const esVentasOAdmin = usuario && (usuario.rol === "Administrador" || usuario.rol === "Ventas");
  const cardVentas = document.getElementById("cardVentasHoy");
  const cardGanancia = document.getElementById("cardGanancia");

  if (esVentasOAdmin) {
    const desdeHoy = inicioDelDia();
    const desdeMes = inicioDelMes();

    const ventasHoyPedidos = pedidos
      .filter((p) => p.estado_pago === "Pagado" && new Date(p.created_at) >= desdeHoy)
      .reduce((sum, p) => sum + (Number(p.precio_unitario) || 0) * (Number(p.cantidad) || 0), 0);

    const gananciaMesPedidos = pedidos
      .filter((p) => p.estado_pago === "Pagado" && new Date(p.created_at) >= desdeMes)
      .reduce((sum, p) => sum + (Number(p.precio_unitario) || 0) * (Number(p.cantidad) || 0), 0);

    // Los "otros ingresos" solo los puede leer Administrador (RLS); si el
    // rol actual es Ventas, esta consulta devuelve vacío/error y se suma 0.
    const { data: otrosIngresos } = await supabaseClient.from("ingresos_otros").select("monto, fecha");
    const listaOtros = otrosIngresos || [];

    const otrosHoy = listaOtros
      .filter((i) => new Date(i.fecha) >= desdeHoy)
      .reduce((sum, i) => sum + (Number(i.monto) || 0), 0);

    const otrosMes = listaOtros
      .filter((i) => new Date(i.fecha) >= desdeMes)
      .reduce((sum, i) => sum + (Number(i.monto) || 0), 0);

    document.getElementById("statVentasHoy").textContent = formatoMoney(ventasHoyPedidos + otrosHoy);
    document.getElementById("statGanancia").textContent = formatoMoney(gananciaMesPedidos + otrosMes);
  } else {
    // Producción no ve cifras de dinero: se ocultan las tarjetas (no se borran).
    if (cardVentas) cardVentas.style.display = "none";
    if (cardGanancia) cardGanancia.style.display = "none";
  }

  // ===== Inventario / stock crítico (solo Administrador y Producción) =====
  const cardInventario = document.getElementById("cardInventario");
  const filamentos = await cargarFilamentosStockCritico();

  if (filamentos) {
    const stockCritico = filamentos.filter((f) => f.peso > 0 && f.disponible / f.peso <= 0.2).length;
    document.getElementById("statInventario").textContent = stockCritico;
  } else if (cardInventario) {
    cardInventario.style.display = "none";
  }

  // ===== Gráfico de ventas (últimos 30 días) =====
  renderGraficoVentas(pedidos);

  // ===== Campana (si ya estaba iniciada, se actualiza) =====
  cargarNotificacionesPendientes();
}

function renderGraficoVentas(pedidos) {
  const linea = document.getElementById("lineaVentas");
  const etiquetas = document.getElementById("etiquetasVentas");
  if (!linea) return;

  const ANCHO = 300;
  const ALTO = 120;
  const MARGEN = 8;
  const DIAS = 30;

  const hoy = new Date();
  const porDia = new Array(DIAS).fill(0);
  const hace30 = new Date(hoy);
  hace30.setDate(hoy.getDate() - (DIAS - 1));
  hace30.setHours(0, 0, 0, 0);

  (pedidos || [])
    .filter((p) => p.estado_pago === "Pagado")
    .forEach((p) => {
      const fecha = new Date(p.created_at);
      if (fecha < hace30) return;
      const diffDias = Math.floor((fecha - hace30) / 86400000);
      if (diffDias >= 0 && diffDias < DIAS) {
        porDia[diffDias] += (Number(p.precio_unitario) || 0) * (Number(p.cantidad) || 0);
      }
    });

  const maximo = Math.max(...porDia, 1);

  const puntos = porDia
    .map((valor, i) => {
      const x = MARGEN + (i * (ANCHO - MARGEN * 2)) / (DIAS - 1);
      const y = ALTO - MARGEN - (valor / maximo) * (ALTO - MARGEN * 2);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  linea.setAttribute("points", puntos);
  linea.style.display = porDia.every((v) => v === 0) ? "none" : "";

  if (etiquetas) {
    const inicioLabel = hace30.toLocaleDateString("es-CO", { day: "numeric", month: "short" });
    const finLabel = hoy.toLocaleDateString("es-CO", { day: "numeric", month: "short" });
    etiquetas.innerHTML = `
      <span>${inicioLabel}</span>
      <span>${formatoMoney(maximo)}</span>
      <span>${finLabel}</span>
    `;
  }
}

let canalNotificacionesCampana = null;
const leidasEnSesion = new Set();
let notificacionesPendientesIds = [];

function actualizarDotNotificaciones(visible) {
  const dot = document.querySelector(".notif-bar .notif-dot");
  if (dot) dot.style.display = visible ? "" : "none";
}

function renderNotificaciones(eventos) {
  const contenedor = document.getElementById("notifDashboard");
  if (!contenedor) return;

  contenedor.innerHTML =
    eventos.length > 0
      ? eventos
          .map((event) => {
            const actor = event.actor_nombre || "Sistema";
            const message = event.mensaje || `${actor} ${event.accion || "registró una acción"}`;
            const text = message.startsWith(actor) ? message : `${actor} ${message}`;
            const detalle = [event.modulo, event.detalle, formatoHoraReciente(new Date(event.created_at))]
              .filter(Boolean)
              .join(" · ");
            return `
              <div class="notif-item notif-item-clickable" data-evento-id="${event.id}" title="Marcar como leída">
                <strong>${iconoActividad(event)} ${text}</strong>
                <br /><small class="notif-meta">${detalle}</small>
              </div>
            `;
          })
          .join("")
      : `<div class="notif-item">No hay novedades por ahora.</div>`;

  contenedor.querySelectorAll(".notif-item-clickable").forEach((item) => {
    item.addEventListener("click", () => {
      marcarNotificacionesLeidas([item.dataset.eventoId]);
    });
  });
}

async function cargarNotificacionesPendientes() {
  const contenedor = document.getElementById("notifDashboard");
  if (!contenedor) return;
  if (typeof supabaseClient === "undefined" || !supabaseClient) {
    renderNotificaciones([]);
    return;
  }

  const { data: authData } = await supabaseClient.auth.getUser();
  const userId = authData?.user?.id || null;

  const { data, error } = await supabaseClient
    .from("notificaciones")
    .select("id, created_at, actor_nombre, modulo, accion, tipo, mensaje, detalle")
    .order("created_at", { ascending: false })
    .limit(8);

  if (error) {
    console.warn("No se pudo cargar la actividad reciente:", error.message);
    renderNotificaciones([]);
    return;
  }

  const eventos = data || [];
  const ids = eventos.map((e) => e.id);
  let leidas = new Set();
  if (userId && ids.length > 0) {
    const { data: filasLeidas } = await supabaseClient
      .from("notificaciones_leidas")
      .select("notificacion_id")
      .eq("usuario_id", userId)
      .in("notificacion_id", ids);
    leidas = new Set((filasLeidas || []).map((r) => r.notificacion_id));
  }

  notificacionesPendientesIds = eventos
    .filter((e) => !leidas.has(e.id) && !leidasEnSesion.has(e.id))
    .map((e) => e.id);
  actualizarDotNotificaciones(notificacionesPendientesIds.length > 0);
  renderNotificaciones(eventos.filter((e) => notificacionesPendientesIds.includes(e.id)));
}

async function marcarNotificacionesLeidas(eventIds) {
  const { data: authData } = await supabaseClient.auth.getUser();
  const userId = authData?.user?.id;
  if (!userId || !eventIds || eventIds.length === 0) return;

  const nuevos = eventIds.filter((id) => !leidasEnSesion.has(id));
  if (nuevos.length === 0) return;
  nuevos.forEach((id) => leidasEnSesion.add(id));

  const { error } = await supabaseClient
    .from("notificaciones_leidas")
    .insert(nuevos.map((notificacion_id) => ({ usuario_id: userId, notificacion_id })));
  if (error) console.warn("No se pudo marcar como leídas:", error.message);

  await cargarNotificacionesPendientes();
}

function iniciarNotificacionesCampana() {
  if (!supabaseClient || canalNotificacionesCampana) return;

  // En vivo: una notificación nueva aparece de inmediato en la campana.
  canalNotificacionesCampana = supabaseClient
    .channel("elrojo-campana-realtime")
    .on(
      "postgres_changes",
      { event: "INSERT", schema: "public", table: "notificaciones" },
      (payload) => {
        mostrarToastNotificacion(payload.new);
        cargarNotificacionesPendientes();
      }
    )
    .subscribe();

  // Respaldo periódico (solo si el panel está cerrado).
  setInterval(() => {
    if (!document.querySelector(".notif-panel.open")) {
      cargarNotificacionesPendientes();
    }
  }, 30000);

  cargarNotificacionesPendientes();
}

function formatoHoraReciente(eventDate) {
  const diffMinutes = Math.floor((new Date() - eventDate) / 60000);
  if (diffMinutes < 1) return "Ahora";
  if (diffMinutes < 60) return `Hace ${diffMinutes} min`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `Hace ${diffHours} ${diffHours === 1 ? "hora" : "horas"}`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "Ayer";
  if (diffDays < 7) return `Hace ${diffDays} días`;
  return eventDate.toLocaleString("es-CO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

function iconoActividad(event) {
  const map = { success: "✅", warning: "⚠️", error: "❌", info: "ℹ️", system: "🔧" };
  return map[event.tipo] || "🔔";
}

function mostrarToastNotificacion(event) {
  if (!event) return;
  const contenedor = document.querySelector(".notif-toast-container") || crearContenedorToast();
  if (!contenedor) return;

  const actor = event.actor_nombre || "Sistema";
  const message = event.mensaje || `${actor} ${event.accion || "registró una acción"}`;
  const text = message.startsWith(actor) ? message : `${actor} ${message}`;
  const detalle = [event.modulo, event.detalle].filter(Boolean).join(" · ");

  const toast = document.createElement("div");
  toast.className = "notif-toast";
  toast.innerHTML = `
    <strong>${iconoActividad(event)} ${text}</strong>
    <div class="notif-toast-meta">${detalle}</div>
  `;
  contenedor.appendChild(toast);

  setTimeout(() => toast.remove(), 7600);
  while (contenedor.children.length > 4) contenedor.firstElementChild.remove();
}

function crearContenedorToast() {
  const contenedor = document.createElement("div");
  contenedor.className = "notif-toast-container";
  document.body.appendChild(contenedor);
  return contenedor;
}

document.addEventListener("DOMContentLoaded", () => {
  if (!document.getElementById("statPedidos")) return;
  inicializarDashboard();
});

// Al volver a la pestaña, se refrescan las tarjetas, el gráfico y la campana.
document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && document.getElementById("statPedidos")) {
    refrescarDatosDashboard();
  }
});
