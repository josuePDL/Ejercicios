const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbx45nWlULe8vSl4SYpuMaha7p1PxJZCvcEswws4F62oFpez0Vm0nbZFXdmQpLoIIuwH/exec';

let appData = null;
let selectedDay = '';

const $ = (id) => document.getElementById(id);

const todayBadge = $('todayBadge');
const todayTitle = $('todayTitle');
const todayMessage = $('todayMessage');
const currentWeightStat = $('currentWeightStat');
const latestWeight = $('latestWeight');
const lastWeightChange = $('lastWeightChange');
const totalWeightChange = $('totalWeightChange');
const weightTrendBadge = $('weightTrendBadge');
const bodyWeightDate = $('bodyWeightDate');
const bodyWeightInput = $('bodyWeightInput');
const bodyWeightNotes = $('bodyWeightNotes');
const saveWeightBtn = $('saveWeightBtn');
const weightChart = $('weightChart');
const weightChartEmpty = $('weightChartEmpty');
const weightHistoryList = $('weightHistoryList');
const openWeightModalBtn = $('openWeightModalBtn');
const weightModal = $('weightModal');
const closeWeightModalBtn = $('closeWeightModalBtn');
const cancelWeightModalBtn = $('cancelWeightModalBtn');
const dayTabs = $('dayTabs');
const routineTitle = $('routineTitle');
const routineDescription = $('routineDescription');
const progressText = $('progressText');
const progressFill = $('progressFill');
const exerciseList = $('exerciseList');
const warningBox = $('warningBox');
const makeupBox = $('makeupBox');
const allowMakeup = $('allowMakeup');
const failReason = $('failReason');
const generalNotes = $('generalNotes');
const saveBtn = $('saveBtn');
const resetBtn = $('resetBtn');
const historyList = $('historyList');
const weakList = $('weakList');
const toast = $('toast');

function jsonpRequest(action, params = {}) {
  return new Promise((resolve, reject) => {
    const callbackName = 'cb_' + Date.now() + '_' + Math.random().toString(36).slice(2);
    const script = document.createElement('script');
    const search = new URLSearchParams({
      action,
      callback: callbackName,
      ...params
    });

    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('La conexión con Apps Script tardó demasiado.'));
    }, 25000);

    function cleanup() {
      clearTimeout(timeout);
      delete window[callbackName];
      if (script.parentNode) script.parentNode.removeChild(script);
    }

    window[callbackName] = (response) => {
      cleanup();
      if (!response.ok) {
        reject(new Error(response.error || 'Error desconocido.'));
        return;
      }
      resolve(response.data);
    };

    script.onerror = () => {
      cleanup();
      reject(new Error('No se pudo conectar con Apps Script. Revisa el enlace o la implementación.'));
    };

    script.src = APPS_SCRIPT_URL + '?' + search.toString();
    document.body.appendChild(script);
  });
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

function setLoading(isLoading) {
  saveBtn.disabled = isLoading;
  resetBtn.disabled = isLoading;
  saveBtn.textContent = isLoading ? 'Guardando...' : 'Guardar avance';
}

function setWeightLoading(isLoading) {
  saveWeightBtn.disabled = isLoading;
  saveWeightBtn.textContent = isLoading ? 'Guardando...' : 'Guardar peso';
}

function openWeightModal() {
  if (!weightModal) return;

  if (appData && !bodyWeightDate.value) {
    bodyWeightDate.value = appData.dateKey;
  }

  weightModal.classList.add('show');
  weightModal.setAttribute('aria-hidden', 'false');
  document.body.classList.add('modal-open');

  setTimeout(() => {
    if (bodyWeightInput) bodyWeightInput.focus();
  }, 80);
}

function closeWeightModal() {
  if (!weightModal) return;

  weightModal.classList.remove('show');
  weightModal.setAttribute('aria-hidden', 'true');
  document.body.classList.remove('modal-open');
}

async function loadData(day = '') {
  try {
    selectedDay = day || selectedDay;
    appData = await jsonpRequest('getAppData', selectedDay ? { day: selectedDay } : {});
    selectedDay = appData.selectedDay;
    renderAll();
  } catch (error) {
    todayBadge.textContent = 'Error';
    todayBadge.className = 'badge rest';
    todayTitle.textContent = 'No se pudo cargar la rutina';
    todayMessage.textContent = error.message;
    showToast(error.message);
  }
}

function renderAll() {
  renderStatus();
  renderBodyWeight();
  renderTabs();
  renderRoutine();
  renderHistory();
  renderWeakPoints();
}

