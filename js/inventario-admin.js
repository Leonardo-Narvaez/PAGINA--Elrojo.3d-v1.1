// ===== Gestión de inventario: Filamentos y Productos =====
// Conectado a Supabase (tablas "filamentos" y "productos").
// Requiere que js/supabase-config.js tenga tus credenciales reales.

let filamentosCache = [];
let productosCache = [];

function formatoMoneda(valor) {
  const numero = Number(valor) || 0;
  return "$" + numero.toLocaleString("es-CO");
}

function supabaseListo() {
  if (typeof supabaseClient === "undefined" || !supabaseClient) {
    alert("Supabase aún no está configurado. Revisa js/supabase-config.js.");
    return false;
  }
  return true;
}

// ===== Cargar datos =====

async function cargarFilamentos() {
  if (!supabaseListo()) return [];
  const { data, error } = await supabaseClient
    .from("filamentos")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    alert("Error al cargar filamentos: " + error.message);
    return [];
  }
  return data;
}

async function cargarProductos() {
  if (!supabaseListo()) return [];
  const { data, error } = await supabaseClient
    .from("productos")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    alert("Error al cargar productos: " + error.message);
    return [];
  }
  return data;
}

// ===== Render =====

async function renderFilamentos() {
  const contenedor = document.getElementById("listaFilamentos");
  const contador = document.getElementById("countFilamentos");
  if (!contenedor) return;

  filamentosCache = await cargarFilamentos();
  const lista = filamentosCache;

  contador.textContent = `${lista.length} filamento${lista.length === 1 ? "" : "s"}`;

  if (lista.length === 0) {
    contenedor.innerHTML = `<p class="empty-state">Aún no has agregado filamentos.</p>`;
    return;
  }

  contenedor.innerHTML = lista
    .map((f) => {
      const estadoBadge = f.activo
        ? `<span class="badge badge-ready">Activo</span>`
        : `<span class="badge badge-inactive">Inactivo</span>`;

      const stockBadge =
        f.peso > 0 && f.disponible / f.peso <= 0.2
          ? `<span class="badge badge-unpaid">Stock bajo</span>`
          : "";

      return `
        <div class="stock-card">
          <div class="stock-card-header">
            <div>
              <div class="stock-name">${f.nombre}</div>
              <div class="stock-sub">${f.marca || "Sin marca"} · ${f.color || "-"} · ${f.material || "-"}</div>
            </div>
            <div class="stock-badges">${estadoBadge}${stockBadge}</div>
          </div>
          <div class="stock-meta">
            <span>Peso total: ${f.peso} g</span>
            <span>Disponible: ${f.disponible} g</span>
            <span>Compra: ${formatoMoneda(f.precio_compra)}</span>
            <span>Fecha: ${f.fecha_compra || "Sin definir"}</span>
          </div>
          <div class="stock-actions">
            <button class="icon-text-btn" onclick="abrirModalFilamento('${f.id}')">✏️ Editar</button>
            <button class="icon-text-btn danger" onclick="eliminarFilamento('${f.id}')">🗑️ Eliminar</button>
          </div>
        </div>
      `;
    })
    .join("");
}

async function renderProductos() {
  const contenedor = document.getElementById("listaProductos");
  const contador = document.getElementById("countProductos");
  if (!contenedor) return;

  productosCache = await cargarProductos();
  const lista = productosCache;

  contador.textContent = `${lista.length} producto${lista.length === 1 ? "" : "s"}`;

  if (lista.length === 0) {
    contenedor.innerHTML = `<p class="empty-state">Aún no has agregado productos.</p>`;
    return;
  }

  contenedor.innerHTML = lista
    .map((p) => {
      const estadoBadge = p.activo
        ? `<span class="badge badge-ready">Activo</span>`
        : `<span class="badge badge-inactive">Inactivo</span>`;

      return `
        <div class="stock-card">
          <div class="stock-card-header">
            <div>
              <div class="stock-name">${p.nombre}</div>
              <div class="stock-sub">${p.categoria || "Sin categoría"}</div>
            </div>
            <div class="stock-badges">${estadoBadge}</div>
          </div>
          <div class="stock-meta">
            <span>Venta: ${formatoMoneda(p.precio_venta)}</span>
            <span>Costo: ${formatoMoneda(p.costo_produccion)}</span>
            <span>Impresión: ${p.tiempo_impresion || "Sin definir"}</span>
          </div>
          ${p.descripcion ? `<div class="stock-desc">${p.descripcion}</div>` : ""}
          <div class="stock-actions">
            <button class="icon-text-btn" onclick="abrirModalProducto('${p.id}')">✏️ Editar</button>
            <button class="icon-text-btn danger" onclick="eliminarProducto('${p.id}')">🗑️ Eliminar</button>
          </div>
        </div>
      `;
    })
    .join("");
}

// ===== Modales =====

function cerrarModales() {
  document.getElementById("modalOverlayFilamento").classList.remove("open");
  document.getElementById("modalOverlayProducto").classList.remove("open");
}

function abrirModalFilamento(id) {
  const form = document.getElementById("formFilamento");
  form.reset();
  document.getElementById("filamentoId").value = "";
  document.getElementById("filamentoActivo").checked = true;

  if (id) {
    const filamento = filamentosCache.find((f) => f.id === id);
    if (filamento) {
      document.getElementById("modalFilamentoTitulo").textContent = "Editar filamento";
      document.getElementById("filamentoId").value = filamento.id;
      document.getElementById("filamentoNombre").value = filamento.nombre;
      document.getElementById("filamentoMarca").value = filamento.marca || "";
      document.getElementById("filamentoColor").value = filamento.color || "";
      document.getElementById("filamentoMaterial").value = filamento.material || "PLA";
      document.getElementById("filamentoPeso").value = filamento.peso;
      document.getElementById("filamentoDisponible").value = filamento.disponible;
      document.getElementById("filamentoPrecio").value = filamento.precio_compra || "";
      document.getElementById("filamentoFecha").value = filamento.fecha_compra || "";
      document.getElementById("filamentoActivo").checked = !!filamento.activo;
    }
  } else {
    document.getElementById("modalFilamentoTitulo").textContent = "Nuevo filamento";
  }

  document.getElementById("modalOverlayFilamento").classList.add("open");
}

