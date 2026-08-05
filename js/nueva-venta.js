// ===== Nueva venta: buscador de producto + guardado del pedido =====

let productosDisponibles = [];
let productoSeleccionado = null;

async function cargarProductosVenta() {
  if (typeof supabaseClient === "undefined" || !supabaseClient) return [];

  const { data, error } = await supabaseClient
    .from("productos")
    .select("id, nombre, precio_venta, activo")
    .eq("activo", true)
    .order("nombre");

  if (error) {
    console.error("No se pudo cargar el catálogo de productos:", error.message);
    return [];
  }
  return data;
}

function formatoMoneyVenta(valor) {
  const numero = Number(valor) || 0;
  return "$" + numero.toLocaleString("es-CO");
}

function renderDropdownProducto(filtro) {
  const dropdown = document.getElementById("productoDropdown");
  const texto = (filtro || "").toLowerCase().trim();

  const coincidencias = texto
    ? productosDisponibles.filter((p) => p.nombre.toLowerCase().includes(texto))
    : productosDisponibles;

  if (coincidencias.length === 0) {
    dropdown.innerHTML = `<div class="combo-empty">No se encontraron productos.</div>`;
  } else {
    dropdown.innerHTML = coincidencias
      .map(
        (p) => `
          <div class="combo-item" data-id="${p.id}">
            <div class="combo-item-nombre">${p.nombre}</div>
            <div class="combo-item-meta">${formatoMoneyVenta(p.precio_venta)}</div>
          </div>
        `
      )
      .join("");
  }

  dropdown.classList.add("open");
}

function seleccionarProducto(id) {
  const producto = productosDisponibles.find((p) => p.id === id);
  if (!producto) return;

  productoSeleccionado = producto;
  document.getElementById("productoBuscar").value = producto.nombre;
  document.getElementById("productoId").value = producto.id;
  document.getElementById("productoPrecio").value = producto.precio_venta || 0;
  document.getElementById("productoDropdown").classList.remove("open");
}

// ===== Buscador de cliente + registro rápido =====

let clientesDisponibles = [];

async function cargarClientesVenta() {
  if (typeof supabaseClient === "undefined" || !supabaseClient) return [];

  const { data, error } = await supabaseClient
    .from("clientes")
    .select("id, nombre, telefono, ciudad")
    .order("nombre");

  if (error) {
    console.error("No se pudo cargar la lista de clientes:", error.message);
    return [];
  }
  return data;
}

function renderDropdownCliente(filtro) {
  const dropdown = document.getElementById("clienteDropdown");
  const texto = (filtro || "").toLowerCase().trim();

  const coincidencias = texto
    ? clientesDisponibles.filter(
        (c) => c.nombre.toLowerCase().includes(texto) || (c.telefono || "").includes(texto)
      )
    : clientesDisponibles;

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
  html += `<div class="combo-item-action" id="btnRegistrarClienteRapido">➕ Registrar nuevo cliente</div>`;

  dropdown.innerHTML = html;
  dropdown.classList.add("open");
}

function seleccionarCliente(id) {
  const cliente = clientesDisponibles.find((c) => c.id === id);
  if (!cliente) return;

  document.getElementById("clienteBuscarVenta").value = cliente.nombre;
  document.getElementById("clienteId").value = cliente.id;
  document.getElementById("clienteDropdown").classList.remove("open");
}

function abrirModalClienteRapido() {
  document.getElementById("clienteDropdown").classList.remove("open");
  document.getElementById("formClienteRapido").reset();
  document.getElementById("rapidoNombre").value = document.getElementById("clienteBuscarVenta").value.trim();
  document.getElementById("modalOverlayClienteRapido").classList.add("open");
}

function cerrarModalClienteRapido() {
  document.getElementById("modalOverlayClienteRapido").classList.remove("open");
}

