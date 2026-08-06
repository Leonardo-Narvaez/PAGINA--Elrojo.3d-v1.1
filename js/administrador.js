let adminProductosMap = new Map();

function inicioDelMes() {
  const hoy = new Date();
  return new Date(hoy.getFullYear(), hoy.getMonth(), 1);
}

function setText(id, texto) {
  const el = document.getElementById(id);
  if (el) el.textContent = texto;
}

function totalPedido(p) {
  return (Number(p.precio_unitario) || 0) * (Number(p.cantidad) || 0);
}

function costoPedido(p) {
  const producto = adminProductosMap.get(p.producto_id);
  return (Number(producto && producto.costo_produccion) || 0) * (Number(p.cantidad) || 0);
}

async function cargarProductosAdmin() {
  if (typeof supabaseClient === "undefined" || !supabaseClient) return;
  const { data } = await supabaseClient
    .from("productos")
    .select("id, nombre, costo_produccion, stock, stock_minimo");
  adminProductosMap = new Map((data || []).map((p) => [p.id, p]));
}

async function cargarFilamentosAdmin() {
  if (typeof supabaseClient === "undefined" || !supabaseClient) return [];
  const { data } = await supabaseClient.from("filamentos").select("id, nombre, peso, disponible");
  return data || [];
}

async function cargarOtrosIngresos() {
  if (typeof supabaseClient === "undefined" || !supabaseClient) return [];
  const { data } = await supabaseClient.from("ingresos_otros").select("monto, fecha");
  return data || [];
}

async function refrescarPanelAdministrador() {
  const pedidos = await cargarPedidos();
  await cargarProductosAdmin();
  const filamentos = await cargarFilamentosAdmin();
  const otrosIngresos = await cargarOtrosIngresos();

  const desdeMes = inicioDelMes();
  const pagadosMes = (pedidos || []).filter(
    (p) => p.estado_pago === "Pagado" && new Date(p.created_at) >= desdeMes
  );

  const ingresosMes = pagadosMes.reduce((s, p) => s + totalPedido(p), 0);
  const otrosMes = otrosIngresos
    .filter((i) => new Date(i.fecha) >= desdeMes)
    .reduce((s, i) => s + (Number(i.monto) || 0), 0);
  const ventasMes = ingresosMes + otrosMes;

  const costosMes = pagadosMes.reduce((s, p) => s + costoPedido(p), 0);
  const utilidadMes = ventasMes - costosMes;
  const margen = ventasMes > 0 ? Math.round((utilidadMes / ventasMes) * 100) : 0;

  const pedidosActivos = (pedidos || []).filter((p) => p.estado !== "Entregado").length;
  const pedidosPendientes = (pedidos || []).filter((p) => p.estado === "Pendiente").length;
  const produccionesActivas = (pedidos || []).filter((p) => p.estado === "En producción").length;

  const filamentosBajos = filamentos.filter((f) => f.peso > 0 && f.disponible / f.peso <= 0.2);
  const productosBajos = [...adminProductosMap.values()].filter(
    (p) => p.stock_minimo != null && Number(p.stock) <= Number(p.stock_minimo)
  );

  setText("valorVentasMes", formatoMoney(ventasMes));
  setText("valorPedidosActivos", pedidosActivos);
  setText("valorGananciaNeta", margen + "%");
  setText("badgePedidosPendientes", pedidosPendientes);
  setText("badgeProduccionesActivas", produccionesActivas);
  setText("badgeInventarioBajo", filamentosBajos.length + productosBajos.length);
  setText("valorCostosProduccion", formatoMoney(costosMes));
  setText("valorIngresosMes", formatoMoney(ventasMes));
  setText("valorUtilidadEstimada", formatoMoney(utilidadMes));

  renderAlertasInteligentes(filamentosBajos, productosBajos, pagadosMes);
}

function renderAlertasInteligentes(filamentosBajos, productosBajos, pagadosMes) {
  const contenedor = document.getElementById("alertasInteligentes");
  if (!contenedor) return;

  const lineas = [];

  filamentosBajos
    .slice(0, 3)
    .forEach((f) => lineas.push(`El filamento "${f.nombre}" está por debajo del stock mínimo.`));

  productosBajos
    .slice(0, 3)
    .forEach((p) => lineas.push(`El producto "${p.nombre}" alcanzó su stock mínimo.`));

  const ventasPorProducto = {};
  pagadosMes.forEach((p) => {
    const nombre = p.producto || "Producto sin nombre";
    ventasPorProducto[nombre] = (ventasPorProducto[nombre] || 0) + (Number(p.cantidad) || 0);
  });

  const masVendido = Object.keys(ventasPorProducto).reduce(
    (mayor, nombre) => (ventasPorProducto[nombre] > (mayor ? ventasPorProducto[mayor] : 0) ? nombre : mayor),
    null
  );
  if (masVendido) lineas.push(`"${masVendido}" es el producto más vendido del mes.`);

  contenedor.innerHTML =
    lineas.length > 0
      ? lineas.map((l) => `<p class="alert-line">${l}</p>`).join("")
      : `<p class="alert-line">Todo en orden. No hay alertas pendientes.</p>`;
}

document.addEventListener("DOMContentLoaded", () => {
  if (!document.getElementById("valorVentasMes")) return;
  refrescarPanelAdministrador();
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && document.getElementById("valorVentasMes")) {
    refrescarPanelAdministrador();
  }
});
