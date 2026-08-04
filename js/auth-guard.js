/*********************************
    AUTH GUARD - ELROJO 3D
*********************************/


// Verifica si existe una sesión activa
const PERFIL_VISUAL_KEY = "elrojo3d.perfilVisual";

function guardarPerfilVisual(usuario) {
    const perfil = { nombre: usuario.nombre || "", apellido: usuario.apellido || "", rol: usuario.rol || "" };
    sessionStorage.setItem(PERFIL_VISUAL_KEY, JSON.stringify(perfil));
}

function obtenerPerfilVisual() {
    try {
        const perfil = JSON.parse(sessionStorage.getItem(PERFIL_VISUAL_KEY));
        return perfil && perfil.rol ? perfil : null;
    } catch (error) {
        sessionStorage.removeItem(PERFIL_VISUAL_KEY);
        return null;
    }
}

function limpiarPerfilVisual() {
    sessionStorage.removeItem(PERFIL_VISUAL_KEY);
}

function mostrarInterfazAutenticada(usuario) {
    mostrarUsuarioEnPantalla(usuario);
    configurarMenuAdministrador(usuario.rol);
    document.documentElement.classList.add("auth-ui-ready");
}

function hidratarInterfazDesdeCache() {
    const perfil = obtenerPerfilVisual();
    if (perfil && document.querySelector(".sidebar, .bottom-nav")) {
        mostrarInterfazAutenticada(perfil);
    }
}

async function verificarSesion() {

    const { data, error } = await supabaseClient.auth.getSession();

    if (error) {
        console.error("Error obteniendo la sesión:", error);
        window.location.href = "index.html";
        return;
    }

    if (!data.session) {
        limpiarPerfilVisual();
        window.location.href = "index.html";
        return;
    }

    return data.session;
}


// Obtiene el usuario autenticado
async function obtenerUsuario() {

    const { data, error } = await supabaseClient.auth.getUser();

    if (error || !data.user) {
        limpiarPerfilVisual();
        window.location.href = "index.html";
        return null;
    }

    return data.user;
}


// Cerrar sesión
async function cerrarSesionSupabase() {

    try {
        limpiarPerfilVisual();

        const { error } = await supabaseClient.auth.signOut();

        if (error) {

            console.error("Error al cerrar sesión:", error);
            return;

        }

        window.location.replace("index.html");

    } catch (error) {

        console.error(error);

    }

}

//CIERRA SESION SI SE VENCE EL TOKEN
supabaseClient.auth.onAuthStateChange((event) => {

    if (event === "SIGNED_OUT") {
        limpiarPerfilVisual();

        window.location.replace("index.html");

    }

});


// Verifica que el usuario tenga un rol permitido
async function verificarRol(rolesPermitidos = []) {

    const usuario = await obtenerUsuario();

    if (!usuario) return;

    // CONSULTAR TU TABLA USUARIOS
    const { data, error } = await supabaseClient
        .from("usuarios")
        .select("rol, estado, nombre, apellido")
        .eq("id", usuario.id)
        .single();

    if (error) {

        console.error(error);
        alert("Tu cuenta todavía no tiene un rol asignado. Contacta al administrador.");
        window.location.href = "index.html";
        return;

    }

    // Muestra el nombre y el rol reales en el sidebar/menú de usuario de
    // cualquier página que tenga estos elementos (todas las internas).


    // SI LA CUENTA NO ESTÁ ACTIVA, CIERRA LA SESIÓN DE INMEDIATO
    if (data.estado !== "activo") {

        alert(`Tu cuenta está ${data.estado}. Contacta al administrador.`);
        await supabaseClient.auth.signOut();
        window.location.href = "index.html";
        return;

    }

    guardarPerfilVisual(data);
    mostrarInterfazAutenticada(data);


    // SI EL ROL NO ESTÁ PERMITIDO (Administrador siempre tiene acceso total)
    if (data.rol !== "Administrador" && !rolesPermitidos.includes(data.rol)) {

        alert("No tienes permisos para acceder a esta página.");

        window.location.href = "dashboard.html";

        return;
    }

    return data.rol;
}


// Actualiza el nombre y el rol reales en el sidebar/menú de usuario
// (mismo bloque .user-name / .user-role que ya existe en todas las
// páginas, tanto en el sidebar de escritorio como en el menú móvil).
function mostrarUsuarioEnPantalla(usuario) {

    const nombreCompleto = [usuario.nombre, usuario.apellido].filter(Boolean).join(" ") || "Usuario";

    document.querySelectorAll(".user-name").forEach((el) => {
        el.textContent = nombreCompleto;
    });

    document.querySelectorAll(".user-role").forEach((el) => {
        el.textContent = usuario.rol;
    });

}


// Agrega el acceso a Administrador en cada navegación interna y lo muestra
// únicamente a las cuentas administradoras. La validación de rutas continúa
// en verificarRol(), por lo que ocultar el enlace no sustituye los permisos.
function configurarMenuAdministrador(rol) {

    const esAdministrador = rol === "Administrador";
    const paginasAdministrativas = [
        "administrador.html",
        "gestion-inventario.html",
        "reportes.html",
        "auditoria.html"
    ];
    const paginaActual = window.location.pathname.split("/").pop() || "dashboard.html";
    const enModuloAdministrador = paginasAdministrativas.includes(paginaActual);

    document.querySelectorAll(".sidebar-nav, .bottom-nav").forEach((menu) => {
        let enlace = [...menu.querySelectorAll("a.nav-item")]
            .find((item) => item.getAttribute("href") === "administrador.html");

        if (!enlace) {
            enlace = document.createElement("a");
            enlace.href = "administrador.html";
            enlace.className = "nav-item admin-menu-link";
            enlace.innerHTML = '<span class="nav-icon">👑</span>' +
                (menu.classList.contains("bottom-nav") ? "Admin" : "Administrador");
            menu.appendChild(enlace);
        }

        enlace.classList.add("admin-menu-link");
        enlace.classList.toggle("admin-menu-visible", esAdministrador);
        enlace.classList.toggle("active", esAdministrador && enModuloAdministrador);
    });
}

// Muestra el perfil de la sesión anterior mientras Supabase confirma los
// datos y permisos reales de la cuenta actual.
hidratarInterfazDesdeCache();

