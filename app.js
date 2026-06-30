const storageKey = "daily-nutrition-pwa-v1";
const supabaseUrl = "https://cxewqhmfpqcsfjqdokud.supabase.co";
const supabaseAnonKey = "sb_publishable_Jz2mLPi94Dp7Vkve2XcGoQ_a9E5u8BG";
const cloudTableName = "nutrition_states";
const cloudClient = window.supabase?.createClient(supabaseUrl, supabaseAnonKey) || null;

const defaultFoods = [
  { id: "raw-skinless-chicken-breast", name: "雞胸（去皮）", calories: 110, protein: 23, basis: "100g 生食重", builtIn: true },
  { id: "raw-skin-on-chicken-breast", name: "雞胸（含皮）", calories: 165, protein: 21, basis: "100g 生食重", builtIn: true },
  { id: "raw-skinless-chicken-leg", name: "雞腿（去皮）", calories: 140, protein: 20, basis: "100g 生食重", builtIn: true },
  { id: "raw-skin-on-chicken-leg", name: "雞腿（含皮）", calories: 210, protein: 18, basis: "100g 生食重", builtIn: true },
  { id: "raw-pork-loin", name: "豬里肌", calories: 140, protein: 22, basis: "100g 生食重", builtIn: true },
  { id: "raw-beef-loin", name: "牛里肌", calories: 150, protein: 22, basis: "100g 生食重", builtIn: true },
  { id: "egg-per-piece", name: "雞蛋（1顆）", calories: 70, protein: 6, basis: "1顆", builtIn: true },
];

let state = loadState();
let selectedDate = state.lastSelectedDate;
let visibleMonth = startOfMonth(parseDateInput(selectedDate));
let storageWarningShown = false;
let currentUser = null;
let syncTimer = null;
let isApplyingCloudState = false;

const els = {
  monthLabel: document.querySelector("#monthLabel"),
  calendarGrid: document.querySelector("#calendarGrid"),
  prevMonth: document.querySelector("#prevMonth"),
  nextMonth: document.querySelector("#nextMonth"),
  todayButton: document.querySelector("#todayButton"),
  dayTitle: document.querySelector("#dayTitle"),
  dailyWeight: document.querySelector("#dailyWeight"),
  dailyCalories: document.querySelector("#dailyCalories"),
  dailyProtein: document.querySelector("#dailyProtein"),
  weightForm: document.querySelector("#weightForm"),
  weightInput: document.querySelector("#weightInput"),
  clearWeightButton: document.querySelector("#clearWeightButton"),
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
  foodTableBody: document.querySelector("#foodTableBody"),
  foodForm: document.querySelector("#foodForm"),
  foodName: document.querySelector("#foodName"),
  foodBasis: document.querySelector("#foodBasis"),
  foodCalories: document.querySelector("#foodCalories"),
  foodProtein: document.querySelector("#foodProtein"),
  exportForm: document.querySelector("#exportForm"),
  exportStartDate: document.querySelector("#exportStartDate"),
  exportEndDate: document.querySelector("#exportEndDate"),
  resetButton: document.querySelector("#resetButton"),
  updateButton: document.querySelector("#updateButton"),
  authForm: document.querySelector("#authForm"),
  authEmail: document.querySelector("#authEmail"),
  authPassword: document.querySelector("#authPassword"),
  authStatus: document.querySelector("#authStatus"),
  signUpButton: document.querySelector("#signUpButton"),
  resetPasswordButton: document.querySelector("#resetPasswordButton"),
  newPasswordForm: document.querySelector("#newPasswordForm"),
  newPasswordInput: document.querySelector("#newPasswordInput"),
  manualSyncButton: document.querySelector("#manualSyncButton"),
  signOutButton: document.querySelector("#signOutButton"),
};

init();

