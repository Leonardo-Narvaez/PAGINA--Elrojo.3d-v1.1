let gastosCache = [];
let ingresosOtrosCache = [];
let rolFinanzas = null;

function supabaseListoFinanzas() {
  if (typeof supabaseClient === "undefined" || !supabaseClient) {
    alert("Supabase aún no está configurado. Revisa js/supabase-config.js.");
    return false;
  }
  return true;
}

function inicioDelMes() {
  const hoy = new Date();
  return new Date(hoy.getFullYear(), hoy.getMonth(), 1);
}

async function obtenerRolFinanzas() {
  if (rolFinanzas) return rolFinanzas;
  const { data: userData } = await supabaseClient.auth.getUser();
  if (!userData || !userData.user) return null;
  const { data } = await supabaseClient
    .from("usuarios")
    .select("rol")
    .eq("id", userData.user.id)
    .single();
  rolFinanzas = data ? data.rol : null;
  return rolFinanzas;
}

async function cargarGastos() {
  if (!supabaseListoFinanzas()) return [];
  const { data, error } = await supabaseClient
    .from("gastos")
    .select("*")
    .order("fecha", { ascending: false });
  if (error) {
    console.warn("No se pudieron cargar los gastos:", error.message);
    return null;
  }
  return data;
}

async function cargarIngresosOtros() {
  if (!supabaseListoFinanzas()) return [];
  const { data, error } = await supabaseClient
    .from("ingresos_otros")
    .select("*")
    .order("fecha", { ascending: false });
  if (error) {
    console.warn("No se pudo leer el listado de ingresos (puede ser normal según el rol):", error.message);
    return null;
  }
  return data;
}

function montoMes(lista) {
  const inicio = inicioDelMes();
  return (lista || [])
    .filter((i) => new Date(i.fecha) >= inicio)
    .reduce((s, i) => s + (Number(i.monto) || 0), 0);
}

function tarjetaGasto(g) {
  const esAdmin = rolFinanzas === "Administrador";
  return `
    <div class="stock-card">
      <div class="stock-card-header">
        <div>
          <div class="stock-name">${g.concepto}</div>
          <div class="stock-sub">${g.fecha} · ${g.categoria || "Sin categoría"} · ${g.metodo_pago || "-"}</div>
        </div>
        <div class="stock-badges">
          <span class="badge badge-unpaid">${formatoMoney(g.monto)}</span>
        </div>
      </div>
      ${g.notas ? `<div class="stock-desc">${g.notas}</div>` : ""}
      ${esAdmin ? `<div class="stock-actions"><button class="icon-text-btn danger" onclick="eliminarGasto('${g.id}')">🗑️ Eliminar</button></div>` : ""}
    </div>
  `;
}

function tarjetaIngreso(i) {
  const esAdmin = rolFinanzas === "Administrador";
  return `
    <div class="stock-card">
      <div class="stock-card-header">
        <div>
          <div class="stock-name">${i.concepto}</div>
          <div class="stock-sub">${i.fecha} · ${i.metodo_pago || "Sin definir"}</div>
        </div>
        <div class="stock-badges">
          <span class="badge badge-ready">${formatoMoney(i.monto)}</span>
        </div>
      </div>
      ${i.notas ? `<div class="stock-desc">${i.notas}</div>` : ""}
      ${esAdmin ? `<div class="stock-actions"><button class="icon-text-btn danger" onclick="eliminarIngresoOtro('${i.id}')">🗑️ Eliminar</button></div>` : ""}
    </div>
  `;
}

