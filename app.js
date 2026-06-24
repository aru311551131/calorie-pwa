const storageKey = "daily-nutrition-pwa-v1";

const defaultFoods = [
  { id: "chicken-breast", name: "雞胸肉", calories: 165, protein: 31, carbs: 0, fat: 3.6, builtIn: true },
  { id: "egg", name: "雞蛋", calories: 143, protein: 12.6, carbs: 0.7, fat: 9.5, builtIn: true },
  { id: "white-rice", name: "白飯", calories: 130, protein: 2.7, carbs: 28, fat: 0.3, builtIn: true },
  { id: "sweet-potato", name: "地瓜", calories: 86, protein: 1.6, carbs: 20.1, fat: 0.1, builtIn: true },
  { id: "tofu", name: "板豆腐", calories: 76, protein: 8, carbs: 1.9, fat: 4.8, builtIn: true },
  { id: "salmon", name: "鮭魚", calories: 208, protein: 20, carbs: 0, fat: 13, builtIn: true },
  { id: "tuna", name: "鮪魚罐頭水煮", calories: 116, protein: 25.5, carbs: 0, fat: 0.8, builtIn: true },
  { id: "greek-yogurt", name: "希臘優格無糖", calories: 59, protein: 10.2, carbs: 3.6, fat: 0.4, builtIn: true },
  { id: "milk", name: "低脂牛奶", calories: 42, protein: 3.4, carbs: 5, fat: 1, builtIn: true },
  { id: "banana", name: "香蕉", calories: 89, protein: 1.1, carbs: 22.8, fat: 0.3, builtIn: true },
  { id: "broccoli", name: "花椰菜", calories: 34, protein: 2.8, carbs: 6.6, fat: 0.4, builtIn: true },
  { id: "pork-loin", name: "豬里肌", calories: 143, protein: 21, carbs: 0, fat: 6, builtIn: true },
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
  servingAmount: document.querySelector("#servingAmount"),
  calcCalories: document.querySelector("#calcCalories"),
  calcProtein: document.querySelector("#calcProtein"),
  calcCarbsFat: document.querySelector("#calcCarbsFat"),
  addCalculatedFood: document.querySelector("#addCalculatedFood"),
  foodTableBody: document.querySelector("#foodTableBody"),
  foodForm: document.querySelector("#foodForm"),
  foodName: document.querySelector("#foodName"),
  foodCalories: document.querySelector("#foodCalories"),
  foodProtein: document.querySelector("#foodProtein"),
  foodCarbs: document.querySelector("#foodCarbs"),
  foodFat: document.querySelector("#foodFat"),
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
  els.foodSelect.addEventListener("change", updateCalculator);
  els.servingAmount.addEventListener("input", updateCalculator);

  els.addCalculatedFood.addEventListener("click", () => {
    const food = getSelectedFood();
    if (!food) return;
    const amount = toNumber(els.servingAmount.value);
    const multiplier = amount / 100;
    state.entries.push({
      id: createId(),
      date: selectedDate,
      name: `${food.name} ${formatAmount(amount)}g`,
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
      carbs: roundOne(toNumber(els.foodCarbs.value)),
      fat: roundOne(toNumber(els.foodFat.value)),
      builtIn: false,
    };

    if (!food.name) return;
    state.foods.push(food);
    saveState();
    els.foodForm.reset();
    els.foodCarbs.value = 0;
    els.foodFat.value = 0;
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
        <td>${food.calories} kcal</td>
        <td>${formatAmount(food.protein)} g</td>
        <td>${formatAmount(food.carbs)} g</td>
        <td>${formatAmount(food.fat)} g</td>
        <td></td>
      `;

      const actionCell = row.lastElementChild;
      const chooseButton = document.createElement("button");
      chooseButton.type = "button";
      chooseButton.className = "text-button";
      chooseButton.textContent = "計算";
      chooseButton.addEventListener("click", () => {
        els.foodSelect.value = food.id;
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
  if (!food || amount <= 0) {
    els.calcCalories.textContent = "0 kcal";
    els.calcProtein.textContent = "0 g 蛋白質";
    els.calcCarbsFat.textContent = "0 g 碳水 · 0 g 脂肪";
    return;
  }

  const multiplier = amount / 100;
  els.calcCalories.textContent = `${Math.round(food.calories * multiplier)} kcal`;
  els.calcProtein.textContent = `${formatAmount(food.protein * multiplier)} g 蛋白質`;
  els.calcCarbsFat.textContent = `${formatAmount(food.carbs * multiplier)} g 碳水 · ${formatAmount(food.fat * multiplier)} g 脂肪`;
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
  savedFoods.forEach((food) => byId.set(food.id, food));
  return Array.from(byId.values());
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
