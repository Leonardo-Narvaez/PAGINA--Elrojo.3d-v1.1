// ===== Cotizaciones =====
// Conectado a Supabase (tablas "cotizaciones" y "cotizacion_productos").
// Requiere que js/supabase-config.js tenga tus credenciales reales.

let productoContador = 0;
let margenActual = 50;
let cotizacionEditandoId = null;
let cotizacionesCache = [];

function supabaseListoCot() {
  if (typeof supabaseClient === "undefined" || !supabaseClient) {
    alert("Supabase aún no está configurado. Revisa js/supabase-config.js.");
    return false;
  }
  return true;
}

async function siguienteFolio() {
  if (!supabaseListoCot()) return "COT-1000";
  const { count } = await supabaseClient
    .from("cotizaciones")
    .select("*", { count: "exact", head: true });
  return "COT-" + (1000 + (count || 0));
}

async function cargarCotizaciones() {
  if (!supabaseListoCot()) return [];
  const { data, error } = await supabaseClient
    .from("cotizaciones")
    .select("*, cotizacion_productos(*)")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    alert("Error al cargar cotizaciones: " + error.message);
    return [];
  }
  return data;

}

function formatoMoney(valor) {
  const numero = Number(valor) || 0;
  return "$" + Math.round(numero).toLocaleString("es-CO");
}

// ===== Productos dinámicos =====

function plantillaProducto(idx, datos) {
  const d = datos || {};
  return `
    <div class="producto-item" data-idx="${idx}">
      <div class="producto-item-header">
        <span>Producto ${idx + 1}</span>
        <button type="button" class="remove-producto-btn" onclick="quitarProducto(${idx})">🗑️ Quitar</button>
      </div>

      <div class="form-row">
        <div class="input-group">
          <label>Nombre del producto</label>
          <input type="text" class="prod-nombre" placeholder="Ej. Soporte Casco XTZ" value="${d.nombre || ""}" />
        </div>
        <div class="input-group">
          <label>Categoría</label>
          <input type="text" class="prod-categoria" placeholder="Ej. Accesorios moto" value="${d.categoria || ""}" />
        </div>
      </div>

      <div class="input-group">
        <label>Descripción</label>
        <textarea class="prod-descripcion" rows="2" placeholder="Detalles del producto...">${d.descripcion || ""}</textarea>
      </div>

      <div class="input-group">
        <label>URL de imagen (opcional)</label>
        <input type="text" class="prod-imagen" placeholder="https://..." value="${d.imagen || ""}" />
      </div>

      <div class="form-row">
        <div class="input-group">
          <label>Cantidad</label>
          <input type="number" class="prod-cantidad" min="1" value="${d.cantidad || 1}" />
        </div>
        <div class="input-group">
          <label>Color</label>
          <input type="text" class="prod-color" placeholder="Ej. Rojo" value="${d.color || ""}" />
        </div>
      </div>

      <div class="form-row">
        <div class="input-group">
          <label>Tiempo estimado (horas)</label>
          <input type="number" class="prod-tiempo" min="0" step="0.5" value="${d.tiempo || 1}" />
        </div>
        <div class="input-group">
          <label>Peso (gramos)</label>
          <input type="number" class="prod-peso" min="0" value="${d.peso || 0}" />
        </div>
      </div>

      <div class="input-group">
        <label>Costos adicionales ($)</label>
        <input type="number" class="prod-adicional" min="0" value="${d.adicional || 0}" />
      </div>

      <div class="cost-breakdown" data-breakdown="${idx}"></div>
    </div>
  `;
}

function agregarProducto(datos) {
  const contenedor = document.getElementById("productosContainer");
  const idx = productoContador++;
  contenedor.insertAdjacentHTML("beforeend", plantillaProducto(idx, datos));
  recalcularTodo();
}

function quitarProducto(idx) {
  const item = document.querySelector(`.producto-item[data-idx="${idx}"]`);
  if (item) item.remove();
  recalcularTodo();
}

