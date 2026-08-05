// ===== Inventario (vista Producción): datos reales desde Supabase =====
// Solo lectura: editar/eliminar se hace en gestion-inventario.html (Admin).

let filamentosCache = [];
let productosCache = [];

function supabaseListoInventario() {
  if (typeof supabaseClient === "undefined" || !supabaseClient) {
    console.warn("Supabase aún no está configurado. Revisa js/supabase-config.js.");
    return false;
  }
  return true;
}

function formatoMonedaInventario(valor) {
  const numero = Number(valor) || 0;
  return "$" + numero.toLocaleString("es-CO");
}

async function cargarFilamentosInventario() {
  if (!supabaseListoInventario()) return [];
  const { data, error } = await supabaseClient
    .from("filamentos")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    console.error(error);
    return [];
  }
  return data;
}

async function cargarProductosInventario() {
  if (!supabaseListoInventario()) return [];
  const { data, error } = await supabaseClient
    .from("productos")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    console.error(error);
    return [];
  }
  return data;
}

function esFilamentoCritico(f) {
  return f.peso > 0 && f.disponible / f.peso <= 0.2;
}

function calcularSalud(filamentos) {
  if (filamentos.length === 0) return 100;
  const criticos = filamentos.filter(esFilamentoCritico).length;
  return Math.max(0, Math.round(100 - (criticos / filamentos.length) * 100));
}

function textoSalud(salud) {
  if (salud >= 80) return "Estado excelente del inventario.";
  if (salud >= 50) return "Estado aceptable, revisa los filamentos críticos.";
  return "Estado bajo, se recomienda reponer stock.";
}

function valorInventario(filamentos) {
  return filamentos.reduce((suma, f) => {
    const precioPorGramo = f.peso > 0 ? (Number(f.precio_compra) || 0) / f.peso : 0;
    return suma + (Number(f.disponible) || 0) * precioPorGramo;
  }, 0);
}

function renderSalud(filamentos) {
  const salud = calcularSalud(filamentos);
  document.getElementById("healthScore").textContent = salud + "%";
  document.getElementById("healthText").textContent = textoSalud(salud);

  const alertas = filamentos.filter(esFilamentoCritico);
  const lista = document.getElementById("healthList");
  lista.innerHTML = "";

  if (alertas.length === 0) {
    lista.innerHTML = `<li>No hay filamentos con stock crítico.</li>`;
    return;
  }

  alertas.forEach((f) => {
    const item = document.createElement("li");
    item.textContent = `Comprar ${f.nombre} próximamente.`;
    lista.appendChild(item);
  });
}

function renderMetricas(filamentos) {
  const rollos = filamentos.length;
  const stockBajo = filamentos.filter(esFilamentoCritico).length;
  const valor = valorInventario(filamentos);

  document.getElementById("statRollos").textContent = rollos;
  document.getElementById("statStockBajo").textContent = stockBajo;
  document.getElementById("statValor").textContent = formatoMonedaInventario(valor);
  document.getElementById("statAlertas").textContent = stockBajo;
}

function renderFilamentosInventario(filamentos) {
  const contenedor = document.getElementById("listaFilamentos");
  if (!contenedor) return;

  if (filamentos.length === 0) {
    contenedor.innerHTML = `<p class="empty-state">Aún no has agregado filamentos.</p>`;
    return;
  }

  contenedor.innerHTML = filamentos
    .map((f) => {
      const porcentaje = f.peso > 0 ? Math.round((f.disponible / f.peso) * 100) : 0;
      const critico = esFilamentoCritico(f);
      return `
        <div class="inv-item">
          <strong>${f.nombre}</strong>
          <br />${f.disponible} g disponibles${critico ? ` <span class="stock-low">- Stock bajo</span>` : ""}
          <br />Marca: ${f.marca || "-"} · Color: ${f.color || "-"} · Material: ${f.material || "-"}
          <br />Costo por gramo: ${formatoMonedaInventario(f.peso > 0 ? (Number(f.precio_compra) || 0) / f.peso : 0)} · Valor restante: ${formatoMonedaInventario((Number(f.disponible) || 0) * (f.peso > 0 ? (Number(f.precio_compra) || 0) / f.peso : 0))}
          <div class="progress">
            <div class="fill" style="width: ${porcentaje}%"></div>
          </div>
        </div>
      `;
    })
    .join("");
}

function renderProductosInventario(productos) {
  const contenedor = document.getElementById("listaProductos");
  if (!contenedor) return;

  if (productos.length === 0) {
    contenedor.innerHTML = `<p class="empty-state">Aún no has agregado productos.</p>`;
    return;
  }

  contenedor.innerHTML = productos
    .map((p) => {
      const stock = Number(p.stock) || 0;
      const esBajo = p.stock_minimo != null && stock <= p.stock_minimo;
      const stockBajo = esBajo ? ` <span class="stock-low">- Stock bajo</span>` : "";
      return `
        <div class="inv-item">
          <strong>${p.nombre}</strong>
          <br />Stock: ${stock}${stockBajo} | Precio: ${formatoMonedaInventario(p.precio_venta)} | Costo: ${formatoMonedaInventario(p.costo_produccion)}${p.tiempo_impresion ? ` | Impresión: ${p.tiempo_impresion}` : ""}
        </div>
      `;
    })
    .join("");
}

async function cargarMovimientos() {
  if (!supabaseListoInventario()) return [];
  const { data, error } = await supabaseClient
    .from("movimientos_inventario")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(10);
  if (error) {
    console.error(error);
    return [];
  }
  return data;
}

function renderMovimientos(movimientos) {
  const contenedor = document.getElementById("listaMovimientos");
  if (!contenedor) return;

  if (movimientos.length === 0) {
    contenedor.innerHTML = `<p class="empty-state">Aún no hay movimientos registrados.</p>`;
    return;
  }

  contenedor.innerHTML = movimientos
    .map((m) => {
      const signo = m.tipo === "entrada" ? "+" : "−";
      const icono = m.tipo === "entrada" ? "🟢" : "🔴";
      const tipoTexto = m.tipo === "entrada" ? "Entrada" : "Salida";
      const cantidad = m.tipo === "entrada" ? `${signo}${m.cantidad} ${m.entidad_tipo === "filamento" ? "g" : "uds"}` : `${signo}${m.cantidad} ${m.entidad_tipo === "filamento" ? "g" : "uds"}`;
      const fecha = new Date(m.created_at).toLocaleString("es-CO", {
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
      });
      return `
        <div class="inv-item">
          <strong>${icono} ${cantidad} ${m.entidad_nombre || "Sin nombre"}</strong>
          <br />${tipoTexto} · ${m.origen || "-"}${m.referencia ? ` · ${m.referencia}` : ""} · ${fecha}
        </div>
      `;
    })
    .join("");
}

async function inicializarInventario() {
  if (!document.getElementById("healthScore")) return;

  filamentosCache = await cargarFilamentosInventario();
  productosCache = await cargarProductosInventario();
  const movimientos = await cargarMovimientos();

  renderSalud(filamentosCache);
  renderMetricas(filamentosCache);
  renderFilamentosInventario(filamentosCache);
  renderProductosInventario(productosCache);
  renderMovimientos(movimientos);
}

document.addEventListener("DOMContentLoaded", () => {
  if (!document.getElementById("listaFilamentos")) return;
  inicializarInventario();
});