function renderMovimientos() {
  const contenedor = document.getElementById("listaMovimientos");
  if (!contenedor) return;

  const movimientos = [
    ...(ingresosOtrosCache || []).map((i) => ({ tipo: "ingreso", fecha: i.fecha, concepto: i.concepto, monto: Number(i.monto) || 0 })),
    ...(gastosCache || []).map((g) => ({ tipo: "gasto", fecha: g.fecha, concepto: g.concepto, monto: Number(g.monto) || 0, categoria: g.categoria })),
  ].sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

  contenedor.innerHTML =
    movimientos.length > 0
      ? movimientos.slice(0, 10)
          .map(
            (m) => `
            <div class="list-item">
              <span>${m.tipo === "ingreso" ? "💚" : "💸"} ${m.concepto}${m.categoria ? ` · ${m.categoria}` : ""} <small class="notif-meta">${m.fecha}</small></span>
              <span class="${m.tipo === "ingreso" ? "badge badge-ready" : "badge badge-unpaid"}">${m.tipo === "ingreso" ? "+" : "-"}${formatoMoney(m.monto)}</span>
            </div>`
          )
          .join("")
      : `<p class="empty-state">Aún no hay movimientos registrados.</p>`;
}

async function refrescarFinanzas() {
  rolFinanzas = await obtenerRolFinanzas();
  gastosCache = await cargarGastos();
  ingresosOtrosCache = await cargarIngresosOtros();

  const pedidos = await cargarPedidos();
  const inicio = inicioDelMes();

  const ventasPedidosMes = (pedidos || [])
    .filter((p) => p.estado_pago === "Pagado" && new Date(p.created_at) >= inicio)
    .reduce((s, p) => s + (Number(p.precio_unitario) || 0) * (Number(p.cantidad) || 0), 0);

  const ingresosOtrosMes = montoMes(ingresosOtrosCache);
  const gastosMes = montoMes(gastosCache);

  const ingresosMes = ventasPedidosMes + ingresosOtrosMes;
  const utilidadMes = ingresosMes - gastosMes;
  const margen = ingresosMes > 0 ? Math.round((utilidadMes / ingresosMes) * 100) : 0;

  document.getElementById("resIngresosMes").textContent = formatoMoney(ingresosMes);
  document.getElementById("resGastosMes").textContent = formatoMoney(gastosMes);
  document.getElementById("resUtilidadMes").textContent = formatoMoney(utilidadMes);
  document.getElementById("resMargen").textContent = margen + "%";

  const listaIngresos = document.getElementById("listaIngresos");
  const seccionIngresos = document.getElementById("seccionListaIngresos");
  if (ingresosOtrosCache === null && seccionIngresos) {
    seccionIngresos.style.display = "none";
  } else if (listaIngresos) {
    seccionIngresos.style.display = "block";
    listaIngresos.innerHTML =
      ingresosOtrosCache.length > 0
        ? ingresosOtrosCache.map(tarjetaIngreso).join("")
        : `<p class="empty-state">Aún no hay ingresos registrados.</p>`;
  }

  const listaGastos = document.getElementById("listaGastos");
  const seccionGastos = document.getElementById("seccionListaGastos");
  if (gastosCache === null && seccionGastos) {
    seccionGastos.style.display = "none";
  } else if (listaGastos) {
    seccionGastos.style.display = "block";
    listaGastos.innerHTML =
      gastosCache.length > 0
        ? gastosCache.map(tarjetaGasto).join("")
        : `<p class="empty-state">Aún no hay gastos registrados.</p>`;
  }

  renderMovimientos();
}

async function eliminarGasto(id) {
  if (!confirm("¿Eliminar este gasto? Esta acción no se puede deshacer.")) return;
  if (!supabaseListoFinanzas()) return;
  const gasto = gastosCache.find((g) => g.id === id);
  const { error } = await supabaseClient.from("gastos").delete().eq("id", id);
  if (error) {
    alert("No se pudo eliminar el gasto: " + error.message);
    return;
  }
  await registrarAuditoria(
    "Finanzas",
    "Eliminó gasto",
    "error",
    `eliminó el gasto "${gasto ? gasto.concepto : id}".`
  );
  refrescarFinanzas();
}

