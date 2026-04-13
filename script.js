const { createClient } = supabase;
const SUPABASE_URL = "https://kbluhvorfldptbcnwvvx.supabase.co";   // <-- RELLENA
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtibHVodm9yZmxkcHRiY253dnZ4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwNDIxNjIsImV4cCI6MjA3ODYxODE2Mn0.WUeTibJHnmVCsNqcwvzsUdFpsTn8BzjM-W7eZCRaZ7I";          // <-- IGUAL

const client = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const loginPanel = document.getElementById("login-panel");
const loginForm = document.getElementById("login-form");
const loginMessage = document.getElementById("login-message");
const panelContent = document.getElementById("panel-content");
const tableBody = document.getElementById("table-body");
const emptyDiv = document.getElementById("empty");
const subtitle = document.getElementById("subtitle");

// Mapea tramo (1..14) a hora real.
// AJUSTA ESTOS VALORES A TU HORARIO REAL:
const SLOT_TIMES = {
  1:  { start: "08:15", end: "09:15" },
  2:  { start: "09:15", end: "10:15" },
  3:  { start: "10:15", end: "11:00" },
  4:  { start: "11:15", end: "11:45" }, // Recreo mañana
  5:  { start: "11:45", end: "12:45" },
  6:  { start: "12:45", end: "13:45" },
  7:  { start: "13:45", end: "14:45" },
  8:  { start: "15:00", end: "16:00" },
  9:  { start: "16:00", end: "17:00" },
  10: { start: "17:00", end: "18:00" },
  11: { start: "18:00", end: "18:15" }, // Recreo tarde
  12: { start: "18:15", end: "19:15" },
  13: { start: "19:15", end: "20:15" },
  14: { start: "20:15", end: "21:15" }
};

function timeToMinutes(hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

function getCurrentSlot() {
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();

  for (const [slotStr, range] of Object.entries(SLOT_TIMES)) {
    const slot = parseInt(slotStr, 10);
    const startMin = timeToMinutes(range.start);
    const endMin = timeToMinutes(range.end);
    if (minutes >= startMin && minutes < endMin) {
      return slot;
    }
  }
  return null; // fuera del horario
}

// ===== Login =====
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginMessage.textContent = "";
  const email = document.getElementById("login-email").value.trim();
  const password = document.getElementById("login-password").value;

  const { data, error } = await client.auth.signInWithPassword({
    email,
    password
  });

  if (error) {
    loginMessage.textContent = "Error al iniciar sesión: " + error.message;
  } else {
    loginPanel.classList.add("hidden");
    panelContent.classList.remove("hidden");
    startPanel();
  }
});

// Comprobar si ya hay sesión (por si la TV recuerda la cookie)
async function checkSession() {
  const { data } = await client.auth.getSession();
  if (data.session && data.session.user) {
    loginPanel.classList.add("hidden");
    panelContent.classList.remove("hidden");
    startPanel();
  }
}

// ===== Lógica del panel =====
function formatTodayForSubtitle() {
  const today = new Date();
  const opts = { weekday: "long", year: "numeric", month: "long", day: "numeric" };
  subtitle.textContent = today.toLocaleDateString("es-ES", opts);
}

function getTodayISODate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getWeekdayFromISODate(dateText) {
  const [year, month, day] = String(dateText || "").split("-").map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  const jsDay = date.getDay();
  return jsDay === 0 ? 7 : jsDay;
}

