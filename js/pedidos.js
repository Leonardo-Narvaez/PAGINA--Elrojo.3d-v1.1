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
  const clase = {
    Pendiente: "badge-pending",
    Confirmado: "badge-confirmed",
    "En producción": "badge-production",
    Listo: "badge-ready",
    Entregado: "badge-delivered",
  };
  return `<span class="badge ${clase[estado] || "badge-pending"}">${estado}</span>`;
}

function badgePago(pago) {
  const clase = pago === "Pagado" ? "badge-paid" : pago === "Parcial" ? "badge-partial" : "badge-unpaid";
  return `<span class="badge ${clase}">💳 ${pago}</span>`;
}

function tarjetaPedido(p) {
  const entrega = p.entrega_sin_definir || !p.fecha_entrega ? "Sin definir" : p.fecha_entrega;

  return `
    <div class="pedido-card" data-estado="${p.estado}" data-pago="${p.estado_pago}">
      <div class="pedido-main">
        <div class="pedido-producto">${p.numero ? `<strong>${p.numero}</strong> · ` : ""}${p.producto}</div>
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
            <option ${p.estado === "Confirmado" ? "selected" : ""}>Confirmado</option>
            <option ${p.estado === "En producción" ? "selected" : ""}>En producción</option>
            <option ${p.estado === "Listo" ? "selected" : ""}>Listo</option>
            <option ${p.estado === "Entregado" ? "selected" : ""}>Entregado</option>
          </select>
        </div>
        <div class="input-group">
          <label>Pago</label>
          <select onchange="actualizarPagoPedido('${p.id}', this.value)">
            <option ${p.estado_pago === "Pendiente" ? "selected" : ""}>Pendiente</option>
            <option ${p.estado_pago === "Parcial" ? "selected" : ""}>Parcial</option>
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

async function buscarPedido(id) {
  if (!supabaseListoPedidos()) return null;
  const { data, error } = await supabaseClient.from("pedidos").select("*").eq("id", id).single();
  if (error) {
    console.error(error);
    return null;
  }
  return data;
}

async function descontarStockProducto(productoId, cantidad, referencia) {
  if (!productoId || !cantidad) return;
  const { data: producto, error: errorGet } = await supabaseClient
    .from("productos")
    .select("stock, nombre")
    .eq("id", productoId)
    .single();
  if (errorGet || !producto) return;

  const stockActual = Number(producto.stock) || 0;
  const nuevoStock = Math.max(0, stockActual - cantidad);
  const { error } = await supabaseClient
    .from("productos")
    .update({ stock: nuevoStock })
    .eq("id", productoId);
  if (error) {
    alert("No se pudo descontar el stock del producto: " + error.message);
    return;
  }
  await registrarMovimiento({
    tipo: "salida",
    origen: "venta",
    entidadTipo: "producto",
    entidadId: productoId,
    entidadNombre: producto.nombre,
    cantidad,
    referencia,
  });
}

async function descontarFilamento(filamentoId, gramos, referencia) {
  if (!filamentoId || !gramos) return;
  const { data: filamento, error: errorGet } = await supabaseClient
    .from("filamentos")
    .select("disponible, nombre")
    .eq("id", filamentoId)
    .single();
  if (errorGet || !filamento) return;

  const disponible = Number(filamento.disponible) || 0;
  const nuevoDisponible = Math.max(0, disponible - gramos);
  const { error } = await supabaseClient
    .from("filamentos")
    .update({ disponible: nuevoDisponible })
    .eq("id", filamentoId);
  if (error) {
    alert("No se pudo descontar el filamento: " + error.message);
    return;
  }
  await registrarMovimiento({
    tipo: "salida",
    origen: "venta",
    entidadTipo: "filamento",
    entidadId: filamentoId,
    entidadNombre: filamento.nombre,
    cantidad: gramos,
    referencia,
  });
}

async function actualizarEstadoPedido(id, nuevoEstado) {
  if (!supabaseListoPedidos()) return;
  const pedido = await buscarPedido(id);
  const anterior = pedido ? pedido.estado : "?";

  if (nuevoEstado === "Entregado") {
    await abrirModalEntrega(pedido);
    return;
  }

  await guardarEstadoPedido(id, pedido?.numero, anterior, nuevoEstado);
}

async function guardarEstadoPedido(id, numeroPedido, anterior, nuevoEstado) {
  const { error } = await supabaseClient.from("pedidos").update({ estado: nuevoEstado }).eq("id", id);
  if (error) {
    alert("No se pudo actualizar el estado: " + error.message);
    return;
  }
  await registrarAuditoria(
    "Pedidos",
    "Cambió estado",
    "warning",
    `cambió el estado del pedido ${numeroPedido || id} de ${anterior} a ${nuevoEstado}.`
  );
  await refrescarVistaPedidos();
}

async function actualizarPagoPedido(id, nuevoPago) {
  if (!supabaseListoPedidos()) return;
  const pedido = await buscarPedido(id);
  const anterior = pedido ? pedido.estado_pago : "?";
  const { error } = await supabaseClient.from("pedidos").update({ estado_pago: nuevoPago }).eq("id", id);
  if (error) {
    alert("No se pudo actualizar el pago: " + error.message);
    return;
  }
  await registrarAuditoria(
    "Pedidos",
    "Cambió pago",
    "warning",
    `cambió el pago del pedido ${pedido?.numero || id} de ${anterior} a ${nuevoPago}.`
  );
  await refrescarVistaPedidos();
}

// ===== Modal: registrar entrega y descontar inventario =====

let entregaPedidoActual = null;
let entregaEstadoAnterior = "";

async function abrirModalEntrega(pedido) {
  if (!pedido) return;
  entregaPedidoActual = pedido;
  entregaEstadoAnterior = pedido.estado;

  const info = document.getElementById("modalDescuentoInfo");
  if (info) {
    info.textContent = `${pedido.numero || pedido.producto} · ${pedido.producto} · Cantidad: ${pedido.cantidad}`;
  }

  const select = document.getElementById("descuentoFilamento");
  const { data, error } = await supabaseClient
    .from("filamentos")
    .select("id, nombre, disponible")
    .order("nombre");

  if (error) {
    console.error(error);
    select.innerHTML = `<option value="">Sin filamentos</option>`;
  } else {
    const activos = (data || []).filter((f) => (Number(f.disponible) || 0) > 0);
    select.innerHTML =
      activos.length > 0
        ? activos
            .map(
              (f) =>
                `<option value="${f.id}">${f.nombre} (${Number(f.disponible)} g disponibles)</option>`
            )
            .join("")
        : `<option value="">No hay filamento disponible</option>`;
  }

  document.getElementById("descuentoGramos").value = "";
  document.getElementById("modalDescuentoFilamento").classList.add("open");
}

function cerrarModalDescuentoFilamento() {
  document.getElementById("modalDescuentoFilamento").classList.remove("open");
}

document.addEventListener("submit", async (event) => {
  if (event.target.id !== "formDescuentoFilamento") return;
  event.preventDefault();

  const filamentoId = document.getElementById("descuentoFilamento").value;
  const gramos = Number(document.getElementById("descuentoGramos").value) || 0;
  const pedido = entregaPedidoActual;

  if (!pedido) return;
  if (!filamentoId || gramos <= 0) {
    alert("Selecciona el filamento y escribe los gramos utilizados.");
    return;
  }

  await descontarFilamento(filamentoId, gramos, pedido.numero || pedido.id);
  if (pedido.producto_id) {
    await descontarStockProducto(pedido.producto_id, pedido.cantidad, pedido.numero || pedido.id);
  }

  cerrarModalDescuentoFilamento();
  await guardarEstadoPedido(pedido.id, pedido.numero, entregaEstadoAnterior, "Entregado");
});

async function eliminarPedido(id) {
  if (!confirm("¿Eliminar este pedido? Esta acción no se puede deshacer.")) return;
  if (!supabaseListoPedidos()) return;

  const pedido = await buscarPedido(id);
  const { error } = await supabaseClient.from("pedidos").delete().eq("id", id);
  if (error) {
    alert("No se pudo eliminar: " + error.message);
    return;
  }
  await registrarAuditoria(
    "Pedidos",
    "Eliminó",
    "error",
    `eliminó el pedido ${pedido?.numero || id} (${pedido?.producto || "sin producto"}).`
  );
  await refrescarVistaPedidos();
}

// ===== Inicialización =====

document.addEventListener("DOMContentLoaded", () => {
  if (!document.getElementById("listaPedidos")) return;

  inicializarPedidos();

  const selectEstado = document.getElementById("filtroEstado");
  const selectPago = document.getElementById("filtroPago");

  if (selectEstado) selectEstado.addEventListener("change", () => {
    filtroEstado = selectEstado.value;
    renderPedidos();
  });
  if (selectPago) selectPago.addEventListener("change", () => {
    filtroPago = selectPago.value;
    renderPedidos();
  });
});
