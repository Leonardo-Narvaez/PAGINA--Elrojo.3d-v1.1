import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { Resend } from "npm:resend@4.0.0";
import * as XLSX from "npm:xlsx@0.18.5";

// Configura dos secretos en Supabase: Settings → Edge Functions → Secrets
//  - RESEND_API_KEY:  API key de resend.com (proveedor de email gratuito)
//  - REPORTES_EMAIL:  correo del administrador que recibe los reportes
// También debes verificar un remitente en Resend (from) con tu dominio,
// o usar onboarding@resend.dev en modo prueba.

const resend = new Resend(Deno.env.get("RESEND_API_KEY") || "");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders },
  });
}

function aBase64(bytes) {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(bin);
}

function construirLibroExcel(secciones, rango) {
  const wb = XLSX.utils.book_new();

  const resumen = [
    ["ELROJO.3D - Reporte del negocio"],
    ["Período", rango],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(resumen), "Resumen");

  for (const sec of secciones) {
    const ws = XLSX.utils.aoa_to_sheet(sec.filas || []);
    const nombre = String(sec.titulo || "Sección").slice(0, 31);
    XLSX.utils.book_append_sheet(wb, ws, nombre);
  }

  return XLSX.write(wb, { bookType: "xlsx", type: "buffer" });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Método no permitido" }, 405);
  }

  const destinatario = (Deno.env.get("REPORTES_EMAIL") || "").toLowerCase();
  if (!destinatario) {
    return json({ error: "Falta el secreto REPORTES_EMAIL" }, 500);
  }

  let body;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Cuerpo inválido" }, 400);
  }

  const { rango = "Todos los tiempos", secciones = [] } = body;

  const libro = construirLibroExcel(secciones, rango);

  const { data, error } = await resend.emails.send({
    from: "ELROJO.3D Reportes <onboarding@resend.dev>",
    to: [destinatario],
    subject: `Reporte del negocio · ${rango}`,
    text: "Adjunto el reporte generado desde el panel administrativo.",
    attachments: [
      {
        filename: `reporte-elrojo-3d-${new Date().toISOString().split("T")[0]}.xlsx`,
        content: aBase64(libro),
      },
    ],
  });

  if (error) {
    console.error("Error enviando el correo:", error.message);
    return json({ error: "Error enviando el correo: " + error.message }, 500);
  }

  return json({ enviado: true, id: data?.id });
});
