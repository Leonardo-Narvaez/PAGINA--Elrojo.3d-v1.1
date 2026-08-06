let reportesProductos = new Map();
let filtroSeccion = "todos";
let rangoDesde = null;
let rangoHasta = null;
let datosReporte = {};

const SECCION_ETIQUETA = {
  score: "Business score y salud",
  resumen: "Resumen ejecutivo",
  ventas: "Ventas",
  produccion: "Producción",
  inventario: "Inventario",
  clientes: "Clientes",
  top: "Top productos",
  ia: "IA del negocio",
  recomendaciones: "Recomendaciones",
};

function setText(id, texto) {
  const el = document.getElementById(id);
  if (el) el.textContent = texto;
}

function clamp(valor, min, max) {
  return Math.max(min, Math.min(max, valor));
}

function normalizarNombre(texto) {
  if (!texto) return "";
  return String(texto)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

function totalPedido(p) {
  return (Number(p.precio_unitario) || 0) * (Number(p.cantidad) || 0);
}

function costoPedido(p) {
  const producto = reportesProductos.get(p.producto_id);
  return (Number(producto && producto.costo_produccion) || 0) * (Number(p.cantidad) || 0);
}

function horasDeImpresion(texto) {
  if (!texto) return 0;
  const t = String(texto).toLowerCase();
  let horas = 0;
  const h = t.match(/([\d.]+)\s*h/);
  const m = t.match(/([\d.]+)\s*m/);
  if (h) horas += parseFloat(h[1]);
  if (m) horas += parseFloat(m[1]) / 60;
  if (!h && !m) {
    const n = parseFloat(t);
    if (!isNaN(n)) horas = n;
  }
  return horas;
}

function formatoHoras(n) {
  return n >= 100 ? Math.round(n).toLocaleString("es-CO") : (Math.round(n * 10) / 10).toLocaleString("es-CO");
}

function etiquetaScore(n) {
  if (n >= 85) return "Excelente";
  if (n >= 70) return "Bueno";
  if (n >= 50) return "Regular";
  return "Crítico";
}

const DIAS_SEMANA = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];

function finDelDia(fecha) {
  const f = new Date(fecha);
  f.setHours(23, 59, 59, 999);
  return f;
}

function inicioDelDia(fecha) {
  const f = new Date(fecha);
  f.setHours(0, 0, 0, 0);
  return f;
}

function descripcionRango() {
  if (!rangoDesde && !rangoHasta) return "Todos los tiempos";
  const desde = rangoDesde ? rangoDesde.toLocaleDateString("es-CO") : "inicio";
  const hasta = rangoHasta ? rangoHasta.toLocaleDateString("es-CO") : "hoy";
  return `${desde} - ${hasta}`;
}

function parseFechaInput(valor) {
  if (!valor) return null;
  const [y, m, d] = valor.split("-").map(Number);
  return new Date(y, m - 1, d);
}

async function cargarProductosReportes() {
  if (typeof supabaseClient === "undefined" || !supabaseClient) return;
  const { data } = await supabaseClient
    .from("productos")
    .select("id, nombre, tiempo_impresion, stock, stock_minimo, precio_venta, costo_produccion");
  reportesProductos = new Map((data || []).map((p) => [p.id, p]));
}

async function cargarFilamentosReportes() {
  if (typeof supabaseClient === "undefined" || !supabaseClient) return [];
  const { data } = await supabaseClient.from("filamentos").select("id, nombre, peso, disponible");
  return data || [];
}

async function cargarClientesReportes() {
  if (typeof supabaseClient === "undefined" || !supabaseClient) return [];
  const { data } = await supabaseClient.from("clientes").select("id, nombre, vip, created_at");
  return data || [];
}

async function cargarMovimientosFilamento() {
  if (typeof supabaseClient === "undefined" || !supabaseClient) return [];
  const { data } = await supabaseClient
    .from("movimientos_inventario")
    .select("entidad_nombre, cantidad")
    .eq("tipo", "salida")
    .eq("entidad_tipo", "filamento");
  const agregado = {};
  (data || []).forEach((m) => {
    const nombre = m.entidad_nombre || "Filamento";
    agregado[nombre] = (agregado[nombre] || 0) + (Number(m.cantidad) || 0);
  });
  return Object.entries(agregado)
    .map(([nombre, cantidad]) => ({ nombre, cantidad }))
    .sort((a, b) => b.cantidad - a.cantidad);
}