function parseWeekday(value) {
  if (value === null || value === undefined) {
    return null;
  }

  if (typeof value === "number" && Number.isFinite(value)) {
    if (value >= 1 && value <= 7) {
      return value;
    }
    if (value >= 0 && value <= 6) {
      return value + 1;
    }
    return value;
  }

  if (typeof value === "string") {
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) {
      return null;
    }

    const letterMapping = {
      l: 1,
      m: 2,
      x: 3,
      j: 4,
      v: 5
    };

    if (letterMapping[trimmed]) {
      return letterMapping[trimmed];
    }

    const numeric = Number(trimmed);
    if (!Number.isNaN(numeric)) {
      return parseWeekday(numeric);
    }

    const mapping = {
      lunes: 1,
      monday: 1,
      martes: 2,
      tuesday: 2,
      miercoles: 3,
      miércoles: 3,
      wednesday: 3,
      jueves: 4,
      thursday: 4,
      viernes: 5,
      friday: 5,
      sabado: 6,
      sábado: 6,
      saturday: 6
    };

    return mapping[trimmed] ?? null;
  }

  return null;
}

function normalizeWeekdayValue(entry) {
  const candidates = [
    entry.weekday_letter,
    entry.weekday,
    entry.week_day,
    entry.day_of_week,
    entry.day,
    entry.weekday_value,
    entry.weekday_number,
    entry.weekday_index
  ];

  for (const candidate of candidates) {
    const normalized = parseWeekday(candidate);
    if (normalized) {
      return normalized;
    }
  }

  return null;
}

function normalizeSlotValue(entry) {
  const candidates = [
    entry.slot,
    entry.slot_value,
    entry.slot_number,
    entry.tramo,
    entry.hour_slot,
    entry.start_slot
  ];

  for (const candidate of candidates) {
    if (candidate === null || candidate === undefined) continue;
    const parsed = Number(candidate);
    if (!Number.isNaN(parsed)) return parsed;
  }

  return null;
}

function buildGuardMap(entries, absentTeachers = []) {
  const guardBySlot = new Map();
  const getGuardOrder = (subjectText) => {
    const normalized = (subjectText || "").toLowerCase();
    if (normalized.includes("alegría") || normalized.includes("alegria")) return 0;
    if (normalized.includes("bulería") || normalized.includes("buleria")) return 1;
    if (normalized.includes("biblioteca")) return 2;
    return 3;
  };
  const getGuardLabel = (subjectText) => {
    const normalized = (subjectText || "").toLowerCase();
    if (normalized.includes("alegría") || normalized.includes("alegria")) return "Alegría";
    if (normalized.includes("bulería") || normalized.includes("buleria")) return "Bulería";
    if (normalized.includes("biblioteca")) return "Biblioteca";
    return "Guardia";
  };
  const getGuardClass = (subjectText) => {
    const normalized = (subjectText || "").toLowerCase();
    if (normalized.includes("biblioteca")) return "guard-biblioteca";
    if (normalized.includes("alegría") || normalized.includes("alegria")) return "guard-alegria";
    if (normalized.includes("bulería") || normalized.includes("buleria")) return "guard-buleria";
    return "guard-default";
  };

  const isTeacherAbsent = (teacherName, slot) => {
    return absentTeachers.some((abs) => {
      if (abs.teacher_name !== teacherName) return false;
      const start = Number(abs.start_slot);
      const end = Number(abs.end_slot);
      if (Number.isFinite(start) && Number.isFinite(end)) {
        return slot >= start && slot <= end;
      }
      return true;
    });
  };

  entries.forEach((entry) => {
    const slot = normalizeSlotValue(entry);
    const teacherName = String(entry.teacher_name || entry.teacher || "").trim();
    if (!Number.isFinite(slot) || !teacherName) return;

    if (!guardBySlot.has(slot)) {
      guardBySlot.set(slot, []);
    }

    const subject = String(entry.subject || entry.subject_name || "").trim();
    const guardClass = getGuardClass(subject);
    const absentClass = isTeacherAbsent(teacherName, slot) ? " guard-absent" : "";

    guardBySlot.get(slot).push({
      teacherName,
      guardLabel: getGuardLabel(subject),
      guardClass,
      guardOrder: getGuardOrder(subject),
      absentClass
    });
  });

  guardBySlot.forEach((teachers, slot) => {
    const uniqueTeachers = Array.from(
      new Map(
        teachers.map((teacher) => [
          `${teacher.teacherName}|${teacher.guardLabel}|${teacher.guardOrder}|${teacher.absentClass}`,
          teacher
        ])
      ).values()
    ).sort((a, b) => {
      if (a.guardOrder !== b.guardOrder) {
        return a.guardOrder - b.guardOrder;
      }
      return a.teacherName.localeCompare(b.teacherName, "es");
    });

    const guardGroups = new Map();
    uniqueTeachers.forEach((teacher) => {
      const key = `${teacher.guardOrder}|${teacher.guardLabel}|${teacher.guardClass}`;
      if (!guardGroups.has(key)) {
        guardGroups.set(key, {
          guardOrder: teacher.guardOrder,
          guardLabel: teacher.guardLabel,
          guardClass: teacher.guardClass,
          teachers: []
        });
      }
      guardGroups.get(key).teachers.push(
        `<div class="guard-teacher ${teacher.guardClass}${teacher.absentClass}">${teacher.teacherName}</div>`
      );
    });

    const displayHtml = Array.from(guardGroups.values())
      .sort((a, b) => a.guardOrder - b.guardOrder)
      .map((group) => (
        `<div class="guard-group">` +
        `<div class="guard-group-title ${group.guardClass}">${group.guardLabel}</div>` +
        `<div class="guard-group-list">${group.teachers.join("")}</div>` +
        `</div>`
      ))
      .join("");

    guardBySlot.set(slot, displayHtml);
  });

  return guardBySlot;
}

