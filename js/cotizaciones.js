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
  const usaCatalogo = d.usaCatalogo || false;
  return `
    <div class="producto-item" data-idx="${idx}">
      <div class="producto-item-header">
        <span>Producto ${idx + 1}</span>
        <button type="button" class="remove-producto-btn" onclick="quitarProducto(${idx})">🗑️ Quitar</button>
      </div>

      <div class="form-row">
        <div class="input-group">
          <label>Nombre del producto</label>
          <div class="combo-wrapper combo-producto-cot" data-idx="${idx}">
            <input type="text" class="prod-nombre combo-input" placeholder="Escribe para buscar o escribe uno nuevo..." autocomplete="off" value="${d.nombre || ""}" />
            <input type="hidden" class="prod-catalogo-id" value="${d.catalogoId || ""}" />
            <input type="hidden" class="prod-catalogo-precio" value="${d.catalogoPrecio || 0}" />
            <div class="combo-dropdown"></div>
          </div>
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

      <div class="toggle-switch">
        <input type="checkbox" class="prod-usa-catalogo" id="usaCatalogo${idx}" ${usaCatalogo ? "checked" : ""} />
        <label for="usaCatalogo${idx}">Usar precio de catálogo en vez de calcular por costos</label>
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
    const usaCatalogo = item.querySelector(".prod-usa-catalogo").checked;
    const catalogoId = item.querySelector(".prod-catalogo-id").value;
    const catalogoPrecio = Number(item.querySelector(".prod-catalogo-precio").value) || 0;

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
    const precioCalculadoTotal = margenFraccion < 1 ? costoBase / (1 - margenFraccion) : costoBase;
    const comision = precioCalculadoTotal * (tarifas.comisionPct / 100);

    // Si el interruptor "usar catálogo" está activo, el precio unitario
    // sale directo de productos.precio_venta; si no, del cálculo por costos.
    const precioUnitario = usaCatalogo ? catalogoPrecio : (cantidad > 0 ? precioCalculadoTotal / cantidad : precioCalculadoTotal);
    const precioVentaTotal = precioUnitario * cantidad;

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
      usaCatalogo,
      catalogoId,
      catalogoPrecio,
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
      if (usaCatalogo) {
        breakdown.innerHTML = `
          <div class="catalogo-precio-info">
            <span>💲 Precio de catálogo (unitario)</span>
            <span>${formatoMoney(catalogoPrecio)}</span>
          </div>
        `;
      } else {
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
    cliente_id: document.getElementById("cotClienteId").value || null,
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
  const esNueva = !cotizacionId;

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
  await registrarAuditoria(
    "Cotizaciones",
    esNueva ? "Creó" : "Modificó",
    "success",
    `${esNueva ? "creó" : "modificó"} la cotización ${cot.folio} para ${cot.cliente} por ${formatoMoney(cot.total)}.`
  );
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
  document.getElementById("cotClienteId").value = cot.cliente_id || "";
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

  const cot = cotizacionesCache.find((c) => c.id === id);

  // Los productos se borran solos por el "on delete cascade" de la tabla.
  const { error } = await supabaseClient.from("cotizaciones").delete().eq("id", id);
  if (error) {
    alert("No se pudo eliminar: " + error.message);
    return;
  }
  await registrarAuditoria(
    "Cotizaciones",
    "Eliminó",
    "error",
    `eliminó la cotización ${cot?.folio || id} (${cot?.cliente || "sin cliente"}).`
  );
  renderCotizacionesGuardadas();
}

async function renderCotizacionesGuardadas() {
  const contenedor = document.getElementById("listaCotizaciones");
  if (!contenedor) return;

  cotizacionesCache = await cargarCotizaciones();
  const activas = cotizacionesCache.filter(
    (c) => c.estado === "Pendiente" || c.estado === "En espera"
  );
  const lista = activas;

  if (lista.length === 0) {
    contenedor.innerHTML = `<p class="empty-state">No hay cotizaciones pendientes o en espera.</p>`;
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

async function crearPedidosDesdeCotizacion() {
  const cliente = document.getElementById("cotCliente").value.trim();
  const productos = leerProductos().filter((p) => p.nombre && p.cantidad > 0);
  if (!cliente || productos.length === 0) {
    alert("Completa al menos el cliente y un producto antes de convertir la cotización.");
    return null;
  }
  if (!supabaseListoCot()) return null;

  const cot = recolectarCotizacionActual();
  const filasPedidos = [];
  for (const p of productos) {
    filasPedidos.push({
      numero: await siguienteNumeroPedido(),
      producto: p.nombre + (p.color ? ` (${p.color})` : ""),
      precio_unitario: p.precioUnitario,
      cliente,
      cliente_id: document.getElementById("cotClienteId").value || null,
      asesor: "",
      cantidad: p.cantidad,
      fecha_entrega: null,
      entrega_sin_definir: true,
      estado: "Confirmado",
      estado_pago: "Pendiente",
      cotizacion_id: cotizacionEditandoId || null,
      observaciones: `Cotización ${cot.folio}. ${p.descripcion || ""}`.trim(),
    });
  }

  const { error } = await supabaseClient.from("pedidos").insert(filasPedidos);
  if (error) {
    alert("La cotización se guardó, pero no se pudieron crear los pedidos: " + error.message);
    return null;
  }

  await registrarAuditoria(
    "Cotizaciones",
    "Convirtió",
    "success",
    `convirtió la cotización ${cot.folio} en ${filasPedidos.length} pedido${filasPedidos.length === 1 ? "" : "s"}: ${filasPedidos.map((p) => p.numero).join(", ")}.`
  );

  return filasPedidos.length;
}

async function convertirEnOrden() {
  document.getElementById("cotEstado").value = "Aprobada";
  await guardarCotizacion();

  const total = await crearPedidosDesdeCotizacion();
  if (total === null) return;

  alert(`${total} pedido${total === 1 ? "" : "s"} creado${total === 1 ? "" : "s"} como Confirmado.`);
  window.location.href = "pedidos.html";
}

async function convertirEnVenta() {
  document.getElementById("cotEstado").value = "Aprobada";
  await guardarCotizacion();

  const total = await crearPedidosDesdeCotizacion();
  if (total === null) return;

  alert(
    `${total} pedido${total === 1 ? "" : "s"} creado${total === 1 ? "" : "s"}. La venta quedó registrada; verifica el pago en Pedidos.`
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

  await cargarCatalogoCotizaciones();
  agregarProducto();
  renderCotizacionesGuardadas();

  document.getElementById("productosContainer").addEventListener("input", recalcularTodo);
  document.getElementById("productosContainer").addEventListener("change", recalcularTodo);
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

  // ===== Buscador de producto (delegado, porque las filas se crean dinámicamente) =====
  document.getElementById("productosContainer").addEventListener("focusin", (event) => {
    const input = event.target.closest(".combo-producto-cot .combo-input");
    if (input) renderDropdownProductoCot(input);
  });

  document.getElementById("productosContainer").addEventListener("input", (event) => {
    const input = event.target.closest(".combo-producto-cot .combo-input");
    if (!input) return;
    const wrapper = input.closest(".combo-producto-cot");
    wrapper.querySelector(".prod-catalogo-id").value = "";
    wrapper.querySelector(".prod-catalogo-precio").value = 0;
    renderDropdownProductoCot(input);
  });

  document.getElementById("productosContainer").addEventListener("click", (event) => {
    const item = event.target.closest(".combo-item");
    if (item) {
      const wrapper = item.closest(".combo-producto-cot");
      seleccionarProductoCot(wrapper, item.dataset.id);
    }
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest(".combo-producto-cot")) {
      document.querySelectorAll(".combo-producto-cot .combo-dropdown").forEach((d) => d.classList.remove("open"));
    }
  });

  // ===== Buscador de cliente =====
  clientesDisponiblesCot = await cargarClientesCotizaciones();
  const clienteInputCot = document.getElementById("cotCliente");

  clienteInputCot.addEventListener("focus", () => renderDropdownClienteCot(clienteInputCot.value));
  clienteInputCot.addEventListener("input", () => {
    document.getElementById("cotClienteId").value = "";
    renderDropdownClienteCot(clienteInputCot.value);
  });

  document.getElementById("cotClienteDropdown").addEventListener("click", (event) => {
    if (event.target.id === "btnRegistrarClienteRapidoCot") {
      abrirModalClienteRapidoCot();
      return;
    }
    const item = event.target.closest(".combo-item");
    if (item) seleccionarClienteCot(item.dataset.id);
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest("#comboClienteCot")) {
      document.getElementById("cotClienteDropdown").classList.remove("open");
    }
  });

  document.getElementById("modalOverlayClienteRapido").addEventListener("click", (event) => {
    if (event.target === event.currentTarget) cerrarModalClienteRapidoCot();
  });

  document.getElementById("formClienteRapidoCot").addEventListener("submit", async (event) => {
    event.preventDefault();

    const nuevoCliente = {
      nombre: document.getElementById("rapidoCotNombre").value.trim(),
      telefono: document.getElementById("rapidoCotTelefono").value.trim(),
      correo: document.getElementById("rapidoCotCorreo").value.trim(),
      ciudad: document.getElementById("rapidoCotCiudad").value.trim(),
    };

    if (!nuevoCliente.nombre || !nuevoCliente.telefono) {
      alert("Por favor completa al menos el nombre y el teléfono.");
      return;
    }

    const { data, error } = await supabaseClient.from("clientes").insert(nuevoCliente).select().single();

    if (error) {
      alert("No se pudo registrar el cliente: " + error.message);
      return;
    }

    clientesDisponiblesCot.push(data);
    seleccionarClienteCot(data.id);
    cerrarModalClienteRapidoCot();
  });
});

// ===== Catálogo de productos (buscador) =====

let catalogoProductosCot = [];

async function cargarCatalogoCotizaciones() {
  if (typeof supabaseClient === "undefined" || !supabaseClient) return;

  const { data, error } = await supabaseClient
    .from("productos")
    .select("id, nombre, precio_venta, activo, categorias_productos(nombre)")
    .eq("activo", true)
    .order("nombre");

  if (error) {
    console.error("No se pudo cargar el catálogo de productos:", error.message);
    return;
  }
  catalogoProductosCot = data || [];
}

function renderDropdownProductoCot(input) {
  const wrapper = input.closest(".combo-producto-cot");
  const dropdown = wrapper.querySelector(".combo-dropdown");
  const texto = input.value.toLowerCase().trim();

  const coincidencias = texto
    ? catalogoProductosCot.filter((p) => p.nombre.toLowerCase().includes(texto))
    : catalogoProductosCot;

  if (coincidencias.length === 0) {
    dropdown.innerHTML = `<div class="combo-empty">No se encontraron productos. Puedes escribir uno nuevo.</div>`;
  } else {
    dropdown.innerHTML = coincidencias
      .map(
        (p) => `
          <div class="combo-item" data-id="${p.id}">
            <div class="combo-item-nombre">${p.nombre}</div>
            <div class="combo-item-meta">${p.categorias_productos ? p.categorias_productos.nombre + " · " : ""}${formatoMoney(p.precio_venta)}</div>
          </div>
        `
      )
      .join("");
  }

  dropdown.classList.add("open");
}

function seleccionarProductoCot(wrapper, id) {
  const producto = catalogoProductosCot.find((p) => p.id === id);
  if (!producto) return;

  const item = wrapper.closest(".producto-item");
  wrapper.querySelector(".prod-nombre").value = producto.nombre;
  wrapper.querySelector(".prod-catalogo-id").value = producto.id;
  wrapper.querySelector(".prod-catalogo-precio").value = producto.precio_venta || 0;
  wrapper.querySelector(".combo-dropdown").classList.remove("open");

  if (producto.categorias_productos) {
    item.querySelector(".prod-categoria").value = producto.categorias_productos.nombre;
  }

  // Al elegir del catálogo, se activa por defecto el precio de catálogo
  // (se puede apagar el interruptor si este pedido necesita un ajuste).
  item.querySelector(".prod-usa-catalogo").checked = true;

  recalcularTodo();
}

// ===== Buscador de cliente (cotizaciones) =====

let clientesDisponiblesCot = [];

async function cargarClientesCotizaciones() {
  if (typeof supabaseClient === "undefined" || !supabaseClient) return [];

  const { data, error } = await supabaseClient
    .from("clientes")
    .select("id, nombre, telefono, correo, ciudad")
    .order("nombre");

  if (error) {
    console.error("No se pudo cargar la lista de clientes:", error.message);
    return [];
  }
  return data;
}

function renderDropdownClienteCot(filtro) {
  const dropdown = document.getElementById("cotClienteDropdown");
  const texto = (filtro || "").toLowerCase().trim();

  const coincidencias = texto
    ? clientesDisponiblesCot.filter(
        (c) => c.nombre.toLowerCase().includes(texto) || (c.telefono || "").includes(texto)
      )
    : clientesDisponiblesCot;

  let html = coincidencias
    .map(
      (c) => `
        <div class="combo-item" data-id="${c.id}">
          <div class="combo-item-nombre">${c.nombre}</div>
          <div class="combo-item-meta">${[c.telefono, c.ciudad].filter(Boolean).join(" · ") || "Sin datos"}</div>
        </div>
      `
    )
    .join("");

  if (coincidencias.length === 0) {
    html += `<div class="combo-empty">No se encontraron clientes.</div>`;
  }
  html += `<div class="combo-item-action" id="btnRegistrarClienteRapidoCot">➕ Registrar nuevo cliente</div>`;

  dropdown.innerHTML = html;
  dropdown.classList.add("open");
}

function seleccionarClienteCot(id) {
  const cliente = clientesDisponiblesCot.find((c) => c.id === id);
  if (!cliente) return;

  document.getElementById("cotCliente").value = cliente.nombre;
  document.getElementById("cotClienteId").value = cliente.id;
  if (cliente.telefono) document.getElementById("cotWhatsapp").value = cliente.telefono;
  if (cliente.ciudad) document.getElementById("cotCiudad").value = cliente.ciudad;
  document.getElementById("cotClienteDropdown").classList.remove("open");
  recalcularTodo();
}

function abrirModalClienteRapidoCot() {
  document.getElementById("cotClienteDropdown").classList.remove("open");
  document.getElementById("formClienteRapidoCot").reset();
  document.getElementById("rapidoCotNombre").value = document.getElementById("cotCliente").value.trim();
  document.getElementById("modalOverlayClienteRapido").classList.add("open");
}

function cerrarModalClienteRapidoCot() {
  document.getElementById("modalOverlayClienteRapido").classList.remove("open");
}