function mayorClave(objeto) {
  const mejor = Object.keys(objeto).reduce(
    (top, k) => (objeto[k] > (top ? objeto[top] : 0) ? k : top),
    null
  );
  return mejor != null ? { nombre: mejor, cantidad: objeto[mejor] } : { nombre: null, cantidad: 0 };
}

function mejorMargenProducto() {
  let mejor = null;
  reportesProductos.forEach((p) => {
    const venta = Number(p.precio_venta) || 0;
    const costo = Number(p.costo_produccion) || 0;
    if (venta <= 0) return;
    const margen = Math.round(((venta - costo) / venta) * 100);
    if (!mejor || margen > mejor.margen) mejor = { nombre: p.nombre, margen };
  });
  return mejor;
}

function calcularVentana() {
  const hoy = finDelDia(new Date());
  if (rangoDesde) {
    const inicio = inicioDelDia(rangoDesde);
    const fin = rangoHasta ? finDelDia(rangoHasta) : hoy;
    const duracion = fin.getTime() - inicio.getTime();
    return {
      inicio,
      fin,
      finPrev: new Date(inicio.getTime() - 1),
      inicioPrev: new Date(inicio.getTime() - duracion - 1),
    };
  }
  const fin = hoy;
  const inicio = inicioDelDia(new Date());
  inicio.setDate(inicio.getDate() - 29);
  return {
    inicio,
    fin,
    finPrev: new Date(inicio.getTime() - 1),
    inicioPrev: new Date(inicio.getTime() - 30 * 86400000),
  };
}

function renderBarrasVentas(pagados, ventana) {
  const contenedor = document.getElementById("barraVentas30");
  if (!contenedor) return;

  const dias = Math.round((ventana.fin - ventana.inicio) / 86400000) + 1;
  const DIAS = clamp(dias, 1, 92);
  const porDia = new Array(DIAS).fill(0);

  pagados.forEach((p) => {
    const fecha = new Date(p.created_at);
    if (fecha < ventana.inicio || fecha > ventana.fin) return;
    const diff = Math.floor((fecha - ventana.inicio) / 86400000);
    if (diff >= 0 && diff < DIAS) porDia[diff] += totalPedido(p);
  });

  const maximo = Math.max(...porDia, 1);
  contenedor.innerHTML = porDia
    .map((v, i) => {
      const altura = v > 0 ? Math.max(4, Math.round((v / maximo) * 100)) : 2;
      const dia = new Date(ventana.inicio.getTime() + i * 86400000);
      const titulo = `${dia.toLocaleDateString("es-CO", { day: "numeric", month: "short" })}: ${formatoMoney(v)}`;
      return `<div class="bar" style="height:${altura}%" title="${titulo}"></div>`;
    })
    .join("");
}

function renderLista(id, lineas) {
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = lineas.map((l) => `<li>${l}</li>`).join("");
}

function paresLista(lineas) {
  return lineas.map((l) => ["—", l]);
}

function ventasPorDiaFilas(pagados, ventana) {
  const dias = Math.round((ventana.fin - ventana.inicio) / 86400000) + 1;
  const DIAS = clamp(dias, 1, 92);
  const porDia = new Array(DIAS).fill(0);
  pagados.forEach((p) => {
    const fecha = new Date(p.created_at);
    if (fecha < ventana.inicio || fecha > ventana.fin) return;
    const diff = Math.floor((fecha - ventana.inicio) / 86400000);
    if (diff >= 0 && diff < DIAS) porDia[diff] += totalPedido(p);
  });
  return porDia.map((v, i) => {
    const dia = new Date(ventana.inicio.getTime() + i * 86400000);
    return [
      dia.toLocaleDateString("es-CO", { day: "numeric", month: "short" }),
      formatoMoney(v),
    ];
  });
}

