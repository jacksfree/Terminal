const STORAGE_KEY = "goals-command-center-v1";
const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const COLORS = {
  cyan: "#3fd4d5",
  amber: "#f3ad44",
  mint: "#8fd2a4",
  coral: "#ef7c70",
  indigo: "#8fa1ff",
};

const els = {
  todayLabel: document.querySelector("#todayLabel"),
  loadDemoButton: document.querySelector("#loadDemoButton"),
  resetButton: document.querySelector("#resetButton"),
  dayScore: document.querySelector("#dayScore"),
  dayScoreMeta: document.querySelector("#dayScoreMeta"),
  missionPrompt: document.querySelector("#missionPrompt"),
  scoreProgress: document.querySelector("#scoreProgress"),
  metricRack: document.querySelector("#metricRack"),
  trendSparkline: document.querySelector("#trendSparkline"),
  trendLabel: document.querySelector("#trendLabel"),
  sparklineLabels: document.querySelector("#sparklineLabels"),
  briefingList: document.querySelector("#briefingList"),
  focusBadge: document.querySelector("#focusBadge"),
  habitList: document.querySelector("#habitList"),
  habitSummaryBadge: document.querySelector("#habitSummaryBadge"),
  habitForm: document.querySelector("#habitForm"),
  habitId: document.querySelector("#habitId"),
  habitName: document.querySelector("#habitName"),
  habitCategory: document.querySelector("#habitCategory"),
  habitSchedule: document.querySelector("#habitSchedule"),
  customDaysField: document.querySelector("#customDaysField"),
  habitTarget: document.querySelector("#habitTarget"),
  habitColor: document.querySelector("#habitColor"),
  targetLabel: document.querySelector("#targetLabel"),
  formHeading: document.querySelector("#formHeading"),
  saveHabitButton: document.querySelector("#saveHabitButton"),
  cancelEditButton: document.querySelector("#cancelEditButton"),
  calendarDropzone: document.querySelector("#calendarDropzone"),
  calendarBrowseButton: document.querySelector("#calendarBrowseButton"),
  calendarFileInput: document.querySelector("#calendarFileInput"),
  clearCalendarButton: document.querySelector("#clearCalendarButton"),
  calendarMeta: document.querySelector("#calendarMeta"),
  calendarList: document.querySelector("#calendarList"),
  historyGrid: document.querySelector("#historyGrid"),
  historyBadge: document.querySelector("#historyBadge"),
  activityFeed: document.querySelector("#activityFeed"),
  assistantSuggestions: document.querySelector("#assistantSuggestions"),
  assistantLog: document.querySelector("#assistantLog"),
  assistantForm: document.querySelector("#assistantForm"),
  assistantInput: document.querySelector("#assistantInput"),
};

const state = loadState();

function createEmptyState() {
  return {
    habits: [],
    checkins: [],
    events: [],
    assistantLog: [
      {
        role: "assistant",
        text:
          "Ask things like 'What should I focus on today?', 'Which habits are slipping?', or 'What is next on my calendar?'.",
      },
    ],
  };
}

function loadState() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return createEmptyState();
    }

    const parsed = JSON.parse(raw);
    return {
      habits: Array.isArray(parsed.habits) ? parsed.habits : [],
      checkins: Array.isArray(parsed.checkins) ? parsed.checkins : [],
      events: Array.isArray(parsed.events) ? parsed.events : [],
      assistantLog: Array.isArray(parsed.assistantLog) && parsed.assistantLog.length
        ? parsed.assistantLog
        : createEmptyState().assistantLog,
    };
  } catch (error) {
    console.warn("Unable to load local state", error);
    return createEmptyState();
  }
}

function saveState() {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function uid(prefix) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}-${Date.now().toString(36)}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function getTodayKey() {
  return dateKey(new Date());
}

function dateKey(date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateKey(key) {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function addDays(date, count) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + count);
  return copy;
}

function startOfWeek(date) {
  const copy = new Date(date);
  const day = copy.getDay();
  copy.setHours(0, 0, 0, 0);
  copy.setDate(copy.getDate() - day);
  return copy;
}

function getWeekKeys(date) {
  const start = startOfWeek(date);
  return Array.from({ length: 7 }, (_, index) => dateKey(addDays(start, index)));
}

function getRangeKeys(days) {
  const today = parseDateKey(getTodayKey());
  return Array.from({ length: days }, (_, index) => {
    const offset = index - (days - 1);
    return dateKey(addDays(today, offset));
  });
}

function getCheckinCount(habitId, key) {
  const found = state.checkins.find(
    (entry) => entry.habitId === habitId && entry.date === key,
  );
  return found ? found.count : 0;
}

function setCheckinCount(habitId, key, nextCount) {
  const safeCount = Math.max(0, nextCount);
  const existing = state.checkins.find(
    (entry) => entry.habitId === habitId && entry.date === key,
  );

  if (existing && safeCount === 0) {
    state.checkins = state.checkins.filter(
      (entry) => !(entry.habitId === habitId && entry.date === key),
    );
  } else if (existing) {
    existing.count = safeCount;
  } else if (safeCount > 0) {
    state.checkins.push({ habitId, date: key, count: safeCount });
  }

  saveState();
  render();
}

