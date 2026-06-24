const storageKey = "daily-nutrition-pwa-v1";

const defaultFoods = [
  { id: "raw-skinless-chicken-breast", name: "雞胸（去皮）", calories: 110, protein: 23, unit: "100g", builtIn: true },
  { id: "raw-skin-on-chicken-breast", name: "雞胸（含皮）", calories: 165, protein: 21, unit: "100g", builtIn: true },
  { id: "raw-skinless-chicken-leg", name: "雞腿（去皮）", calories: 140, protein: 20, unit: "100g", builtIn: true },
  { id: "raw-skin-on-chicken-leg", name: "雞腿（含皮）", calories: 210, protein: 18, unit: "100g", builtIn: true },
  { id: "raw-pork-loin", name: "豬里肌", calories: 140, protein: 22, unit: "100g", builtIn: true },
  { id: "raw-beef-loin", name: "牛里肌", calories: 150, protein: 22, unit: "100g", builtIn: true },
  { id: "egg-per-piece", name: "雞蛋（1顆）", calories: 70, protein: 6, unit: "piece", builtIn: true },
];

let state = loadState();
let selectedDate = state.lastSelectedDate;
let visibleMonth = startOfMonth(parseDateInput(selectedDate));
let deferredInstallPrompt = null;
let storageWarningShown = false;

const els = {
  monthLabel: document.querySelector("#monthLabel"),
  calendarGrid: document.querySelector("#calendarGrid"),
  prevMonth: document.querySelector("#prevMonth"),
  nextMonth: document.querySelector("#nextMonth"),
  todayButton: document.querySelector("#todayButton"),
  dayTitle: document.querySelector("#dayTitle"),
  dailyCalories: document.querySelector("#dailyCalories"),
  dailyProtein: document.querySelector("#dailyProtein"),
  entryForm: document.querySelector("#entryForm"),
  entryDate: document.querySelector("#entryDate"),
  entryName: document.querySelector("#entryName"),
  entryProtein: document.querySelector("#entryProtein"),
  entryCalories: document.querySelector("#entryCalories"),
  entryList: document.querySelector("#entryList"),
  entryTemplate: document.querySelector("#entryTemplate"),
  foodSearch: document.querySelector("#foodSearch"),
  foodSelect: document.querySelector("#foodSelect"),
  servingLabel: document.querySelector("#servingLabel"),
  servingAmount: document.querySelector("#servingAmount"),
  calcCalories: document.querySelector("#calcCalories"),
  calcProtein: document.querySelector("#calcProtein"),
  addCalculatedFood: document.querySelector("#addCalculatedFood"),
  foodTableBody: document.querySelector("#foodTableBody"),
  foodForm: document.querySelector("#foodForm"),
  foodName: document.querySelector("#foodName"),
  foodCalories: document.querySelector("#foodCalories"),
  foodProtein: document.querySelector("#foodProtein"),
  resetButton: document.querySelector("#resetButton"),
  installButton: document.querySelector("#installButton"),
};

init();

function init() {
  els.entryDate.value = selectedDate;
  bindEvents();
  render();
  registerServiceWorker();
}

function bindEvents() {
  els.prevMonth.addEventListener("click", () => {
    visibleMonth = addMonths(visibleMonth, -1);
    renderCalendar();
  });

  els.nextMonth.addEventListener("click", () => {
    visibleMonth = addMonths(visibleMonth, 1);
    renderCalendar();
  });

  els.todayButton.addEventListener("click", () => {
    setSelectedDate(toDateInputValue(new Date()));
    render();
  });

  els.entryDate.addEventListener("change", (event) => {
    if (!event.target.value) return;
    setSelectedDate(event.target.value);
    render();
  });

  els.entryForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const entry = {
      id: createId(),
      date: els.entryDate.value,
      name: els.entryName.value.trim(),
      protein: toNumber(els.entryProtein.value),
      calories: Math.round(toNumber(els.entryCalories.value)),
    };

    if (!entry.name || !entry.date) return;
    state.entries.push(entry);
    setSelectedDate(entry.date, false);
    saveState();
    els.entryForm.reset();
    els.entryDate.value = entry.date;
    render();
    els.entryName.focus();
  });

  els.foodSearch.addEventListener("input", renderFoodTable);
  els.foodSelect.addEventListener("change", () => {
    setDefaultServingAmount(getSelectedFood());
    updateCalculator();
  });
  els.servingAmount.addEventListener("input", updateCalculator);

  els.addCalculatedFood.addEventListener("click", () => {
    const food = getSelectedFood();
    if (!food) return;
    const amount = toNumber(els.servingAmount.value);
    const multiplier = amount / getBaseAmount(food);
    state.entries.push({
      id: createId(),
      date: selectedDate,
      name: `${food.name} ${formatAmount(amount)}${getAmountSuffix(food)}`,
      protein: roundOne(food.protein * multiplier),
      calories: Math.round(food.calories * multiplier),
    });
    saveState();
    render();
  });

  els.foodForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const food = {
      id: createId(),
      name: els.foodName.value.trim(),
      calories: Math.round(toNumber(els.foodCalories.value)),
      protein: roundOne(toNumber(els.foodProtein.value)),
      unit: "100g",
      builtIn: false,
    };

    if (!food.name) return;
    state.foods.push(food);
    saveState();
    els.foodForm.reset();
    renderFoodTools();
  });

  els.resetButton.addEventListener("click", () => {
    const confirmed = window.confirm("確定要清除所有本機紀錄和自訂食物嗎？這個動作不能復原。");
    if (!confirmed) return;
    state = createDefaultState();
    setSelectedDate(state.lastSelectedDate, false);
    saveState();
    render();
  });

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredInstallPrompt = event;
    els.installButton.hidden = false;
  });

  els.installButton.addEventListener("click", async () => {
    if (!deferredInstallPrompt) return;
    deferredInstallPrompt.prompt();
    await deferredInstallPrompt.userChoice;
    deferredInstallPrompt = null;
    els.installButton.hidden = true;
  });
}

