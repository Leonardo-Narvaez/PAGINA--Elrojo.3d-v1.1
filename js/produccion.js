// ===== Producción: tablero real basado en pedidos =====
// Reutiliza cargarPedidos() y tarjetaPedido() de js/pedidos.js.

function actualizarNotificacionesProduccion(pedidos) {
  const contenedor = document.getElementById("notifProduccion");
  if (!contenedor) return;

  const pendientes = pedidos.filter((p) => p.estado === "Pendiente" || p.estado === "Confirmado").length;
  const enProduccion = pedidos.filter((p) => p.estado === "En producción").length;
  const listos = pedidos.filter((p) => p.estado === "Listo").length;
  const porPagar = pedidos.filter(
    (p) => p.estado_pago === "Pendiente" || p.estado_pago === "Parcial"
  ).length;

  const notificaciones = [];

  if (pendientes > 0) {
    notificaciones.push(
      `🆕 ${pendientes} pedido${pendientes === 1 ? "" : "s"} pendiente${pendientes === 1 ? "" : "s"} de iniciar.`
    );
  }
  if (enProduccion > 0) {
    notificaciones.push(`🖨️ ${enProduccion} pedido${enProduccion === 1 ? "" : "s"} en producción.`);
  }
  if (listos > 0) {
    notificaciones.push(`✅ ${listos} pedido${listos === 1 ? "" : "s"} listo${listos === 1 ? "" : "s"} para entrega.`);
  }
  if (porPagar > 0) {
    notificaciones.push(`💳 ${porPagar} pedido${porPagar === 1 ? "" : "s"} con pago pendiente.`);
  }

  contenedor.innerHTML =
    notificaciones.length > 0
      ? notificaciones.map((n) => `<div class="notif-item">${n}</div>`).join("")
      : `<div class="notif-item">No hay novedades por ahora.</div>`;

  const dot = document.querySelector(".notif-dot");
  if (dot) dot.style.display = pendientes > 0 || listos > 0 ? "block" : "none";
}

async function inicializarProduccion() {
  const pedidos = await cargarPedidos();

  document.getElementById("statActivas").textContent = pedidos.filter(
    (p) => p.estado !== "Listo" && p.estado !== "Entregado"
  ).length;
  document.getElementById("statPendientes").textContent = pedidos.filter(
    (p) => p.estado === "Pendiente" || p.estado === "Confirmado"
  ).length;
  document.getElementById("statListos").textContent = pedidos.filter(
    (p) => p.estado === "Listo"
  ).length;

  actualizarNotificacionesProduccion(pedidos);

  const columnas = {
    Pendiente: document.getElementById("colPendiente"),
    Confirmado: document.getElementById("colConfirmado"),
    "En producción": document.getElementById("colEnProduccion"),
    Listo: document.getElementById("colListo"),
    Entregado: document.getElementById("colEntregado"),
  };

  Object.values(columnas).forEach((col) => {
    if (col) col.innerHTML = "";
  });

  if (pedidos.length === 0) {
    columnas.Pendiente.innerHTML = `<p class="empty-state">No hay pedidos todavía.</p>`;
    return;
  }

  pedidos.forEach((p) => {
    const columna = columnas[p.estado] || columnas.Pendiente;
    if (columna) columna.insertAdjacentHTML("beforeend", tarjetaPedido(p));
  });
}

document.addEventListener("DOMContentLoaded", () => {
  if (!document.getElementById("kanbanProduccion")) return;
  inicializarProduccion();
});
