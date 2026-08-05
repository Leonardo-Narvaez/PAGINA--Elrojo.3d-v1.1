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
  const fechaDesde = document.getElementById("fechaDesde");
  const fechaHasta = document.getElementById("fechaHasta");
  const empty = document.getElementById("auditEmpty");
  const timeline = document.getElementById("auditTimeline");
  const log = document.querySelector(".audit-log");
  const pagination = document.getElementById("auditPagination");
  const POR_PAGINA = 20;
  const state = { events: [], visible: [], pagina: 1 };

  document.querySelectorAll(".audit-day").forEach((day) => day.remove());

  const normalizar = (value) => String(value || "").toLocaleLowerCase("es");
  const inicioDelDia = (date = new Date()) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

  function inicioPeriodo(value) {
    if (value === "todo") return null;
    const now = new Date();
    const start = inicioDelDia(now);
    if (value === "semana") {
      const day = start.getDay() || 7;
      start.setDate(start.getDate() - day + 1);
    }
    if (value === "mes") start.setDate(1);
    return start;
  }

  function rangoPersonalizado() {
    const desde = fechaDesde.value;
    const hasta = fechaHasta.value;
    if (!desde && !hasta) return null;
    const rango = {};
    if (desde) rango.desde = inicioDelDia(new Date(desde + "T00:00:00"));
    if (hasta) rango.hasta = new Date(hasta + "T23:59:59.999");
    return rango;
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
    const name = document.createElement("b");
    name.textContent = actor;
    if (message.startsWith(actor)) {
      paragraph.append(name, document.createTextNode(message.slice(actor.length)));
    } else {
      paragraph.append(name, document.createTextNode(" " + message));
    }
    const detail = document.createElement("small");
    detail.textContent = [event.modulo, event.detalle, formatoHora(eventDate)].filter(Boolean).join(" • ");
    content.append(paragraph, detail);
    article.append(dot, content);
    return article;
  }

  function renderTimeline() {
    timeline.replaceChildren();
    const inicio = (state.pagina - 1) * POR_PAGINA;
    const paginaEventos = state.visible.slice(inicio, inicio + POR_PAGINA);
    const groups = new Map();
    paginaEventos.forEach((event) => {
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

  function renderPaginacion() {
    const total = state.visible.length;
    const totalPaginas = Math.max(1, Math.ceil(total / POR_PAGINA));
    if (state.pagina > totalPaginas) state.pagina = totalPaginas;

    const inicio = total === 0 ? 0 : (state.pagina - 1) * POR_PAGINA + 1;
    const fin = Math.min(state.pagina * POR_PAGINA, total);

    pagination.replaceChildren();

    if (total === 0) {
      pagination.hidden = true;
      return;
    }

    const info = document.createElement("span");
    info.className = "audit-page-info";
    info.textContent = `Eventos ${inicio}–${fin} de ${total}`;

    const btnPrev = document.createElement("button");
    btnPrev.type = "button";
    btnPrev.textContent = "← Anterior";
    btnPrev.disabled = state.pagina === 1;
    btnPrev.addEventListener("click", () => {
      state.pagina--;
      renderTimeline();
      renderPaginacion();
    });

    const nums = document.createElement("div");
    nums.className = "audit-page-nums";
    for (let i = 1; i <= totalPaginas; i++) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = String(i);
      btn.className = i === state.pagina ? "active" : "";
      btn.addEventListener("click", () => {
        state.pagina = i;
        renderTimeline();
        renderPaginacion();
      });
      nums.append(btn);
    }

    const btnNext = document.createElement("button");
    btnNext.type = "button";
    btnNext.textContent = "Siguiente →";
    btnNext.disabled = state.pagina === totalPaginas;
    btnNext.addEventListener("click", () => {
      state.pagina++;
      renderTimeline();
      renderPaginacion();
    });

    pagination.append(info, btnPrev, nums, btnNext);
    pagination.hidden = false;
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
    state.pagina = 1;
    renderTimeline();
    renderPaginacion();
    empty.hidden = state.visible.length !== 0;
    empty.textContent = "No hay eventos que coincidan con los filtros.";
  }

  async function cargarEventos() {
    empty.hidden = false;
    empty.textContent = "Cargando eventos de auditoría...";
    timeline.replaceChildren();
    let query = supabaseClient
      .from("auditoria_eventos")
      .select("id, created_at, actor_id, actor_nombre, modulo, accion, tipo, mensaje, detalle")
      .order("created_at", { ascending: false })
      .limit(500);

    const rango = rangoPersonalizado();
    if (rango) {
      if (rango.desde) query = query.gte("created_at", rango.desde.toISOString());
      if (rango.hasta) query = query.lte("created_at", rango.hasta.toISOString());
    } else {
      const desde = inicioPeriodo(period.value);
      if (desde) query = query.gte("created_at", desde.toISOString());
    }

    const { data, error } = await query;

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
  period.addEventListener("change", () => {
    fechaDesde.value = "";
    fechaHasta.value = "";
    cargarEventos();
  });
  fechaDesde.addEventListener("change", () => {
    period.value = "todo";
    cargarEventos();
  });
  fechaHasta.addEventListener("change", () => {
    period.value = "todo";
    cargarEventos();
  });

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
    const hoy = new Date().toISOString().split("T")[0];
    link.download = `auditoria-elrojo-3d-${hoy}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  });

  await cargarEventos();
}
