// Estoque e interesses usam chaves separadas. A prévia pública lê o mesmo
// estoque do painel de demonstração, na mesma origem do navegador.
(() => {
  const inventory = document.querySelector("#inventory");
  const stockForm = document.querySelector("#stock-form");
  const transferForm = document.querySelector("#transfer-form");
  const interestForm = document.querySelector("#interest-form");
  const interestList = document.querySelector("#interests");
  if (!inventory && !interestForm && !interestList) return;

  const stockKey = "guaramo-demo-stock-v1";
  const interestKey = "guaramo-demo-interests-v1";
  const points = ["north", "center", "east", "south", "west"];
  const areas = interestForm ? Array.from(interestForm.elements.area.options, (option) => option.value).filter(Boolean) : [];
  const samples = [
    { id: "jackets", point: "north", labelKey: "jackets", qty: 8 },
    { id: "blankets", point: "north", labelKey: "blankets", qty: 5 },
    { id: "baskets", point: "center", labelKey: "baskets", qty: 6 },
    { id: "kits", point: "east", labelKey: "kits", qty: 12 },
    { id: "school", point: "south", labelKey: "school", qty: 10 },
    { id: "craft", point: "west", labelKey: "craft", qty: 7 }
  ];
  const statuses = new Map();
  const newId = () => crypto.randomUUID?.() ?? Date.now() + "-" + Math.random().toString(36).slice(2);
  const t = (key) => copy[key][document.documentElement.lang === "es" ? 1 : 0];
  const itemName = (item) => item.labelKey ? t(item.labelKey) : item.name;

  function node(tag, text, className) {
    const element = document.createElement(tag);
    if (text) element.textContent = text;
    if (className) element.className = className;
    return element;
  }

  function button(key, context, value = "") {
    const element = node("button", t(key), "button");
    element.type = "submit";
    element.value = value;
    element.setAttribute("aria-label", t(key) + " — " + context);
    return element;
  }

  function read(key, fallback = []) {
    try {
      const data = JSON.parse(localStorage.getItem(key));
      if (Array.isArray(data)) return data;
    } catch {
      // A vitrine ainda mostra o estoque de exemplo sem armazenamento.
    }
    return fallback.map((item) => ({ ...item }));
  }

  async function save(key, fallback, update) {
    const write = () => {
      const items = read(key, fallback);
      const result = update(items);
      if (result.ok) localStorage.setItem(key, JSON.stringify(items));
      return result.message;
    };

    try {
      // Serializa alterações entre abas nos navegadores com Web Locks.
      return navigator.locks
        ? await navigator.locks.request(key, write)
        : write();
    } catch {
      return "storage-error";
    }
  }

  function announce(id, key) {
    statuses.set(id, key);
    document.getElementById(id).textContent = t(key);
  }

  function validQuantity(value) {
    const qty = Number(value);
    return value !== "" && Number.isInteger(qty) && qty >= 0 && qty <= 99999;
  }

  function stockRow(item) {
    const name = itemName(item);
    const row = node("li", "", "stock-row");
    row.append(node("strong", name));
    if (!stockForm) {
      row.append(node("span", t("qty-label") + " — " + item.qty));
      return row;
    }

    const form = node("form", "", "row-actions");
    const label = node("label", t("qty-label") + " — " + name, "sr-only");
    const input = node("input");
    input.type = "number";
    input.name = "quantity";
    input.min = "0";
    input.max = "99999";
    input.step = "1";
    input.required = true;
    input.value = item.qty;
    label.htmlFor = input.id = "qty-" + item.id;

    const change = button("save-qty", name, "update");
    change.id = "save-" + item.id;
    const remove = button("remove", name, "remove");
    remove.formNoValidate = true;
    form.append(label, input, change, remove);
    form.addEventListener("submit", async (event) => {
      event.preventDefault();
      const removing = event.submitter?.value === "remove";
      const qty = input.value;
      if (!removing && !validQuantity(qty)) {
        announce("stock-status", "invalid-entry");
        return;
      }
      const message = await save(stockKey, samples, (items) => {
        const index = items.findIndex((entry) => entry.id === item.id);
        if (index < 0) return { ok: false, message: "stock-missing" };
        if (removing) items.splice(index, 1);
        else items[index].qty = Number(qty);
        return { ok: true, message: removing ? "stock-removed" : "stock-saved" };
      });
      renderStock();
      announce("stock-status", message);
      (document.getElementById(change.id) ?? stockForm.elements.namedItem("item")).focus();
    });
    row.append(form);
    return row;
  }

  function renderStock() {
    if (!inventory) return;
    const items = read(stockKey, samples);
    renderTransfer(items);
    inventory.replaceChildren(...points.map((point) => {
      const card = node("article", "", "card");
      const rows = items.filter((item) => item.point === point).map(stockRow);
      card.append(node("h3", t("point-" + point)));
      if (rows.length) {
        const list = node("ul", "", "plain-list stock-list");
        list.append(...rows);
        card.append(list);
      } else {
        card.append(node("p", t("empty-stock")));
      }
      return card;
    }));
  }

  if (stockForm) {
    stockForm.hidden = false;
    stockForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const fields = new FormData(stockForm);
      const point = fields.get("point");
      const name = fields.get("item").trim();
      const qty = fields.get("quantity");
      if (!name || !points.includes(point) || !validQuantity(qty)) {
        announce("stock-status", "invalid-entry");
        return;
      }
      const collator = new Intl.Collator(document.documentElement.lang, { sensitivity: "base" });
      const message = await save(stockKey, samples, (items) => {
        const exists = items.some((item) => {
          if (item.point !== point) return false;
          const names = item.labelKey ? copy[item.labelKey] : [item.name];
          return names.some((label) => collator.compare(label, name) === 0);
        });
        if (exists) return { ok: false, message: "stock-duplicate" };
        items.push({ id: newId(), point, name, qty: Number(qty) });
        return { ok: true, message: "stock-added" };
      });
      if (message === "stock-added") {
        stockForm.elements.namedItem("item").value = "";
        stockForm.elements.quantity.value = "";
      }
      renderStock();
      announce("stock-status", message);
    });
  }

  function renderTransfer(items) {
    if (!transferForm) return;
    const source = transferForm.elements.source;
    const destination = transferForm.elements.destination;
    const selectedSource = source.value;
    const selectedDestination = destination.value;
    const available = items.filter((item) => item.qty > 0);
    source.replaceChildren(...available.map((item) => {
      const option = node("option", itemName(item) + " · " + t("point-" + item.point) + " (" + item.qty + ")");
      option.value = item.id;
      return option;
    }));
    if (available.some((item) => item.id === selectedSource)) source.value = selectedSource;
    const origin = available.find((item) => item.id === source.value)?.point;
    destination.replaceChildren(...points.filter((point) => point !== origin).map((point) => {
      const option = node("option", t("point-" + point));
      option.value = point;
      return option;
    }));
    if (selectedDestination && selectedDestination !== origin) destination.value = selectedDestination;
    transferForm.querySelector("button").disabled = !available.length;
  }

  if (transferForm) {
    transferForm.hidden = false;
    transferForm.elements.source.addEventListener("change", () => {
      renderTransfer(read(stockKey, samples));
    });
    transferForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const fields = new FormData(transferForm);
      const source = fields.get("source");
      const destination = fields.get("destination");
      const rawQuantity = fields.get("quantity");
      const qty = Number(rawQuantity);
      if (!source || !points.includes(destination) || !validQuantity(rawQuantity) || qty < 1) {
        announce("transfer-status", "invalid-entry");
        return;
      }
      const collator = new Intl.Collator(document.documentElement.lang, { sensitivity: "base" });
      const message = await save(stockKey, samples, (items) => {
        const origin = items.find((item) => item.id === source);
        if (!origin) return { ok: false, message: "stock-missing" };
        if (origin.point === destination) return { ok: false, message: "invalid-entry" };
        if (origin.qty < qty) return { ok: false, message: "transfer-short" };

        const names = origin.labelKey ? copy[origin.labelKey] : [origin.name];
        const target = items.find((item) => {
          if (item.point !== destination) return false;
          const targetNames = item.labelKey ? copy[item.labelKey] : [item.name];
          return names.some((name) => targetNames.some((other) => collator.compare(name, other) === 0));
        });
        if (target && target.qty + qty > 99999) return { ok: false, message: "transfer-max" };
        origin.qty -= qty;
        if (target) target.qty += qty;
        else items.push({ ...origin, id: newId(), point: destination, qty });
        return { ok: true, message: "transfer-ok" };
      });
      if (message === "transfer-ok") transferForm.elements.quantity.value = "";
      renderStock();
      announce("transfer-status", message);
    });
  }

  if (interestForm) {
    interestForm.hidden = false;
    const requested = new URLSearchParams(location.search).get("area");
    if (areas.includes(requested)) interestForm.elements.area.value = requested;
    interestForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const fields = new FormData(interestForm);
      const name = fields.get("name").trim();
      const area = fields.get("area");
      const details = fields.get("details").trim();
      if (!name || !areas.includes(area)) {
        announce("interest-status", "invalid-entry");
        return;
      }
      const message = await save(interestKey, [], (items) => {
        items.push({ id: newId(), name, area, details, reviewed: false });
        return { ok: true, message: "interest-recorded" };
      });
      if (message === "interest-recorded") interestForm.reset();
      announce("interest-status", message);
    });
  }

  function renderInterests() {
    if (!interestList) return;
    const items = read(interestKey);
    if (!items.length) {
      interestList.replaceChildren(node("li", t("empty-interest")));
      return;
    }
    interestList.replaceChildren(...items.map((item) => {
      const row = node("li", "", "card");
      const status = item.reviewed ? "reviewed" : "pending";
      const form = node("form", "", "row-actions");
      const toggle = button(item.reviewed ? "reopen" : "review", item.name, "toggle");
      toggle.id = "review-" + item.id;
      form.append(toggle, button("remove", item.name, "remove"));
      row.append(node("strong", item.name), node("p", t(item.area) + " · " + t(status)));
      if (item.details) row.append(node("p", item.details));
      row.append(form);
      form.addEventListener("submit", async (event) => {
        event.preventDefault();
        const removing = event.submitter?.value === "remove";
        const message = await save(interestKey, [], (entries) => {
          const index = entries.findIndex((entry) => entry.id === item.id);
          if (index < 0) return { ok: false, message: "record-missing" };
          if (removing) entries.splice(index, 1);
          else entries[index].reviewed = !item.reviewed;
          return { ok: true, message: removing ? "interest-removed" : "interest-updated" };
        });
        renderInterests();
        announce("admin-interest-status", message);
        const next = document.getElementById(toggle.id) ?? interestList.querySelector("button");
        if (next) next.focus();
        else document.querySelector("#interesses h2").focus();
      });
      return row;
    }));
  }

  renderStock();
  renderInterests();
  window.addEventListener("storage", (event) => {
    if (event.key === stockKey || event.key === null) renderStock();
    if (event.key === interestKey || event.key === null) renderInterests();
  });
  document.addEventListener("guaramo:language", () => {
    renderStock();
    renderInterests();
    for (const [id, key] of statuses) announce(id, key);
  });
})();