function renderStatus() {
  if (appData.isTrainingDay) {
    todayBadge.textContent = 'Hoy toca entrenar';
    todayBadge.className = 'badge train';
    todayTitle.textContent = `Hoy es ${appData.todayDay}`;
    todayMessage.textContent = appData.canEdit
      ? 'Puedes marcar tus ejercicios y guardar el avance en Google Sheets.'
      : `Hoy es ${appData.todayDay}. Estás viendo la rutina de ${appData.selectedDay}.`;
  } else {
    todayBadge.textContent = 'Hoy es descanso';
    todayBadge.className = 'badge rest';
    todayTitle.textContent = `Hoy es ${appData.todayDay}`;
    todayMessage.textContent = `Tu próximo entrenamiento sugerido es ${appData.selectedDay}.`;
  }
}

function renderBodyWeight() {
  const data = appData.bodyWeight || { history: [], chart: [], latest: null, previous: null };
  const latest = data.latest;

  if (!bodyWeightDate.value) {
    bodyWeightDate.value = appData.dateKey;
  }

  if (latest) {
    currentWeightStat.textContent = formatKg(latest.weightKg);
    latestWeight.textContent = formatKg(latest.weightKg);
  } else {
    currentWeightStat.textContent = 'Sin registro';
    latestWeight.textContent = '-- kg';
  }

  if (latest && latest.changeKg !== '') {
    lastWeightChange.textContent = formatChange(latest.changeKg);
  } else {
    lastWeightChange.textContent = '-- kg';
  }

  if (data.totalChange !== '') {
    totalWeightChange.textContent = formatChange(data.totalChange);
  } else {
    totalWeightChange.textContent = '-- kg';
  }

  weightTrendBadge.textContent = data.totalStatus || 'Sin datos';
  weightTrendBadge.className = 'weight-status ' + trendClass(data.totalStatus || '');

  renderWeightChart(data.chart || []);
  renderWeightHistory(data.history || []);
}

function renderWeightChart(rows) {
  weightChart.innerHTML = '';

  if (!rows || rows.length < 2) {
    weightChartEmpty.style.display = 'flex';
    return;
  }

  weightChartEmpty.style.display = 'none';

  const width = Math.max(weightChart.clientWidth || 320, 320);
  const height = 240;
  const pad = { top: 18, right: 18, bottom: 44, left: 46 };
  const weights = rows.map(row => Number(row.weightKg));
  let min = Math.min(...weights);
  let max = Math.max(...weights);

  if (min === max) {
    min -= 1;
    max += 1;
  }

  const padding = Math.max((max - min) * 0.15, 0.4);
  min -= padding;
  max += padding;

  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const x = (index) => pad.left + (rows.length === 1 ? plotW / 2 : (index / (rows.length - 1)) * plotW);
  const y = (weight) => pad.top + ((max - weight) / (max - min)) * plotH;

  const points = rows.map((row, index) => [x(index), y(Number(row.weightKg))]);
  const path = points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${point[0].toFixed(1)} ${point[1].toFixed(1)}`).join(' ');
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  const gridValues = [max, (max + min) / 2, min];

  const circles = rows.map((row, index) => {
    const [cx, cy] = points[index];
    const date = shortDate(row.dateKey);
    return `
      <g>
        <circle class="chart-point" cx="${cx}" cy="${cy}" r="5"></circle>
        <title>${date}: ${formatKg(row.weightKg)}</title>
      </g>
    `;
  }).join('');

  const grid = gridValues.map(value => {
    const gy = y(value);
    return `
      <line class="chart-grid" x1="${pad.left}" y1="${gy}" x2="${width - pad.right}" y2="${gy}"></line>
      <text class="chart-label" x="${pad.left - 8}" y="${gy + 4}" text-anchor="end">${value.toFixed(1)}</text>
    `;
  }).join('');

  const xLabels = rows.map((row, index) => {
    if (rows.length > 6 && index % 2 !== 0 && index !== rows.length - 1) return '';
    return `<text class="chart-label" x="${x(index)}" y="${height - 16}" text-anchor="middle">${shortDate(row.dateKey)}</text>`;
  }).join('');

  weightChart.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="Gráfica de peso corporal en kg">
      ${grid}
      <path class="chart-area" d="${path} L ${lastPoint[0].toFixed(1)} ${height - pad.bottom} L ${firstPoint[0].toFixed(1)} ${height - pad.bottom} Z"></path>
      <path class="chart-line" d="${path}"></path>
      ${circles}
      ${xLabels}
    </svg>
  `;
}

function renderWeightHistory(rows) {
  weightHistoryList.innerHTML = '';

  if (!rows.length) {
    weightHistoryList.innerHTML = '<div class="mini-item"><span>Aún no hay pesos corporales guardados.</span></div>';
    return;
  }

  rows.slice().reverse().slice(0, 8).forEach((row) => {
    const item = document.createElement('div');
    item.className = 'mini-item';
    const changeText = row.changeKg === '' ? 'Primer registro' : formatChange(row.changeKg);
    item.innerHTML = `
      <strong>${escapeHtml(row.dateKey)} · ${formatKg(row.weightKg)}</strong>
      <span>${escapeHtml(row.status || 'Inicial')} · ${changeText}${row.notes ? ' · ' + escapeHtml(row.notes) : ''}</span>
    `;
    weightHistoryList.appendChild(item);
  });
}

