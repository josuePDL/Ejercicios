const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbx45nWlULe8vSl4SYpuMaha7p1PxJZCvcEswws4F62oFpez0Vm0nbZFXdmQpLoIIuwH/exec';

let appData = null;
let selectedDay = '';

const $ = (id) => document.getElementById(id);

const todayBadge = $('todayBadge');
const todayTitle = $('todayTitle');
const todayMessage = $('todayMessage');
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
    ? 'Marca lo que termines. También registra peso, reps reales y notas.'
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
        <label>Peso usado
          <input class="weight-input" type="text" maxlength="20" placeholder="Ej: 40 lb" value="${escapeAttr(exercise.weight)}" ${canEdit ? '' : 'disabled'} />
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

loadData();