async function eliminarIngresoOtro(id) {
  if (!confirm("¿Eliminar este ingreso? Esta acción no se puede deshacer.")) return;
  if (!supabaseListoFinanzas()) return;
  const ingreso = ingresosOtrosCache.find((i) => i.id === id);
  const { error } = await supabaseClient.from("ingresos_otros").delete().eq("id", id);
  if (error) {
    alert("No se pudo eliminar el ingreso: " + error.message);
    return;
  }
  await registrarAuditoria(
    "Finanzas",
    "Eliminó ingreso",
    "error",
    `eliminó el ingreso "${ingreso ? ingreso.concepto : id}".`
  );
  refrescarFinanzas();
}

function cambiarTabFinanzas(tab) {
  document.querySelectorAll("#finanzasTabs .filter-tab").forEach((b) => {
    b.classList.toggle("active", b.dataset.tab === tab);
  });
  ["vistaResumen", "vistaIngresos", "vistaGastos"].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.style.display = id === "vista" + tab.charAt(0).toUpperCase() + tab.slice(1) ? "block" : "none";
  });
  refrescarFinanzas();
}

document.addEventListener("DOMContentLoaded", () => {
  if (!document.getElementById("formIngresoFinanzas")) return;

  document.getElementById("ingresoFFecha").value = new Date().toISOString().split("T")[0];
  document.getElementById("gastoFFecha").value = new Date().toISOString().split("T")[0];

  refrescarFinanzas();

  document.getElementById("formIngresoFinanzas").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!supabaseListoFinanzas()) return;
    const { data: userData } = await supabaseClient.auth.getUser();
    const ingreso = {
      concepto: document.getElementById("ingresoFConcepto").value.trim(),
      monto: Number(document.getElementById("ingresoFMonto").value) || 0,
      fecha: document.getElementById("ingresoFFecha").value,
      metodo_pago: document.getElementById("ingresoFMetodoPago").value,
      notas: document.getElementById("ingresoFNotas").value.trim(),
      registrado_por: userData && userData.user ? userData.user.id : null,
    };
    if (!ingreso.concepto || ingreso.monto <= 0) {
      alert("Por favor completa el concepto y un monto válido.");
      return;
    }
    const { error } = await supabaseClient.from("ingresos_otros").insert(ingreso);
    if (error) {
      alert("No se pudo registrar el ingreso: " + error.message);
      return;
    }
    await registrarAuditoria("Finanzas", "Registró ingreso", "success", `registró el ingreso "${ingreso.concepto}" por ${formatoMoney(ingreso.monto)}.`);
    event.target.reset();
    document.getElementById("ingresoFFecha").value = new Date().toISOString().split("T")[0];
    refrescarFinanzas();
  });

  document.getElementById("formGastoFinanzas").addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!supabaseListoFinanzas()) return;
    const { data: userData } = await supabaseClient.auth.getUser();
    const gasto = {
      concepto: document.getElementById("gastoFConcepto").value.trim(),
      monto: Number(document.getElementById("gastoFMonto").value) || 0,
      fecha: document.getElementById("gastoFFecha").value,
      categoria: document.getElementById("gastoFCategoria").value,
      metodo_pago: document.getElementById("gastoFMetodoPago").value,
      notas: document.getElementById("gastoFNotas").value.trim(),
      registrado_por: userData && userData.user ? userData.user.id : null,
    };
    if (!gasto.concepto || gasto.monto <= 0) {
      alert("Por favor completa el concepto y un monto válido.");
      return;
    }
    const { error } = await supabaseClient.from("gastos").insert(gasto);
    if (error) {
      alert("No se pudo registrar el gasto: " + error.message);
      return;
    }
    await registrarAuditoria("Finanzas", "Registró gasto", "warning", `registró el gasto "${gasto.concepto}" por ${formatoMoney(gasto.monto)}.`);
    event.target.reset();
    document.getElementById("gastoFFecha").value = new Date().toISOString().split("T")[0];
    refrescarFinanzas();
  });
});