function leerTarifas() {
  return {
    filamento: Number(document.getElementById("tarifaFilamento").value) || 0,
    electricidad: Number(document.getElementById("tarifaElectricidad").value) || 0,
    empaque: Number(document.getElementById("tarifaEmpaque").value) || 0,
    desgaste: Number(document.getElementById("tarifaDesgaste").value) || 0,
    manoObra: Number(document.getElementById("tarifaManoObra").value) || 0,
    comisionPct: Number(document.getElementById("tarifaComision").value) || 0,
  };
}

function leerProductos() {
  const tarifas = leerTarifas();
  const items = document.querySelectorAll(".producto-item");
  const productos = [];

  items.forEach((item) => {
    const idx = item.dataset.idx;
    const cantidad = Number(item.querySelector(".prod-cantidad").value) || 0;
    const pesoUnitario = Number(item.querySelector(".prod-peso").value) || 0;
    const tiempoUnitario = Number(item.querySelector(".prod-tiempo").value) || 0;
    const adicional = Number(item.querySelector(".prod-adicional").value) || 0;

    const gramosTotales = pesoUnitario * cantidad;
    const tiempoTotal = tiempoUnitario * cantidad;

    const costoFilamento = gramosTotales * tarifas.filamento;
    const costoElectricidad = tiempoTotal * tarifas.electricidad;
    const costoEmpaque = cantidad * tarifas.empaque;
    const costoDesgaste = tiempoTotal * tarifas.desgaste;
    const costoManoObra = tiempoTotal * tarifas.manoObra;

    const costoBase =
      costoFilamento + costoElectricidad + costoEmpaque + costoDesgaste + costoManoObra + adicional;

    const margenFraccion = Math.min(margenActual, 95) / 100;
    const precioVentaTotal = margenFraccion < 1 ? costoBase / (1 - margenFraccion) : costoBase;
    const comision = precioVentaTotal * (tarifas.comisionPct / 100);
    const precioUnitario = cantidad > 0 ? precioVentaTotal / cantidad : precioVentaTotal;

    productos.push({
      idx,
      nombre: item.querySelector(".prod-nombre").value.trim() || "Producto sin nombre",
      categoria: item.querySelector(".prod-categoria").value.trim(),
      descripcion: item.querySelector(".prod-descripcion").value.trim(),
      imagen: item.querySelector(".prod-imagen").value.trim(),
      cantidad,
      color: item.querySelector(".prod-color").value.trim(),
      tiempo: tiempoUnitario,
      peso: pesoUnitario,
      adicional,
      gramosTotales,
      costoFilamento,
      costoElectricidad,
      costoEmpaque,
      costoDesgaste,
      costoManoObra,
      comision,
      costoBase,
      precioVentaTotal,
      precioUnitario,
    });

    const breakdown = document.querySelector(`[data-breakdown="${idx}"]`);
    if (breakdown) {
      breakdown.innerHTML = `
        <div><span>Gramos utilizados</span><span>${gramosTotales} g</span></div>
        <div><span>Costo filamento</span><span>${formatoMoney(costoFilamento)}</span></div>
        <div><span>Costo electricidad</span><span>${formatoMoney(costoElectricidad)}</span></div>
        <div><span>Costo empaques</span><span>${formatoMoney(costoEmpaque)}</span></div>
        <div><span>Desgaste impresora</span><span>${formatoMoney(costoDesgaste)}</span></div>
        <div><span>Mano de obra</span><span>${formatoMoney(costoManoObra)}</span></div>
        <div><span>Costos adicionales</span><span>${formatoMoney(adicional)}</span></div>
        <div><span>Comisión de venta (${tarifas.comisionPct}%)</span><span>${formatoMoney(comision)}</span></div>
        <div class="cost-line-total"><span>Precio de venta (unitario)</span><span>${formatoMoney(precioUnitario)}</span></div>
      `;
    }
  });

  return productos;
}

// ===== Vista previa =====

