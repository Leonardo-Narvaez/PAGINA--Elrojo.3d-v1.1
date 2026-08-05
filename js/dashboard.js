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

  const pedidos = await cargarPedidos();

  // ===== Pedidos y Producción (visibles para todos los roles) =====
  document.getElementById("statPedidos").textContent = pedidos.length;
  document.getElementById("statProduccion").textContent = pedidos.filter((p) => p.estado === "En producción").length;

  // ===== Ventas de hoy y Ganancia del mes (solo Administrador y Ventas) =====
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

  // ===== Actividad reciente =====
  actualizarNotificacionesDashboard();
  setInterval(() => {
    if (document.getElementById("notifDashboard") && !document.querySelector(".notif-panel.open")) {
      actualizarNotificacionesDashboard();
    }
  }, 30000);
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

async function actualizarNotificacionesDashboard() {
  const contenedor = document.getElementById("notifDashboard");
  if (!contenedor) return;
  if (typeof supabaseClient === "undefined" || !supabaseClient) {
    contenedor.innerHTML = `<div class="notif-item">No hay novedades por ahora.</div>`;
    return;
  }

  const { data, error } = await supabaseClient
    .from("auditoria_eventos")
    .select("created_at, actor_nombre, modulo, accion, tipo, mensaje, detalle")
    .order("created_at", { ascending: false })
    .limit(8);

  if (error) {
    console.warn("No se pudo cargar la actividad reciente:", error.message);
    contenedor.innerHTML = `<div class="notif-item">No hay novedades por ahora.</div>`;
    return;
  }

  const eventos = data || [];
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
              <div class="notif-item">
                <strong>${iconoActividad(event)} ${text}</strong>
                <br /><small class="notif-meta">${detalle}</small>
              </div>
            `;
          })
          .join("")
      : `<div class="notif-item">No hay novedades por ahora.</div>`;
}

document.addEventListener("DOMContentLoaded", () => {
  if (!document.getElementById("statPedidos")) return;
  inicializarDashboard();
});
