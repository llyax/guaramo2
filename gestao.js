// Conteúdo publicado e moderação local. As páginas públicas mostram
// apenas registros publicados ou aprovados na mesma origem do navegador.
(() => {
  const t = (key) => copy[key][document.documentElement.lang === "es" ? 1 : 0];
  const select = (id) => document.getElementById(id);
  const keyFor = (type) => "guaramo-gestao-" + type + "-v1";
  const editing = new Map();
  const statusKeys = new Map();
  const artKinds = ["art-paint", "art-music", "art-poem", "art-other"];
  const circleFilter = new URLSearchParams(location.search).get("tipo") === "roda";
  const settings = {
    jobs: { fields: ["title", "company", "region", "description", "url"], empty: "postings-empty", action: "apply-job" },
    calendar: { fields: ["title", "when", "place", "description", "url", "kind"], empty: "calendar-empty", action: "event-open" },
    arts: { empty: "arts-empty", action: "art-open" }
  };

  function node(tag, text = "", className = "") {
    const result = document.createElement(tag);
    result.textContent = text;
    if (className) result.className = className;
    return result;
  }

  function safeUrl(raw) {
    if (!raw) return "";
    try {
      const url = new URL(raw);
      return url.protocol === "https:" && !url.username && !url.password ? url.href : "";
    } catch {
      return "";
    }
  }

  function read(type) {
    try {
      const entries = JSON.parse(localStorage.getItem(keyFor(type)));
      return Array.isArray(entries) ? entries : [];
    } catch {
      return [];
    }
  }

  async function update(type, action) {
    const key = keyFor(type);
    const save = () => {
      const entries = read(type);
      const message = action(entries);
      if (message !== "record-missing") localStorage.setItem(key, JSON.stringify(entries));
      return message;
    };
    try {
      return navigator.locks ? await navigator.locks.request(key, save) : save();
    } catch {
      return "storage-error";
    }
  }

  function announce(id, message) {
    statusKeys.set(id, message);
    select(id).textContent = t(message);
  }

  function actionButton(key, context, action) {
    const button = node("button", t(key), "button");
    button.type = "button";
    button.setAttribute("aria-label", t(key) + " — " + context);
    button.addEventListener("click", action);
    return button;
  }

  function appendInformation(card, type, entry) {
    const metadata = type === "jobs" ? [entry.company, entry.region] : type === "calendar" ? [entry.place, t(entry.kind === "circle" ? "event-circle" : "event-general")] : [entry.author, t(entry.kind)];
    if (type === "calendar") {
      const date = new Date(entry.when + ":00-03:00");
      if (!Number.isNaN(date.getTime())) {
        const label = new Intl.DateTimeFormat(document.documentElement.lang, {
          dateStyle: "long", timeStyle: "short", timeZone: "America/Sao_Paulo"
        }).format(date);
        const time = node("time", label);
        time.dateTime = entry.when + ":00-03:00";
        card.append(time);
      }
    }
    card.append(node("p", metadata.join(" · "), "overline"));
    if (entry.description) card.append(node("p", entry.description, "submitted-text"));
    const url = safeUrl(entry.url);
    if (url) {
      const link = node("a", t(settings[type].action), "text-link");
      link.href = url;
      card.append(link);
    }
  }

  function setEdit(type, entry) {
    const form = select(type + "-form");
    const cancel = form.querySelector("[data-cancel]");
    if (entry) {
      editing.set(type, entry.id);
      for (const field of settings[type].fields) {
        form.elements.namedItem(field).value = entry[field] ?? "";
      }
      announce(type + "-status", "editing");
      form.elements.namedItem("title").focus();
    } else {
      editing.delete(type);
      form.reset();
    }
    form.querySelector("[type=submit]").textContent = t(entry ? "save-change" : "publish");
    cancel.hidden = !entry;
  }

  function showPublic(type, entries) {
    const surface = select(type + "-public");
    if (!surface) return;
    if (type === "calendar" && circleFilter) {
      select("agenda-titulo").textContent = t("circles");
      select("calendar-all").hidden = false;
    }
    const items = entries.filter((entry) => entry.state === (type === "arts" ? "approved" : "published"));
    if (!items.length) {
      surface.replaceChildren(node("p", t(type === "calendar" && circleFilter ? "calendar-circle-empty" : settings[type].empty)));
      return;
    }
    surface.replaceChildren(...items.map((entry) => {
      const card = node("article", "", "card");
      card.append(node("h3", entry.title));
      appendInformation(card, type, entry);
      return card;
    }));
  }

  function changeEntry(type, entry, state) {
    return async () => {
      const message = await update(type, (items) => {
        const index = items.findIndex((item) => item.id === entry.id);
        if (index < 0) return "record-missing";
        if (state) items[index].state = state;
        else items.splice(index, 1);
        return state ? "saved" : "removed";
      });
      if (message === "removed" && editing.get(type) === entry.id) setEdit(type);
      render(type);
      announce(type === "arts" ? "arts-admin-status" : type + "-status", message);
      const list = select(type + "-admin");
      (list.querySelector("button") ?? list.closest("details").querySelector("summary")).focus();
    };
  }

  function showAdmin(type, entries) {
    const list = select(type + "-admin");
    if (!list) return;
    if (!entries.length) {
      list.replaceChildren(node("li", t("queue-empty")));
      return;
    }
    list.replaceChildren(...entries.map((entry) => {
      const row = node("li", "", "card");
      row.append(node("strong", entry.title));
      appendInformation(row, type, entry);
      const controls = node("div", "", "resource-actions");
      const add = (key, state) => controls.append(actionButton(key, entry.title, changeEntry(type, entry, state)));
      if (type === "arts") {
        row.append(node("p", t(entry.state)));
        if (entry.state !== "approved") add("approve", "approved");
        if (entry.state !== "rejected") add("reject", "rejected");
        if (entry.state !== "pending") add("unpublish-art", "pending");
      } else {
        const published = entry.state === "published";
        row.append(node("p", t(published ? "publication-state" : "publication-paused")));
        controls.append(actionButton("edit", entry.title, () => setEdit(type, entry)));
        if (published) add("hide-publication", "hidden");
        else add("publish", "published");
      }
      add("remove", "");
      row.append(controls);
      return row;
    }));
  }

  function render(type) {
    const entries = read(type);
    if (type === "calendar") entries.sort((a, b) => a.when.localeCompare(b.when));
    showAdmin(type, entries);
    showPublic(type, type === "calendar" && circleFilter ? entries.filter((entry) => entry.kind === "circle") : entries);
  }

  function id() {
    return crypto.randomUUID?.() ?? Date.now() + "-" + Math.random().toString(36).slice(2);
  }

  for (const type of ["jobs", "calendar"]) {
    const form = select(type + "-form");
    if (!form) continue;
    form.hidden = false;
    form.querySelector("[data-cancel]").addEventListener("click", () => {
      setEdit(type);
      form.elements.namedItem("title").focus();
    });
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const fields = Object.fromEntries(Array.from(new FormData(form), ([key, value]) => [key, value.trim()]));
      if (!settings[type].fields.every((field) => fields[field] || (type === "calendar" && field === "url"))) {
        announce(type + "-status", "invalid-entry");
        return;
      }
      const url = safeUrl(fields.url);
      if (fields.url && !url) {
        announce(type + "-status", "link-invalid");
        return;
      }
      const entryId = editing.get(type);
      const message = await update(type, (entries) => {
        if (entryId) {
          const existing = entries.find((entry) => entry.id === entryId);
          if (!existing) return "record-missing";
          Object.assign(existing, fields, { url });
        } else {
          entries.push({ ...fields, url, id: id(), state: "published" });
        }
        return "saved";
      });
      if (message === "saved") setEdit(type);
      render(type);
      announce(type + "-status", message);
    });
  }

  const submission = select("art-form");
  if (submission) {
    submission.hidden = false;
    submission.addEventListener("submit", async (event) => {
      event.preventDefault();
      const { title, author, kind, description, url } = Object.fromEntries(
        Array.from(new FormData(submission), ([key, value]) => [key, value.trim()])
      );
      const publicUrl = safeUrl(url);
      if (!title || !author || !artKinds.includes(kind)) {
        announce("art-status", "invalid-entry");
        return;
      }
      if ((url && !publicUrl) || (!publicUrl && !(kind === "art-poem" && description))) {
        announce("art-status", "art-invalid");
        return;
      }
      const message = await update("arts", (entries) => {
        entries.push({ id: id(), title, author, kind, description, url: publicUrl, state: "pending" });
        return "art-sent";
      });
      if (message === "art-sent") submission.reset();
      render("arts");
      announce("art-status", message);
    });
  }

  for (const type of Object.keys(settings)) render(type);
  window.addEventListener("storage", (event) => {
    for (const type of Object.keys(settings)) {
      if (event.key === keyFor(type) || event.key === null) render(type);
    }
  });
  document.addEventListener("guaramo:language", () => {
    for (const type of Object.keys(settings)) {
      render(type);
      const form = select(type + "-form");
      if (form && editing.has(type)) form.querySelector("[type=submit]").textContent = t("save-change");
    }
    for (const [status, message] of statusKeys) announce(status, message);
  });
})();