function actualizarPreview(productos) {
  const cliente = document.getElementById("cotCliente").value.trim() || "Cliente sin nombre";
  const whatsapp = document.getElementById("cotWhatsapp").value.trim();
  const ciudad = document.getElementById("cotCiudad").value.trim();

  document.getElementById("quoteClienteNombre").textContent = cliente;
  document.getElementById("quoteClienteMeta").textContent = [whatsapp, ciudad].filter(Boolean).join(" · ");

  const tbody = document.getElementById("quoteTableBody");
  tbody.innerHTML = productos
    .map(
      (p) => `
        <tr>
          <td>${p.nombre}${p.color ? ` (${p.color})` : ""}</td>
          <td>${p.cantidad}</td>
          <td>${formatoMoney(p.precioUnitario)}</td>
          <td>${formatoMoney(p.precioVentaTotal)}</td>
        </tr>
      `
    )
    .join("");

  const total = productos.reduce((sum, p) => sum + p.precioVentaTotal, 0);
  document.getElementById("quoteTotal").textContent = formatoMoney(total);

  return total;
}

function recalcularTodo() {
  const productos = leerProductos();
  actualizarPreview(productos);
}

// ===== Margen =====

function seleccionarMargen(valor, boton) {
  document.querySelectorAll("#margenTabs .filter-tab").forEach((t) => t.classList.remove("active"));
  boton.classList.add("active");

  const wrap = document.getElementById("margenPersonalizadoWrap");
  if (valor === "custom") {
    wrap.style.display = "block";
    margenActual = Number(document.getElementById("margenPersonalizado").value) || 50;
  } else {
    wrap.style.display = "none";
    margenActual = Number(valor);
  }

  recalcularTodo();
}

// ===== Guardar / duplicar / eliminar / cargar =====

function recolectarCotizacionActual() {
  const productos = leerProductos();
  const total = productos.reduce((sum, p) => sum + p.precioVentaTotal, 0);

  return {
    folio: document.getElementById("quoteFolio").textContent,
    cliente: document.getElementById("cotCliente").value.trim(),
    whatsapp: document.getElementById("cotWhatsapp").value.trim(),
    correo: document.getElementById("cotCorreo").value.trim(),
    ciudad: document.getElementById("cotCiudad").value.trim(),
    fecha: document.getElementById("cotFecha").value || null,
    estado: document.getElementById("cotEstado").value,
    margen: margenActual,
    entrega: document.getElementById("quoteEntrega").value.trim(),
    garantia: document.getElementById("quoteGarantia").value.trim(),
    metodo_pago: document.getElementById("quoteMetodoPago").value,
    total,
    productos,
  };
}

async function guardarCotizacion() {
  const cliente = document.getElementById("cotCliente").value.trim();
  if (!cliente) {
    alert("Por favor escribe el nombre del cliente antes de guardar.");
    return;
  }
  if (!supabaseListoCot()) return;

  const cot = recolectarCotizacionActual();
  const { productos, ...cabecera } = cot;

  let cotizacionId = cotizacionEditandoId;

  if (cotizacionId) {
    const { error } = await supabaseClient.from("cotizaciones").update(cabecera).eq("id", cotizacionId);
    if (error) {
      alert("No se pudo actualizar la cotización: " + error.message);
      return;
    }
    // Reemplaza los productos: borra los anteriores y guarda los actuales.
    await supabaseClient.from("cotizacion_productos").delete().eq("cotizacion_id", cotizacionId);
  } else {
    const { data, error } = await supabaseClient.from("cotizaciones").insert(cabecera).select().single();
    if (error) {
      alert("No se pudo guardar la cotización: " + error.message);
      return;
    }
    cotizacionId = data.id;
  }

  if (productos.length > 0) {
    const filasProductos = productos.map((p) => ({
      cotizacion_id: cotizacionId,
      nombre: p.nombre,
      categoria: p.categoria,
      descripcion: p.descripcion,
      imagen: p.imagen,
      cantidad: p.cantidad,
      color: p.color,
      tiempo: p.tiempo,
      peso: p.peso,
      adicional: p.adicional,
      costo_base: p.costoBase,
      precio_venta_total: p.precioVentaTotal,
      precio_unitario: p.precioUnitario,
    }));

    const { error: errorProductos } = await supabaseClient.from("cotizacion_productos").insert(filasProductos);
    if (errorProductos) {
      alert("La cotización se guardó, pero hubo un error con los productos: " + errorProductos.message);
    }
  }

  cotizacionEditandoId = cotizacionId;
  await renderCotizacionesGuardadas();
  alert(`Cotización ${cot.folio} guardada correctamente.`);
}