async function loadData() {
  const today = getTodayISODate();

  const { data, error } = await client
    .from("classes_to_cover")
    .select("date, weekday_letter, slot, group_name, subject, classroom, teacher_name, display_name")
    .eq("date", today)
    .order("slot", { ascending: true })
    .order("group_name", { ascending: true });

  if (error) {
    console.error("Error cargando datos panel:", error);
    return;
  }

  const weekday = getWeekdayFromISODate(today);
  let guardMap = new Map();
  let absentTeachers = [];

  const { data: absData, error: absError } = await client
    .from("absences")
    .select("teacher_name, start_slot, end_slot")
    .eq("date", today);

  if (absError) {
    console.error("Error cargando ausencias para guardias:", absError);
  } else {
    absentTeachers = absData || [];
  }

  if (weekday !== null) {
    const { data: guardData, error: guardError } = await client
      .from("timetable")
      .select("*")
      .ilike("subject", "Guardia%");

    if (guardError) {
      console.error("Error cargando profesorado de guardia:", guardError);
    } else {
      const guardEntries = (guardData || []).filter((entry) => normalizeWeekdayValue(entry) === weekday);
      guardMap = buildGuardMap(guardEntries, absentTeachers);
    }
  }

  const merged = mergeByTeacherAndSlot(data || []);
  renderTable(merged, guardMap);
}

function mergeByTeacherAndSlot(rows) {
  const map = new Map();

  rows.forEach(row => {
    const visibleName = row.display_name || row.teacher_name;
    const key = `${row.slot}|${visibleName}|${row.subject}|${row.classroom || ""}`;

    const existing = map.get(key);
    if (!existing) {
      map.set(key, {
        date: row.date,
        weekday_letter: row.weekday_letter,
        slot: row.slot,
        group_name_list: [row.group_name],
        subject: row.subject,
        classroom: row.classroom,
        teacher_name: row.teacher_name,
        display_name: row.display_name || row.teacher_name
      });
    } else {
      existing.group_name_list.push(row.group_name);
    }
  });

  return Array.from(map.values()).map(r => ({
    date: r.date,
    weekday_letter: r.weekday_letter,
    slot: r.slot,
    group_name: [...new Set(r.group_name_list)].join(" / "),
    subject: r.subject,
    classroom: r.classroom,
    teacher_name: r.teacher_name,
    display_name: r.display_name
  }));
}