function render() {
  renderCalendar();
  renderDay();
  renderFoodTools();
}

function renderCalendar() {
  const year = visibleMonth.getFullYear();
  const month = visibleMonth.getMonth();
  const monthStart = new Date(year, month, 1);
  const monthEnd = new Date(year, month + 1, 0);
  const startOffset = (monthStart.getDay() + 6) % 7;
  const gridStart = addDays(monthStart, -startOffset);
  const todayValue = toDateInputValue(new Date());

  els.monthLabel.textContent = `${year} 年 ${month + 1} 月`;
  els.calendarGrid.innerHTML = "";

  for (let index = 0; index < 42; index += 1) {
    const date = addDays(gridStart, index);
    const value = toDateInputValue(date);
    const totals = getTotalsForDate(value);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "day-button";
    button.setAttribute("aria-label", `${value}，${totals.calories} kcal，蛋白質 ${formatAmount(totals.protein)} g`);
    if (date < monthStart || date > monthEnd) button.classList.add("is-muted");
    if (value === selectedDate) button.classList.add("is-selected");
    if (value === todayValue) button.classList.add("is-today");

    button.innerHTML = `
      <span class="day-number">${date.getDate()}</span>
      <span class="day-totals">
        <span>${totals.calories} kcal</span>
        <span>${formatAmount(totals.protein)} g P</span>
      </span>
      ${totals.count ? '<span class="day-dot" aria-hidden="true"></span>' : ""}
    `;

    button.addEventListener("click", () => {
      setSelectedDate(value);
      renderCalendar();
      renderDay();
    });

    els.calendarGrid.append(button);
  }
}

function renderDay() {
  const date = parseDateInput(selectedDate);
  const totals = getTotalsForDate(selectedDate);
  const entries = state.entries
    .filter((entry) => entry.date === selectedDate)
    .sort((a, b) => a.id.localeCompare(b.id));

  els.dayTitle.textContent = formatDateTitle(date);
  els.dailyCalories.textContent = totals.calories;
  els.dailyProtein.textContent = formatAmount(totals.protein);
  els.entryDate.value = selectedDate;
  els.entryList.innerHTML = "";

  if (!entries.length) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "這天還沒有紀錄。";
    els.entryList.append(empty);
    return;
  }

  entries.forEach((entry) => {
    const node = els.entryTemplate.content.firstElementChild.cloneNode(true);
    node.querySelector("h3").textContent = entry.name;
    node.querySelector("p").textContent = `${entry.calories} kcal · ${formatAmount(entry.protein)} g 蛋白質`;
    node.querySelector("button").addEventListener("click", () => {
      state.entries = state.entries.filter((item) => item.id !== entry.id);
      saveState();
      render();
    });
    els.entryList.append(node);
  });
}

function renderFoodTools() {
  renderFoodSelect();
  renderFoodTable();
  updateCalculator();
}

function renderFoodSelect() {
  const current = els.foodSelect.value;
  els.foodSelect.innerHTML = "";
  state.foods.forEach((food) => {
    const option = document.createElement("option");
    option.value = food.id;
    option.textContent = food.name;
    els.foodSelect.append(option);
  });

  if (state.foods.some((food) => food.id === current)) {
    els.foodSelect.value = current;
  }
  setDefaultServingAmount(getSelectedFood(), false);
}

