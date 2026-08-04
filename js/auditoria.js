let auditoriaIniciada = false;

async function inicializarAuditoria() {
  if (auditoriaIniciada) return;
  auditoriaIniciada = true;

  const search = document.getElementById("buscarAuditoria");
  const user = document.getElementById("filtroUsuario");
  const module = document.getElementById("filtroModulo");
  const action = document.getElementById("filtroAccion");
  const onlyErrors = document.getElementById("soloErrores");
  const period = document.getElementById("periodoAuditoria");
  const empty = document.getElementById("auditEmpty");
  const timeline = document.getElementById("auditTimeline");
  const log = document.querySelector(".audit-log");
  const state = { events: [], visible: [] };

  document.querySelectorAll(".audit-day").forEach((day) => day.remove());

  const normalizar = (value) => String(value || "").toLocaleLowerCase("es");
  const inicioDelDia = (date = new Date()) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

  function inicioPeriodo(value) {
    const now = new Date();
    const start = inicioDelDia(now);
    if (value === "semana") {
      const day = start.getDay() || 7;
      start.setDate(start.getDate() - day + 1);
    }
    if (value === "mes") start.setDate(1);
    return start;
  }

  function formatoHora(eventDate) {
    const now = new Date();
    const diffMinutes = Math.floor((now - eventDate) / 60000);
    if (diffMinutes < 1) return "Ahora";
    if (diffMinutes < 60) return `Hace ${diffMinutes} min`;
    if (inicioDelDia(eventDate).getTime() === inicioDelDia(now).getTime()) {
      const hours = Math.floor(diffMinutes / 60);
      return `Hace ${hours} ${hours === 1 ? "hora" : "horas"}`;
    }
    return eventDate.toLocaleString("es-CO", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  }

  function etiquetaDia(eventDate) {
    const today = inicioDelDia();
    const eventDay = inicioDelDia(eventDate);
    const diffDays = Math.round((today - eventDay) / 86400000);
    if (diffDays === 0) return "Hoy";
    if (diffDays === 1) return "Ayer";
    return eventDate.toLocaleDateString("es-CO", { day: "numeric", month: "long" });
  }

  function poblarFiltro(select, values) {
    const current = select.value;
    const placeholder = select.options[0].textContent;
    select.replaceChildren(new Option(placeholder, ""));
    [...values].filter(Boolean).sort((a, b) => a.localeCompare(b, "es")).forEach((value) => {
      select.add(new Option(value, value));
    });
    select.value = current;
  }

  function actualizarResumen() {
    const today = inicioDelDia().getTime();
    const users = new Set(state.events.filter((event) => event.actor_id).map((event) => event.actor_id));
    document.getElementById("metricEventos").textContent = state.events.length.toLocaleString("es-CO");
    document.getElementById("metricHoy").textContent = state.events.filter((event) => inicioDelDia(new Date(event.created_at)).getTime() === today).length;
    document.getElementById("metricUsuarios").textContent = users.size;
    document.getElementById("metricErrores").textContent = state.events.filter((event) => event.tipo === "error").length;
  }

  function crearEvento(event) {
    const actor = event.actor_nombre || "Sistema";
    const message = event.mensaje || `${actor} ${event.accion || "registró una acción"}`;
    const eventDate = new Date(event.created_at);
    const article = document.createElement("article");
    const type = ["success", "warning", "info", "error", "system"].includes(event.tipo) ? event.tipo : "info";
    article.className = "audit-event";
    article.dataset.user = actor;
    article.dataset.module = event.modulo || "";
    article.dataset.action = event.accion || "";
    article.dataset.type = type;

    const dot = document.createElement("span");
    dot.className = `audit-dot ${type}`;
    const content = document.createElement("div");
    const paragraph = document.createElement("p");
    if (message.startsWith(actor)) {
      const name = document.createElement("b");
      name.textContent = actor;
      paragraph.append(name, document.createTextNode(message.slice(actor.length)));
    } else {
      paragraph.textContent = message;
    }
    const detail = document.createElement("small");
    detail.textContent = [event.modulo, event.detalle, formatoHora(eventDate)].filter(Boolean).join(" • ");
    content.append(paragraph, detail);
    article.append(dot, content);
    return article;
  }

  function renderTimeline() {
    timeline.replaceChildren();
    const groups = new Map();
    state.visible.forEach((event) => {
      const date = new Date(event.created_at);
      const key = inicioDelDia(date).toISOString();
      if (!groups.has(key)) groups.set(key, { label: etiquetaDia(date), events: [] });
      groups.get(key).events.push(event);
    });

    groups.forEach((group) => {
      const day = document.createElement("div");
      day.className = "audit-day";
      const heading = document.createElement("h2");
      heading.append(document.createElement("span"), document.createTextNode(group.label));
      const events = document.createElement("div");
      events.className = "audit-events";
      group.events.forEach((event) => events.append(crearEvento(event)));
      day.append(heading, events);
      timeline.append(day);
    });
  }

  function aplicarFiltros() {
    const term = normalizar(search.value);
    state.visible = state.events.filter((event) => {
      const text = normalizar([event.actor_nombre, event.modulo, event.accion, event.mensaje, event.detalle].join(" "));
      return (!term || text.includes(term)) &&
        (!user.value || event.actor_nombre === user.value) &&
        (!module.value || event.modulo === module.value) &&
        (!action.value || event.accion === action.value) &&
        (!onlyErrors.checked || event.tipo === "error");
    });
    renderTimeline();
    empty.hidden = state.visible.length !== 0;
    empty.textContent = "No hay eventos que coincidan con los filtros.";
  }

  async function cargarEventos() {
    empty.hidden = false;
    empty.textContent = "Cargando eventos de auditoría...";
    timeline.replaceChildren();
    const { data, error } = await supabaseClient
      .from("auditoria_eventos")
      .select("id, created_at, actor_id, actor_nombre, modulo, accion, tipo, mensaje, detalle")
      .gte("created_at", inicioPeriodo(period.value).toISOString())
      .order("created_at", { ascending: false })
      .limit(500);

    if (error) {
      console.error("No se pudo cargar la auditoría:", error);
      empty.textContent = "No fue posible cargar los eventos de auditoría.";
      log.classList.remove("is-loading");
      return;
    }

    state.events = data || [];
    poblarFiltro(user, new Set(state.events.map((event) => event.actor_nombre)));
    poblarFiltro(module, new Set(state.events.map((event) => event.modulo)));
    poblarFiltro(action, new Set(state.events.map((event) => event.accion)));
    actualizarResumen();
    aplicarFiltros();
    log.classList.remove("is-loading");
  }

  [search, user, module, action, onlyErrors].forEach((control) => {
    control.addEventListener(control === search ? "input" : "change", aplicarFiltros);
  });
  period.addEventListener("change", cargarEventos);

  document.getElementById("exportarAuditoria").addEventListener("click", () => {
    const rows = state.visible.map((event) => [
      new Date(event.created_at).toLocaleString("es-CO"), event.actor_nombre, event.modulo,
      event.accion, event.mensaje, event.detalle || ""
    ]);
    const csv = ["Fecha,Usuario,Módulo,Acción,Evento,Detalle", ...rows]
      .map((row) => row.map((cell) => `"${String(cell).replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" }));
    link.download = "auditoria-elrojo-3d.csv";
    link.click();
    URL.revokeObjectURL(link.href);
  });

  await cargarEventos();
}
