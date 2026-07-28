// ===== Recuperar contraseña: paso 1 (pedir el correo) =====

async function enviarCorreoRecuperacion() {
  const email = document.getElementById("recuperarEmail").value.trim();

  if (!email) {
    alert("Por favor escribe tu correo electrónico.");
    return;
  }

  if (typeof supabaseClient === "undefined" || !supabaseClient) {
    alert("Supabase aún no está configurado. Revisa js/supabase-config.js.");
    return;
  }

  const boton = document.querySelector(".login-btn");
  boton.disabled = true;
  boton.textContent = "Enviando...";

  // redirectTo debe estar agregado en Supabase → Authentication → URL Configuration
  // → Redirect URLs, o el enlace del correo no va a funcionar.
  const { error } = await supabaseClient.auth.resetPasswordForEmail(email, {
    redirectTo: window.location.origin + window.location.pathname.replace("recuperar-password.html", "restablecer-password.html"),
  });

  boton.disabled = false;
  boton.textContent = "Enviar enlace";

  if (error) {
    alert("No pudimos enviar el correo: " + error.message);
    return;
  }

  alert("Listo. Si el correo existe en nuestro sistema, te llegará un enlace para crear tu contraseña nueva. Revisa también la carpeta de spam.");
  window.location.href = "index.html";
}