async function duplicarCotizacionActual() {
  cotizacionEditandoId = null;
  document.getElementById("quoteFolio").textContent = await siguienteFolio();
  await guardarCotizacion();
}

function cargarCotizacionEnFormulario(id) {
  const cot = cotizacionesCache.find((c) => c.id === id);
  if (!cot) return;

  cotizacionEditandoId = cot.id;
  document.getElementById("quoteFolio").textContent = cot.folio;
  document.getElementById("cotCliente").value = cot.cliente || "";
  document.getElementById("cotWhatsapp").value = cot.whatsapp || "";
  document.getElementById("cotCorreo").value = cot.correo || "";
  document.getElementById("cotCiudad").value = cot.ciudad || "";
  document.getElementById("cotFecha").value = cot.fecha || "";
  document.getElementById("cotEstado").value = cot.estado || "Pendiente";
  document.getElementById("quoteEntrega").value = cot.entrega || "";
  document.getElementById("quoteGarantia").value = cot.garantia || "";
  document.getElementById("quoteMetodoPago").value = cot.metodo_pago || "Efectivo";

  document.getElementById("productosContainer").innerHTML = "";
  productoContador = 0;
  (cot.cotizacion_productos || []).forEach((p) =>
    agregarProducto({
      nombre: p.nombre,
      categoria: p.categoria,
      descripcion: p.descripcion,
      imagen: p.imagen,
      cantidad: p.cantidad,
      color: p.color,
      tiempo: p.tiempo,
      peso: p.peso,
      adicional: p.adicional,
    })
  );

  margenActual = cot.margen || 50;
  const tabBtn = document.querySelector(`#margenTabs .filter-tab[data-margen="${margenActual}"]`);
  document.querySelectorAll("#margenTabs .filter-tab").forEach((t) => t.classList.remove("active"));
  if (tabBtn) {
    tabBtn.classList.add("active");
    document.getElementById("margenPersonalizadoWrap").style.display = "none";
  } else {
    document.querySelector('#margenTabs .filter-tab[data-margen="custom"]').classList.add("active");
    document.getElementById("margenPersonalizadoWrap").style.display = "block";
    document.getElementById("margenPersonalizado").value = margenActual;
  }

  recalcularTodo();
  window.scrollTo({ top: 0, behavior: "smooth" });
}

async function eliminarCotizacionGuardada(id) {
  if (!confirm("¿Eliminar esta cotización guardada? Esta acción no se puede deshacer.")) return;
  if (!supabaseListoCot()) return;

  // Los productos se borran solos por el "on delete cascade" de la tabla.
  const { error } = await supabaseClient.from("cotizaciones").delete().eq("id", id);
  if (error) {
    alert("No se pudo eliminar: " + error.message);
    return;
  }
  renderCotizacionesGuardadas();
}

async function renderCotizacionesGuardadas() {
  const contenedor = document.getElementById("listaCotizaciones");
  if (!contenedor) return;

  cotizacionesCache = await cargarCotizaciones();
  const lista = cotizacionesCache;

  if (lista.length === 0) {
    contenedor.innerHTML = `<p class="empty-state">Aún no has guardado ninguna cotización.</p>`;
    return;
  }

  const badgeClase = {
    Pendiente: "badge-pending",
    Aprobada: "badge-ready",
    Rechazada: "badge-unpaid",
    "En espera": "badge-production",
  };

  contenedor.innerHTML = lista
    .map(
      (c) => `
        <div class="stock-card">
          <div class="stock-card-header">
            <div>
              <div class="stock-name">${c.folio} · ${c.cliente || "Sin cliente"}</div>
              <div class="stock-sub">${c.fecha || "Sin fecha"} · ${formatoMoney(c.total)}</div>
            </div>
            <span class="badge ${badgeClase[c.estado] || "badge-pending"}">${c.estado}</span>
          </div>
          <div class="stock-actions">
            <button class="icon-text-btn" onclick="cargarCotizacionEnFormulario('${c.id}')">✏️ Editar</button>
            <button class="icon-text-btn danger" onclick="eliminarCotizacionGuardada('${c.id}')">🗑️ Eliminar</button>
          </div>
        </div>
      `
    )
    .join("");
}