function renderTable(rows, guardMap = new Map()) {
  tableBody.innerHTML = "";
  if (!rows.length) {
    emptyDiv.classList.remove("hidden");
    return;
  }
  emptyDiv.classList.add("hidden");

  // Agrupar por franja horaria (slot)
  const groups = new Map();
  rows.forEach(row => {
    if (!groups.has(row.slot)) {
      groups.set(row.slot, []);
    }
    groups.get(row.slot).push(row);
  });

  let sortedSlots = Array.from(groups.keys()).sort((a, b) => a - b);

  // Slot actual según la hora real
  const currentSlot = getCurrentSlot();

  // Si estamos dentro de horario, ocultar franjas anteriores
  if (currentSlot !== null) {
    const futureSlots = sortedSlots.filter(slot => slot >= currentSlot);
    if (futureSlots.length > 0) {
      sortedSlots = futureSlots;
    }
    // Si por lo que sea no hay futuras (por ejemplo, ya ha pasado todo),
    // dejamos sortedSlots como estaba para que al menos se vea algo.
  }

  let groupIndex = 0;

  sortedSlots.forEach(slot => {
    const groupRows = groups.get(slot);

    // Orden interno por profe (puedes cambiarlo a group_name si te gusta más)
    groupRows.sort((a, b) => {
      const nameA = (a.display_name || a.teacher_name) || "";
      const nameB = (b.display_name || b.teacher_name) || "";
      return nameA.localeCompare(nameB);
    });
    const timeRange = SLOT_TIMES[slot];
    let slotLabel;
    if (timeRange) {
      slotLabel = `${timeRange.start} - ${timeRange.end}`;
    } else {
      slotLabel = `T${slot}`;
    }

    // Alternancia de colores por bloque
    let blockClass = (groupIndex % 2 === 0) ? "slot-even" : "slot-odd";

    // Si es la franja actual, se marca especial
    if (currentSlot !== null && slot === currentSlot) {
      blockClass += " slot-current";
    }

    groupRows.forEach((row, idx) => {
      const tr = document.createElement("tr");
      tr.className = blockClass;

      // Celda de la hora solo en la primera fila del bloque
      if (idx === 0) {
        const tdSlot = document.createElement("td");
        tdSlot.className = "slot";
        tdSlot.rowSpan = groupRows.length;
        tdSlot.textContent = slotLabel;
        tr.appendChild(tdSlot);

        const tdGuard = document.createElement("td");
        tdGuard.className = "guard-cell";
        const guards = guardMap.get(slot) || "";
        tdGuard.rowSpan = groupRows.length;
        tdGuard.innerHTML = guards || "-";
        tr.appendChild(tdGuard);
      }

      const tdGroupSubject = document.createElement("td");
      tdGroupSubject.className = "group-subject";

      const groupStrong = document.createElement("strong");
      groupStrong.className = "group";
      groupStrong.textContent = row.group_name;

      const subjectSpan = document.createElement("span");
      subjectSpan.className = "subject";
      subjectSpan.textContent = `: ${row.subject}`;

      tdGroupSubject.appendChild(groupStrong);
      tdGroupSubject.appendChild(subjectSpan);

      const tdClassroom = document.createElement("td");
      tdClassroom.className = "classroom-cell";
      tdClassroom.textContent = row.classroom || "-";

      const tdTeacher = document.createElement("td");
      tdTeacher.className = "teacher-cell";
      tdTeacher.textContent = row.display_name || row.teacher_name;

      tr.appendChild(tdGroupSubject);
      tr.appendChild(tdClassroom);
      tr.appendChild(tdTeacher);

      tableBody.appendChild(tr);
    });

    groupIndex++;
  });
}

function startPanel() {
  formatTodayForSubtitle();
  loadData();
  // refrescar cada 60 segundos
  setInterval(loadData, 60000);
}

checkSession();
