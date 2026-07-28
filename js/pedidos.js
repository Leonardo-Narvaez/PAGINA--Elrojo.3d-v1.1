// ===== Pedidos: datos reales desde Supabase =====
// Los pedidos se crean desde nueva-venta.html y se gestionan aquí.

let pedidosCache = [];
let filtroEstado = "todos";
let filtroPago = "todos";

function supabaseListoPedidos() {
  if (typeof supabaseClient === "undefined" || !supabaseClient) {
    alert("Supabase aún no está configurado. Revisa js/supabase-config.js.");
    return false;
  }
  return true;
}

async function cargarPedidos() {
  if (!supabaseListoPedidos()) return [];
  const { data, error } = await supabaseClient
    .from("pedidos")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    alert("Error al cargar pedidos: " + error.message);
    return [];
  }
  return data;
}

function badgeEstado(estado) {
  const clase = { Pendiente: "badge-pending", "En producción": "badge-production", Listo: "badge-ready" };
  return `<span class="badge ${clase[estado] || "badge-pending"}">${estado}</span>`;
}

function badgePago(pago) {
  const clase = pago === "Pagado" ? "badge-paid" : "badge-unpaid";
  return `<span class="badge ${clase}">💳 ${pago}</span>`;
}

function tarjetaPedido(p) {
  const entrega = p.entrega_sin_definir || !p.fecha_entrega ? "Sin definir" : p.fecha_entrega;

  return `
    <div class="pedido-card" data-estado="${p.estado}" data-pago="${p.estado_pago}">
      <div class="pedido-main">
        <div class="pedido-producto">${p.producto}</div>
        <div class="pedido-cliente">${p.cliente}${p.asesor ? ` · Asesor: ${p.asesor}` : ""}</div>
      </div>
      <div class="pedido-badges">
        ${badgeEstado(p.estado)}
        ${badgePago(p.estado_pago)}
      </div>
      <div class="pedido-meta">Cantidad: ${p.cantidad} · Entrega: ${entrega}</div>
      ${p.observaciones ? `<div class="pedido-notas">${p.observaciones}</div>` : ""}

      <div class="form-row" style="margin-top: 10px">
        <div class="input-group">
          <label>Estado</label>
          <select onchange="actualizarEstadoPedido('${p.id}', this.value)">
            <option ${p.estado === "Pendiente" ? "selected" : ""}>Pendiente</option>
            <option ${p.estado === "En producción" ? "selected" : ""}>En producción</option>
            <option ${p.estado === "Listo" ? "selected" : ""}>Listo</option>
          </select>
        </div>
        <div class="input-group">
          <label>Pago</label>
          <select onchange="actualizarPagoPedido('${p.id}', this.value)">
            <option ${p.estado_pago === "Pendiente" ? "selected" : ""}>Pendiente</option>
            <option ${p.estado_pago === "Pagado" ? "selected" : ""}>Pagado</option>
          </select>
        </div>
      </div>
      <div class="stock-actions">
        <button class="icon-text-btn danger" onclick="eliminarPedido('${p.id}')">🗑️ Eliminar</button>
      </div>
    </div>
  `;
}

function renderPedidos() {
  const contenedor = document.getElementById("listaPedidos");
  if (!contenedor) return;

  const filtrados = pedidosCache.filter((p) => {
    const okEstado = filtroEstado === "todos" || p.estado === filtroEstado;
    const okPago = filtroPago === "todos" || p.estado_pago === filtroPago;
    return okEstado && okPago;
  });

  contenedor.innerHTML =
    filtrados.length > 0
      ? filtrados.map(tarjetaPedido).join("")
      : `<p class="empty-state">No hay pedidos que coincidan con estos filtros.</p>`;
}

async function inicializarPedidos() {
  pedidosCache = await cargarPedidos();
  renderPedidos();
}

async function refrescarVistaPedidos() {
  if (typeof inicializarPedidos === "function" && document.getElementById("listaPedidos")) {
    await inicializarPedidos();
  }
  if (typeof inicializarProduccion === "function" && document.getElementById("kanbanProduccion")) {
    await inicializarProduccion();
  }
}

async function actualizarEstadoPedido(id, nuevoEstado) {
  if (!supabaseListoPedidos()) return;
  const { error } = await supabaseClient.from("pedidos").update({ estado: nuevoEstado }).eq("id", id);
  if (error) {
    alert("No se pudo actualizar el estado: " + error.message);
    return;
  }
  await refrescarVistaPedidos();
}

async function actualizarPagoPedido(id, nuevoPago) {
  if (!supabaseListoPedidos()) return;
  const { error } = await supabaseClient.from("pedidos").update({ estado_pago: nuevoPago }).eq("id", id);
  if (error) {
    alert("No se pudo actualizar el pago: " + error.message);
    return;
  }
  await refrescarVistaPedidos();
}

async function eliminarPedido(id) {
  if (!confirm("¿Eliminar este pedido? Esta acción no se puede deshacer.")) return;
  if (!supabaseListoPedidos()) return;

  const { error } = await supabaseClient.from("pedidos").delete().eq("id", id);
  if (error) {
    alert("No se pudo eliminar: " + error.message);
    return;
  }
  await refrescarVistaPedidos();
}

// ===== Inicialización =====

document.addEventListener("DOMContentLoaded", () => {
  if (!document.getElementById("listaPedidos")) return;

  inicializarPedidos();

  document.querySelectorAll(".filter-tabs").forEach((group) => {
    const grupo = group.dataset.filterGroup;

    group.querySelectorAll(".filter-tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        group.querySelectorAll(".filter-tab").forEach((t) => t.classList.remove("active"));
        tab.classList.add("active");

        if (grupo === "estado") filtroEstado = tab.dataset.filter;
        if (grupo === "pago") filtroPago = tab.dataset.filter;

        renderPedidos();
      });
    });
  });
});
