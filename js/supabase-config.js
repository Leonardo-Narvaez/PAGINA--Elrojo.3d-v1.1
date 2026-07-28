// ===== Conexión a Supabase =====
// 1. Ve a tu proyecto en supabase.com → Settings → API
// 2. Copia "Project URL" y pégala abajo en SUPABASE_URL
// 3. Copia la clave "anon public" y pégala abajo en SUPABASE_ANON_KEY
//    (NUNCA uses la clave "service_role" aquí, esa es solo para el servidor)

const SUPABASE_URL = "https://uttonacmdqsshgfecmev.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0dG9uYWNtZHFzc2hnZmVjbWV2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODQ2ODM5ODgsImV4cCI6MjEwMDI1OTk4OH0.H-pezCniJRy1Z3xo33nSvejVB_jyaBJE38mcNYrmrww";

let supabaseClient = null;

// Solo se activa si ya reemplazaste las dos constantes de arriba.
if (SUPABASE_URL.startsWith("http") && SUPABASE_ANON_KEY.length > 20) {
  supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

// ===== Iniciar sesión =====
async function loginConSupabase(email, password) {
  if (!supabaseClient) {
    alert("Supabase aún no está configurado. Revisa js/supabase-config.js.");
    return;
  }

  const { data, error } = await supabaseClient.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    alert("No pudimos iniciar sesión: " + error.message);
    return;
  }

  window.location.href = "dashboard.html";
}

// El cierre de sesión y la protección de páginas internas ahora viven en
// js/auth-guard.js (funciones cerrarSesionSupabase() y verificarSesion()).