function getScheduleLabel(habit) {
  if (habit.scheduleType === "daily") {
    return `${habit.target}x per day`;
  }
  if (habit.scheduleType === "weekdays") {
    return `${habit.target}x on weekdays`;
  }
  if (habit.scheduleType === "custom") {
    const days = (habit.weekdays || []).map((day) => DAY_NAMES[day]);
    return `${habit.target}x on ${days.join(", ")}`;
  }
  return `${habit.target}x per week`;
}

function isHabitScheduledOnDate(habit, key) {
  const day = parseDateKey(key).getDay();

  if (habit.scheduleType === "daily") {
    return true;
  }

  if (habit.scheduleType === "weekdays") {
    return day >= 1 && day <= 5;
  }

  if (habit.scheduleType === "custom") {
    return Array.isArray(habit.weekdays) && habit.weekdays.includes(day);
  }

  return true;
}

function getHabitProgress(habit, key = getTodayKey()) {
  if (habit.scheduleType === "times-per-week") {
    const keys = getWeekKeys(parseDateKey(key));
    const count = keys.reduce((total, item) => total + getCheckinCount(habit.id, item), 0);
    return { count, target: habit.target };
  }

  return { count: getCheckinCount(habit.id, key), target: habit.target };
}

function getVisibleHabitsForToday() {
  const today = getTodayKey();
  return state.habits.filter((habit) => isHabitScheduledOnDate(habit, today));
}

function getCompletionLevel(habit, key) {
  const { count, target } = getHabitProgress(habit, key);
  return target ? Math.min(count / target, 1) : 0;
}

function getConsistency(habit) {
  if (habit.scheduleType === "times-per-week") {
    const weeks = Array.from({ length: 4 }, (_, index) => {
      const anchor = addDays(parseDateKey(getTodayKey()), -index * 7);
      const keys = getWeekKeys(anchor);
      const total = keys.reduce((sum, key) => sum + getCheckinCount(habit.id, key), 0);
      return Math.min(total / habit.target, 1);
    });
    const average = weeks.reduce((sum, value) => sum + value, 0) / weeks.length;
    return Math.round(average * 100);
  }

  const recentKeys = getRangeKeys(14).filter((key) => isHabitScheduledOnDate(habit, key));
  if (!recentKeys.length) {
    return 0;
  }

  const hits = recentKeys.filter((key) => getCheckinCount(habit.id, key) >= habit.target).length;
  return Math.round((hits / recentKeys.length) * 100);
}

function getStreak(habit) {
  if (habit.scheduleType === "times-per-week") {
    let streak = 0;
    let anchor = parseDateKey(getTodayKey());
    for (let index = 0; index < 12; index += 1) {
      const keys = getWeekKeys(anchor);
      const total = keys.reduce((sum, key) => sum + getCheckinCount(habit.id, key), 0);
      if (total >= habit.target) {
        streak += 1;
        anchor = addDays(anchor, -7);
      } else {
        break;
      }
    }
    return streak;
  }

  let streak = 0;
  let pointer = parseDateKey(getTodayKey());

  for (let index = 0; index < 90; index += 1) {
    const key = dateKey(pointer);
    if (!isHabitScheduledOnDate(habit, key)) {
      pointer = addDays(pointer, -1);
      continue;
    }

    if (getCheckinCount(habit.id, key) >= habit.target) {
      streak += 1;
      pointer = addDays(pointer, -1);
    } else {
      break;
    }
  }

  return streak;
}

function formatLongDate(date) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatShortDate(date) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
  }).format(date);
}

function formatTime(date, allDay) {
  if (allDay) {
    return "All day";
  }

  return new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
  }).format(date);
}

function getUpcomingEvents(limit = 6) {
  const now = Date.now();
  return [...state.events]
    .filter((event) => new Date(event.end || event.start).getTime() >= now)
    .sort((left, right) => new Date(left.start) - new Date(right.start))
    .slice(0, limit);
}

function getSummaryMetrics() {
  const visibleHabits = getVisibleHabitsForToday();
  const completedHabits = visibleHabits.filter(
    (habit) => getHabitProgress(habit).count >= getHabitProgress(habit).target,
  );
  const dayCoverage = visibleHabits.length
    ? Math.round((completedHabits.length / visibleHabits.length) * 100)
    : 0;
  const todayCheckins = state.habits.reduce(
    (sum, habit) => sum + getCheckinCount(habit.id, getTodayKey()),
    0,
  );

  const weeklyRatios = state.habits.map((habit) => {
    if (habit.scheduleType === "times-per-week") {
      const { count, target } = getHabitProgress(habit);
      return target ? Math.min(count / target, 1) : 0;
    }

    const weekKeys = getWeekKeys(parseDateKey(getTodayKey())).filter((key) =>
      isHabitScheduledOnDate(habit, key),
    );
    if (!weekKeys.length) {
      return 0;
    }

    const hitCount = weekKeys.filter((key) => getCheckinCount(habit.id, key) >= habit.target).length;
    return hitCount / weekKeys.length;
  });

  const weeklyMomentum = weeklyRatios.length
    ? Math.round((weeklyRatios.reduce((sum, value) => sum + value, 0) / weeklyRatios.length) * 100)
    : 0;

  const streakLeader = [...state.habits]
    .map((habit) => ({ habit, streak: getStreak(habit) }))
    .sort((left, right) => right.streak - left.streak)[0];

  const averageConsistency = state.habits.length
    ? Math.round(
        state.habits.reduce((sum, habit) => sum + getConsistency(habit), 0) / state.habits.length,
      )
    : 0;

  return {
    visibleHabits,
    completedHabits,
    dayCoverage,
    todayCheckins,
    weeklyMomentum,
    streakLeader,
    averageConsistency,
    upcomingEvents: getUpcomingEvents(),
  };
}