async function refrescarReportes() {
  const pedidos = await cargarPedidos();
  await cargarProductosReportes();
  const filamentos = await cargarFilamentosReportes();
  const clientes = await cargarClientesReportes();
  const movFilamento = await cargarMovimientosFilamento();

  const ventana = calcularVentana();
  const enRango = (fecha) => fecha >= ventana.inicio && fecha <= ventana.fin;

  const todosLosPedidos = pedidos || [];
  const filtrados = todosLosPedidos.filter((p) => enRango(new Date(p.created_at)));
  const pagados = filtrados.filter((p) => p.estado_pago === "Pagado");

  const ventas = pagados.reduce((s, p) => s + totalPedido(p), 0);
  const costos = pagados.reduce((s, p) => s + costoPedido(p), 0);
  const ganancia = ventas - costos;

  const pedidosPorCliente = {};
  pagados.forEach((p) => {
    const n = normalizarNombre(p.cliente);
    if (n) pedidosPorCliente[n] = (pedidosPorCliente[n] || 0) + 1;
  });
  const recompradores = Object.keys(pedidosPorCliente).filter((n) => pedidosPorCliente[n] >= 2).length;
  const recompra = clientes.length ? Math.round((recompradores / clientes.length) * 100) : 0;

  setText("resumenVentas", formatoMoney(ventas));
  setText("resumenGanancia", formatoMoney(ganancia));
  setText("resumenPedidos", filtrados.length);
  setText("resumenProductos", reportesProductos.size);
  setText("resumenClientes", clientes.length);
  setText("resumenRecompra", recompra + "%");

  const tituloGrafico = document.getElementById("tituloGrafico");
  if (tituloGrafico) {
    tituloGrafico.textContent = rangoDesde || rangoHasta ? `Ventas - ${descripcionRango()}` : "Ventas - Últimos 30 días";
  }
  renderBarrasVentas(pagados, ventana);

  const producidos = filtrados.filter((p) => p.estado === "Entregado" || p.estado === "Listo");
  let horas = 0;
  let conTiempo = 0;
  producidos.forEach((p) => {
    const prod = reportesProductos.get(p.producto_id);
    const h = prod ? horasDeImpresion(prod.tiempo_impresion) : 0;
    if (h > 0) {
      horas += h * (Number(p.cantidad) || 1);
      conTiempo++;
    }
  });
  const tiempoPromedio = conTiempo ? horas / conTiempo : 0;
  const lineasProduccion = [
    `${producidos.length} pedido${producidos.length === 1 ? "" : "s"} producido${producidos.length === 1 ? "" : "s"}.`,
    `${formatoHoras(horas)} horas de impresión.`,
    conTiempo ? `Tiempo promedio: ${formatoHoras(tiempoPromedio)} horas.` : "Sin tiempos de impresión registrados.",
  ];
  renderLista("listaProduccion", lineasProduccion);

  const filBajos = filamentos.filter((f) => f.peso > 0 && f.disponible / f.peso <= 0.2);
  const productosLista = [...reportesProductos.values()];
  const prodBajos = productosLista.filter((p) => p.stock_minimo != null && Number(p.stock) <= Number(p.stock_minimo));
  const agotados = productosLista.filter((p) => (Number(p.stock) || 0) <= 0);
  const totalItems = filamentos.length + productosLista.length;
  const sanas = filamentos.length - filBajos.length + (productosLista.length - prodBajos.length);
  const saludInventario = totalItems ? Math.round((sanas / totalItems) * 100) : 100;
  const kg = filamentos.reduce((s, f) => s + (Number(f.disponible) || 0), 0) / 1000;
  const masUsado = movFilamento.length ? movFilamento[0] : null;
  const lineasInventario = [
    `Salud del inventario: ${saludInventario}%.`,
    `${kg.toFixed(1)} Kg de filamento disponibles.`,
    `${agotados.length} producto${agotados.length === 1 ? "" : "s"} agotado${agotados.length === 1 ? "" : "s"}.`,
    masUsado
      ? `${masUsado.nombre} es el más utilizado (${Math.round(masUsado.cantidad)} g).`
      : "Sin movimientos de filamento registrados.",
  ];
  renderLista("listaInventario", lineasInventario);

  const porCliente = {};
  pagados.forEach((p) => {
    const n = normalizarNombre(p.cliente);
    if (n) porCliente[n] = (porCliente[n] || 0) + 1;
  });
  const mejorCliente = mayorClave(porCliente);
  const vips = clientes.filter((c) => c.vip).length;
  const clientesNuevos = clientes.filter((c) => c.created_at && enRango(new Date(c.created_at))).length;
  const lineasClientes = [
    `Cliente del período: ${mejorCliente.nombre || "Sin clientes en este período"}.`,
    `Clientes VIP: ${vips}.`,
    `Clientes nuevos: ${clientesNuevos}.`,
    `Recompra: ${recompra}%.`,
  ];
  renderLista("listaClientes", lineasClientes);

  const porProducto = {};
  pagados.forEach((p) => {
    const nombre = (p.producto || "Sin nombre").trim();
    if (nombre) porProducto[nombre] = (porProducto[nombre] || 0) + (Number(p.cantidad) || 1);
  });
  const topProductos = Object.entries(porProducto)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4);
  renderLista(
    "listaTopProductos",
    topProductos.length
      ? topProductos.map(([nombre, cantidad]) => `${nombre} - ${cantidad} venta${cantidad === 1 ? "" : "s"}.`)
      : ["Aún no hay ventas en este período."]
  );

  const ult30 = pagados.filter((p) => enRango(new Date(p.created_at))).reduce((s, p) => s + totalPedido(p), 0);
  const prev30 = todosLosPedidos
    .filter((p) => {
      const f = new Date(p.created_at);
      return f >= ventana.inicioPrev && f <= ventana.finPrev;
    })
    .filter((p) => p.estado_pago === "Pagado")
    .reduce((s, p) => s + totalPedido(p), 0);

  const scoreVentas = prev30 > 0 ? Math.round((ult30 / prev30) * 70) : ult30 > 0 ? 80 : 0;
  const scoreVentasFinal = clamp(scoreVentas, 0, 100);
  const scoreProduccion = filtrados.length ? Math.round((producidos.length / filtrados.length) * 100) : 50;
  const scoreInventario = saludInventario;
  const scoreClientes = clientes.length ? clamp(Math.round((recompradores / clientes.length) * 100), 0, 100) : 50;
  const margen = ventas > 0 ? Math.round((ganancia / ventas) * 100) : 0;
  const scoreRentabilidad = clamp(margen, 0, 100);
  const scoreTotal = Math.round(
    (scoreVentasFinal + scoreProduccion + scoreInventario + scoreClientes + scoreRentabilidad) / 5
  );

  setText("scoreVentas", scoreVentasFinal + "%");
  setText("scoreProduccion", scoreProduccion + "%");
  setText("scoreInventario", scoreInventario + "%");
  setText("scoreClientes", scoreClientes + "%");
  setText("scoreRentabilidad", scoreRentabilidad + "%");
  setText("scoreBusiness", scoreTotal + " / 100");
  setText("tagBusiness", etiquetaScore(scoreTotal));
  setText("saludGeneral", scoreTotal + "%");

  const saludLineas = [];
  if (ult30 > prev30) {
    const subida = prev30 > 0 ? Math.round((ult30 / prev30 - 1) * 100) : 100;
    saludLineas.push(`Tus ventas subieron un ${subida}% en el período.`);
  } else if (prev30 > 0) {
    saludLineas.push(`Tus ventas bajaron un ${Math.round((1 - ult30 / prev30) * 100)}% frente al período anterior.`);
  } else {
    saludLineas.push("Aún no hay ventas en este período.");
  }
  saludLineas.push(`Producción al ${scoreProduccion}%.`);
  saludLineas.push(
    saludInventario >= 80
      ? "Inventario saludable."
      : `Hay ${prodBajos.length + filBajos.length} ítem${prodBajos.length + filBajos.length === 1 ? "" : "s"} con stock bajo.`
  );
  saludLineas.push(
    clientes.length
      ? `Tienes ${vips} cliente${vips === 1 ? "" : "s"} VIP de ${clientes.length} registrado${clientes.length === 1 ? "" : "s"}.`
      : "Aún no hay clientes registrados."
  );
  renderLista("listaSalud", saludLineas);

  const mejorMargen = mejorMargenProducto();
  const porDiaSemana = {};
  pagados.forEach((p) => {
    const dia = new Date(p.created_at).getDay();
    porDiaSemana[dia] = (porDiaSemana[dia] || 0) + totalPedido(p);
  });
  const mejorDia = mayorClave(porDiaSemana);
  const iaLineas = [];
  if (mejorDia.nombre != null) iaLineas.push(`Tus ventas aumentan los ${DIAS_SEMANA[mejorDia.nombre]}.`);
  if (masUsado) iaLineas.push(`El ${masUsado.nombre} concentra la mayor salida de inventario.`);
  if (mejorMargen) iaLineas.push(`${mejorMargen.nombre} tiene el mayor margen (${mejorMargen.margen}%).`);
  if (clientes.length) iaLineas.push(`El ${recompra}% de tus clientes ha comprado más de una vez.`);
  renderLista("listaIA", iaLineas.length ? iaLineas : ["Aún hay pocos datos para generar insights."]);

  const porNombreProducto = new Map(productosLista.map((p) => [normalizarNombre(p.nombre), p]));
  const recos = [];
  filBajos.slice(0, 2).forEach((f) => recos.push(`Comprar 1 Kg de ${f.nombre}.`));
  const topAgotado = topProductos.find(([nombre]) => {
    const prod = porNombreProducto.get(normalizarNombre(nombre));
    return prod && (Number(prod.stock) || 0) <= 0;
  });
  if (topAgotado) recos.push(`Producir más ${topAgotado[0]}.`);
  const pendientes = filtrados.filter((p) => p.estado === "Pendiente").length;
  if (pendientes) recos.push(`Confirmar los ${pendientes} pedido${pendientes === 1 ? "" : "s"} pendientes.`);
  if (mejorMargen && mejorMargen.margen >= 50) recos.push(`Promocionar ${mejorMargen.nombre}.`);
  renderLista("listaRecomendaciones", recos.length ? recos : ["Sin recomendaciones por ahora."]);

  datosReporte = {
    score: [
      ["Métrica", "Valor"],
      ["Business score", scoreTotal + " / 100"],
      ["Ventas", scoreVentasFinal + "%"],
      ["Producción", scoreProduccion + "%"],
      ["Inventario", scoreInventario + "%"],
      ["Clientes", scoreClientes + "%"],
      ["Rentabilidad", scoreRentabilidad + "%"],
    ],
    resumen: [
      ["Métrica", "Valor"],
      ["Ventas", formatoMoney(ventas)],
      ["Ganancia", formatoMoney(ganancia)],
      ["Pedidos", filtrados.length],
      ["Productos", reportesProductos.size],
      ["Clientes", clientes.length],
      ["Recompra", recompra + "%"],
    ],
    ventas: [["Día", "Ventas"], ...ventasPorDiaFilas(pagados, ventana)],
    produccion: [
      ["Métrica", "Valor"],
      ["Pedidos producidos", producidos.length],
      ["Horas de impresión", formatoHoras(horas)],
      ["Tiempo promedio", conTiempo ? formatoHoras(tiempoPromedio) + " horas" : "Sin datos"],
    ],
    inventario: [
      ["Métrica", "Valor"],
      ["Salud del inventario", saludInventario + "%"],
      ["Filamento disponible", kg.toFixed(1) + " Kg"],
      ["Productos agotados", agotados.length],
      ["Filamento más utilizado", masUsado ? `${masUsado.nombre} (${Math.round(masUsado.cantidad)} g)` : "Sin datos"],
    ],
    clientes: [
      ["Métrica", "Valor"],
      ["Cliente del período", mejorCliente.nombre || "Sin datos"],
      ["Clientes VIP", vips],
      ["Clientes nuevos", clientesNuevos],
      ["Recompra", recompra + "%"],
    ],
    top: [["Producto", "Ventas"], ...topProductos],
    ia: paresLista(iaLineas),
    recomendaciones: paresLista(recos),
  };
}