document.addEventListener("DOMContentLoaded", async () => {
  const buscador = document.getElementById("productoBuscar");
  if (!buscador) return; // No estamos en nueva-venta.html

  productosDisponibles = await cargarProductosVenta();

  buscador.addEventListener("focus", () => renderDropdownProducto(buscador.value));
  buscador.addEventListener("input", () => {
    productoSeleccionado = null;
    document.getElementById("productoId").value = "";
    document.getElementById("productoPrecio").value = 0;
    renderDropdownProducto(buscador.value);
  });

  document.getElementById("productoDropdown").addEventListener("click", (event) => {
    const item = event.target.closest(".combo-item");
    if (item) seleccionarProducto(item.dataset.id);
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest("#comboProducto")) {
      document.getElementById("productoDropdown").classList.remove("open");
    }
  });

  // ===== Checkbox "Sin definir" fecha de entrega =====
  const sinDefinirCheckbox = document.getElementById("sinDefinir");
  const fechaEntregaInput = document.getElementById("fechaEntrega");
  if (sinDefinirCheckbox && fechaEntregaInput) {
    const syncFechaEntrega = () => {
      fechaEntregaInput.disabled = sinDefinirCheckbox.checked;
      if (sinDefinirCheckbox.checked) fechaEntregaInput.value = "";
    };
    syncFechaEntrega();
    sinDefinirCheckbox.addEventListener("change", syncFechaEntrega);
  }

  // ===== Buscador de cliente =====
  clientesDisponibles = await cargarClientesVenta();
  const clienteInput = document.getElementById("clienteBuscarVenta");

  clienteInput.addEventListener("focus", () => renderDropdownCliente(clienteInput.value));
  clienteInput.addEventListener("input", () => {
    document.getElementById("clienteId").value = "";
    renderDropdownCliente(clienteInput.value);
  });

  document.getElementById("clienteDropdown").addEventListener("click", (event) => {
    if (event.target.id === "btnRegistrarClienteRapido") {
      abrirModalClienteRapido();
      return;
    }
    const item = event.target.closest(".combo-item");
    if (item) seleccionarCliente(item.dataset.id);
  });

  document.addEventListener("click", (event) => {
    if (!event.target.closest("#comboCliente")) {
      document.getElementById("clienteDropdown").classList.remove("open");
    }
  });

  document.getElementById("modalOverlayClienteRapido").addEventListener("click", (event) => {
    if (event.target === event.currentTarget) cerrarModalClienteRapido();
  });

  document.getElementById("formClienteRapido").addEventListener("submit", async (event) => {
    event.preventDefault();

    const nuevoCliente = {
      nombre: document.getElementById("rapidoNombre").value.trim(),
      telefono: document.getElementById("rapidoTelefono").value.trim(),
      correo: document.getElementById("rapidoCorreo").value.trim(),
      ciudad: document.getElementById("rapidoCiudad").value.trim(),
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

    clientesDisponibles.push(data);
    seleccionarCliente(data.id);
    cerrarModalClienteRapido();
  });

  // ===== Guardar el pedido =====
  const ventaForm = document.getElementById("ventaForm");
  if (ventaForm) {
    ventaForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const sinDefinir = sinDefinirCheckbox.checked;

      const venta = {
        numero: await siguienteNumeroPedido(),
        producto: document.getElementById("productoBuscar").value.trim(),
        precio_unitario: Number(document.getElementById("productoPrecio").value) || 0,
        cliente: document.getElementById("clienteBuscarVenta").value.trim(),
        cliente_id: document.getElementById("clienteId").value || null,
        asesor: document.getElementById("asesor").value,
        cantidad: Number(document.getElementById("cantidad").value) || 1,
        fecha_entrega: sinDefinir ? null : fechaEntregaInput.value || null,
        entrega_sin_definir: sinDefinir,
        estado: document.getElementById("estado").value,
        estado_pago: document.getElementById("estadoPago").value,
        observaciones: document.getElementById("observaciones").value.trim(),
      };

      if (!venta.producto || !venta.cliente) {
        alert("Por favor completa al menos el producto y el cliente.");
        return;
      }

      if (typeof supabaseClient === "undefined" || !supabaseClient) {
        alert("Supabase aún no está configurado. Revisa js/supabase-config.js.");
        return;
      }

      const { error } = await supabaseClient.from("pedidos").insert(venta);

      if (error) {
        alert("No se pudo guardar la venta: " + error.message);
        return;
      }

      await registrarAuditoria(
        "Pedidos",
        "Creó",
        "success",
        `creó el pedido ${venta.numero} (${venta.producto}) para ${venta.cliente}.`
      );
      alert("Venta registrada correctamente.");
      window.location.href = "pedidos.html";
    });
  }
});