function getMissionPrompt(metrics) {
  const incomplete = metrics.visibleHabits.filter(
    (habit) => getHabitProgress(habit).count < getHabitProgress(habit).target,
  );
  const nextEvent = metrics.upcomingEvents[0];

  if (!state.habits.length) {
    return "Start by defining a few core habits so the dashboard can begin tracking your rhythm.";
  }

  if (!incomplete.length && !nextEvent) {
    return "Today looks clear. Keep your momentum rolling and use the habit builder to add new reps.";
  }

  if (incomplete.length && nextEvent) {
    return `Clear ${incomplete.length} habit ${incomplete.length === 1 ? "target" : "targets"} before ${nextEvent.title} at ${formatTime(new Date(nextEvent.start), nextEvent.allDay)}.`;
  }

  if (incomplete.length) {
    return `You have ${incomplete.length} habit ${incomplete.length === 1 ? "target" : "targets"} still open today.`;
  }

  return `Your next calendar pressure point is ${nextEvent.title} at ${formatTime(new Date(nextEvent.start), nextEvent.allDay)}.`;
}

function renderOverview() {
  const metrics = getSummaryMetrics();
  const circumference = 2 * Math.PI * 46;
  const offset = circumference - (circumference * metrics.dayCoverage) / 100;

  els.todayLabel.textContent = formatLongDate(new Date());
  els.dayScore.textContent = `${metrics.dayCoverage}%`;
  els.dayScoreMeta.textContent = `${metrics.completedHabits.length} of ${metrics.visibleHabits.length} habits closed`;
  els.missionPrompt.textContent = getMissionPrompt(metrics);
  els.scoreProgress.style.strokeDashoffset = `${offset}`;
  els.focusBadge.textContent =
    metrics.dayCoverage >= 80 ? "On pace" : metrics.dayCoverage >= 50 ? "In motion" : "Needs attention";

  const metricCards = [
    {
      label: "Check-ins today",
      value: `${metrics.todayCheckins}`,
      detail: "All habit reps logged today",
    },
    {
      label: "Weekly momentum",
      value: `${metrics.weeklyMomentum}%`,
      detail: "How this week is stacking up",
    },
    {
      label: "Consistency",
      value: `${metrics.averageConsistency}%`,
      detail: "Average across active habits",
    },
    {
      label: "Streak leader",
      value: metrics.streakLeader ? `${metrics.streakLeader.streak}` : "0",
      detail: metrics.streakLeader ? metrics.streakLeader.habit.name : "No streak yet",
    },
  ];

  els.metricRack.innerHTML = metricCards
    .map(
      (metric) => `
        <article class="metric-card">
          <span class="eyebrow">${escapeHtml(metric.label)}</span>
          <strong>${escapeHtml(metric.value)}</strong>
          <span class="subtle">${escapeHtml(metric.detail)}</span>
        </article>
      `,
    )
    .join("");

  renderSparkline();
  renderBriefing(metrics);
}

function renderSparkline() {
  const keys = getRangeKeys(7);
  const values = keys.map((key) =>
    state.habits.reduce((sum, habit) => sum + getCheckinCount(habit.id, key), 0),
  );
  const max = Math.max(...values, 1);
  const points = values
    .map((value, index) => {
      const x = 20 + index * 46;
      const y = 90 - (value / max) * 60;
      return `${x},${y}`;
    })
    .join(" ");

  const areaPoints = `20,90 ${points} ${20 + (values.length - 1) * 46},90`;
  const horizontalLines = [20, 50, 80]
    .map((y) => `<line class="sparkline-grid" x1="12" y1="${y}" x2="308" y2="${y}"></line>`)
    .join("");
  const circles = values
    .map((value, index) => {
      const x = 20 + index * 46;
      const y = 90 - (value / max) * 60;
      return `<circle class="sparkline-point" cx="${x}" cy="${y}" r="4"></circle>`;
    })
    .join("");

  els.trendSparkline.innerHTML = `
    ${horizontalLines}
    <polygon class="sparkline-fill" points="${areaPoints}"></polygon>
    <polyline class="sparkline-path" points="${points}"></polyline>
    ${circles}
  `;

  els.sparklineLabels.innerHTML = keys
    .map((key, index) => {
      const label = formatShortDate(parseDateKey(key));
      return `<span>${escapeHtml(label)} · ${escapeHtml(values[index])}</span>`;
    })
    .join("");

  const weeklyTotal = values.reduce((sum, value) => sum + value, 0);
  els.trendLabel.textContent = weeklyTotal
    ? `${weeklyTotal} total check-ins this week view`
    : "No activity yet";
}

