// ===== Recuperar contraseña: paso 2 (poner la contraseña nueva) =====
// Supabase te trae hasta aquí desde el enlace del correo, con un token
// especial en la URL que activa una sesión temporal de "recuperación".

let sesionDeRecuperacionLista = false;

document.addEventListener("DOMContentLoaded", () => {
  if (typeof supabaseClient === "undefined" || !supabaseClient) {
    alert("Supabase aún no está configurado. Revisa js/supabase-config.js.");
    return;
  }

  const boton = document.getElementById("btnGuardarPassword");
  const descripcion = document.getElementById("restablecerDescripcion");
  boton.disabled = true;

  supabaseClient.auth.onAuthStateChange((event) => {
    if (event === "PASSWORD_RECOVERY") {
      sesionDeRecuperacionLista = true;
      boton.disabled = false;
    }
  });

  // Si después de unos segundos no llegó el evento PASSWORD_RECOVERY,
  // seguramente entraron a esta página directo (sin venir del correo).
  setTimeout(() => {
    if (!sesionDeRecuperacionLista) {
      descripcion.textContent =
        "Este enlace no es válido o ya expiró. Solicita uno nuevo desde 'Olvidaste tu contraseña'.";
    }
  }, 4000);
});

async function guardarPasswordNueva() {
  if (!sesionDeRecuperacionLista) {
    alert("Este enlace no es válido o ya expiró. Solicita uno nuevo.");
    return;
  }

  const nueva = document.getElementById("passwordNueva").value;
  const confirmar = document.getElementById("passwordConfirmar").value;

  if (!nueva || nueva.length < 6) {
    alert("La contraseña debe tener al menos 6 caracteres.");
    return;
  }

  if (nueva !== confirmar) {
    alert("Las contraseñas no coinciden.");
    return;
  }

  const boton = document.getElementById("btnGuardarPassword");
  boton.disabled = true;
  boton.textContent = "Guardando...";

  const { error } = await supabaseClient.auth.updateUser({ password: nueva });

  boton.disabled = false;
  boton.textContent = "Guardar contraseña";

  if (error) {
    alert("No se pudo actualizar la contraseña: " + error.message);
    return;
  }

  alert("Contraseña actualizada correctamente. Ya puedes iniciar sesión.");
  await supabaseClient.auth.signOut();
  window.location.href = "index.html";
}
