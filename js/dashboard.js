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
  actualizarNotificacionesDashboard(pedidos);
}

function actualizarNotificacionesDashboard(pedidos) {
  const contenedor = document.getElementById("notifDashboard");
  if (!contenedor) return;

  const pendientes = pedidos.filter((p) => p.estado === "Pendiente").length;
  const enProduccion = pedidos.filter((p) => p.estado === "En producción").length;
  const listos = pedidos.filter((p) => p.estado === "Listo").length;

  const notificaciones = [];
  if (pendientes > 0) notificaciones.push(`🆕 ${pendientes} pedido${pendientes === 1 ? "" : "s"} pendiente${pendientes === 1 ? "" : "s"}.`);
  if (enProduccion > 0) notificaciones.push(`🖨️ ${enProduccion} pedido${enProduccion === 1 ? "" : "s"} en producción.`);
  if (listos > 0) notificaciones.push(`✅ ${listos} pedido${listos === 1 ? "" : "s"} listo${listos === 1 ? "" : "s"} para entrega.`);

  contenedor.innerHTML =
    notificaciones.length > 0
      ? notificaciones.map((n) => `<div class="notif-item">${n}</div>`).join("")
      : `<div class="notif-item">No hay novedades por ahora.</div>`;
}

document.addEventListener("DOMContentLoaded", () => {
  if (!document.getElementById("statPedidos")) return;
  inicializarDashboard();
});