// ===== Convertir en orden / venta =====

async function convertirEnOrden() {
  const cliente = document.getElementById("cotCliente").value.trim();
  if (!cliente) {
    alert("Completa al menos el cliente y un producto antes de convertir la cotización.");
    return;
  }

  document.getElementById("cotEstado").value = "Aprobada";
  await guardarCotizacion();

  alert(
    "Cotización marcada como Aprobada. En un sistema con backend, esto crearía automáticamente el pedido en Producción. Por ahora, créalo manualmente desde 'Nueva venta'."
  );
  window.location.href = "nueva-venta.html";
}

async function convertirEnVenta() {
  const cliente = document.getElementById("cotCliente").value.trim();
  if (!cliente) {
    alert("Completa al menos el cliente y un producto antes de convertir la cotización.");
    return;
  }

  await guardarCotizacion();
  alert(
    "Cotización lista para convertir en venta. En un sistema con backend, esto descontaría el inventario y registraría la ganancia automáticamente."
  );
  window.location.href = "ventas.html";
}

// ===== WhatsApp =====

function compartirWhatsApp() {
  const productos = leerProductos();
  const total = productos.reduce((sum, p) => sum + p.precioVentaTotal, 0);

  const folio = document.getElementById("quoteFolio").textContent;
  const cliente =
    document.getElementById("cotCliente").value.trim() || "cliente";

  const whatsapp = document
    .getElementById("cotWhatsapp")
    .value.replace(/\D/g, "");

  const entrega = document
    .getElementById("quoteEntrega")
    .value.trim();

  // Construimos el mensaje normalmente
  let mensaje = `¡Hola ${cliente}! 

Gracias por confiar en *@elrojo.3d*.

Te comparto la cotización de tu pedido.

 *Cotización:* ${folio}

`;

  // Agregar productos
  productos.forEach((p) => {
    mensaje += `• ${p.nombre} x${p.cantidad} - ${formatoMoney(
      p.precioVentaTotal
    )}\n`;
  });

  // Total
  mensaje += `\n *Total cotizado:* ${formatoMoney(total)}\n`;

  // Tiempo de entrega (opcional)
  if (entrega) {
    mensaje += ` *Tiempo de entrega:* ${entrega}\n`;
  }

  // Mensaje final
  mensaje += `
Si tienes alguna duda o deseas realizar alguna modificación, estaré atento para ayudarte.

¡Quedo pendiente de tu confirmación! `;

  // Codificamos el mensaje completo
  const mensajeCodificado = encodeURIComponent(mensaje);

  // Generamos la URL de WhatsApp
  const url = whatsapp
    ? `https://wa.me/57${whatsapp}?text=${mensajeCodificado}`
    : `https://wa.me/?text=${mensajeCodificado}`;

  // Abrimos WhatsApp
  window.open(url, "_blank");
}

// ===== Inicialización =====

document.addEventListener("DOMContentLoaded", async () => {
  if (!document.getElementById("productosContainer")) return;

  document.getElementById("quoteFolio").textContent = await siguienteFolio();
  document.getElementById("cotFecha").value = new Date().toISOString().split("T")[0];
  document.getElementById("quoteFecha").textContent = new Date().toLocaleDateString("es-CO", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  agregarProducto();
  renderCotizacionesGuardadas();

  document.getElementById("productosContainer").addEventListener("input", recalcularTodo);
  document
    .querySelectorAll("#cotCliente, #cotWhatsapp, #cotCiudad, #tarifaFilamento, #tarifaElectricidad, #tarifaEmpaque, #tarifaDesgaste, #tarifaManoObra, #tarifaComision")
    .forEach((el) => el.addEventListener("input", recalcularTodo));

  document.querySelectorAll("#margenTabs .filter-tab").forEach((tab) => {
    tab.addEventListener("click", () => seleccionarMargen(tab.dataset.margen, tab));
  });

  document.getElementById("margenPersonalizado").addEventListener("input", (e) => {
    margenActual = Number(e.target.value) || 0;
    recalcularTodo();
  });
});