function renderFoodTable() {
  const query = els.foodSearch.value.trim().toLocaleLowerCase();
  els.foodTableBody.innerHTML = "";

  state.foods
    .filter((food) => food.name.toLocaleLowerCase().includes(query))
    .forEach((food) => {
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${escapeHtml(food.name)}</td>
        <td>${getBaseLabel(food)}</td>
        <td>${food.calories} kcal</td>
        <td>${formatAmount(food.protein)} g</td>
        <td></td>
      `;

      const actionCell = row.lastElementChild;
      const chooseButton = document.createElement("button");
      chooseButton.type = "button";
      chooseButton.className = "text-button";
      chooseButton.textContent = "計算";
      chooseButton.addEventListener("click", () => {
        els.foodSelect.value = food.id;
        setDefaultServingAmount(food);
        updateCalculator();
        els.servingAmount.focus();
      });
      actionCell.append(chooseButton);

      if (!food.builtIn) {
        const removeButton = document.createElement("button");
        removeButton.type = "button";
        removeButton.className = "text-button danger";
        removeButton.textContent = "移除";
        removeButton.addEventListener("click", () => {
          state.foods = state.foods.filter((item) => item.id !== food.id);
          saveState();
          renderFoodTools();
        });
        actionCell.append(removeButton);
      }

      els.foodTableBody.append(row);
    });
}

function updateCalculator() {
  const food = getSelectedFood();
  const amount = toNumber(els.servingAmount.value);
  els.servingLabel.textContent = getAmountLabel(food);
  els.servingAmount.step = food?.unit === "piece" ? "1" : "1";
  if (!food || amount <= 0) {
    els.calcCalories.textContent = "0 kcal";
    els.calcProtein.textContent = "0 g 蛋白質";
    return;
  }

  const multiplier = amount / getBaseAmount(food);
  els.calcCalories.textContent = `${Math.round(food.calories * multiplier)} kcal`;
  els.calcProtein.textContent = `${formatAmount(food.protein * multiplier)} g 蛋白質`;
}

function getSelectedFood() {
  return state.foods.find((food) => food.id === els.foodSelect.value) || state.foods[0];
}

function getTotalsForDate(dateValue) {
  return state.entries.reduce(
    (totals, entry) => {
      if (entry.date !== dateValue) return totals;
      totals.calories += Number(entry.calories) || 0;
      totals.protein += Number(entry.protein) || 0;
      totals.count += 1;
      return totals;
    },
    { calories: 0, protein: 0, count: 0 },
  );
}

function setSelectedDate(dateValue, shouldSave = true) {
  if (!isDateInputValue(dateValue)) return;
  selectedDate = dateValue;
  state.lastSelectedDate = dateValue;
  visibleMonth = startOfMonth(parseDateInput(dateValue));
  els.entryDate.value = dateValue;
  if (shouldSave) saveState();
}

function loadState() {
  try {
    const stored = JSON.parse(window.localStorage.getItem(storageKey));
    if (!stored || !Array.isArray(stored.entries) || !Array.isArray(stored.foods)) {
      return createDefaultState();
    }
    return {
      entries: stored.entries,
      foods: mergeFoods(stored.foods),
      lastSelectedDate: getStoredSelectedDate(stored),
    };
  } catch {
    return createDefaultState();
  }
}

function saveState() {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(state));
  } catch {
    if (!storageWarningShown) {
      storageWarningShown = true;
      window.alert("瀏覽器目前沒有允許本機儲存，關閉分頁後資料可能不會保留。請確認不是私密瀏覽，並允許網站資料儲存。");
    }
  }
}

function createDefaultState() {
  return {
    entries: [],
    foods: [...defaultFoods],
    lastSelectedDate: toDateInputValue(new Date()),
  };
}

function getStoredSelectedDate(stored) {
  if (isDateInputValue(stored.lastSelectedDate)) return stored.lastSelectedDate;
  const entryDates = stored.entries.map((entry) => entry.date).filter(isDateInputValue);
  if (entryDates.length) return entryDates.sort()[entryDates.length - 1];
  return toDateInputValue(new Date());
}

function mergeFoods(savedFoods) {
  const byId = new Map(defaultFoods.map((food) => [food.id, food]));
  savedFoods
    .filter((food) => !food.builtIn)
    .map(normalizeCustomFood)
    .forEach((food) => byId.set(food.id, food));
  return Array.from(byId.values());
}

function normalizeCustomFood(food) {
  return {
    id: food.id || createId(),
    name: food.name || "自訂食物",
    calories: Math.round(toNumber(food.calories)),
    protein: roundOne(toNumber(food.protein)),
    unit: food.unit === "piece" ? "piece" : "100g",
    builtIn: false,
  };
}

function setDefaultServingAmount(food, force = true) {
  if (!food || (!force && els.servingAmount.value)) return;
  els.servingAmount.value = food.unit === "piece" ? "1" : "100";
}

function getBaseAmount(food) {
  return food?.unit === "piece" ? 1 : 100;
}

function getBaseLabel(food) {
  return food?.unit === "piece" ? "每 1 顆" : "每 100g 生食重";
}

function getAmountLabel(food) {
  return food?.unit === "piece" ? "顆數" : "生食重 g";
}

function getAmountSuffix(food) {
  return food?.unit === "piece" ? "顆" : "g";
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateInput(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function isDateInputValue(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = parseDateInput(value);
  return toDateInputValue(date) === value;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date, months) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function formatDateTitle(date) {
  return new Intl.DateTimeFormat("zh-Hant-TW", {
    month: "long",
    day: "numeric",
    weekday: "long",
  }).format(date);
}

function formatAmount(value) {
  return roundOne(value).toLocaleString("zh-Hant-TW", {
    maximumFractionDigits: 1,
  });
}

function roundOne(value) {
  return Math.round((Number(value) || 0) * 10) / 10;
}

function toNumber(value) {
  return Number.parseFloat(value) || 0;
}

function createId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