function renderBriefing(metrics) {
  const incomplete = metrics.visibleHabits.filter(
    (habit) => getHabitProgress(habit).count < getHabitProgress(habit).target,
  );
  const weakest = [...state.habits]
    .map((habit) => ({ habit, score: getConsistency(habit) }))
    .sort((left, right) => left.score - right.score)
    .slice(0, 2);
  const nextEvent = metrics.upcomingEvents[0];
  const notes = [];

  if (incomplete.length) {
    notes.push(
      `${incomplete.length} habit ${incomplete.length === 1 ? "target is" : "targets are"} still open today.`,
    );
  } else {
    notes.push("Today’s visible habits are all covered.");
  }

  if (nextEvent) {
    notes.push(
      `Next event: ${nextEvent.title} at ${formatTime(new Date(nextEvent.start), nextEvent.allDay)}.`,
    );
  } else {
    notes.push("No upcoming calendar events are loaded right now.");
  }

  if (weakest.length) {
    notes.push(
      `${weakest
        .map((entry) => `${entry.habit.name} (${entry.score}%)`)
        .join(" and ")} need the most consistency support.`,
    );
  }

  els.briefingList.innerHTML = notes
    .map((note) => `<li>${escapeHtml(note)}</li>`)
    .join("");
}

function renderHabits() {
  const visibleHabits = getVisibleHabitsForToday();
  els.habitSummaryBadge.textContent = `${visibleHabits.length} active today`;

  if (!state.habits.length) {
    els.habitList.innerHTML = `
      <article class="habit-card">
        <div class="habit-title">
          <strong>No habits configured yet</strong>
          <span class="habit-category">Use the builder to add your first daily tracker.</span>
        </div>
      </article>
    `;
    return;
  }

  if (!visibleHabits.length) {
    els.habitList.innerHTML = `
      <article class="habit-card">
        <div class="habit-title">
          <strong>Nothing scheduled for today</strong>
          <span class="habit-category">Your custom cadence skips this day.</span>
        </div>
      </article>
    `;
    return;
  }

  els.habitList.innerHTML = visibleHabits
    .map((habit) => {
      const progress = getHabitProgress(habit);
      const consistency = getConsistency(habit);
      const streak = getStreak(habit);
      const percent = progress.target ? Math.min((progress.count / progress.target) * 100, 100) : 0;
      const remaining = Math.max(progress.target - progress.count, 0);
      const statusText = remaining
        ? `${remaining} more to close`
        : "Target achieved";

      return `
        <article class="habit-card" style="--habit-color: ${escapeHtml(COLORS[habit.color] || COLORS.cyan)}">
          <div class="habit-header">
            <div class="habit-title">
              <strong>${escapeHtml(habit.name)}</strong>
              <span class="habit-category">${escapeHtml(habit.category || "Uncategorized")}</span>
            </div>
            <span class="habit-pill">${escapeHtml(getScheduleLabel(habit))}</span>
          </div>

          <div class="habit-status">
            <span>${escapeHtml(statusText)}</span>
            <span class="habit-pill">${escapeHtml(progress.count)} / ${escapeHtml(progress.target)}</span>
          </div>

          <div class="habit-progress">
            <span style="width: ${percent}%"></span>
          </div>

          <div class="habit-meta">
            <span>Consistency ${escapeHtml(consistency)}%</span>
            <span>Streak ${escapeHtml(streak)}${habit.scheduleType === "times-per-week" ? " wks" : " days"}</span>
          </div>

          <div class="habit-actions">
            <div class="delta-group">
              <button class="delta-button" type="button" data-action="decrement" data-habit-id="${escapeHtml(habit.id)}">-</button>
              <button class="delta-button" type="button" data-action="increment" data-habit-id="${escapeHtml(habit.id)}">+</button>
            </div>

            <div class="button-row">
              <button class="button ghost" type="button" data-action="edit" data-habit-id="${escapeHtml(habit.id)}">Edit</button>
              <button class="button ghost" type="button" data-action="delete" data-habit-id="${escapeHtml(habit.id)}">Delete</button>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

function resetForm() {
  els.habitForm.reset();
  els.habitId.value = "";
  els.habitTarget.value = "1";
  els.habitColor.value = "cyan";
  els.formHeading.textContent = "Add New Habit";
  els.saveHabitButton.textContent = "Save Habit";
  els.cancelEditButton.classList.add("hidden");
  updateScheduleFields();
  els.customDaysField
    .querySelectorAll('input[type="checkbox"]')
    .forEach((input) => {
      input.checked = false;
    });
}

function populateForm(habit) {
  els.habitId.value = habit.id;
  els.habitName.value = habit.name;
  els.habitCategory.value = habit.category || "";
  els.habitSchedule.value = habit.scheduleType;
  els.habitTarget.value = habit.target;
  els.habitColor.value = habit.color || "cyan";
  updateScheduleFields();

  els.customDaysField
    .querySelectorAll('input[type="checkbox"]')
    .forEach((input) => {
      input.checked = Array.isArray(habit.weekdays)
        ? habit.weekdays.includes(Number(input.value))
        : false;
    });

  els.formHeading.textContent = "Edit Habit";
  els.saveHabitButton.textContent = "Update Habit";
  els.cancelEditButton.classList.remove("hidden");
}

function updateScheduleFields() {
  const schedule = els.habitSchedule.value;
  const isCustom = schedule === "custom";
  const isWeekly = schedule === "times-per-week";

  els.customDaysField.classList.toggle("hidden", !isCustom);
  els.targetLabel.textContent = isWeekly ? "Target per week" : "Target per day";
}

function renderCalendar() {
  const upcoming = getUpcomingEvents();

  if (!state.events.length) {
    els.calendarMeta.textContent =
      "No imported events yet. Drop an .ics file from Google Calendar, Apple Calendar, or Outlook.";
    els.calendarList.innerHTML = `
      <article class="calendar-event">
        <strong>Calendar feed is empty</strong>
        <span>Import a file so habits and schedule live in the same view.</span>
      </article>
    `;
    return;
  }

  els.calendarMeta.textContent = `${state.events.length} event${state.events.length === 1 ? "" : "s"} loaded. Showing the next ${upcoming.length}.`;
  els.calendarList.innerHTML = upcoming
    .map((event) => {
      const start = new Date(event.start);
      const end = event.end ? new Date(event.end) : null;
      const dayLabel = formatLongDate(start);
      const timeLabel = event.allDay
        ? "All day"
        : `${formatTime(start, false)}${end ? ` - ${formatTime(end, false)}` : ""}`;

      return `
        <article class="calendar-event">
          <strong>${escapeHtml(event.title)}</strong>
          <time datetime="${escapeHtml(event.start)}">${escapeHtml(dayLabel)}</time>
          <span>${escapeHtml(timeLabel)}</span>
          <span>${escapeHtml(event.sourceName || "Imported calendar")}</span>
        </article>
      `;
    })
    .join("");
}

function getHistoryLevel(habit, key) {
  const count = getCheckinCount(habit.id, key);

  if (!count) {
    return 0;
  }

  if (habit.scheduleType === "times-per-week") {
    return Math.min(count, 3);
  }

  const ratio = count / habit.target;
  if (ratio >= 1) {
    return 3;
  }
  if (ratio >= 0.6) {
    return 2;
  }
  return 1;
}

function renderHistory() {
  const keys = getRangeKeys(14);
  const totalHits = state.checkins.reduce((sum, entry) => sum + entry.count, 0);
  els.historyBadge.textContent = totalHits ? `${totalHits} logged reps` : "No history";

  if (!state.habits.length) {
    els.historyGrid.innerHTML = `
      <div class="history-head">
        <div class="history-label"><strong>Habits</strong><span>Last 14 days</span></div>
      </div>
    `;
    els.activityFeed.innerHTML = `
      <article class="activity-item">
        Add a habit to start building a visible history trail.
      </article>
    `;
    return;
  }

  const header = `
    <div class="history-head">
      <div class="history-label"><strong>Habits</strong><span>Intensity by day</span></div>
      ${keys
        .map((key) => {
          const date = parseDateKey(key);
          return `
            <div class="history-cell">
              <strong>${escapeHtml(DAY_NAMES[date.getDay()])}</strong>
              <div>${escapeHtml(`${date.getMonth() + 1}/${date.getDate()}`)}</div>
            </div>
          `;
        })
        .join("")}
    </div>
  `;

  const rows = state.habits
    .map((habit) => {
      return `
        <div class="history-row">
          <div class="history-label">
            <strong>${escapeHtml(habit.name)}</strong>
            <span>${escapeHtml(getConsistency(habit))}% consistent</span>
          </div>
          ${keys
            .map((key) => {
              const level = getHistoryLevel(habit, key);
              const label = getCheckinCount(habit.id, key)
                ? `${getCheckinCount(habit.id, key)} rep${getCheckinCount(habit.id, key) === 1 ? "" : "s"}`
                : "No entry";
              return `
                <div class="history-cell" title="${escapeHtml(label)}">
                  <div class="history-chip ${level ? `level-${level}` : ""}"></div>
                </div>
              `;
            })
            .join("")}
        </div>
      `;
    })
    .join("");

  els.historyGrid.innerHTML = `${header}${rows}`;

  const recentEntries = [...state.checkins]
    .sort((left, right) => right.date.localeCompare(left.date))
    .slice(0, 8)
    .map((entry) => {
      const habit = state.habits.find((item) => item.id === entry.habitId);
      return {
        habitName: habit ? habit.name : "Removed habit",
        date: entry.date,
        count: entry.count,
      };
    });

  els.activityFeed.innerHTML = recentEntries.length
    ? recentEntries
        .map(
          (entry) => `
            <article class="activity-item">
              <strong>${escapeHtml(entry.habitName)}</strong>
              <div>${escapeHtml(formatShortDate(parseDateKey(entry.date)))} · ${escapeHtml(entry.count)} rep${entry.count === 1 ? "" : "s"}</div>
            </article>
          `,
        )
        .join("")
    : `
      <article class="activity-item">
        No check-ins yet. Use the plus buttons in the tracker to start building history.
      </article>
    `;
}

function renderAssistant() {
  const prompts = [
    "What should I focus on today?",
    "Which habits are slipping?",
    "What is next on my calendar?",
  ];

  els.assistantSuggestions.innerHTML = prompts
    .map(
      (prompt) => `
        <button class="suggestion-pill" type="button" data-prompt="${escapeHtml(prompt)}">
          ${escapeHtml(prompt)}
        </button>
      `,
    )
    .join("");

  els.assistantLog.innerHTML = state.assistantLog
    .slice(-12)
    .map(
      (message) => `
        <article class="message ${escapeHtml(message.role)}">
          ${escapeHtml(message.text)}
        </article>
      `,
    )
    .join("");

  els.assistantLog.scrollTop = els.assistantLog.scrollHeight;
}

function render() {
  renderOverview();
  renderHabits();
  renderCalendar();
  renderHistory();
  renderAssistant();
}

function handleHabitSubmit(event) {
  event.preventDefault();

  const scheduleType = els.habitSchedule.value;
  const weekdays = [...els.customDaysField.querySelectorAll('input[type="checkbox"]:checked')].map(
    (input) => Number(input.value),
  );

  if (scheduleType === "custom" && !weekdays.length) {
    window.alert("Pick at least one day for a custom cadence.");
    return;
  }

  const target = Number(els.habitTarget.value);
  const baseHabit = {
    name: els.habitName.value.trim(),
    category: els.habitCategory.value.trim(),
    scheduleType,
    target,
    weekdays,
    color: els.habitColor.value,
  };

  if (!baseHabit.name) {
    return;
  }

  if (els.habitId.value) {
    const existing = state.habits.find((habit) => habit.id === els.habitId.value);
    if (existing) {
      Object.assign(existing, baseHabit);
    }
  } else {
    state.habits.unshift({
      id: uid("habit"),
      createdAt: new Date().toISOString(),
      ...baseHabit,
    });
  }

  saveState();
  resetForm();
  render();
}

function handleHabitAction(event) {
  const button = event.target.closest("button[data-action]");
  if (!button) {
    return;
  }

  const action = button.dataset.action;
  const habit = state.habits.find((item) => item.id === button.dataset.habitId);
  if (!habit) {
    return;
  }

  if (action === "increment") {
    setCheckinCount(habit.id, getTodayKey(), getCheckinCount(habit.id, getTodayKey()) + 1);
    return;
  }

  if (action === "decrement") {
    setCheckinCount(habit.id, getTodayKey(), getCheckinCount(habit.id, getTodayKey()) - 1);
    return;
  }

  if (action === "edit") {
    populateForm(habit);
    return;
  }

  if (action === "delete") {
    const shouldDelete = window.confirm(`Delete "${habit.name}" and its history?`);
    if (!shouldDelete) {
      return;
    }

    state.habits = state.habits.filter((item) => item.id !== habit.id);
    state.checkins = state.checkins.filter((entry) => entry.habitId !== habit.id);
    saveState();
    resetForm();
    render();
  }
}

function parseIcsDate(raw) {
  if (!raw) {
    return null;
  }

  if (/^\d{8}$/.test(raw)) {
    const year = Number(raw.slice(0, 4));
    const month = Number(raw.slice(4, 6)) - 1;
    const day = Number(raw.slice(6, 8));
    return new Date(year, month, day);
  }

  if (/^\d{8}T\d{6}Z$/.test(raw)) {
    const year = Number(raw.slice(0, 4));
    const month = Number(raw.slice(4, 6)) - 1;
    const day = Number(raw.slice(6, 8));
    const hour = Number(raw.slice(9, 11));
    const minute = Number(raw.slice(11, 13));
    const second = Number(raw.slice(13, 15));
    return new Date(Date.UTC(year, month, day, hour, minute, second));
  }

  if (/^\d{8}T\d{6}$/.test(raw)) {
    const year = Number(raw.slice(0, 4));
    const month = Number(raw.slice(4, 6)) - 1;
    const day = Number(raw.slice(6, 8));
    const hour = Number(raw.slice(9, 11));
    const minute = Number(raw.slice(11, 13));
    const second = Number(raw.slice(13, 15));
    return new Date(year, month, day, hour, minute, second);
  }

  const guess = new Date(raw);
  return Number.isNaN(guess.getTime()) ? null : guess;
}

function parseIcsFile(text, fileName) {
  const unfolded = text.replace(/\r?\n[ \t]/g, "");
  const lines = unfolded.split(/\r?\n/);
  const events = [];
  let current = null;

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      current = {};
      continue;
    }

    if (line === "END:VEVENT") {
      if (current && current.summary && current.start) {
        events.push({
          id: uid("event"),
          title: current.summary,
          start: current.start.toISOString(),
          end: current.end ? current.end.toISOString() : current.start.toISOString(),
          allDay: current.allDay || false,
          sourceName: fileName,
        });
      }
      current = null;
      continue;
    }

    if (!current) {
      continue;
    }

    const separator = line.indexOf(":");
    if (separator === -1) {
      continue;
    }

    const keySection = line.slice(0, separator);
    const rawValue = line.slice(separator + 1);
    const baseKey = keySection.split(";")[0];

    if (baseKey === "SUMMARY") {
      current.summary = rawValue;
    } else if (baseKey === "DTSTART") {
      current.start = parseIcsDate(rawValue);
      current.allDay = /^\d{8}$/.test(rawValue);
    } else if (baseKey === "DTEND") {
      current.end = parseIcsDate(rawValue);
    }
  }

  return events;
}

function importCalendarFiles(fileList) {
  const files = [...fileList].filter((file) => file.name.toLowerCase().endsWith(".ics"));
  if (!files.length) {
    window.alert("Choose an .ics calendar file.");
    return;
  }

  Promise.all(
    files.map(
      (file) =>
        new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(parseIcsFile(String(reader.result), file.name));
          reader.onerror = () => reject(reader.error);
          reader.readAsText(file);
        }),
    ),
  )
    .then((eventGroups) => {
      const merged = eventGroups.flat();
      const existingKeys = new Set(state.events.map((event) => `${event.title}-${event.start}`));

      merged.forEach((event) => {
        const signature = `${event.title}-${event.start}`;
        if (!existingKeys.has(signature)) {
          state.events.push(event);
          existingKeys.add(signature);
        }
      });

      state.events.sort((left, right) => new Date(left.start) - new Date(right.start));
      saveState();
      render();
    })
    .catch((error) => {
      console.warn("Calendar import failed", error);
      window.alert("The calendar file could not be read.");
    });
}

function answerAssistant(prompt) {
  const text = prompt.trim().toLowerCase();
  const metrics = getSummaryMetrics();
  const incomplete = metrics.visibleHabits.filter(
    (habit) => getHabitProgress(habit).count < getHabitProgress(habit).target,
  );
  const weakest = [...state.habits]
    .map((habit) => ({ habit, score: getConsistency(habit) }))
    .sort((left, right) => left.score - right.score)
    .slice(0, 3);
  const nextEvent = metrics.upcomingEvents[0];

  if (/focus|today|priority|what should/i.test(text)) {
    if (!incomplete.length && !nextEvent) {
      return "You are in a clean state right now. No visible habits are open and there is no upcoming calendar pressure loaded.";
    }

    const habitText = incomplete.length
      ? `Open habits: ${incomplete.map((habit) => habit.name).join(", ")}.`
      : "Your visible habits are currently covered.";
    const eventText = nextEvent
      ? ` Next event: ${nextEvent.title} at ${formatTime(new Date(nextEvent.start), nextEvent.allDay)}.`
      : " No upcoming events are currently loaded.";
    return `${habitText}${eventText}`;
  }

  if (/slipping|miss|behind|weak|struggle/.test(text)) {
    if (!weakest.length) {
      return "There is not enough history yet to identify slipping habits.";
    }

    return `The habits needing the most support are ${weakest
      .map((entry) => `${entry.habit.name} (${entry.score}% consistency)`)
      .join(", ")}.`;
  }

  if (/calendar|next|schedule|meeting|event/.test(text)) {
    if (!nextEvent) {
      return "No upcoming calendar items are loaded. Drop an .ics file into the calendar panel to bring them in.";
    }

    const upcoming = metrics.upcomingEvents
      .slice(0, 3)
      .map(
        (event) =>
          `${event.title} on ${formatLongDate(new Date(event.start))} at ${formatTime(new Date(event.start), event.allDay)}`,
      )
      .join("; ");
    return `Next up: ${upcoming}.`;
  }

  if (/streak/.test(text)) {
    if (!metrics.streakLeader) {
      return "No streak leader yet. Once you log a few consistent days, I can rank them.";
    }

    return `${metrics.streakLeader.habit.name} leads with a ${metrics.streakLeader.streak}-${metrics.streakLeader.habit.scheduleType === "times-per-week" ? "week" : "day"} streak.`;
  }

  if (/consisten|progress|week/.test(text)) {
    return `Weekly momentum is ${metrics.weeklyMomentum}% and overall consistency is ${metrics.averageConsistency}%.`;
  }

  return "I can answer simple questions about focus, consistency, streaks, and your upcoming calendar. Try asking what to focus on today or which habits are slipping.";
}

function pushAssistantExchange(prompt) {
  state.assistantLog.push({ role: "user", text: prompt });
  state.assistantLog.push({ role: "assistant", text: answerAssistant(prompt) });
  state.assistantLog = state.assistantLog.slice(-16);
  saveState();
  renderAssistant();
}

function loadDemoState() {
  const today = parseDateKey(getTodayKey());
  const habits = [
    {
      id: uid("habit"),
      name: "Deep Work Block",
      category: "Work",
      scheduleType: "daily",
      target: 2,
      weekdays: [],
      color: "cyan",
      createdAt: new Date().toISOString(),
    },
    {
      id: uid("habit"),
      name: "Workout",
      category: "Health",
      scheduleType: "weekdays",
      target: 1,
      weekdays: [],
      color: "amber",
      createdAt: new Date().toISOString(),
    },
    {
      id: uid("habit"),
      name: "Plan Tomorrow",
      category: "Planning",
      scheduleType: "daily",
      target: 1,
      weekdays: [],
      color: "mint",
      createdAt: new Date().toISOString(),
    },
    {
      id: uid("habit"),
      name: "Inbox Sweep",
      category: "Admin",
      scheduleType: "times-per-week",
      target: 4,
      weekdays: [],
      color: "coral",
      createdAt: new Date().toISOString(),
    },
  ];

  const checkins = [];
  const range = getRangeKeys(14);
  habits.forEach((habit) => {
    range.forEach((key, index) => {
      if (!isHabitScheduledOnDate(habit, key)) {
        return;
      }

      const shouldLog = index % 3 !== 0 || habit.name === "Plan Tomorrow";
      if (!shouldLog) {
        return;
      }

      const count = habit.scheduleType === "times-per-week"
        ? (index % 4 === 0 ? 0 : 1)
        : habit.target === 2 && index % 2 === 0
          ? 2
          : 1;

      if (count > 0) {
        checkins.push({ habitId: habit.id, date: key, count });
      }
    });
  });

  const events = [
    {
      id: uid("event"),
      title: "Client Review",
      start: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 10, 30).toISOString(),
      end: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 11, 15).toISOString(),
      allDay: false,
      sourceName: "Demo calendar",
    },
    {
      id: uid("event"),
      title: "Project Deep Dive",
      start: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 14, 0).toISOString(),
      end: new Date(today.getFullYear(), today.getMonth(), today.getDate(), 15, 30).toISOString(),
      allDay: false,
      sourceName: "Demo calendar",
    },
    {
      id: uid("event"),
      title: "Weekly Reset",
      start: addDays(new Date(today.getFullYear(), today.getMonth(), today.getDate(), 18, 0), 1).toISOString(),
      end: addDays(new Date(today.getFullYear(), today.getMonth(), today.getDate(), 18, 45), 1).toISOString(),
      allDay: false,
      sourceName: "Demo calendar",
    },
  ];

  state.habits = habits;
  state.checkins = checkins;
  state.events = events;
  state.assistantLog = createEmptyState().assistantLog;
  saveState();
  resetForm();
  render();
}

function registerEvents() {
  els.habitSchedule.addEventListener("change", updateScheduleFields);
  els.habitForm.addEventListener("submit", handleHabitSubmit);
  els.habitList.addEventListener("click", handleHabitAction);
  els.cancelEditButton.addEventListener("click", resetForm);

  els.loadDemoButton.addEventListener("click", loadDemoState);
  els.resetButton.addEventListener("click", () => {
    const shouldReset = window.confirm("Reset all local habits, history, and imported events?");
    if (!shouldReset) {
      return;
    }

    const nextState = createEmptyState();
    state.habits = nextState.habits;
    state.checkins = nextState.checkins;
    state.events = nextState.events;
    state.assistantLog = nextState.assistantLog;
    saveState();
    resetForm();
    render();
  });

  els.calendarBrowseButton.addEventListener("click", () => els.calendarFileInput.click());
  els.calendarFileInput.addEventListener("change", (event) => {
    importCalendarFiles(event.target.files || []);
    event.target.value = "";
  });

  ["dragenter", "dragover"].forEach((eventName) => {
    els.calendarDropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      els.calendarDropzone.classList.add("active");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    els.calendarDropzone.addEventListener(eventName, (event) => {
      event.preventDefault();
      els.calendarDropzone.classList.remove("active");
    });
  });

  els.calendarDropzone.addEventListener("drop", (event) => {
    importCalendarFiles(event.dataTransfer ? event.dataTransfer.files : []);
  });

  els.calendarDropzone.addEventListener("keydown", (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      els.calendarFileInput.click();
    }
  });

  els.clearCalendarButton.addEventListener("click", () => {
    state.events = [];
    saveState();
    render();
  });

  els.assistantSuggestions.addEventListener("click", (event) => {
    const button = event.target.closest("button[data-prompt]");
    if (!button) {
      return;
    }
    pushAssistantExchange(button.dataset.prompt || "");
  });

  els.assistantForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const prompt = els.assistantInput.value.trim();
    if (!prompt) {
      return;
    }
    pushAssistantExchange(prompt);
    els.assistantInput.value = "";
  });
}

updateScheduleFields();
registerEvents();
render();
