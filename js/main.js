function login() {
  const email = document.querySelector('input[type="email"]').value.trim();
  const password = document.querySelector('input[type="password"]').value.trim();

  if (!email || !password) {
    alert("Por favor completa correo y contraseña.");
    return;
  }

  // Si ya configuraste Supabase (js/supabase-config.js), se usa el login real.
  if (typeof supabaseClient !== "undefined" && supabaseClient) {
    loginConSupabase(email, password);
    return;
  }

  // Modo demo (sin Supabase configurado todavía):
  console.log("Intentando iniciar sesión con:", email);
  alert("Inicio de sesión exitoso (modo demo, sin Supabase conectado aún).");
  window.location.href = "dashboard.html";
}

function validarEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

function toggleNotifications(button) {
  const panel = button.nextElementSibling;
  const isOpen = panel.classList.contains("open");

  document.querySelectorAll(".notif-panel.open, .user-menu.open").forEach((p) => p.classList.remove("open"));

  if (!isOpen) {
    panel.classList.add("open");
  }
}

document.addEventListener("click", (event) => {
  if (!event.target.closest(".notif-wrapper") && !event.target.closest(".user-menu-wrapper")) {
    document.querySelectorAll(".notif-panel.open, .user-menu.open").forEach((p) => p.classList.remove("open"));
  }
});

document.addEventListener("DOMContentLoaded", () => {
  const quickCards = document.querySelectorAll(".quick-card");
  quickCards.forEach((card) => {
    card.addEventListener("click", () => {
      const role = card.textContent.trim();
      console.log("Acceso rápido seleccionado:", role);
    });
  });

  const fechaEl = document.getElementById("fecha-actual");
  if (fechaEl) {
    const hoy = new Date();
    const opciones = { month: "long", day: "numeric" };
    fechaEl.textContent = hoy.toLocaleDateString("es-ES", opciones);
  }

  const clienteForm = document.getElementById("clienteForm");
  if (clienteForm) {
    clienteForm.addEventListener("submit", async (event) => {
      event.preventDefault();

      const cliente = {
        nombre: document.getElementById("nombre").value.trim(),
        telefono: document.getElementById("telefono").value.trim(),
        correo: document.getElementById("correo").value.trim(),
        ciudad: document.getElementById("ciudad").value.trim(),
        notas: document.getElementById("notas").value.trim(),
      };

      if (!cliente.nombre || !cliente.telefono) {
        alert("Por favor completa al menos el nombre y el teléfono.");
        return;
      }

      if (typeof supabaseClient === "undefined" || !supabaseClient) {
        alert("Supabase aún no está configurado. Revisa js/supabase-config.js.");
        return;
      }

      const { error } = await supabaseClient.from("clientes").insert(cliente);

      if (error) {
        alert("No se pudo guardar el cliente: " + error.message);
        return;
      }

      alert("Cliente registrado correctamente.");
      window.location.href = "clientes.html";
    });
  }

});