async function saveBodyWeight() {
  const dateKey = bodyWeightDate.value;
  const weightKg = bodyWeightInput.value;
  const notes = bodyWeightNotes.value.trim();

  if (!dateKey) {
    showToast('Selecciona una fecha.');
    return;
  }

  if (!weightKg || Number(weightKg) < 30 || Number(weightKg) > 250) {
    showToast('Ingresa un peso válido en kg. Ejemplo: 75.7');
    return;
  }

  try {
    setWeightLoading(true);
    appData = await jsonpRequest('saveBodyWeight', {
      payload: JSON.stringify({
        dateKey,
        weightKg,
        notes,
        dayName: appData ? appData.selectedDay : ''
      })
    });
    bodyWeightInput.value = '';
    bodyWeightNotes.value = '';
    closeWeightModal();
    showToast('Peso corporal guardado en kg.');
    renderAll();
  } catch (error) {
    showToast(error.message);
  } finally {
    setWeightLoading(false);
  }
}

function renderTabs() {
  dayTabs.innerHTML = '';

  appData.trainingDays.forEach((day) => {
    const btn = document.createElement('button');
    btn.className = 'day-tab' + (day === appData.selectedDay ? ' active' : '');
    btn.textContent = day;
    btn.addEventListener('click', () => {
      failReason.value = '';
      generalNotes.value = '';
      allowMakeup.checked = false;
      loadData(day);
    });
    dayTabs.appendChild(btn);
  });
}

function canEditNow() {
  return appData.canEdit || allowMakeup.checked;
}

function renderRoutine() {
  const canEdit = canEditNow();

  routineTitle.textContent = `${appData.selectedDay} · Rutina`;
  routineDescription.textContent = appData.canEdit
    ? 'Marca lo que termines. También registra peso usado en kg, reps reales y notas.'
    : 'Puedes ver esta rutina. Para guardar fuera del día, activa reposición.';

  makeupBox.style.display = appData.canEdit ? 'none' : 'flex';

  warningBox.style.display = appData.canEdit ? 'none' : 'block';
  warningBox.textContent = `Esta rutina no corresponde al día actual (${appData.todayDay}). Activa reposición si realmente la entrenaste hoy.`;

  exerciseList.innerHTML = '';

  appData.exercises.forEach((exercise) => {
    const item = document.createElement('article');
    item.className = 'exercise' + (exercise.done ? ' done' : '');
    item.dataset.id = exercise.id;

    item.innerHTML = `
      <input class="done-check" type="checkbox" ${exercise.done ? 'checked' : ''} ${canEdit ? '' : 'disabled'} />
      <div>
        <div class="exercise-top">
          <div>
            <div class="exercise-title">${escapeHtml(exercise.name)}</div>
            <div class="exercise-detail">${escapeHtml(exercise.detail)}</div>
          </div>
          <span class="tag">${escapeHtml(exercise.muscle)}</span>
        </div>
      </div>
      <div class="exercise-fields">
        <label>Peso usado (kg)
          <input class="weight-input" type="number" step="0.5" min="0" maxlength="20" placeholder="Ej: 40 kg" value="${escapeAttr(exercise.weight)}" ${canEdit ? '' : 'disabled'} />
        </label>
        <label>Reps reales
          <input class="reps-input" type="text" maxlength="20" placeholder="Ej: 12/10/8" value="${escapeAttr(exercise.reps)}" ${canEdit ? '' : 'disabled'} />
        </label>
        <label>Notas
          <input class="notes-input" type="text" maxlength="120" placeholder="Ej: costó la última serie" value="${escapeAttr(exercise.notes)}" ${canEdit ? '' : 'disabled'} />
        </label>
      </div>
    `;

    const checkbox = item.querySelector('.done-check');
    checkbox.addEventListener('change', () => {
      item.classList.toggle('done', checkbox.checked);
      updateProgressFromDom();
    });

    exerciseList.appendChild(item);
  });

  failReason.disabled = !canEdit;
  generalNotes.disabled = !canEdit;
  saveBtn.disabled = !canEdit;
  resetBtn.disabled = !canEdit;

  updateProgressFromDom();
}

function updateProgressFromDom() {
  const checks = [...document.querySelectorAll('.done-check')];
  const done = checks.filter(c => c.checked).length;
  const percent = checks.length ? Math.round((done / checks.length) * 100) : 0;

  progressText.textContent = percent + '%';
  progressFill.style.width = percent + '%';
}

