/*********************************
    AUTH GUARD - ELROJO 3D
*********************************/


// Verifica si existe una sesión activa
async function verificarSesion() {

    const { data, error } = await supabaseClient.auth.getSession();

    if (error) {
        console.error("Error obteniendo la sesión:", error);
        window.location.href = "index.html";
        return;
    }

    if (!data.session) {
        window.location.href = "index.html";
        return;
    }

    return data.session;
}


// Obtiene el usuario autenticado
async function obtenerUsuario() {

    const { data, error } = await supabaseClient.auth.getUser();

    if (error || !data.user) {
        window.location.href = "index.html";
        return null;
    }

    return data.user;
}


// Cerrar sesión
async function cerrarSesionSupabase() {

    try {

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
    mostrarUsuarioEnPantalla(data);


    // SI LA CUENTA NO ESTÁ ACTIVA, CIERRA LA SESIÓN DE INMEDIATO
    if (data.estado !== "activo") {

        alert(`Tu cuenta está ${data.estado}. Contacta al administrador.`);
        await supabaseClient.auth.signOut();
        window.location.href = "index.html";
        return;

    }


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

