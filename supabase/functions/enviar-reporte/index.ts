import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { Resend } from "npm:resend@4.0.0";

// Configura dos secretos en Supabase: Settings → Edge Functions → Secrets
//  - RESEND_API_KEY:  API key de resend.com (proveedor de email gratuito)
//  - REPORTES_EMAIL:  correo del administrador que recibe los reportes
// También debes verificar un remitente en Resend (from) con tu dominio,
// o usar onboarding@resend.dev en modo prueba.

const resend = new Resend(Deno.env.get("RESEND_API_KEY") || "");

serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Método no permitido", { status: 405 });
  }

  const destinatario = Deno.env.get("REPORTES_EMAIL");
  if (!destinatario) {
    return new Response("Falta el secreto REPORTES_EMAIL", { status: 500 });
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return new Response("Cuerpo inválido", { status: 400 });
  }

  const { rango = "Todos los tiempos", csv = "" } = body;

  const { data, error } = await resend.emails.send({
    from: "ELROJO.3D Reportes <onboarding@resend.dev>",
    to: [destinatario],
    subject: `Reporte del negocio · ${rango}`,
    text: "Adjunto el reporte generado desde el panel administrativo.",
    attachments: [
      {
        filename: `reporte-elrojo-3d-${new Date().toISOString().split("T")[0]}.csv`,
        content: csv,
      },
    ],
  });

  if (error) {
    console.error("Error enviando el correo:", error.message);
    return new Response("Error enviando el correo: " + error.message, { status: 500 });
  }

  return new Response(JSON.stringify({ enviado: true, id: data?.id }), {
    headers: { "Content-Type": "application/json" },
  });
});