function getPayloadFromDom() {
  const exercises = [...document.querySelectorAll('.exercise')].map((item) => ({
    id: item.dataset.id,
    done: item.querySelector('.done-check').checked,
    weight: item.querySelector('.weight-input').value.trim(),
    reps: item.querySelector('.reps-input').value.trim(),
    notes: item.querySelector('.notes-input').value.trim()
  }));

  return {
    dayName: appData.selectedDay,
    allowMakeup: allowMakeup.checked,
    failReason: failReason.value,
    generalNotes: generalNotes.value.trim(),
    exercises
  };
}

async function saveProgress() {
  try {
    setLoading(true);
    const payload = getPayloadFromDom();
    appData = await jsonpRequest('saveDayLog', {
      payload: JSON.stringify(payload)
    });
    showToast('Avance guardado en Google Sheets.');
    renderAll();
  } catch (error) {
    showToast(error.message);
  } finally {
    setLoading(false);
  }
}

async function resetProgress() {
  const ok = confirm('¿Seguro que quieres reiniciar el registro de este día?');
  if (!ok) return;

  try {
    setLoading(true);
    appData = await jsonpRequest('resetDayLog', {
      dayName: appData.selectedDay,
      allowMakeup: String(allowMakeup.checked)
    });
    failReason.value = '';
    generalNotes.value = '';
    showToast('Registro reiniciado.');
    renderAll();
  } catch (error) {
    showToast(error.message);
  } finally {
    setLoading(false);
  }
}

function renderHistory() {
  historyList.innerHTML = '';

  if (!appData.history.length) {
    historyList.innerHTML = '<div class="mini-item"><span>Aún no hay sesiones guardadas.</span></div>';
    return;
  }

  appData.history.forEach((session) => {
    const item = document.createElement('div');
    item.className = 'mini-item';
    item.innerHTML = `
      <strong>${escapeHtml(session.date)} · ${escapeHtml(session.dayName)} · ${session.percent}%</strong>
      <span>${session.done}/${session.total} ejercicios. ${escapeHtml(session.failReason || '')}</span>
    `;
    historyList.appendChild(item);
  });
}

function renderWeakPoints() {
  weakList.innerHTML = '';

  if (!appData.weakPoints.length) {
    weakList.innerHTML = '<div class="mini-item"><span>Aún no hay ejercicios fallados registrados.</span></div>';
    return;
  }

  appData.weakPoints.forEach((itemData) => {
    const item = document.createElement('div');
    item.className = 'mini-item';
    item.innerHTML = `
      <strong>${escapeHtml(itemData.name)}</strong>
      <span>No completado ${itemData.times} vez/veces.</span>
    `;
    weakList.appendChild(item);
  });
}

function formatKg(value) {
  if (value === '' || value === null || value === undefined) return '-- kg';
  const num = Number(value);
  if (!isFinite(num)) return '-- kg';
  return num.toFixed(1) + ' kg';
}

function formatChange(value) {
  if (value === '' || value === null || value === undefined) return '-- kg';
  const num = Number(value);
  if (!isFinite(num)) return '-- kg';
  const sign = num > 0 ? '+' : '';
  return sign + num.toFixed(1) + ' kg';
}

function trendClass(status) {
  const text = String(status).toLowerCase();
  if (text.includes('baj')) return 'down';
  if (text.includes('sub')) return 'up';
  if (text.includes('igual')) return 'same';
  return '';
}

function shortDate(dateKey) {
  const parts = String(dateKey || '').split('-');
  if (parts.length !== 3) return dateKey;
  return `${parts[2]}/${parts[1]}`;
}

function escapeHtml(value) {
  return String(value || '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function escapeAttr(value) {
  return escapeHtml(value).replaceAll('`', '&#096;');
}

allowMakeup.addEventListener('change', renderRoutine);
saveBtn.addEventListener('click', saveProgress);
resetBtn.addEventListener('click', resetProgress);
saveWeightBtn.addEventListener('click', saveBodyWeight);

if (openWeightModalBtn) {
  openWeightModalBtn.addEventListener('click', openWeightModal);
}

if (closeWeightModalBtn) {
  closeWeightModalBtn.addEventListener('click', closeWeightModal);
}

if (cancelWeightModalBtn) {
  cancelWeightModalBtn.addEventListener('click', closeWeightModal);
}

if (weightModal) {
  weightModal.addEventListener('click', (event) => {
    if (event.target && event.target.dataset.closeModal === 'true') {
      closeWeightModal();
    }
  });
}

window.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') closeWeightModal();
});

window.addEventListener('resize', () => {
  if (appData && appData.bodyWeight) renderWeightChart(appData.bodyWeight.chart || []);
});

loadData();
