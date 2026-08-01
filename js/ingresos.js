// ===== Ingresos (otros, no ligados a un pedido) =====

function formatoMoneyIngresos(valor) {
  const numero = Number(valor) || 0;
  return "$" + Math.round(numero).toLocaleString("es-CO");
}

function supabaseListoIngresos() {
  if (typeof supabaseClient === "undefined" || !supabaseClient) {
    alert("Supabase aún no está configurado. Revisa js/supabase-config.js.");
    return false;
  }
  return true;
}

async function obtenerRolActualIngresos() {
  const { data: userData } = await supabaseClient.auth.getUser();
  if (!userData || !userData.user) return null;

  const { data, error } = await supabaseClient
    .from("usuarios")
    .select("rol")
    .eq("id", userData.user.id)
    .single();

  if (error) return null;
  return data.rol;
}

async function cargarIngresos() {
  if (!supabaseListoIngresos()) return [];

  const { data, error } = await supabaseClient
    .from("ingresos_otros")
    .select("*")
    .order("fecha", { ascending: false });

  // Un error aquí es normal si el rol actual es Ventas (no tiene permiso
  // de leer el listado, solo de insertar) — no se muestra como fallo.
  if (error) {
    console.warn("No se pudo cargar el listado de ingresos (puede ser normal según el rol):", error.message);
    return null;
  }
  return data;
}

function tarjetaIngreso(i) {
  return `
    <div class="stock-card">
      <div class="stock-card-header">
        <div>
          <div class="stock-name">${i.concepto}</div>
          <div class="stock-sub">${i.fecha} · ${i.metodo_pago || "Sin definir"}</div>
        </div>
        <div class="stock-badges">
          <span class="badge badge-ready">${formatoMoneyIngresos(i.monto)}</span>
        </div>
      </div>
      ${i.notas ? `<div class="stock-desc">${i.notas}</div>` : ""}
    </div>
  `;
}

async function inicializarReporteIngresos() {
  const ingresos = await cargarIngresos();
  const seccion = document.getElementById("reporteIngresos");

  if (ingresos === null) {
    // Rol sin permiso de ver el reporte (ej. Ventas) — la sección se
    // queda oculta, solo se muestra el formulario de registro.
    seccion.style.display = "none";
    return;
  }

  seccion.style.display = "block";

  const total = ingresos.reduce((sum, i) => sum + (Number(i.monto) || 0), 0);
  const inicioMes = new Date();
  inicioMes.setDate(1);
  inicioMes.setHours(0, 0, 0, 0);

  const totalMes = ingresos
    .filter((i) => new Date(i.fecha) >= inicioMes)
    .reduce((sum, i) => sum + (Number(i.monto) || 0), 0);

  document.getElementById("totalIngresos").textContent = formatoMoneyIngresos(total);
  document.getElementById("totalIngresosMes").textContent = formatoMoneyIngresos(totalMes);
  document.getElementById("countIngresos").textContent = ingresos.length;

  const contenedor = document.getElementById("listaIngresos");
  contenedor.innerHTML =
    ingresos.length > 0
      ? ingresos.map(tarjetaIngreso).join("")
      : `<p class="empty-state">Aún no hay ingresos registrados.</p>`;
}

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("formIngreso");
  if (!form) return;

  document.getElementById("ingresoFecha").value = new Date().toISOString().split("T")[0];

  inicializarReporteIngresos();

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!supabaseListoIngresos()) return;

    const { data: userData } = await supabaseClient.auth.getUser();

    const ingreso = {
      concepto: document.getElementById("ingresoConcepto").value.trim(),
      monto: Number(document.getElementById("ingresoMonto").value) || 0,
      fecha: document.getElementById("ingresoFecha").value,
      metodo_pago: document.getElementById("ingresoMetodoPago").value,
      notas: document.getElementById("ingresoNotas").value.trim(),
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

    alert("Ingreso registrado correctamente.");
    form.reset();
    document.getElementById("ingresoFecha").value = new Date().toISOString().split("T")[0];
    inicializarReporteIngresos();
  });
});
