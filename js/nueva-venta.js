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

  // ===== Guardar el pedido =====
  const ventaForm = document.getElementById("ventaForm");
  if (ventaForm) {
    ventaForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const sinDefinir = sinDefinirCheckbox.checked;

      const venta = {
        producto: document.getElementById("productoBuscar").value.trim(),
        precio_unitario: Number(document.getElementById("productoPrecio").value) || 0,
        cliente: document.getElementById("cliente").value.trim(),
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

      alert("Venta registrada correctamente.");
      window.location.href = "pedidos.html";
    });
  }
});
