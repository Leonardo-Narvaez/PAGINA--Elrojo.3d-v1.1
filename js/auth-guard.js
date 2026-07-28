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
        .select("rol")
        .eq("id", usuario.id)
        .single();

    if (error) {

        console.error(error);
        window.location.href = "dashboard.html";
        return;

    }


    // SI EL ROL NO ESTÁ PERMITIDO
    if (!rolesPermitidos.includes(data.rol)) {

        alert("No tienes permisos para acceder a esta página.");

        window.location.href = "dashboard.html";

        return;
    }

    return data.rol;
}

