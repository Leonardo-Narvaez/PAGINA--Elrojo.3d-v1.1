// ===== Clientes: datos reales desde Supabase =====
// Conectado a la tabla "clientes". Las secciones que necesitan datos de
// compras/pedidos (salud del cliente, radar, top 5, frecuentes/inactivos,
// productos favoritos) siguen con datos de ejemplo por ahora, ya que ese
// historial todavía no existe en la base de datos.

let clientesCache = [];

function supabaseListoClientes() {
  if (typeof supabaseClient === "undefined" || !supabaseClient) {
    alert("Supabase aún no está configurado. Revisa js/supabase-config.js.");
    return false;
  }
  return true;
}

async function cargarClientes() {
  if (!supabaseListoClientes()) return [];
  const { data, error } = await supabaseClient
    .from("clientes")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    alert("Error al cargar clientes: " + error.message);
    return [];
  }
  return data;
}

function tarjetaCliente(c) {
  const vipBadge = c.vip ? `<span class="badge badge-ready">VIP</span>` : "";
  const meta = [c.telefono, c.ciudad].filter(Boolean).join(" · ");

  return `
    <div class="stock-card">
      <div class="stock-card-header">
        <div>
          <div class="stock-name">${c.nombre}</div>
          <div class="stock-sub">${meta || "Sin datos de contacto"}</div>
        </div>
        <div class="stock-badges">${vipBadge}</div>
      </div>
      ${c.notas ? `<div class="stock-desc">${c.notas}</div>` : ""}
      <div class="stock-actions">
        <button class="icon-text-btn" onclick="abrirModalCliente('${c.id}')">✏️ Editar</button>
        <button class="icon-text-btn" onclick="alternarVip('${c.id}', ${!c.vip})">${c.vip ? "⭐ Quitar VIP" : "⭐ Hacer VIP"}</button>
        <button class="icon-text-btn danger" onclick="eliminarCliente('${c.id}')">🗑️ Eliminar</button>
      </div>
    </div>
  `;
}

function renderStats(lista) {
  const registrados = lista.length;
  const vip = lista.filter((c) => c.vip).length;
  const ciudades = new Set(lista.map((c) => c.ciudad).filter(Boolean)).size;

  const hace30dias = new Date();
  hace30dias.setDate(hace30dias.getDate() - 30);
  const nuevos = lista.filter((c) => c.created_at && new Date(c.created_at) >= hace30dias).length;

  document.getElementById("statRegistrados").textContent = registrados;
  document.getElementById("statVip").textContent = vip;
  document.getElementById("statCiudades").textContent = ciudades;
  document.getElementById("statNuevos").textContent = nuevos;
}

function renderListas(filtro) {
  const texto = (filtro || "").toLowerCase().trim();

  const filtrados = texto
    ? clientesCache.filter((c) =>
        [c.nombre, c.telefono, c.ciudad].some((campo) => (campo || "").toLowerCase().includes(texto))
      )
    : clientesCache;

  const listaVip = document.getElementById("listaVip");
  const vip = filtrados.filter((c) => c.vip);
  listaVip.innerHTML =
    vip.length > 0
      ? vip.map(tarjetaCliente).join("")
      : `<p class="empty-state">No hay clientes VIP${texto ? " que coincidan con la búsqueda" : " todavía"}.</p>`;

  const listaClientes = document.getElementById("listaClientes");
  listaClientes.innerHTML =
    filtrados.length > 0
      ? filtrados.map(tarjetaCliente).join("")
      : `<p class="empty-state">No hay clientes${texto ? " que coincidan con la búsqueda" : " registrados todavía"}.</p>`;
}

async function inicializarClientes() {
  clientesCache = await cargarClientes();
  renderStats(clientesCache);
  renderListas();
}

// ===== Modal de edición =====

function cerrarModalCliente() {
  document.getElementById("modalOverlayCliente").classList.remove("open");
}

function abrirModalCliente(id) {
  const cliente = clientesCache.find((c) => c.id === id);
  if (!cliente) return;

  document.getElementById("editClienteId").value = cliente.id;
  document.getElementById("editNombre").value = cliente.nombre || "";
  document.getElementById("editTelefono").value = cliente.telefono || "";
  document.getElementById("editCorreo").value = cliente.correo || "";
  document.getElementById("editCiudad").value = cliente.ciudad || "";
  document.getElementById("editNotas").value = cliente.notas || "";
  document.getElementById("editVip").checked = !!cliente.vip;

  document.getElementById("modalOverlayCliente").classList.add("open");
}

async function alternarVip(id, nuevoValor) {
  if (!supabaseListoClientes()) return;
  const { error } = await supabaseClient.from("clientes").update({ vip: nuevoValor }).eq("id", id);
  if (error) {
    alert("No se pudo actualizar: " + error.message);
    return;
  }
  await inicializarClientes();
}

async function eliminarCliente(id) {
  const cliente = clientesCache.find((c) => c.id === id);
  const nombre = cliente ? cliente.nombre : "este cliente";
  if (!confirm(`¿Eliminar a "${nombre}" de tu base de clientes? Esta acción no se puede deshacer.`)) return;
  if (!supabaseListoClientes()) return;

  const { error } = await supabaseClient.from("clientes").delete().eq("id", id);
  if (error) {
    alert("No se pudo eliminar: " + error.message);
    return;
  }
  await inicializarClientes();
}

// ===== Inicialización =====

document.addEventListener("DOMContentLoaded", () => {
  if (!document.getElementById("listaClientes")) return;

  inicializarClientes();

  const buscador = document.getElementById("clienteBuscar");
  if (buscador) {
    buscador.addEventListener("input", (e) => renderListas(e.target.value));
  }

  document.getElementById("modalOverlayCliente").addEventListener("click", (event) => {
    if (event.target === event.currentTarget) cerrarModalCliente();
  });

  document.getElementById("formEditarCliente").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!supabaseListoClientes()) return;

    const id = document.getElementById("editClienteId").value;
    const cambios = {
      nombre: document.getElementById("editNombre").value.trim(),
      telefono: document.getElementById("editTelefono").value.trim(),
      correo: document.getElementById("editCorreo").value.trim(),
      ciudad: document.getElementById("editCiudad").value.trim(),
      notas: document.getElementById("editNotas").value.trim(),
      vip: document.getElementById("editVip").checked,
    };

    if (!cambios.nombre || !cambios.telefono) {
      alert("Por favor completa al menos el nombre y el teléfono.");
      return;
    }

    const { error } = await supabaseClient.from("clientes").update(cambios).eq("id", id);
    if (error) {
      alert("No se pudo guardar: " + error.message);
      return;
    }

    cerrarModalCliente();
    await inicializarClientes();
  });
});