function seccionesVisibles() {
  if (filtroSeccion === "todos") return ["score", "resumen", "ventas", "produccion", "inventario", "clientes", "top", "ia", "recomendaciones"];
  return SECCION_ETIQUETA[filtroSeccion] ? [filtroSeccion] : [];
}

function filaCSV(fila) {
  return fila
    .map((c) => {
      const s = String(c ?? "");
      return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    })
    .join(";");
}

function construirCSV() {
  const filas = [];
  filas.push(["ELROJO.3D - Reporte del negocio"]);
  filas.push(["Período", descripcionRango()]);
  filas.push([""]);
  seccionesVisibles().forEach((s) => {
    filas.push([SECCION_ETIQUETA[s]]);
    (datosReporte[s] || []).forEach((fila) => filas.push(fila));
    filas.push([""]);
  });
  return filas.map(filaCSV).join("\r\n");
}

function construirTablasHTML() {
  let html = `<html><head><meta charset="utf-8"></head><body>`;
  html += `<h1>ELROJO.3D - Reporte del negocio</h1><p>Período: ${descripcionRango()}</p>`;
  seccionesVisibles().forEach((s) => {
    html += `<h2>${SECCION_ETIQUETA[s]}</h2><table border="1"><tbody>`;
    (datosReporte[s] || []).forEach((fila) => {
      html += `<tr>${fila.map((c) => `<td>${String(c ?? "").replace(/</g, "&lt;").replace(/>/g, "&gt;")}</td>`).join("")}</tr>`;
    });
    html += "</tbody></table>";
  });
  html += "</body></html>";
  return html;
}