function init() {
  els.entryDate.value = selectedDate;
  els.exportStartDate.value = toDateInputValue(startOfMonth(parseDateInput(selectedDate)));
  els.exportEndDate.value = selectedDate;
  bindEvents();
  render();
  registerServiceWorker();
  initCloudAuth();
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

  els.weightForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const weight = roundWeight(toDecimalNumber(els.weightInput.value));
    if (weight <= 0) return;
    state.weights[selectedDate] = weight;
    saveState();
    render();
  });

  els.clearWeightButton.addEventListener("click", () => {
    delete state.weights[selectedDate];
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
      basis: normalizeBasis(els.foodBasis.value),
      builtIn: false,
    };

    if (!food.name || !food.basis) return;
    state.foods.push(food);
    saveState();
    els.foodForm.reset();
    renderFoodTools();
  });

  els.exportForm.addEventListener("submit", (event) => {
    event.preventDefault();
    exportRange(els.exportStartDate.value, els.exportEndDate.value);
  });

  els.resetButton.addEventListener("click", () => {
    const confirmed = window.confirm("確定要清除所有本機紀錄和自訂食物嗎？這個動作不能復原。");
    if (!confirmed) return;
    state = createDefaultState();
    setSelectedDate(state.lastSelectedDate, false);
    saveState();
    render();
  });

  els.updateButton.addEventListener("click", refreshAppVersion);

  els.authForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await signInWithPassword();
  });

  els.signUpButton.addEventListener("click", async () => {
    await signUpWithPassword();
  });

  els.resetPasswordButton.addEventListener("click", async () => {
    await requestPasswordReset();
  });

  els.newPasswordForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveNewPassword();
  });

  els.manualSyncButton.addEventListener("click", async () => {
    await syncCloudState();
  });

  els.signOutButton.addEventListener("click", async () => {
    await signOut();
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
    const weight = getWeightForDate(value);
    const calendarTotals = getCalendarTotalsDisplay(totals, weight);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "day-button";
    button.setAttribute("aria-label", `${value}，體重 ${formatWeight(weight)} kg，${calendarTotals.calories}，蛋白質 ${calendarTotals.protein}`);
    if (date < monthStart || date > monthEnd) button.classList.add("is-muted");
    if (value === selectedDate) button.classList.add("is-selected");
    if (value === todayValue) button.classList.add("is-today");

    button.innerHTML = `
      <span class="day-number">${date.getDate()}</span>
      <span class="day-totals">
        <span>${formatWeight(weight)} kg</span>
        <span>${calendarTotals.calories}</span>
        <span>${calendarTotals.protein}</span>
      </span>
      ${totals.count || weight ? '<span class="day-dot" aria-hidden="true"></span>' : ""}
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
  const weight = getWeightForDate(selectedDate);
  const entries = state.entries
    .filter((entry) => entry.date === selectedDate)
    .sort((a, b) => a.id.localeCompare(b.id));

  els.dayTitle.textContent = formatDateTitle(date);
  els.dailyWeight.textContent = formatWeight(weight);
  els.dailyCalories.textContent = totals.calories;
  els.dailyProtein.textContent = formatAmount(totals.protein);
  els.entryDate.value = selectedDate;
  els.weightInput.value = weight ? formatWeight(weight, "") : "";
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
  setDefaultServingAmount(false);
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
        <td>${escapeHtml(getBaseLabel(food))}</td>
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
        setDefaultServingAmount();
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
  const servings = toNumber(els.servingAmount.value);
  els.servingLabel.textContent = "份數";
  els.servingAmount.step = "0.1";
  if (!food || servings <= 0) {
    els.calcCalories.textContent = "0 kcal";
    els.calcProtein.textContent = "0 g 蛋白質";
    return;
  }

  els.calcCalories.textContent = `${Math.round(food.calories * servings)} kcal`;
  els.calcProtein.textContent = `${formatAmount(food.protein * servings)} g 蛋白質`;
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

function getCalendarTotalsDisplay(totals, weight) {
  if (weight && totals.count === 0) {
    return {
      calories: "XXXX kcal",
      protein: "XXX g P",
    };
  }
  return {
    calories: `${totals.calories} kcal`,
    protein: `${formatAmount(totals.protein)} g P`,
  };
}

function getWeightForDate(dateValue) {
  const weight = Number(state.weights?.[dateValue]);
  return Number.isFinite(weight) && weight > 0 ? weight : null;
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
    return normalizeStoredState(stored);
  } catch {
    return createDefaultState();
  }
}

function saveState() {
  try {
    window.localStorage.setItem(storageKey, JSON.stringify(state));
    if (!isApplyingCloudState) scheduleCloudSave();
  } catch {
    if (!storageWarningShown) {
      storageWarningShown = true;
      window.alert("瀏覽器目前沒有允許本機儲存，關閉分頁後資料可能不會保留。請確認不是私密瀏覽，並允許網站資料儲存。");
    }
  }
}

async function initCloudAuth() {
  if (!cloudClient) {
    setAuthStatus("無法載入雲端同步套件，本機模式仍可使用。");
    return;
  }

  setAuthStatus("檢查登入狀態中...");
  const { data, error } = await cloudClient.auth.getSession();
  if (error) {
    setAuthStatus(`登入狀態讀取失敗：${error.message}`);
    return;
  }

  await handleCloudSession(data.session);
  cloudClient.auth.onAuthStateChange((event, session) => {
    if (event === "PASSWORD_RECOVERY") {
      showPasswordRecoveryForm();
      currentUser = session?.user || null;
      updateAuthUi();
      setAuthStatus("請輸入新密碼。");
      return;
    }
    handleCloudSession(session);
  });
}

async function signInWithPassword() {
  if (!cloudClient) {
    setAuthStatus("雲端同步套件尚未載入，請稍後再試。");
    return;
  }

  const email = els.authEmail.value.trim();
  const password = els.authPassword.value;
  if (!email || !password) return;

  setAuthStatus("登入中...");
  const { error } = await cloudClient.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    setAuthStatus(`登入失敗：${formatCloudError(error)}`);
    return;
  }

  setAuthStatus("登入成功，載入雲端資料中...");
}

async function signUpWithPassword() {
  if (!cloudClient) {
    setAuthStatus("雲端同步套件尚未載入，請稍後再試。");
    return;
  }

  const email = els.authEmail.value.trim();
  const password = els.authPassword.value;
  if (!email || !password) return;

  if (password.length < 6) {
    setAuthStatus("建立帳號失敗：密碼至少需要 6 碼。");
    return;
  }

  setAuthStatus("建立帳號中...");
  const { data, error } = await cloudClient.auth.signUp({
    email,
    password,
  });

  if (error) {
    setAuthStatus(`建立帳號失敗：${formatCloudError(error)}`);
    return;
  }

  if (!data.session) {
    setAuthStatus("帳號已建立，請先到信箱完成確認後再登入。");
    return;
  }

  setAuthStatus("帳號已建立，載入雲端資料中...");
}

async function requestPasswordReset() {
  if (!cloudClient) {
    setAuthStatus("雲端同步套件尚未載入，請稍後再試。");
    return;
  }

  const email = els.authEmail.value.trim();
  if (!email) {
    setAuthStatus("請先輸入 email。");
    return;
  }

  setAuthStatus("寄送設定密碼信中...");
  const { error } = await cloudClient.auth.resetPasswordForEmail(email, {
    redirectTo: getAuthRedirectUrl(),
  });

  if (error) {
    setAuthStatus(`設定密碼信寄送失敗：${formatCloudError(error)}`);
    return;
  }

  setAuthStatus("設定密碼信已寄出，請到信箱點連結。");
}

async function saveNewPassword() {
  if (!cloudClient) return;

  const password = els.newPasswordInput.value;
  if (password.length < 6) {
    setAuthStatus("新密碼至少需要 6 碼。");
    return;
  }

  setAuthStatus("儲存新密碼中...");
  const { error } = await cloudClient.auth.updateUser({ password });

  if (error) {
    setAuthStatus(`新密碼儲存失敗：${formatCloudError(error)}`);
    return;
  }

  els.newPasswordInput.value = "";
  hidePasswordRecoveryForm();
  setAuthStatus("新密碼已設定，載入雲端資料中...");
  const { data } = await cloudClient.auth.getSession();
  await handleCloudSession(data.session);
}

async function signOut() {
  if (!cloudClient) return;
  await cloudClient.auth.signOut();
  currentUser = null;
  hidePasswordRecoveryForm();
  updateAuthUi();
  setAuthStatus("已登出，本機資料仍保留在這台裝置。");
}

async function handleCloudSession(session) {
  currentUser = session?.user || null;
  updateAuthUi();
  if (!currentUser) {
    setAuthStatus("未登入，本機資料只會留在這台裝置。");
    return;
  }

  els.authEmail.value = currentUser.email || "";
  els.authPassword.value = "";
  await syncCloudState();
}

async function syncCloudState() {
  if (!cloudClient || !currentUser) return;

  setAuthStatus("同步中...");
  els.manualSyncButton.disabled = true;

  try {
    const { data, error } = await cloudClient
      .from(cloudTableName)
      .select("data, updated_at")
      .eq("user_id", currentUser.id)
      .maybeSingle();

    if (error) throw error;

    if (data?.data) {
      applyCloudState(normalizeStoredState(data.data));
      await saveCloudState();
      setAuthStatus(`已載入雲端資料：${currentUser.email || "已登入帳號"}`);
    } else {
      await saveCloudState();
      setAuthStatus(`已建立雲端資料：${currentUser.email || "已登入帳號"}`);
    }
  } catch (error) {
    isApplyingCloudState = false;
    setAuthStatus(`同步失敗：${formatCloudError(error)}`);
  } finally {
    els.manualSyncButton.disabled = !currentUser;
  }
}

function scheduleCloudSave() {
  if (!cloudClient || !currentUser) return;
  window.clearTimeout(syncTimer);
  syncTimer = window.setTimeout(() => {
    saveCloudState();
  }, 700);
}

async function saveCloudState() {
  if (!cloudClient || !currentUser) return;

  const { error } = await cloudClient.from(cloudTableName).upsert({
    user_id: currentUser.id,
    data: serializeState(state),
    updated_at: new Date().toISOString(),
  });

  if (error) {
    setAuthStatus(`雲端儲存失敗：${formatCloudError(error)}`);
    return;
  }

  setAuthStatus(`已同步：${currentUser.email || "已登入帳號"}`);
}

function serializeState(source) {
  return {
    entries: normalizeEntries(source.entries),
    foods: getCustomFoods(source.foods),
    weights: normalizeWeights(source.weights),
    lastSelectedDate: isDateInputValue(source.lastSelectedDate) ? source.lastSelectedDate : selectedDate,
  };
}

function applyCloudState(cloudState) {
  isApplyingCloudState = true;
  state = cloudState;
  selectedDate = cloudState.lastSelectedDate;
  visibleMonth = startOfMonth(parseDateInput(selectedDate));
  window.localStorage.setItem(storageKey, JSON.stringify(state));
  isApplyingCloudState = false;
  render();
}

function updateAuthUi() {
  const isLoggedIn = Boolean(currentUser);
  if (!isPasswordRecoveryVisible()) {
    els.authForm.hidden = isLoggedIn;
  }
  els.signOutButton.hidden = !isLoggedIn;
  els.manualSyncButton.disabled = !isLoggedIn;
}

function showPasswordRecoveryForm() {
  els.authForm.hidden = true;
  els.newPasswordForm.hidden = false;
  els.newPasswordInput.focus();
}

function hidePasswordRecoveryForm() {
  els.newPasswordForm.hidden = true;
  els.authForm.hidden = Boolean(currentUser);
}

function isPasswordRecoveryVisible() {
  return !els.newPasswordForm.hidden;
}

function setAuthStatus(message) {
  els.authStatus.textContent = message;
}

function getAuthRedirectUrl() {
  return `${window.location.origin}${window.location.pathname}`;
}

function formatCloudError(error) {
  if (error?.code === "42P01" || error?.code === "PGRST205") {
    return "找不到資料表，請先在 Supabase SQL Editor 執行 supabase-schema.sql。";
  }
  if (error?.message?.includes("Email not confirmed")) return "信箱尚未確認，請先到信箱點確認信。";
  if (error?.message?.includes("Invalid login credentials")) return "信箱或密碼錯誤。";
  if (error?.message) return error.message;
  return "未知錯誤";
}

async function refreshAppVersion() {
  const originalText = els.updateButton.querySelector(".button-text").textContent;
  els.updateButton.disabled = true;
  els.updateButton.querySelector(".button-text").textContent = "更新中";

  try {
    if ("serviceWorker" in navigator) {
      const registrations = await navigator.serviceWorker.getRegistrations();
      await Promise.all(registrations.map((registration) => registration.unregister()));
    }
    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((key) => caches.delete(key)));
    }
  } finally {
    els.updateButton.querySelector(".button-text").textContent = originalText;
    const url = new URL(window.location.href);
    url.searchParams.set("refresh", Date.now().toString());
    window.location.replace(url.toString());
  }
}

function exportRange(startValue, endValue) {
  if (!isDateInputValue(startValue) || !isDateInputValue(endValue)) return;

  const start = parseDateInput(startValue);
  const end = parseDateInput(endValue);
  if (start > end) {
    window.alert("開始日期不能晚於結束日期。");
    return;
  }

  const rows = [["日期", "體重kg", "熱量kcal", "蛋白質g"]];
  for (let date = new Date(start); date <= end; date = addDays(date, 1)) {
    const dateValue = toDateInputValue(date);
    const totals = getTotalsForDate(dateValue);
    rows.push([
      dateValue,
      formatWeight(getWeightForDate(dateValue), ""),
      String(totals.calories),
      formatAmount(totals.protein),
    ]);
  }

  const csv = `\uFEFF${rows.map((row) => row.map(escapeCsvCell).join(",")).join("\r\n")}`;
  const filename = `nutrition-${startValue}-to-${endValue}.csv`;
  downloadTextFile(filename, csv, "text/csv;charset=utf-8");
}

function escapeCsvCell(value) {
  const text = String(value ?? "");
  if (!/[",\r\n]/.test(text)) return text;
  return `"${text.replaceAll('"', '""')}"`;
}

function downloadTextFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function createDefaultState() {
  return {
    entries: [],
    foods: [...defaultFoods],
    weights: {},
    lastSelectedDate: toDateInputValue(new Date()),
  };
}

function normalizeStoredState(stored) {
  if (!stored || typeof stored !== "object") return createDefaultState();
  const entries = normalizeEntries(stored.entries);
  return {
    entries,
    foods: mergeFoods(Array.isArray(stored.foods) ? stored.foods : []),
    weights: normalizeWeights(stored.weights),
    lastSelectedDate: getStoredSelectedDate({ ...stored, entries }),
  };
}

function normalizeEntries(entries) {
  if (!Array.isArray(entries)) return [];
  return entries
    .map((entry) => ({
      id: entry.id || createId(),
      date: entry.date,
      name: String(entry.name || "").trim(),
      protein: roundOne(entry.protein),
      calories: Math.round(toNumber(entry.calories)),
    }))
    .filter((entry) => isDateInputValue(entry.date) && entry.name);
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

function getCustomFoods(foods) {
  if (!Array.isArray(foods)) return [];
  return foods.filter((food) => !food.builtIn).map(normalizeCustomFood);
}

function normalizeCustomFood(food) {
  return {
    id: food.id || createId(),
    name: food.name || "自訂食物",
    calories: Math.round(toNumber(food.calories)),
    protein: roundOne(toNumber(food.protein)),
    basis: normalizeBasis(food.basis || getLegacyBasis(food.unit)),
    builtIn: false,
  };
}

function normalizeWeights(weights) {
  if (!weights || typeof weights !== "object") return {};
  return Object.entries(weights).reduce((normalized, [date, weight]) => {
    const value = roundWeight(weight);
    if (isDateInputValue(date) && value > 0) normalized[date] = value;
    return normalized;
  }, {});
}

function getBaseLabel(food) {
  return `每 ${normalizeBasis(food?.basis || getLegacyBasis(food?.unit))}`;
}

function setDefaultServingAmount(force = true) {
  if (!force && els.servingAmount.value) return;
  els.servingAmount.value = "1";
}

function normalizeBasis(value) {
  return String(value || "").trim().replace(/\s+/g, " ");
}

function getLegacyBasis(unit) {
  if (unit === "piece") return "1顆";
  if (unit === "serving") return "1份";
  return "100g 生食重";
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

function formatWeight(value, emptyValue = "--") {
  if (!value) return emptyValue;
  return roundWeight(value).toLocaleString("zh-Hant-TW", {
    maximumFractionDigits: 2,
  });
}

function roundWeight(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function roundOne(value) {
  return Math.round((Number(value) || 0) * 10) / 10;
}

function toNumber(value) {
  return Number.parseFloat(value) || 0;
}

function toDecimalNumber(value) {
  return Number.parseFloat(String(value).trim().replace(",", ".")) || 0;
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
