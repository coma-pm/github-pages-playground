const MS_PER_DAY = 24 * 60 * 60 * 1000;

const startDateInput = document.getElementById("start-date");
const endDateInput = document.getElementById("end-date");
const dayCountInput = document.getElementById("day-count");
const summary = document.getElementById("summary");

function parseDate(value) {
  if (!value) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);

  if (![year, month, day].every(Number.isInteger)) {
    return null;
  }

  return new Date(Date.UTC(year, month - 1, day));
}

function formatDate(date) {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function formatDateLabel(value) {
  const date = parseDate(value);

  if (!date) {
    return "not set";
  }

  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
}

function diffDays(startValue, endValue) {
  const start = parseDate(startValue);
  const end = parseDate(endValue);

  if (!start || !end) {
    return null;
  }

  return Math.round((end.getTime() - start.getTime()) / MS_PER_DAY) + 1;
}

function addDays(startValue, days) {
  const start = parseDate(startValue);

  if (!start || !Number.isInteger(days) || days < 1) {
    return null;
  }

  return formatDate(new Date(start.getTime() + (days - 1) * MS_PER_DAY));
}

function renderSummary() {
  const startLabel = formatDateLabel(startDateInput.value);
  const endLabel = formatDateLabel(endDateInput.value);
  const dayCount = dayCountInput.value === "" ? "not set" : `${dayCountInput.value} days`;

  summary.textContent = `${startLabel} to ${endLabel}: ${dayCount}`;
}

function syncDaysFromDates() {
  const days = diffDays(startDateInput.value, endDateInput.value);

  if (days === null) {
    renderSummary();
    return;
  }

  dayCountInput.value = String(days);
  renderSummary();
}

function syncEndDateFromDays() {
  if (dayCountInput.value === "") {
    renderSummary();
    return;
  }

  const days = Number(dayCountInput.value);
  const nextEndDate = addDays(startDateInput.value, days);

  if (!nextEndDate) {
    renderSummary();
    return;
  }

  endDateInput.value = nextEndDate;
  renderSummary();
}

const today = new Date();
const defaultStart = formatDate(new Date(Date.UTC(
  today.getFullYear(),
  today.getMonth(),
  today.getDate(),
)));
const defaultEnd = formatDate(new Date(Date.UTC(
  today.getFullYear(),
  today.getMonth(),
  today.getDate() + 7,
)));

startDateInput.value = defaultStart;
endDateInput.value = defaultEnd;
syncDaysFromDates();

startDateInput.addEventListener("input", () => {
  syncDaysFromDates();
});

endDateInput.addEventListener("input", () => {
  syncDaysFromDates();
});

dayCountInput.addEventListener("input", () => {
  syncEndDateFromDays();
});