function abrirModalProducto(id) {
  const form = document.getElementById("formProducto");
  form.reset();
  document.getElementById("productoId").value = "";
  document.getElementById("productoActivo").checked = true;

  if (id) {
    const producto = productosCache.find((p) => p.id === id);
    if (producto) {
      document.getElementById("modalProductoTitulo").textContent = "Editar producto";
      document.getElementById("productoId").value = producto.id;
      document.getElementById("productoNombre").value = producto.nombre;
      document.getElementById("productoDescripcion").value = producto.descripcion || "";
      document.getElementById("productoCategoria").value = producto.categoria || "";
      document.getElementById("productoPrecioVenta").value = producto.precio_venta;
      document.getElementById("productoCosto").value = producto.costo_produccion || "";
      document.getElementById("productoTiempo").value = producto.tiempo_impresion || "";
      document.getElementById("productoActivo").checked = !!producto.activo;
    }
  } else {
    document.getElementById("modalProductoTitulo").textContent = "Nuevo producto";
  }

  document.getElementById("modalOverlayProducto").classList.add("open");
}

// ===== Eliminar =====

async function eliminarFilamento(id) {
  const filamento = filamentosCache.find((f) => f.id === id);
  const nombre = filamento ? filamento.nombre : "este filamento";
  if (!confirm(`¿Eliminar "${nombre}" del inventario? Esta acción no se puede deshacer.`)) return;
  if (!supabaseListo()) return;

  const { error } = await supabaseClient.from("filamentos").delete().eq("id", id);
  if (error) {
    alert("No se pudo eliminar: " + error.message);
    return;
  }
  renderFilamentos();
}

async function eliminarProducto(id) {
  const producto = productosCache.find((p) => p.id === id);
  const nombre = producto ? producto.nombre : "este producto";
  if (!confirm(`¿Eliminar "${nombre}" del catálogo? Esta acción no se puede deshacer.`)) return;
  if (!supabaseListo()) return;

  const { error } = await supabaseClient.from("productos").delete().eq("id", id);
  if (error) {
    alert("No se pudo eliminar: " + error.message);
    return;
  }
  renderProductos();
}

// ===== Inicialización =====

document.addEventListener("DOMContentLoaded", () => {
  if (!document.getElementById("listaFilamentos")) return;

  renderFilamentos();
  renderProductos();

  // Pestañas Filamentos / Productos
  const tabs = document.querySelectorAll("#viewTabs .filter-tab");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => t.classList.remove("active"));
      tab.classList.add("active");

      const vista = tab.dataset.view;
      document.getElementById("viewFilamentos").style.display = vista === "filamentos" ? "block" : "none";
      document.getElementById("viewProductos").style.display = vista === "productos" ? "block" : "none";
    });
  });

  // Cerrar modal al hacer clic fuera de la tarjeta
  document.querySelectorAll(".modal-overlay").forEach((overlay) => {
    overlay.addEventListener("click", (event) => {
      if (event.target === overlay) cerrarModales();
    });
  });

  // Guardar filamento
  document.getElementById("formFilamento").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!supabaseListo()) return;

    const id = document.getElementById("filamentoId").value;
    const filamento = {
      nombre: document.getElementById("filamentoNombre").value.trim(),
      marca: document.getElementById("filamentoMarca").value.trim(),
      color: document.getElementById("filamentoColor").value.trim(),
      material: document.getElementById("filamentoMaterial").value,
      peso: Number(document.getElementById("filamentoPeso").value) || 0,
      disponible: Number(document.getElementById("filamentoDisponible").value) || 0,
      precio_compra: Number(document.getElementById("filamentoPrecio").value) || 0,
      fecha_compra: document.getElementById("filamentoFecha").value || null,
      activo: document.getElementById("filamentoActivo").checked,
    };

    if (!filamento.nombre) {
      alert("Por favor completa el nombre del filamento.");
      return;
    }

    const { error } = id
      ? await supabaseClient.from("filamentos").update(filamento).eq("id", id)
      : await supabaseClient.from("filamentos").insert(filamento);

    if (error) {
      alert("No se pudo guardar: " + error.message);
      return;
    }

    await renderFilamentos();
    cerrarModales();
  });

  // Guardar producto
  document.getElementById("formProducto").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!supabaseListo()) return;

    const id = document.getElementById("productoId").value;
    const producto = {
      nombre: document.getElementById("productoNombre").value.trim(),
      descripcion: document.getElementById("productoDescripcion").value.trim(),
      categoria: document.getElementById("productoCategoria").value.trim(),
      precio_venta: Number(document.getElementById("productoPrecioVenta").value) || 0,
      costo_produccion: Number(document.getElementById("productoCosto").value) || 0,
      tiempo_impresion: document.getElementById("productoTiempo").value.trim(),
      activo: document.getElementById("productoActivo").checked,
    };

    if (!producto.nombre) {
      alert("Por favor completa el nombre del producto.");
      return;
    }

    const { error } = id
      ? await supabaseClient.from("productos").update(producto).eq("id", id)
      : await supabaseClient.from("productos").insert(producto);

    if (error) {
      alert("No se pudo guardar: " + error.message);
      return;
    }

    await renderProductos();
    cerrarModales();
  });
});