function descargarArchivo(nombre, contenido, mime) {
  const blob = new Blob([contenido], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportarPDF() {
  window.print();
}

function exportarExcel() {
  descargarArchivo(
    `reporte-elrojo-3d.xls`,
    construirTablasHTML(),
    "application/vnd.ms-excel"
  );
}

function exportarCSV() {
  descargarArchivo(
    `reporte-elrojo-3d-${new Date().toISOString().split("T")[0]}.csv`,
    "\uFEFF" + construirCSV(),
    "text/csv;charset=utf-8"
  );
}

async function enviarReporteCorreo() {
  const cuerpo = {
    rango: descripcionRango(),
    csv: construirCSV(),
  };
  try {
    const { error } = await supabaseClient.functions.invoke("enviar-reporte", { body: cuerpo });
    if (error) throw error;
    alert("Reporte enviado. Revisa el correo del destinatario configurado.");
  } catch (e) {
    console.warn("No se pudo enviar por correo:", e.message || e);
    alert(
      "El envío por correo requiere desplegar la Edge Function 'enviar-reporte' en Supabase. Mientras tanto, usa Exportar PDF, Excel o CSV."
    );
  }
}

function aplicarFiltros() {
  rangoDesde = parseFechaInput(document.getElementById("filtroDesde").value);
  const hastaRaw = document.getElementById("filtroHasta").value;
  rangoHasta = hastaRaw ? finDelDia(parseFechaInput(hastaRaw)) : null;
  refrescarReportes();
}

function aplicarRangoRapido(clave) {
  const desde = document.getElementById("filtroDesde");
  const hasta = document.getElementById("filtroHasta");
  const fmt = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

  if (clave === "todo") {
    desde.value = "";
    hasta.value = "";
  } else {
    const hoy = new Date();
    const s = new Date(hoy);
    if (clave === "hoy") {
      desde.value = fmt(hoy);
      hasta.value = fmt(hoy);
    } else if (clave === "7d") {
      s.setDate(s.getDate() - 6);
      desde.value = fmt(s);
      hasta.value = fmt(hoy);
    } else if (clave === "30d") {
      s.setDate(s.getDate() - 29);
      desde.value = fmt(s);
      hasta.value = fmt(hoy);
    } else if (clave === "mes") {
      const m = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      desde.value = fmt(m);
      hasta.value = fmt(hoy);
    }
  }
  aplicarFiltros();
}

function aplicarFiltroSeccion() {
  filtroSeccion = document.getElementById("filtroSeccion").value;
  document.querySelectorAll("[data-seccion]").forEach((el) => {
    const coincide = filtroSeccion === "todos" || el.dataset.seccion === filtroSeccion;
    el.style.display = coincide ? "" : "none";
  });
}

document.addEventListener("DOMContentLoaded", () => {
  if (!document.getElementById("resumenVentas")) return;
  refrescarReportes();
  aplicarFiltroSeccion();
});

document.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "visible" && document.getElementById("resumenVentas")) {
    refrescarReportes();
  }
});