// =========================================================
// app.js — 달력 화면을 그리고 버튼 동작을 처리하는 파일
// =========================================================

// ---------------------------------------------------------
// 1. localStorage 도우미
//    브라우저 설정에 따라 저장소를 쓸 수 없을 때도 앱이 멈추지 않도록
//    try/catch로 감싸 둡니다.
// ---------------------------------------------------------
const STORAGE_KEYS = {
  theme: 'studentCalendar.theme', // 'light' 또는 'dark'
  events: 'studentCalendar.events', // 일정 목록 (JSON 문자열)
  ddaySort: 'studentCalendar.ddaySort', // D-day 정렬: 'added' | 'asc' | 'desc'
  subjects: 'studentCalendar.subjects', // 과목 목록 (JSON 문자열, 화면에서 추가·수정한 내용)
  timetable: 'studentCalendar.timetable', // 시간표 (JSON 문자열)
};

function loadSetting(key) {
  try {
    return localStorage.getItem(key);
  } catch (e) {
    return null;
  }
}

// 저장에 성공하면 true, 실패하면 false를 돌려줍니다.
function saveSetting(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (e) {
    return false;
  }
}

// 예전의 '시험' 일정을 지금 종류로 바꿔요. 바뀐 게 있으면 true를 돌려줘요.
//   하루 시험 → 모의고사 / 기간이 켜진 시험 → 정기고사
//   과목은 내용 앞에 붙이고(예: '문학 쪽지'), 교시는 지워요. 한 번 바꾸면 다시 바뀌지 않아요.
function migrateOldExam(event) {
  if (!event || event.type !== 'exam') return false;
  let changed = false;
  if (event.subject && typeof event.title === 'string') {
    event.title = `${event.subject} ${event.title}`.slice(0, 100);
  }
  if (event.subject) changed = true;
  event.subject = null;
  if ('period' in event) {
    delete event.period;
    changed = true;
  }
  if (event.endDate) {
    event.type = 'regularExam';
    delete event.dayOrder;
    changed = true;
  }
  return changed;
}

// 저장된 일정 목록 불러오기 (없거나 망가져 있으면 빈 목록)
function loadEvents() {
  const raw = loadSetting(STORAGE_KEYS.events);
  if (!raw) return [];
  try {
    const data = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    // 예전 일정을 바꿨으면 바로 저장해서 다음부터는 바꿀 일이 없게 해요.
    const changed = data.map(migrateOldExam).some(Boolean);
    if (changed) saveSetting(STORAGE_KEYS.events, JSON.stringify(data));
    return data;
  } catch (e) {
    return [];
  }
}

function saveEvents() {
  const ok = saveSetting(STORAGE_KEYS.events, JSON.stringify(events));
  if (!ok) {
    alert('일정을 저장하지 못했어요. 브라우저의 저장소 설정(사이트 데이터 차단, 시크릿 모드 등)을 확인해 주세요.');
  }
}

// 과목 하나가 올바른 모양인지 검사하고 다듬기 (이름 + #RRGGBB 색). 틀리면 null
function normalizeSubject(raw) {
  if (!raw || typeof raw.name !== 'string' || !raw.name.trim()) return null;
  if (typeof raw.color !== 'string' || !/^#[0-9a-f]{6}$/i.test(raw.color)) return null;
  return { name: raw.name.trim().slice(0, 20), color: raw.color.toLowerCase() };
}

// 과목 목록 여러 개를 검사 (잘못된 것과 이름이 겹치는 것은 빼요)
function normalizeSubjectList(list) {
  const seen = new Set();
  return list.map(normalizeSubject).filter((s) => s && !seen.has(s.name) && seen.add(s.name));
}

// 예전 버전에서 기본으로 들어 있던 과목 목록
// 예전 버전은 과목을 화면에서 고치지 않으면 브라우저에 따로 저장하지 않았어요.
// 그래서 예전 버전으로 이미 일정을 쓰던 브라우저에서는, 기본값이 '과목 없음'으로 바뀌어도
// 쓰던 과목이 사라지지 않도록 이 목록을 한 번만 저장해 줍니다. (새로 쓰는 사람은 빈 목록)
const LEGACY_DEFAULT_SUBJECTS = [
  { name: '문학', color: '#fab005' },
  { name: '영어Ⅱ', color: '#7048e8' },
  { name: '미적분Ⅰ', color: '#37b24d' },
  { name: '확률과 통계', color: '#f76707' },
  { name: '역학과 에너지', color: '#1c7ed6' },
  { name: '물질과 에너지', color: '#e64980' },
  { name: '인공지능 기초', color: '#8d6e63' },
];

// 저장된 과목 목록 불러오기
//   - 저장된 목록이 있으면 그대로 (모두 지워서 빈 목록이면 빈 목록 그대로)
//   - 없으면: 예전 버전으로 일정을 쓰던 브라우저 → 예전 기본 과목,
//             처음 쓰는 브라우저 → config.js의 SUBJECTS(기본은 빈 목록)
//   그리고 바로 저장해 두어서, 이 판단은 처음 한 번만 해요.
function loadSubjects() {
  const raw = loadSetting(STORAGE_KEYS.subjects);
  if (raw) {
    try {
      const data = JSON.parse(raw);
      if (Array.isArray(data)) return normalizeSubjectList(data);
    } catch (e) {
      // 망가진 값이면 아래에서 새로 정해요
    }
  }
  const usedBefore = loadSetting(STORAGE_KEYS.events) !== null;
  const initial = (usedBefore ? LEGACY_DEFAULT_SUBJECTS : SUBJECTS).map((s) => ({ ...s }));
  saveSetting(STORAGE_KEYS.subjects, JSON.stringify(initial));
  return initial;
}

function saveSubjects() {
  const ok = saveSetting(STORAGE_KEYS.subjects, JSON.stringify(subjects));
  if (!ok) {
    alert('과목을 저장하지 못했어요. 브라우저의 저장소 설정(사이트 데이터 차단, 시크릿 모드 등)을 확인해 주세요.');
  }
}

// 시간표가 올바른 모양인지 검사하고 다듬기. 시간표 모양이 아니면 null
//   { cells: { '1-3': { kind: 'subject', name: '문학' }, '1-7': { kind: 'custom', name: '동아리' } } }
//   칸 이름은 '요일번호-교시'(1 = 월요일)이고, 빈 칸은 아예 적지 않아요.
//   kind가 subject면 과목 목록의 과목, custom이면 직접 추가한 이름이에요.
function normalizeTimetable(raw) {
  if (!raw || typeof raw !== 'object' || !raw.cells || typeof raw.cells !== 'object') return null;
  const cells = {};
  Object.keys(raw.cells).forEach((key) => {
    const match = /^(\d+)-(\d+)$/.exec(key);
    if (!match) return;
    // config.js에 없는 요일이나 교시 칸은 빼요.
    const count = PERIODS_PER_WEEKDAY[Number(match[1])] || 0;
    const period = Number(match[2]);
    if (period < 1 || period > count) return;

    const cell = raw.cells[key];
    if (!cell || (cell.kind !== 'subject' && cell.kind !== 'custom')) return;
    if (typeof cell.name !== 'string' || !cell.name.trim()) return;
    cells[`${Number(match[1])}-${period}`] = { kind: cell.kind, name: cell.name.trim().slice(0, 20) };
  });
  return { cells };
}

// 저장된 시간표 불러오기 (없거나 망가져 있으면 빈 시간표)
function loadTimetable() {
  const raw = loadSetting(STORAGE_KEYS.timetable);
  if (raw) {
    try {
      const data = normalizeTimetable(JSON.parse(raw));
      if (data) return data;
    } catch (e) {
      // 망가진 값이면 아래의 빈 시간표로
    }
  }
  return { cells: {} };
}

function saveTimetable() {
  const ok = saveSetting(STORAGE_KEYS.timetable, JSON.stringify(timetable));
  if (!ok) {
    alert('시간표를 저장하지 못했어요. 브라우저의 저장소 설정(사이트 데이터 차단, 시크릿 모드 등)을 확인해 주세요.');
  }
}

// ---------------------------------------------------------
// 2. 날짜 도우미
// ---------------------------------------------------------
const WEEKDAY_NAMES = '일월화수목금토';

// Date 객체를 'YYYY-MM-DD' 문자열로 바꿉니다. (예: 2026-10-29)
// 이 형식은 문자열끼리 크기 비교를 해도 날짜 순서와 같아서 편리합니다.
function toDateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

// 'YYYY-MM-DD' 문자열을 Date 객체로 바꿉니다.
function parseDateKey(key) {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

// '2026-10-29' → '2026년 10월 29일 (목)'
function formatDateLabel(key) {
  const d = parseDateKey(key);
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAY_NAMES[d.getDay()]})`;
}

// '2026-10-29' → '10월 29일 (목)' (올해가 아니면 앞에 연도도 붙여요)
function formatShortDate(key) {
  const d = parseDateKey(key);
  const yearPart = d.getFullYear() === new Date().getFullYear() ? '' : `${d.getFullYear()}년 `;
  return `${yearPart}${d.getMonth() + 1}월 ${d.getDate()}일 (${WEEKDAY_NAMES[d.getDay()]})`;
}

// 오늘 날짜 문자열
function getTodayKey() {
  return toDateKey(new Date());
}

// 오늘부터 그 날짜까지 며칠 남았는지 (지난 날짜면 음수)
// 시간은 무시하고 '날짜'만 비교하려고 둘 다 자정(0시) 기준으로 계산합니다.
function getDaysUntil(dateKey) {
  const now = new Date();
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const ONE_DAY = 24 * 60 * 60 * 1000;
  // Math.round: 서머타임이 있는 지역에서도 하루가 23/25시간이 되는 오차를 없애 줘요.
  return Math.round((parseDateKey(dateKey) - todayMidnight) / ONE_DAY);
}

// 남은 날 수 → 'D-5' / 'D-DAY' / 'D+3'
function formatDday(days) {
  if (days > 0) return `D-${days}`;
  if (days === 0) return 'D-DAY';
  return `D+${-days}`;
}

// ---------------------------------------------------------
// 2-1. 공휴일 찾기표 만들기
//    holidays.js의 HOLIDAYS에서 '올해 ± HOLIDAY_YEAR_RANGE년'만 골라
//    { '2026-10-03': ['개천절'], ... } 모양으로 바꿔 둡니다.
//    하루에 공휴일이 두 개일 수도 있어서(예: 추석 + 개천절) 이름을 배열로 모읍니다.
// ---------------------------------------------------------
function buildHolidayMap() {
  const map = {};
  const thisYear = new Date().getFullYear();

  for (let year = thisYear - HOLIDAY_YEAR_RANGE; year <= thisYear + HOLIDAY_YEAR_RANGE; year++) {
    const list = HOLIDAYS[year] || []; // 데이터가 없는 연도는 그냥 건너뜀
    list.forEach((holiday) => {
      if (!map[holiday.date]) map[holiday.date] = [];
      map[holiday.date].push(holiday.name);
    });
  }
  return map;
}

let holidayMap = buildHolidayMap();

// ---------------------------------------------------------
// 3. 일정 종류·과목 도우미
// ---------------------------------------------------------
const UNKNOWN_SUBJECT_COLOR = '#868e96'; // 과목 목록에 없는(삭제된) 과목의 색 (회색)

// 종류 id로 종류 정보 찾기 (못 찾으면 '기타'처럼 마지막 종류로 취급)
function getEventType(typeId) {
  return EVENT_TYPES.find((t) => t.id === typeId) || EVENT_TYPES[EVENT_TYPES.length - 1];
}

function getSubjectColor(subjectName) {
  const subject = subjects.find((s) => s.name === subjectName);
  return subject ? subject.color : UNKNOWN_SUBJECT_COLOR;
}

// 일정 하나의 표시 색: 과목을 쓰는 종류면 과목 색, 아니면 종류 색
function getEventColor(event) {
  const type = getEventType(event.type);
  return type.useSubject ? getSubjectColor(event.subject) : type.color;
}

// 그날의 정기고사 시험 목록: [{ period, subject, event }] (교시 순서)
// 같은 날 같은 교시에 둘 이상 적혀 있으면(겹치는 정기고사) 먼저인 일정만 줄에 놓고 hidden으로 세요.
function getExamBarsOn(dateKey) {
  const bars = [];
  let hidden = 0;
  getRangeEventsOn(dateKey).forEach((event) => {
    const slots = event.examSlots && event.examSlots[dateKey];
    if (!slots) return;
    Object.keys(slots).map(Number).sort((a, b) => a - b).forEach((period) => {
      if (bars.some((bar) => bar.period === period)) hidden++;
      else bars.push({ period, subject: slots[period], event });
    });
  });
  bars.sort((a, b) => a.period - b.period);
  return { bars, hidden };
}

// 그 일정(과 시험 시간표)에 들어 있는 과목 이름 바꾸기
function renameSubjectInEvent(event, oldName, newName) {
  if (event.subject === oldName) event.subject = newName;
  Object.values(event.examSlots || {}).forEach((slots) => {
    Object.keys(slots).forEach((period) => {
      if (slots[period] === oldName) slots[period] = newName;
    });
  });
}

// 기간 일정 도우미 (endDate가 있으면 기간 일정, date가 시작일이에요)
function isRangeEvent(event) {
  return Boolean(event.endDate);
}

function getEventEnd(event) {
  return event.endDate || event.date;
}

// 이 일정이 시간표로 날마다 교시를 찾는 일정인지 (수행평가의 기간·반복 일정)
function usesDailyPeriods(event) {
  return (isRangeEvent(event) || isRepeatEvent(event)) && Boolean(getEventType(event.type).useTimetable);
}

// ---------------------------------------------------------
// 반복 일정 도우미
//   반복 일정은 날짜마다 복사하지 않고 규칙(repeat) 하나로 저장해서, 화면에 그릴 때 펼쳐요.
//   repeat: { freq: 'weekly'|'monthly', weekdays: [1, 3], until, skipHolidays,
//             excludedDates: [...], dayOrders: { 날짜: 순서 } }
//   '이 일정만' 고친 날은 규칙에서 빼고(excludedDates) 보통 하루 일정으로 따로 만들어요.
//   그 하루 일정의 seriesId가 원래 반복 일정을 가리켜요.
// ---------------------------------------------------------
function isRepeatEvent(event) {
  return Boolean(event.repeat);
}

// 반복 일정이 그날 있는지
function occursOn(series, dateKey) {
  const { repeat } = series;
  if (dateKey < series.date || dateKey > repeat.until) return false;
  if ((repeat.excludedDates || []).includes(dateKey)) return false;
  if (repeat.skipHolidays && holidayMap[dateKey]) return false;
  const date = parseDateKey(dateKey);
  if (repeat.freq === 'weekly') return repeat.weekdays.includes(date.getDay());
  // 매월: 시작일과 같은 날짜 (그 날짜가 없는 달은 건너뛰어요)
  return date.getDate() === parseDateKey(series.date).getDate();
}

// 반복 일정의 모든 날짜
function getOccurrenceDates(series) {
  const dates = [];
  const date = parseDateKey(series.date);
  // 종료일을 아주 먼 미래로 잘못 입력해도 멈추지 않도록 최대 10년까지만 세요.
  for (let i = 0; i < 3660; i++) {
    const key = toDateKey(date);
    if (key > series.repeat.until) break;
    if (occursOn(series, key)) dates.push(key);
    date.setDate(date.getDate() + 1);
  }
  return dates;
}

// 그 날짜의 일정 하나로 펼치기 (id에 날짜를 붙이고, series로 원래 일정을 가리켜요)
function createOccurrence(series, dateKey) {
  const occurrence = { ...series, id: `${series.id}@${dateKey}`, date: dateKey, series };
  const order = (series.repeat.dayOrders || {})[dateKey];
  if (typeof order === 'number') occurrence.dayOrder = order;
  // 수행평가: 그날 시간표의 첫 교시 (동그라미 안 숫자와 정렬에 써요)
  if (getEventType(series.type).useTimetable) {
    const first = getTimetablePeriods(series.subject, dateKey)[0];
    if (first) occurrence.period = first;
  }
  return occurrence;
}

// '매주 월·수 · ~12월 31일', '매월 15일 · ~12월 31일'
function formatRepeatLabel(series) {
  const { repeat } = series;
  const rule = repeat.freq === 'weekly'
    ? `매주 ${[...repeat.weekdays].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map((d) => WEEKDAY_NAMES[d]).join('·')}`
    : `매월 ${parseDateKey(series.date).getDate()}일`;
  const until = parseDateKey(repeat.until);
  const yearPart = until.getFullYear() === new Date().getFullYear() ? '' : `${until.getFullYear()}년 `;
  return `${rule} · ~${yearPart}${until.getMonth() + 1}월 ${until.getDate()}일`;
}

// 하루 전 날짜 문자열
function getPreviousDayKey(dateKey) {
  const date = parseDateKey(dateKey);
  date.setDate(date.getDate() - 1);
  return toDateKey(date);
}

// 그날 시간표에서 그 과목의 교시들. 공휴일이거나 수업이 없으면 빈 목록이에요.
function getTimetablePeriods(subjectName, dateKey) {
  if (!subjectName || holidayMap[dateKey]) return [];
  const weekday = parseDateKey(dateKey).getDay();
  const periods = [];
  for (let period = 1; period <= (PERIODS_PER_WEEKDAY[weekday] || 0); period++) {
    const cell = timetable.cells[`${weekday}-${period}`];
    if (cell && cell.kind === 'subject' && cell.name === subjectName) periods.push(period);
  }
  return periods;
}

// 기간 글자: '11월 10일~13일', '11월 30일~12월 2일', 연도가 다르면 연도까지
function formatRangeLabel(startKey, endKey) {
  const s = parseDateKey(startKey);
  const e = parseDateKey(endKey);
  if (s.getFullYear() !== e.getFullYear()) {
    return `${s.getFullYear()}년 ${s.getMonth() + 1}월 ${s.getDate()}일~${e.getFullYear()}년 ${e.getMonth() + 1}월 ${e.getDate()}일`;
  }
  const yearPart = s.getFullYear() === new Date().getFullYear() ? '' : `${s.getFullYear()}년 `;
  const endPart = s.getMonth() === e.getMonth() ? `${e.getDate()}일` : `${e.getMonth() + 1}월 ${e.getDate()}일`;
  return `${yearPart}${s.getMonth() + 1}월 ${s.getDate()}일~${endPart}`;
}

// 그 종류·날짜에 고를 수 있는 교시 수 (교시를 쓰지 않거나, 수업 없는 요일이면 0)
//   시험: 요일 상관없이 3 / 수행평가: 월·수·금 7, 화·목 6, 토·일 0 (config.js)
function getPeriodCount(type, dateKey) {
  if (typeof type.periods === 'number') return type.periods;
  if (type.periods === 'weekday') return PERIODS_PER_WEEKDAY[parseDateKey(dateKey).getDay()] || 0;
  return 0;
}

// 하루 안에서 보여 줄 '기본' 순서
//   1) config.js의 종류 순서 (정기고사 → 모의고사 → 학교 행사 → 수행평가 → 기타)
//   2) 같은 종류끼리는 교시 순서 (교시를 안 정한 것은 맨 뒤)
//   3) 그래도 같으면 먼저 등록한 순서
function compareEvents(a, b) {
  const typeOrder = (ev) => EVENT_TYPES.findIndex((t) => t.id === ev.type);
  const periodOrder = (ev) => (typeof ev.period === 'number' ? ev.period : Infinity);
  return (
    typeOrder(a) - typeOrder(b) ||
    periodOrder(a) - periodOrder(b) ||
    (a.createdAt || 0) - (b.createdAt || 0)
  );
}

// 기간 일정끼리의 순서: 시작일이 빠른 순서 → 긴 순서 → 기본 순서
function compareRangeEvents(a, b) {
  return (
    a.date.localeCompare(b.date) ||
    getEventEnd(b).localeCompare(getEventEnd(a)) ||
    compareEvents(a, b)
  );
}

// 그날을 포함하는 기간 일정들
function getRangeEventsOn(dateKey) {
  return events
    .filter((ev) => isRangeEvent(ev) && ev.date <= dateKey && ev.endDate >= dateKey)
    .sort(compareRangeEvents);
}

// 특정 날짜의 일정 전체: 기간 일정이 항상 위, 그 아래에 하루 일정
function getEventsOn(dateKey) {
  return [...getRangeEventsOn(dateKey), ...getSingleEventsOn(dateKey)];
}

// 특정 날짜의 하루 일정 목록 (보여 줄 순서대로)
// - 날짜 창에서 끌어서 순서를 바꾼 일정에는 dayOrder(0, 1, 2...)가 붙어 있어 그 순서를 따라요.
// - 그 뒤에 새로 추가한 일정(dayOrder 없음)은, 기본 순서로 따져서 자기보다 먼저 와야 하는
//   일정들 중 '가장 아래에 있는 것' 바로 뒤에 끼워 넣어요.
//   (예: 2교시·5교시 수행평가 사이에 3교시 수행평가를 추가하면 그 둘 사이로)
function getSingleEventsOn(dateKey) {
  const dayEvents = [
    ...events.filter((ev) => !isRangeEvent(ev) && !isRepeatEvent(ev) && ev.date === dateKey),
    ...events.filter((ev) => isRepeatEvent(ev) && occursOn(ev, dateKey)).map((ev) => createOccurrence(ev, dateKey)),
  ];
  const ordered = dayEvents
    .filter((ev) => typeof ev.dayOrder === 'number')
    .sort((a, b) => a.dayOrder - b.dayOrder);
  const unordered = dayEvents.filter((ev) => typeof ev.dayOrder !== 'number').sort(compareEvents);

  unordered.forEach((ev) => {
    let index = 0;
    ordered.forEach((other, i) => {
      if (compareEvents(other, ev) <= 0) index = i + 1;
    });
    ordered.splice(index, 0, ev);
  });
  return ordered;
}

// 일정을 글로 표현 (삭제 확인 창, 마우스 올렸을 때 설명 등에 사용)
// 예: '수행평가 · 영어Ⅱ · 3교시 · 단어시험'
function describeEvent(event) {
  const type = getEventType(event.type);
  const parts = [type.label];
  if (type.useSubject && event.subject) parts.push(event.subject);
  if (isRangeEvent(event)) parts.push(formatRangeLabel(event.date, event.endDate));
  if (event.series && usesDailyPeriods(event)) {
    // 수행평가 반복: 그날 교시를 모두 적어요.
    const periods = getTimetablePeriods(event.subject, event.date).join('·');
    if (periods) parts.push(`${periods}교시`);
  } else if (event.period) {
    parts.push(`${event.period}교시`);
  }
  parts.push(event.title);
  return parts.join(' · ');
}

// 일정마다 겹치지 않는 id 만들기
function createId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// 색칠된 막대 위의 글자색 고르기
// 노란색처럼 밝은 바탕엔 검은 글자, 파란색처럼 어두운 바탕엔 흰 글자가 잘 보여요.
// (밝기를 계산해서 두 글자색 중 더 또렷하게 보이는 쪽을 고릅니다)
const BAR_TEXT_DARK = '#1f2937';
const BAR_TEXT_LIGHT = '#ffffff';

function getLuminance(hex) {
  const rgb = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const [r, g, b] = rgb.map((c) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function getBarTextColor(backgroundHex) {
  const bg = getLuminance(backgroundHex);
  const contrastWithWhite = 1.05 / (bg + 0.05);
  const contrastWithDark = (bg + 0.05) / (getLuminance(BAR_TEXT_DARK) + 0.05);
  return contrastWithWhite >= contrastWithDark ? BAR_TEXT_LIGHT : BAR_TEXT_DARK;
}

// 모양 표시(막대, ●, ○)를 만듭니다. 색은 CSS 변수 --event-color로 넘겨요.
// number를 주면 동그라미 안에 숫자(교시)를 넣어요. 숫자 색은 바탕색에 맞춰 흰색/진회색.
function createMarker(shape, color, number) {
  const marker = document.createElement('span');
  marker.className = `marker marker-${shape}`;
  marker.style.setProperty('--event-color', color);
  marker.setAttribute('aria-hidden', 'true');
  if (number) {
    marker.classList.add('marker-numbered');
    marker.textContent = number;
    marker.style.color = getBarTextColor(color);
  }
  return marker;
}

// 교시가 있는 수행평가처럼 '동그라미 안에 교시 숫자'를 넣는 일정이면 그 숫자, 아니면 null
function getMarkerNumber(event) {
  return getEventType(event.type).shape === 'circle' && event.period ? event.period : null;
}

// ---------------------------------------------------------
// 3-1. 끌어서 순서 바꾸기 (과목 목록, 하루 일정 목록에서 함께 사용)
//    목록의 각 줄(li)에 data-key(이름표)와 손잡이(⋮⋮ 버튼)를 붙여 두면,
//    손잡이를 누른 채 위아래로 끌어서 순서를 바꿀 수 있어요.
//    마우스·손가락(터치) 모두 되고, 손잡이에서 키보드 ↑ ↓ 로도 옮길 수 있어요.
// ---------------------------------------------------------
const GRIP_ICON =
  '<svg viewBox="0 0 12 16" aria-hidden="true">' +
  '<circle cx="3" cy="3" r="1.5"/><circle cx="9" cy="3" r="1.5"/>' +
  '<circle cx="3" cy="8" r="1.5"/><circle cx="9" cy="8" r="1.5"/>' +
  '<circle cx="3" cy="13" r="1.5"/><circle cx="9" cy="13" r="1.5"/></svg>';

let dragJustEnded = false; // 끌기를 막 끝낸 순간의 클릭이 '창 닫기'로 오해되지 않도록

function createDragHandle(label) {
  const handle = document.createElement('button');
  handle.type = 'button';
  handle.className = 'drag-handle';
  handle.innerHTML = GRIP_ICON;
  handle.setAttribute('aria-label', `${label} 순서 바꾸기 (위아래 화살표 키)`);
  handle.title = '끌어서 순서 바꾸기';
  return handle;
}

function getListOrder(list) {
  return [...list.children].map((li) => li.dataset.key);
}

// 움직이는 연출 시간 (운영체제에서 '애니메이션 줄이기'를 켰으면 0 = 연출 없음)
const reduceMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
function getMotionMs() {
  return reduceMotionQuery.matches ? 0 : 200;
}

// 다른 줄들이 자리를 비켜 줄 때 '툭' 하고 바뀌지 않고 부드럽게 미끄러지게 하는 연출
// (줄 순서를 바꾸기 전 위치를 기억해 두었다가, 바꾼 뒤 원래 위치에서 새 위치로 움직여 보여 줘요)
function animateSiblings(items, beforeTops) {
  const ms = getMotionMs();
  items.forEach((li) => {
    const delta = beforeTops.get(li) - li.offsetTop;
    if (!delta || !ms) return;
    // 원래 자리(delta만큼 떨어진 곳)에서 시작해 새 자리(0)로 미끄러지는 애니메이션
    li.animate(
      [{ transform: `translateY(${delta}px)` }, { transform: 'translateY(0)' }],
      { duration: ms, easing: 'ease' }
    );
  });
}

// list: 순서를 바꿀 목록(ul), onChange: 순서가 바뀌면 새 이름표 배열을 받아 저장하는 함수
function makeSortable(list, onChange) {
  list.addEventListener('pointerdown', (e) => {
    const handle = e.target.closest('.drag-handle');
    if (!handle || e.button !== 0) return; // 왼쪽 버튼(또는 손가락)만
    e.preventDefault();

    const item = handle.closest('li');
    const startOrder = getListOrder(list).join('\n');

    // 잡은 순간의 위치를 기억해 둬요.
    //   grabOffset: 줄의 윗변에서 손가락까지 거리 (줄이 손가락을 그대로 따라오게)
    //   startTop/startOffsetTop: 화면 기준 위치와 목록 안 위치 (줄이 다른 자리로 옮겨 가도 계산하려고)
    const startTop = item.getBoundingClientRect().top;
    const startOffsetTop = item.offsetTop;
    const grabOffset = e.clientY - startTop;
    let pointerY = e.clientY;

    // 들어올리기: 살짝 커지고 그림자가 생겨요 (CSS의 li.dragging)
    item.classList.add('dragging');
    document.body.classList.add('is-dragging');

    // 잡은 줄을 손가락 위치에 맞춰 위아래로 옮겨 그려요.
    const followPointer = () => {
      const layoutTop = startTop + (item.offsetTop - startOffsetTop); // 지금 자리(줄 순서 기준)의 화면 위치
      item.style.translate = `0 ${pointerY - grabOffset - layoutTop}px`;
    };

    // 잡은 줄의 가장자리가 다른 줄의 가운데를 넘어가면 그 줄과 자리를 바꿔요.
    //   아래로 끌 때: 잡은 줄의 아랫변이 아래 줄의 가운데를 넘으면
    //   위로 끌 때: 잡은 줄의 윗변이 위 줄의 가운데를 넘으면
    const onMove = (ev) => {
      pointerY = ev.clientY;
      const all = [...list.children];
      const myIndex = all.indexOf(item);
      const others = all.filter((li) => li !== item);
      const draggedTop = startOffsetTop + (pointerY - grabOffset - startTop); // 목록 안 기준 위치
      const draggedBottom = draggedTop + item.offsetHeight;

      // 잡은 줄보다 위에 있어야 할 줄이 몇 개인지 세요.
      const aboveCount = others.filter((li) => {
        const middle = li.offsetTop + li.offsetHeight / 2;
        const isAboveNow = all.indexOf(li) < myIndex;
        return isAboveNow ? draggedTop > middle : draggedBottom > middle;
      }).length;
      const next = others[aboveCount]; // 이 줄 바로 앞에 들어가요 (없으면 맨 끝)
      const needsMove = next ? item.nextElementSibling !== next : list.lastElementChild !== item;

      if (needsMove) {
        const beforeTops = new Map(others.map((li) => [li, li.offsetTop]));
        if (next) list.insertBefore(item, next);
        else list.appendChild(item);
        animateSiblings(others, beforeTops);
      }
      followPointer();
    };

    const onEnd = () => {
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onEnd);
      document.removeEventListener('pointercancel', onEnd);
      document.body.classList.remove('is-dragging');
      dragJustEnded = true;
      setTimeout(() => (dragJustEnded = false), 0);

      // 내려놓기: 손가락 위치에서 정해진 자리로 부드럽게 내려앉아요.
      const ms = getMotionMs();
      const from = item.style.translate || '0 0';
      item.style.translate = '';
      item.classList.remove('dragging'); // 커진 크기·그림자도 CSS 전환으로 부드럽게 원래대로
      if (ms) item.animate([{ translate: from }, { translate: '0 0' }], { duration: ms, easing: 'ease' });

      // 내려앉는 연출이 끝난 뒤에 저장하고 목록을 다시 그려요. (먼저 그리면 연출이 끊겨요)
      const order = getListOrder(list);
      setTimeout(() => {
        if (order.join('\n') !== startOrder) onChange(order);
      }, ms);
    };

    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onEnd);
    document.addEventListener('pointercancel', onEnd);
  });

  // 키보드: 손잡이에 초점이 있을 때 ↑ ↓ 로 한 칸씩 옮기기
  list.addEventListener('keydown', (e) => {
    const handle = e.target.closest('.drag-handle');
    if (!handle || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    e.preventDefault();
    const item = handle.closest('li');
    const sibling = e.key === 'ArrowUp' ? item.previousElementSibling : item.nextElementSibling;
    if (!sibling) return;
    if (e.key === 'ArrowUp') list.insertBefore(item, sibling);
    else list.insertBefore(sibling, item);

    const key = item.dataset.key;
    onChange(getListOrder(list)); // 저장하면서 목록이 새로 그려져요
    // 새로 그려진 목록에서 같은 줄의 손잡이에 다시 초점을 맞춰 계속 옮길 수 있게
    const again = [...list.children].find((li) => li.dataset.key === key);
    if (again) again.querySelector('.drag-handle').focus();
  });
}

// ---------------------------------------------------------
// 4. 화면 상태
//    지금 달력에 보이는 연도와 달을 기억합니다.
//    month는 자바스크립트 규칙대로 0 = 1월, 11 = 12월입니다.
// ---------------------------------------------------------
const today = new Date();
const state = {
  year: today.getFullYear(),
  month: today.getMonth(),
};

let events = loadEvents(); // 모든 일정
let subjects = loadSubjects(); // 과목 목록 (범례에 보이는 순서 그대로)
let timetable = loadTimetable(); // 시간표
let timetableEditing = false; // 시간표 수정 모드인지 (수정 모드에서만 칸을 바꿀 수 있어요)
let pickerCellKey = null; // 작은 선택 창이 열려 있는 시간표 칸 ('요일번호-교시')
// 새 일정 창에서 사용자가 직접 건드린 칸 (직접 고른 값은 자동 선택으로 덮어쓰지 않아요)
const formTouched = { subject: false, period: false, type: false };
// 일정 창에서 적는 중인 시험 시간표: { 날짜: { 교시: 과목 } } (저장할 때 일정에 넣어요)
let formExamSlots = {};
let renderedTodayKey = ''; // 마지막으로 달력을 그린 날 (자정이 지나면 다시 그리기 위해 기억)
let openDayKey = null; // 일정 목록 창에 보이는 날짜
let editingId = null; // 수정 중인 일정의 id (새 일정이면 null)
let editingSubjectName = null; // 수정 중인 과목 이름 (새 과목이면 null)
// 하루 일정 창에서 펼쳐 둔 메모의 일정 id (창을 닫으면 다시 모두 접혀요)
const expandedMemoIds = new Set();
// 되돌릴 수 있는 가장 최근 삭제: { entries: [{ event: 삭제 직전 일정의 복사본, index: 목록에서의 자리 }], timer }
let pendingUndo = null;
// 일정 창의 수정 범위: null(보통), 'single'(이 일정만), 'from'(이 일정과 이후), 'all'(전체)
let formScope = null;
let formOccurrence = null; // 범위를 고른 반복 일정의 그 날짜 일정
let scopeChoiceHandler = null; // 범위 창에서 고르면 실행할 일
// 되돌리기 알림이 내려가는 중일 때의 애니메이션과 타이머 (그사이 또 삭제하면 취소하려고 기억해요)
let undoToastExit = null;

// 날짜 칸 하나에 보여 줄 최대 줄 수 (넘치면 마지막 줄을 '+N개'로 표시)
const MAX_EVENTS_PER_CELL = 3;

// 자주 쓰는 화면 요소를 미리 찾아 둡니다.
const els = {
  grid: document.getElementById('calendarGrid'),
  yearInput: document.getElementById('yearInput'),
  monthInput: document.getElementById('monthInput'),
  prev: document.getElementById('prevMonth'),
  next: document.getElementById('nextMonth'),
  today: document.getElementById('todayBtn'),
  theme: document.getElementById('themeToggle'),
  now: document.getElementById('now'),
  todayDate: document.getElementById('todayDate'),
  clock: document.getElementById('clock'),
  clockHM: document.getElementById('clockHM'),
  clockSec: document.getElementById('clockSec'),
  ddayList: document.getElementById('ddayList'),
  ddayEmpty: document.getElementById('ddayEmpty'),
  ddaySort: document.getElementById('ddaySort'),
  exportBtn: document.getElementById('exportBtn'),
  importBtn: document.getElementById('importBtn'),
  importFile: document.getElementById('importFile'),
  legendTypes: document.getElementById('legendTypes'),
  legendSubjects: document.getElementById('legendSubjects'),
  subjectEmpty: document.getElementById('subjectEmpty'),
  addSubject: document.getElementById('addSubjectBtn'),
  // 시간표
  timetablePanel: document.getElementById('timetablePanel'),
  timetableTable: document.getElementById('timetableTable'),
  timetableEmpty: document.getElementById('timetableEmpty'),
  timetableHint: document.getElementById('timetableHint'),
  timetableEdit: document.getElementById('timetableEdit'),
  timetableClear: document.getElementById('timetableClear'),
  timetableRegister: document.getElementById('timetableRegister'),
  // 시간표 칸의 작은 선택 창
  ttPicker: document.getElementById('ttPicker'),
  ttPickerTitle: document.getElementById('ttPickerTitle'),
  ttPickerList: document.getElementById('ttPickerList'),
  ttPickerAddToggle: document.getElementById('ttPickerAddToggle'),
  ttPickerAddForm: document.getElementById('ttPickerAddForm'),
  ttPickerAddName: document.getElementById('ttPickerAddName'),
  ttPickerError: document.getElementById('ttPickerError'),
  ttPickerClear: document.getElementById('ttPickerClear'),
  // 과목 추가/수정 창
  subjectDialog: document.getElementById('subjectDialog'),
  subjectForm: document.getElementById('subjectForm'),
  subjectDialogTitle: document.getElementById('subjectDialogTitle'),
  subjectName: document.getElementById('subjectName'),
  subjectColor: document.getElementById('subjectColor'),
  subjectColorOptions: document.getElementById('subjectColorOptions'),
  subjectError: document.getElementById('subjectError'),
  subjectDelete: document.getElementById('subjectDelete'),
  subjectCancel: document.getElementById('subjectCancel'),
  // 일정 목록 창
  dayDialog: document.getElementById('dayDialog'),
  dayTitle: document.getElementById('dayDialogTitle'),
  dayHoliday: document.getElementById('dayDialogHoliday'),
  dayClose: document.getElementById('dayDialogClose'),
  dayPrev: document.getElementById('dayPrev'),
  dayNext: document.getElementById('dayNext'),
  dayRangeList: document.getElementById('dayRangeList'),
  dayList: document.getElementById('dayEventList'),
  dayEmpty: document.getElementById('dayEmpty'),
  addEvent: document.getElementById('addEventBtn'),
  // 일정 추가/수정 창
  eventDialog: document.getElementById('eventDialog'),
  eventForm: document.getElementById('eventForm'),
  eventDialogTitle: document.getElementById('eventDialogTitle'),
  formDate: document.getElementById('eventDate'),
  formDateLabel: document.getElementById('eventDateLabel'),
  formRangeToggle: document.getElementById('eventRangeToggle'),
  formEndField: document.getElementById('eventEndField'),
  formEndDate: document.getElementById('eventEndDate'),
  formPeriodNote: document.getElementById('eventPeriodNote'),
  formRangeField: document.getElementById('eventRangeField'),
  repeatField: document.getElementById('repeatField'),
  repeatFreq: document.getElementById('repeatFreq'),
  repeatWeekdays: document.getElementById('repeatWeekdays'),
  repeatUntilField: document.getElementById('repeatUntilField'),
  repeatUntil: document.getElementById('repeatUntil'),
  repeatSkipField: document.getElementById('repeatSkipField'),
  repeatSkip: document.getElementById('repeatSkipHolidays'),
  scopeDialog: document.getElementById('scopeDialog'),
  scopeTitle: document.getElementById('scopeDialogTitle'),
  examScheduleField: document.getElementById('examScheduleField'),
  examScheduleRows: document.getElementById('examScheduleRows'),
  formTypeOptions: document.getElementById('eventTypeOptions'),
  formSubjectField: document.getElementById('subjectField'),
  formSubject: document.getElementById('eventSubject'),
  formPeriodField: document.getElementById('periodField'),
  formPeriod: document.getElementById('eventPeriod'),
  formTitle: document.getElementById('eventTitle'),
  formMemo: document.getElementById('eventMemo'),
  formError: document.getElementById('formError'),
  formCancel: document.getElementById('eventCancel'),
  // 삭제 되돌리기 알림
  undoToast: document.getElementById('undoToast'),
  undoBtn: document.getElementById('undoBtn'),
};

// ---------------------------------------------------------
// 5. 달력 그리기
// ---------------------------------------------------------

// 메모가 있는 일정에 붙는 작은 연필 아이콘 (색은 글자색을 따라감)
const MEMO_ICON =
  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20h9"/>' +
  '<path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';

// 달력 칸 안에 들어갈 일정 한 줄을 만듭니다.
//   모의고사·학교 행사: 색칠된 막대 안에 내용
//   수행평가: [과목 색 동그라미] 내용 (공간을 아끼려고 과목 이름은 빼요) / 기타: [모양] 내용
//   메모가 있으면 오른쪽 끝에 작은 연필 아이콘 (메모 내용은 달력에 보여 주지 않아요)
function createEventChip(event) {
  const type = getEventType(event.type);
  const color = getEventColor(event);

  const chip = document.createElement('div');
  chip.className = `event-chip shape-${type.shape}`;
  chip.style.setProperty('--event-color', color);
  chip.title = describeEvent(event);

  if (type.shape === 'bar') {
    chip.style.color = getBarTextColor(color);
  } else {
    // 교시가 있는 수행평가: 과목 색 동그라미 안에 교시 숫자 (예: ⑤ 문학 발표)
    chip.appendChild(createMarker(type.shape, color, getMarkerNumber(event)));
  }

  chip.appendChild(createEventText(event));
  if (event.memo) chip.appendChild(createMemoIcon());
  return chip;
}

// 일정 이름 글자: 과목 내용 (과목을 숨기는 종류는 내용만)
function createEventText(event) {
  const type = getEventType(event.type);
  const text = document.createElement('span');
  text.className = 'event-text';
  if (type.useSubject && event.subject && !type.hideSubjectInCalendar) {
    const subject = document.createElement('b');
    subject.textContent = event.subject;
    text.append(subject, ' ', event.title);
  } else {
    text.append(event.title);
  }
  return text;
}

function createPeriodBox(label) {
  const box = document.createElement('span');
  box.className = 'bar-period';
  box.textContent = label;
  return box;
}

function createMemoIcon() {
  const icon = document.createElement('span');
  icon.className = 'event-memo-icon';
  icon.innerHTML = MEMO_ICON;
  return icon;
}

// 정기고사 시험 막대: 과목 색으로 진하게 칠하고 과목 이름만 적어요. (줄 위치가 곧 교시예요)
function createExamBar(bar) {
  const color = getSubjectColor(bar.subject);
  const element = document.createElement('div');
  element.className = 'event-chip exam-bar';
  element.style.setProperty('--event-color', color);
  element.style.color = getBarTextColor(color);
  element.title = `${bar.event.title} · ${bar.period}교시 · ${bar.subject}`;
  const text = document.createElement('span');
  text.className = 'event-text';
  text.textContent = bar.subject;
  element.appendChild(text);
  return element;
}

// 일정 모양에 따른 띠 모양: 막대는 진하게 칠한 띠, 원은 연하게 칠한 띠, 테두리 원은 테두리 띠
const BAND_STYLES = { bar: 'solid', square: 'solid', circle: 'soft', ring: 'outline' };

// 기간 일정의 띠 한 조각 만들기 (fromCol~toCol: 이 주에서 차지하는 칸 번호 0~6)
//   실제 시작일·종료일 쪽만 모서리가 둥글고, 주가 바뀌어 끊긴 쪽은 각져 있어요.
function createBand(event, weekKeys, fromCol, toCol) {
  const color = getEventColor(event);
  const style = BAND_STYLES[getEventType(event.type).shape] || 'solid';

  const band = document.createElement('div');
  band.className = `event-chip band band-${style}`;
  band.style.setProperty('--event-color', color);
  band.title = describeEvent(event);
  if (weekKeys[fromCol] === event.date) band.classList.add('round-start');
  if (weekKeys[toCol] === event.endDate) band.classList.add('round-end');
  if (style === 'solid') band.style.color = getBarTextColor(color);

  if (usesDailyPeriods(event)) {
    // 수행평가: 첫 칸에 이름 [교시], 나머지 칸에는 그날 [교시]만
    band.classList.add('band-daily');
    band.style.gridTemplateColumns = `repeat(${toCol - fromCol + 1}, minmax(0, 1fr))`;
    for (let col = fromCol; col <= toCol; col++) {
      const periods = getTimetablePeriods(event.subject, weekKeys[col]).join('·');
      const slot = document.createElement('span');
      slot.className = 'band-slot';
      if (col === fromCol) {
        slot.classList.add('band-slot-first');
        const name = document.createElement('span');
        name.className = 'event-text';
        name.textContent = event.title;
        slot.append(name);
      }
      if (periods) slot.append(createPeriodBox(periods));
      band.appendChild(slot);
    }
  } else {
    band.appendChild(createEventText(event));
  }
  if (event.memo) band.appendChild(createMemoIcon());
  return band;
}

// 달력 한 주의 일정 자리를 정해서 주(week) 칸에 넣어요.
//   - 기간 일정을 먼저 윗줄부터 놓아요. 주 안에서는 같은 줄을 유지해요.
//   - 하루 일정은 그날 비어 있는 줄을 위에서부터 채워요.
//   - 그날 일정이 3개를 넘으면 셋째 줄은 '+N개'이고, 그 줄을 지나던 띠는 그날만 끊겨요.
//   - 정기고사 시험이 적힌 날은 세 줄이 시험 전용이에요. (1교시 = 첫째 줄 …)
//     시험이 없는 교시 줄은 비워 두고, 다른 일정은 모두 날짜 숫자 옆 '+N개'로 묶어요.
function placeWeekEvents(week, weekKeys, todayKey) {
  const first = weekKeys[0];
  const last = weekKeys[6];
  const bands = events
    .filter((ev) => isRangeEvent(ev) && ev.date <= last && ev.endDate >= first)
    .sort(compareRangeEvents)
    .map((event) => ({
      event,
      fromCol: event.date < first ? 0 : weekKeys.indexOf(event.date),
      toCol: event.endDate > last ? 6 : weekKeys.indexOf(event.endDate),
      lane: 0,
    }));

  // 기간 일정의 줄 정하기: 겹치지 않는 가장 위쪽 줄
  const laneUsed = []; // laneUsed[줄][칸] = true
  bands.forEach((band) => {
    let lane = 0;
    const isFree = (l) => {
      for (let col = band.fromCol; col <= band.toCol; col++) {
        if (laneUsed[l] && laneUsed[l][col]) return false;
      }
      return true;
    };
    while (!isFree(lane)) lane++;
    if (!laneUsed[lane]) laneUsed[lane] = [];
    for (let col = band.fromCol; col <= band.toCol; col++) laneUsed[lane][col] = true;
    band.lane = lane;
  });

  const place = (element, col, span, lane) => {
    element.classList.add('week-item');
    element.setAttribute('aria-hidden', 'true'); // 내용은 날짜 칸의 설명에 들어 있어요
    element.style.gridColumn = `${col + 1} / span ${span}`;
    element.style.gridRow = String(lane + 2); // 1번 줄은 날짜 숫자 자리
    week.appendChild(element);
  };

  // 날마다 몇 줄까지 쓸 수 있는지 정하고 하루 일정을 놓아요.
  const dayCells = week.querySelectorAll('.day');
  const dayLimits = weekKeys.map((key, col) => {
    const bandsHere = bands.filter((b) => b.fromCol <= col && col <= b.toCol);
    const singles = getSingleEventsOn(key);
    const total = bandsHere.length + singles.length;

    // 정기고사 시험이 적힌 날: 띠와 하루 일정은 줄에 놓지 않아요. (limit 0)
    const { bars, hidden } = getExamBarsOn(key);
    if (bars.length > 0) {
      const isDim = key < todayKey || parseDateKey(key).getMonth() !== state.month;
      const lastPeriod = bars[bars.length - 1].period;
      for (let period = 1; period <= lastPeriod; period++) {
        const bar = bars.find((b) => b.period === period);
        let element;
        if (bar) {
          element = createExamBar(bar);
          if (isDim) element.classList.add('dim');
        } else {
          // 시험이 없는 교시: 줄 높이만 차지하는 빈 자리 (그래야 3교시가 셋째 줄에 있어요)
          element = document.createElement('div');
          element.className = 'event-chip exam-gap';
          element.textContent = ' ';
        }
        place(element, col, 1, period - 1);
      }
      // 시험이 적힌 정기고사 일정 자체는 막대로 보이니 '+N개'에서 빼요.
      const others = hidden + singles.length + bandsHere.filter((b) => !b.event.examSlots || !b.event.examSlots[key]).length;
      if (others > 0) {
        const more = document.createElement('span');
        more.className = 'more-events';
        more.textContent = `+${others}개`;
        dayCells[col].querySelector('.day-top').appendChild(more);
      }
      return 0;
    }

    const overflow = total > MAX_EVENTS_PER_CELL || bandsHere.some((b) => b.lane >= MAX_EVENTS_PER_CELL);
    const limit = overflow ? MAX_EVENTS_PER_CELL - 1 : MAX_EVENTS_PER_CELL;

    const usedLanes = bandsHere.map((b) => b.lane).filter((lane) => lane < limit);
    let shown = usedLanes.length;
    let lane = 0;
    singles.forEach((ev) => {
      while (usedLanes.includes(lane)) lane++;
      if (lane >= limit) return;
      const chip = createEventChip(ev);
      if (key < todayKey || parseDateKey(key).getMonth() !== state.month) chip.classList.add('dim');
      place(chip, col, 1, lane);
      usedLanes.push(lane);
      shown++;
    });

    if (overflow) {
      const more = document.createElement('div');
      more.className = 'more-events';
      more.textContent = `+${total - shown}개`;
      place(more, col, 1, MAX_EVENTS_PER_CELL - 1);
    }
    return limit;
  });

  // 띠 그리기: '+N개' 때문에 쓸 수 없는 날에서 조각을 나눠요.
  bands.forEach((band) => {
    let runStart = null;
    for (let col = band.fromCol; col <= band.toCol + 1; col++) {
      const visible = col <= band.toCol && band.lane < dayLimits[col];
      if (visible && runStart === null) runStart = col;
      if (!visible && runStart !== null) {
        const element = createBand(band.event, weekKeys, runStart, col - 1);
        if (band.event.endDate < todayKey) element.classList.add('dim'); // 기간이 다 끝난 일정만 흐리게
        place(element, runStart, col - runStart, band.lane);
        runStart = null;
      }
    }
  });
}

function renderCalendar() {
  const { year, month } = state;
  const todayKey = getTodayKey();
  renderedTodayKey = todayKey;

  // 연도·월 입력칸에 지금 보고 있는 달을 넣어 둡니다. (화면에는 사람 기준 1~12월)
  els.yearInput.value = year;
  els.monthInput.value = month + 1;

  // 이번 달 1일이 무슨 요일인지 (0 = 일요일 ... 6 = 토요일)
  const firstWeekday = new Date(year, month, 1).getDay();
  // 이번 달의 마지막 날짜 (다음 달 0일 = 이번 달 마지막 날)
  const lastDate = new Date(year, month + 1, 0).getDate();
  // 필요한 주(줄) 수만큼만 칸을 만듭니다. (4~6주)
  const totalCells = Math.ceil((firstWeekday + lastDate) / 7) * 7;

  // 칸을 하나씩 만든 뒤 한 번에 화면에 넣어야 빠릅니다.
  const fragment = document.createDocumentFragment();
  let week = null; // 지금 채우는 주
  let weekKeys = []; // 그 주의 날짜들

  for (let i = 0; i < totalCells; i++) {
    // 첫 칸은 1일보다 firstWeekday만큼 앞선 날짜(지난달 날짜)부터 시작합니다.
    // new Date는 0일, -1일, 32일 같은 값도 알아서 앞뒤 달로 넘겨 줍니다.
    const date = new Date(year, month, 1 - firstWeekday + i);
    const key = toDateKey(date);
    const weekday = date.getDay();
    const holidayNames = holidayMap[key]; // 공휴일이 아니면 undefined
    const dayEvents = getEventsOn(key);

    // 일요일마다 새로운 주를 시작해요. 일정 띠가 칸을 넘어 이어지도록 주 단위로 묶어요.
    if (weekday === 0) {
      week = document.createElement('div');
      week.className = 'week';
      weekKeys = [];
      fragment.appendChild(week);
    }
    weekKeys.push(key);

    const cell = document.createElement('div');
    cell.className = 'day';
    cell.dataset.date = key;
    cell.style.gridColumn = String(weekday + 1);
    // 키보드(Tab → Enter)로도 날짜를 누를 수 있게
    cell.tabIndex = 0;
    cell.setAttribute('role', 'button');

    if (weekday === 0) cell.classList.add('sun');
    if (weekday === 6) cell.classList.add('sat');
    if (holidayNames) cell.classList.add('holiday'); // 공휴일은 일요일처럼 빨간색
    if (date.getMonth() !== month) cell.classList.add('other-month');
    if (key < todayKey) cell.classList.add('past');
    if (key === todayKey) cell.classList.add('today');

    // 칸 맨 윗줄: [날짜 숫자] [공휴일 이름]
    const top = document.createElement('div');
    top.className = 'day-top';

    const number = document.createElement('span');
    number.className = 'day-number';
    number.textContent = date.getDate();
    top.appendChild(number);

    // 공휴일 이름은 날짜 오른쪽에 작게 (두 개면 "추석 · 개천절"처럼 이어서 표시)
    if (holidayNames) {
      const holidayText = holidayNames.join(' · ');
      const name = document.createElement('span');
      name.className = 'holiday-name';
      name.textContent = holidayText;
      name.title = holidayText; // 칸이 좁아 잘려도 마우스를 올리면 전체 이름이 보여요
      top.appendChild(name);
    }
    cell.appendChild(top);

    // 화면 읽기 프로그램을 위한 설명 (예: "10월 29일 목요일, 오늘, 일정 2개")
    let label = `${date.getMonth() + 1}월 ${date.getDate()}일 ${WEEKDAY_NAMES[weekday]}요일`;
    if (holidayNames) label += `, ${holidayNames.join(', ')}`;
    if (key === todayKey) label += ', 오늘';
    if (dayEvents.length > 0) label += `, 일정 ${dayEvents.length}개`;
    const examBars = getExamBarsOn(key).bars;
    if (examBars.length > 0) label += `, 시험 ${examBars.map((b) => `${b.period}교시 ${b.subject}`).join(', ')}`;
    cell.setAttribute('aria-label', label);

    week.appendChild(cell);
    // 토요일까지 칸을 다 만들면 그 주의 일정을 놓아요.
    if (weekday === 6) placeWeekEvents(week, weekKeys, todayKey);
  }

  els.grid.replaceChildren(fragment);
}

// ---------------------------------------------------------
// 5-1. 달력에서 끌어서 기간 고르기
//    컴퓨터: 날짜를 누른 채 끌면 지나간 날짜가 칠해지고, 놓으면 일정 추가 창이 떠요.
//    휴대폰: 끌면 화면이 스크롤되니, 약 0.4초 길게 누른 뒤에 끌어요.
//    움직이지 않고 누르면 지금처럼 하루 일정 창이 열려요. Esc를 누르면 취소돼요.
// ---------------------------------------------------------
const LONG_PRESS_MS = 400;
const LONG_PRESS_MOVE_LIMIT = 10; // 길게 누르는 중 이만큼 움직이면 스크롤로 보고 취소 (px)
let rangeDrag = null; // 끌기 상태: { startKey, endKey, active, isTouch, startX, startY, timer }
let rangeDragJustEnded = false; // 끌기를 끝낸 순간의 클릭이 '날짜 누르기'로 오해되지 않도록

// 화면의 한 점에 있는 날짜 칸 찾기 (일정 띠 위를 눌러도 그 아래 날짜를 찾아요)
function getDayCellAt(x, y) {
  const element = document.elementFromPoint(x, y);
  const week = element && element.closest('.week');
  if (!week) return null;
  const rect = week.getBoundingClientRect();
  const col = Math.max(0, Math.min(6, Math.floor(((x - rect.left) / rect.width) * 7)));
  return week.querySelectorAll('.day')[col];
}

// 고른 범위의 칸을 칠해요. (거꾸로 끌어도 되도록 앞뒤를 맞춰요)
function paintRangeDrag() {
  const start = rangeDrag.startKey < rangeDrag.endKey ? rangeDrag.startKey : rangeDrag.endKey;
  const end = rangeDrag.startKey < rangeDrag.endKey ? rangeDrag.endKey : rangeDrag.startKey;
  els.grid.querySelectorAll('.day').forEach((cell) => {
    const key = cell.dataset.date;
    cell.classList.toggle('selecting', rangeDrag.active && start <= key && key <= end);
  });
}

function handleRangeDragStart(e) {
  if (e.button !== 0) return;
  const cell = getDayCellAt(e.clientX, e.clientY);
  if (!cell) return;
  rangeDrag = {
    startKey: cell.dataset.date,
    endKey: cell.dataset.date,
    active: false,
    isTouch: e.pointerType === 'touch',
    startX: e.clientX,
    startY: e.clientY,
    timer: null,
  };
  if (rangeDrag.isTouch) {
    rangeDrag.timer = setTimeout(() => {
      rangeDrag.active = true;
      paintRangeDrag();
    }, LONG_PRESS_MS);
  }
  document.addEventListener('pointermove', handleRangeDragMove);
  document.addEventListener('pointerup', handleRangeDragEnd);
  document.addEventListener('pointercancel', cancelRangeDrag);
  document.addEventListener('keydown', handleRangeDragKey);
}

function handleRangeDragMove(e) {
  // 휴대폰에서 길게 누르기 전에 움직이면 스크롤하려는 것이니 끌기를 취소해요.
  if (rangeDrag.isTouch && !rangeDrag.active) {
    const moved = Math.hypot(e.clientX - rangeDrag.startX, e.clientY - rangeDrag.startY);
    if (moved > LONG_PRESS_MOVE_LIMIT) cancelRangeDrag();
    return;
  }
  const cell = getDayCellAt(e.clientX, e.clientY);
  if (!cell) return;
  rangeDrag.endKey = cell.dataset.date;
  if (rangeDrag.endKey !== rangeDrag.startKey) rangeDrag.active = true;
  if (rangeDrag.active) paintRangeDrag();
}

function stopRangeDrag() {
  clearTimeout(rangeDrag.timer);
  const finished = rangeDrag;
  rangeDrag.active = false;
  paintRangeDrag();
  rangeDrag = null;
  document.removeEventListener('pointermove', handleRangeDragMove);
  document.removeEventListener('pointerup', handleRangeDragEnd);
  document.removeEventListener('pointercancel', cancelRangeDrag);
  document.removeEventListener('keydown', handleRangeDragKey);
  return finished;
}

function cancelRangeDrag() {
  stopRangeDrag();
}

function handleRangeDragKey(e) {
  if (e.key === 'Escape') {
    const wasActive = rangeDrag.active;
    stopRangeDrag();
    if (wasActive) suppressNextDayClick();
  }
}

// 끌기를 끝낸 뒤 바로 따라오는 클릭은 무시해요.
function suppressNextDayClick() {
  rangeDragJustEnded = true;
  setTimeout(() => (rangeDragJustEnded = false), 0);
}

function handleRangeDragEnd() {
  const wasActive = rangeDrag.active;
  const { startKey, endKey } = stopRangeDrag();
  if (!wasActive) return; // 그냥 누른 것: 클릭으로 처리돼서 하루 일정 창이 열려요
  suppressNextDayClick();
  if (startKey === endKey) return; // 제자리로 돌아왔거나 길게 누르기만 하면 아무것도 하지 않아요
  const start = startKey < endKey ? startKey : endKey;
  const end = startKey < endKey ? endKey : startKey;
  openEventForm(null, { start, end });
}

// ---------------------------------------------------------
// 6. 범례 그리기 (일정 종류는 config.js, 과목은 저장된 과목 목록으로 자동 생성)
// ---------------------------------------------------------
function renderLegend() {
  // 일정 종류: 모양 + 이름
  els.legendTypes.replaceChildren(
    ...EVENT_TYPES.map((type) => {
      const li = document.createElement('li');
      // 과목 색을 쓰는 종류는 과목마다 색이 달라서 범례에서는 회색으로 모양만 보여 줍니다.
      const color = type.useSubject ? 'var(--text-muted)' : type.color;
      const label = document.createElement('span');
      label.textContent = type.label;
      li.append(createMarker(type.shape, color), label);
      return li;
    })
  );

  // 과목: [⋮⋮ 손잡이] [큰 동그라미(과목 색)] [과목 이름] [수정]
  els.subjectEmpty.hidden = subjects.length > 0;
  els.legendSubjects.replaceChildren(
    ...subjects.map((subject) => {
      const li = document.createElement('li');
      li.className = 'subject-row';
      li.dataset.key = subject.name; // 끌어서 순서 바꿀 때 쓰는 이름표

      const label = document.createElement('span');
      label.className = 'subject-name';
      label.textContent = subject.name;

      const editBtn = document.createElement('button');
      editBtn.type = 'button';
      editBtn.className = 'small-btn subject-edit';
      editBtn.textContent = '수정';
      editBtn.setAttribute('aria-label', `${subject.name} 수정`);
      editBtn.addEventListener('click', () => openSubjectForm(subject));

      li.append(createDragHandle(subject.name), createMarker('dot', subject.color), label, editBtn);
      return li;
    })
  );
}

// 과목 목록에서 끌어서 순서를 바꿨을 때: 새 순서대로 저장
function reorderSubjects(names) {
  subjects = names.map((name) => subjects.find((s) => s.name === name));
  saveSubjects();
  renderLegend();
}

// ---------------------------------------------------------
// 6-0. 과목 추가/수정/삭제 창
// ---------------------------------------------------------

// 색 견본 버튼 만들기 (config.js의 SUBJECT_COLOR_PRESETS)
function buildColorOptions() {
  els.subjectColorOptions.replaceChildren(
    ...SUBJECT_COLOR_PRESETS.map((color) => {
      const swatch = document.createElement('button');
      swatch.type = 'button';
      swatch.className = 'color-swatch';
      swatch.dataset.color = color;
      swatch.style.setProperty('--swatch', color);
      swatch.setAttribute('aria-label', `색 ${color}`);
      swatch.addEventListener('click', () => {
        els.subjectColor.value = color;
        updateColorSelection();
      });
      return swatch;
    })
  );
}

// 지금 고른 색과 같은 견본에 표시(테두리)를 해 줘요.
function updateColorSelection() {
  const current = els.subjectColor.value.toLowerCase();
  els.subjectColorOptions.querySelectorAll('.color-swatch').forEach((swatch) => {
    swatch.setAttribute('aria-pressed', swatch.dataset.color === current ? 'true' : 'false');
  });
}

// subject가 있으면 수정, 없으면 새 과목 추가
function openSubjectForm(subject) {
  editingSubjectName = subject ? subject.name : null;
  els.subjectDialogTitle.textContent = subject ? '과목 수정' : '과목 추가';
  els.subjectError.textContent = '';
  els.subjectName.value = subject ? subject.name : '';
  els.subjectDelete.hidden = !subject; // 삭제 버튼은 수정할 때만

  // 새 과목은 아직 아무 과목도 쓰지 않는 색으로 미리 골라 둬요.
  const usedColors = subjects.map((s) => s.color);
  const freeColor = SUBJECT_COLOR_PRESETS.find((c) => !usedColors.includes(c)) || SUBJECT_COLOR_PRESETS[0];
  els.subjectColor.value = subject ? subject.color : freeColor;
  updateColorSelection();

  els.subjectDialog.showModal();
  els.subjectName.focus();
}

// 과목 표시가 바뀌면 다시 그려야 하는 곳들
function refreshAfterSubjectChange() {
  renderLegend();
  renderCalendar();
  renderDdayList();
  renderTimetable();
  if (els.dayDialog.open) renderDayDialog();
}

function handleSubjectSubmit(e) {
  e.preventDefault();
  const name = els.subjectName.value.trim();
  const color = els.subjectColor.value.toLowerCase();

  let error = '';
  if (!name) error = '과목 이름을 입력해 주세요.';
  else if (subjects.some((s) => s.name === name && s.name !== editingSubjectName)) {
    error = `'${name}' 과목이 이미 있어요.`;
  }
  if (error) {
    els.subjectError.textContent = error;
    return;
  }

  if (editingSubjectName) {
    const target = subjects.find((s) => s.name === editingSubjectName);
    // 이름을 바꾸면 그 과목으로 저장된 일정들의 과목 이름도 같이 바꿔 줘요.
    if (name !== editingSubjectName) {
      events.forEach((ev) => renameSubjectInEvent(ev, editingSubjectName, name));
      saveEvents();
      // 되돌리기를 기다리는 일정의 과목 이름도 같이 바꿔요.
      if (pendingUndo) {
        pendingUndo.entries.forEach((entry) => renameSubjectInEvent(entry.event, editingSubjectName, name));
      }
      // 시간표의 그 과목도 같이 바꿔요. (직접 추가한 이름은 이름이 같아도 그대로)
      getSubjectCellKeys(editingSubjectName).forEach((key) => {
        timetable.cells[key].name = name;
      });
      saveTimetable();
    }
    Object.assign(target, { name, color });
  } else {
    subjects.push({ name, color });
  }
  saveSubjects();
  els.subjectDialog.close();
  refreshAfterSubjectChange();
}

function deleteSubject() {
  const name = editingSubjectName;
  const count = events.filter((ev) => ev.subject === name).length;
  let message = `'${name}' 과목을 삭제할까요?`;
  if (count > 0) message += `\n\n이 과목의 일정 ${count}개는 지워지지 않고 회색으로 표시돼요.`;
  let examCount = 0;
  events.forEach((ev) => {
    Object.values(ev.examSlots || {}).forEach((slots) => {
      examCount += Object.values(slots).filter((subject) => subject === name).length;
    });
  });
  if (examCount > 0) message += `\n\n시험 시간표의 이 과목 ${examCount}칸도 지워지지 않고 회색으로 표시돼요.`;
  const cellKeys = getSubjectCellKeys(name);
  if (cellKeys.length > 0) message += `\n\n시간표에서 이 과목이 있는 ${cellKeys.length}칸은 비워져요.`;
  if (!confirm(message)) return;

  subjects = subjects.filter((s) => s.name !== name);
  saveSubjects();
  // 시간표의 그 과목 칸은 비워요. (직접 추가한 이름은 이름이 같아도 그대로)
  cellKeys.forEach((key) => delete timetable.cells[key]);
  saveTimetable();
  els.subjectDialog.close();
  refreshAfterSubjectChange();
}

// ---------------------------------------------------------
// 6-1. D-day 목록
//    일정에 dday: true 가 붙어 있으면 목록에 나옵니다.
//    ddayOrder에는 D-day로 설정한 시각을 넣어 '설정한 순서' 정렬에 씁니다.
//    지난 일정도 직접 해제할 때까지 목록에 남아 있어요.
// ---------------------------------------------------------
const DDAY_SORTS = ['added', 'asc', 'desc'];
const DDAY_URGENT_DAYS = 7; // D-7(같은 요일 일주일 전)부터 D-DAY까지 빨간색

function getDdaySort() {
  const saved = loadSetting(STORAGE_KEYS.ddaySort);
  return DDAY_SORTS.includes(saved) ? saved : 'added';
}

function sortDdayEvents(list, sort) {
  const byAdded = (a, b) => (a.ddayOrder || 0) - (b.ddayOrder || 0);
  // 날짜가 같으면 설정한 순서대로
  if (sort === 'asc') return list.sort((a, b) => getDdayDate(a).localeCompare(getDdayDate(b)) || byAdded(a, b));
  if (sort === 'desc') return list.sort((a, b) => getDdayDate(b).localeCompare(getDdayDate(a)) || byAdded(a, b));
  return list.sort(byAdded);
}

// D-day를 계산하는 기준 날짜 (반복 일정은 오늘 이후 가장 가까운 날, 모두 지났으면 마지막 날)
function getDdayDate(event) {
  if (!isRepeatEvent(event)) return event.date;
  const dates = getOccurrenceDates(event);
  const todayKey = getTodayKey();
  return dates.find((key) => key >= todayKey) || dates[dates.length - 1] || event.date;
}

// D-day 표시와 색
//   시작 전: 시작일까지 남은 날 (D-5), D-7부터 빨강
//   기간 일정의 기간 중: '진행 중' (빨강) / 하루 일정의 당일: 'D-DAY' (빨강)
//   끝난 뒤: 종료일 기준 지난 날 (D+1), 회색
//   반복 일정: 가장 가까운 다음 날짜 기준 (모두 지났으면 마지막 날짜 기준)
function getDdayStatus(event) {
  const target = getDdayDate(event);
  const untilStart = getDaysUntil(target);
  const untilEnd = isRangeEvent(event) ? getDaysUntil(event.endDate) : untilStart;
  if (untilEnd < 0) return { label: formatDday(untilEnd), state: 'passed' };
  if (isRangeEvent(event) && untilStart <= 0) return { label: '진행 중', state: 'urgent' };
  return { label: formatDday(untilStart), state: untilStart <= DDAY_URGENT_DAYS ? 'urgent' : '' };
}

function renderDdayList() {
  const sort = getDdaySort();
  els.ddaySort.value = sort;

  const list = sortDdayEvents(events.filter((ev) => ev.dday), sort);
  els.ddayEmpty.hidden = list.length > 0;

  els.ddayList.replaceChildren(
    ...list.map((ev) => {
      const type = getEventType(ev.type);
      const status = getDdayStatus(ev);

      const li = document.createElement('li');
      li.className = 'dday-item';
      if (status.state) li.classList.add(status.state);

      // 누르면 그 날짜가 있는 달로 이동하는 버튼 (목록 한 줄 전체)
      const goBtn = document.createElement('button');
      goBtn.type = 'button';
      goBtn.className = 'dday-go';
      goBtn.title = '이 날짜로 이동';
      goBtn.addEventListener('click', () => goToDate(getDdayDate(ev)));

      const badge = document.createElement('span');
      badge.className = 'dday-badge';
      badge.textContent = status.label;

      const body = document.createElement('span');
      body.className = 'dday-body';
      const title = document.createElement('span');
      title.className = 'dday-title';
      title.append(createMarker(type.shape, getEventColor(ev), getMarkerNumber(ev)));
      const titleText = document.createElement('span');
      titleText.className = 'dday-title-text';
      titleText.textContent = type.useSubject && ev.subject ? `${ev.subject} ${ev.title}` : ev.title;
      title.append(titleText);
      const date = document.createElement('span');
      date.className = 'dday-date';
      const dateText = isRangeEvent(ev) ? formatRangeLabel(ev.date, ev.endDate) : formatShortDate(getDdayDate(ev));
      date.textContent = `${dateText} · ${type.label}${ev.period ? ` · ${ev.period}교시` : ''}`;
      body.append(title, date);

      goBtn.append(badge, body);

      // 오른쪽 × 버튼: D-day 해제 (일정 자체는 지워지지 않아요)
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'dday-remove';
      removeBtn.textContent = '×';
      removeBtn.title = 'D-day 해제';
      removeBtn.setAttribute('aria-label', `${ev.title} D-day 해제`);
      removeBtn.addEventListener('click', () => toggleDday(ev));

      li.append(goBtn, removeBtn);
      return li;
    })
  );
}

// D-day 설정 ↔ 해제
// (반복 일정은 어느 날짜에서 눌러도 반복 일정 전체에 적용돼요)
function toggleDday(event) {
  const target = event.series ? events.find((ev) => ev.id === event.series.id) : event;
  if (target.dday) {
    delete target.dday;
    delete target.ddayOrder;
  } else {
    target.dday = true;
    target.ddayOrder = Date.now();
  }
  saveEvents();
  renderDdayList();
  if (els.dayDialog.open) renderDayDialog();
}

// D-day 목록에서 일정을 누르면: 그 달로 이동 + 해당 날짜 칸을 잠깐 반짝여서 알려 줌
function goToDate(dateKey) {
  const date = parseDateKey(dateKey);
  setMonth(date.getFullYear(), date.getMonth());

  const cell = els.grid.querySelector(`.day[data-date="${dateKey}"]`);
  if (cell) {
    cell.classList.add('flash');
    // 휴대폰에서는 달력이 D-day 목록 아래에 있으니 그 칸이 보이도록 화면을 내려 줘요.
    cell.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => cell.classList.remove('flash'), 1600);
  }
}

// ---------------------------------------------------------
// 6-2. 시간표
//    timetable.cells에 칸마다 과목(subject) 또는 직접 추가한 이름(custom)이 들어 있어요.
//    요일과 교시 수는 config.js의 PERIODS_PER_WEEKDAY를 따라요.
//    수정 모드에서만 칸을 눌러 바꿀 수 있어요.
// ---------------------------------------------------------

// 시간표에 나올 요일 번호 (1 = 월요일 ...)
function getTimetableWeekdays() {
  return Object.keys(PERIODS_PER_WEEKDAY).map(Number).sort((a, b) => a - b);
}

// 그 과목이 들어 있는 시간표 칸 이름들
function getSubjectCellKeys(subjectName) {
  return Object.keys(timetable.cells).filter((key) => {
    const cell = timetable.cells[key];
    return cell.kind === 'subject' && cell.name === subjectName;
  });
}

// 직접 추가한 이름 목록: 칸에 쓰이고 있는 이름만 모아요.
// (어느 칸에서도 쓰지 않게 되면 목록에서 저절로 사라져요)
function getCustomNames() {
  const names = [];
  getTimetableWeekdays().forEach((weekday) => {
    for (let period = 1; period <= PERIODS_PER_WEEKDAY[weekday]; period++) {
      const cell = timetable.cells[`${weekday}-${period}`];
      if (cell && cell.kind === 'custom' && !names.includes(cell.name)) names.push(cell.name);
    }
  });
  return names;
}

// 칸의 색: 과목은 과목 색, 직접 추가한 이름은 회색 (목록에 없는 과목도 회색)
function getCellColor(cell) {
  return cell.kind === 'subject' ? getSubjectColor(cell.name) : UNKNOWN_SUBJECT_COLOR;
}

function renderTimetable() {
  const hasCells = Object.keys(timetable.cells).length > 0;
  const showTable = hasCells || timetableEditing;

  // 비어 있으면 표 대신 안내 문구와 '시간표 등록' 버튼
  els.timetableEmpty.hidden = showTable;
  els.timetableTable.hidden = !showTable;
  els.timetableEdit.hidden = !showTable;
  els.timetableEdit.textContent = timetableEditing ? '완료' : '수정';
  els.timetableClear.hidden = !(timetableEditing && hasCells);
  els.timetableHint.hidden = !timetableEditing;
  els.timetablePanel.classList.toggle('editing', timetableEditing);
  if (!showTable) {
    els.timetableTable.replaceChildren();
    return;
  }

  const weekdays = getTimetableWeekdays();
  const todayWeekday = new Date().getDay();
  const rowCount = Math.max(...weekdays.map((weekday) => PERIODS_PER_WEEKDAY[weekday]));

  // 맨 윗줄: [빈칸] 월 화 수 목 금
  const headRow = document.createElement('tr');
  const corner = document.createElement('th');
  corner.className = 'tt-period';
  corner.scope = 'col';
  corner.setAttribute('aria-label', '교시');
  headRow.appendChild(corner);
  weekdays.forEach((weekday) => {
    const th = document.createElement('th');
    th.scope = 'col';
    th.textContent = WEEKDAY_NAMES[weekday];
    if (weekday === todayWeekday) th.className = 'tt-today-head'; // 오늘 요일: 진하게 채움
    headRow.appendChild(th);
  });
  const thead = document.createElement('thead');
  thead.appendChild(headRow);

  const tbody = document.createElement('tbody');
  for (let period = 1; period <= rowCount; period++) {
    const row = document.createElement('tr');
    const rowHead = document.createElement('th');
    rowHead.className = 'tt-period';
    rowHead.scope = 'row';
    rowHead.textContent = `${period}교시`;
    row.appendChild(rowHead);

    weekdays.forEach((weekday) => {
      const td = document.createElement('td');
      if (weekday === todayWeekday) td.classList.add('tt-today'); // 오늘 요일: 열 전체에 연한 배경
      if (period > PERIODS_PER_WEEKDAY[weekday]) {
        td.classList.add('tt-off'); // 그 요일에 없는 교시: 빗금
      } else {
        td.appendChild(createTimetableCell(`${weekday}-${period}`, weekday, period));
      }
      row.appendChild(td);
    });
    tbody.appendChild(row);
  }
  els.timetableTable.replaceChildren(thead, tbody);
}

// 칸 하나 만들기: 수정 모드에서는 누를 수 있는 버튼, 평소에는 글자만
function createTimetableCell(key, weekday, period) {
  const cell = timetable.cells[key];
  const box = document.createElement(timetableEditing ? 'button' : 'div');
  box.className = 'tt-cell';

  if (cell) {
    box.classList.add('tt-filled');
    box.style.setProperty('--tt-color', getCellColor(cell));
    box.title = cell.name; // 칸이 좁아 잘려도 마우스를 올리면 전체 이름이 보여요
    const name = document.createElement('span');
    name.className = 'tt-name';
    name.textContent = cell.name;
    box.appendChild(name);
  }
  if (timetableEditing) {
    box.type = 'button';
    box.dataset.cell = key;
    const place = `${WEEKDAY_NAMES[weekday]}요일 ${period}교시`;
    box.setAttribute('aria-label', cell ? `${place}, ${cell.name}, 바꾸기` : `${place}, 비어 있음, 고르기`);
    if (!cell) box.textContent = '+';
  }
  return box;
}

// 수정 모드 켜기/끄기
function toggleTimetableEditing() {
  timetableEditing = !timetableEditing;
  renderTimetable();
}

function clearTimetable() {
  if (!confirm('시간표의 모든 칸을 비울까요?\n비우면 되돌릴 수 없어요.')) return;
  timetable.cells = {};
  saveTimetable();
  renderTimetable();
}

// 칸을 누르면 뜨는 작은 선택 창의 목록 한 줄
function createPickerOption(label, markerEl, isCurrent, onPick) {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'tt-option';
  if (isCurrent) button.setAttribute('aria-current', 'true');
  const text = document.createElement('span');
  text.className = 'tt-option-name';
  text.textContent = label;
  button.append(markerEl, text);
  if (isCurrent) {
    const check = document.createElement('span');
    check.textContent = '✓';
    check.setAttribute('aria-hidden', 'true');
    button.appendChild(check);
  }
  button.addEventListener('click', onPick);
  const li = document.createElement('li');
  li.appendChild(button);
  return li;
}

function openTimetablePicker(key, anchor) {
  pickerCellKey = key;
  const [weekday, period] = key.split('-').map(Number);
  const current = timetable.cells[key];
  const isSame = (kind, name) => Boolean(current) && current.kind === kind && current.name === name;

  els.ttPickerTitle.textContent = `${WEEKDAY_NAMES[weekday]}요일 ${period}교시`;
  els.ttPickerError.textContent = '';
  els.ttPickerAddName.value = '';
  els.ttPickerAddForm.hidden = true;
  els.ttPickerAddToggle.hidden = false;
  els.ttPickerClear.disabled = !current; // 이미 빈 칸이면 비울 게 없어요

  // 1) 등록한 과목(범례 순서) 2) 직접 추가한 이름
  els.ttPickerList.replaceChildren(
    ...subjects.map((subject) =>
      createPickerOption(subject.name, createMarker('dot', subject.color), isSame('subject', subject.name), () =>
        setTimetableCell(key, { kind: 'subject', name: subject.name })
      )
    ),
    ...getCustomNames().map((name) =>
      createPickerOption(name, createMarker('dot', UNKNOWN_SUBJECT_COLOR), isSame('custom', name), () =>
        setTimetableCell(key, { kind: 'custom', name })
      )
    )
  );

  els.ttPicker.showModal();
  positionTimetablePicker(anchor);
}

// 선택 창을 누른 칸 바로 아래에 놓아요. 화면 밖으로 나가면 칸 위쪽으로 옮기고 안쪽으로 밀어 넣어요.
function positionTimetablePicker(anchor) {
  const margin = 8;
  const rect = anchor.getBoundingClientRect();
  const width = els.ttPicker.offsetWidth;
  const height = els.ttPicker.offsetHeight;

  let top = rect.bottom + 4;
  if (top + height > window.innerHeight - margin) top = rect.top - height - 4;
  top = Math.max(margin, Math.min(top, window.innerHeight - height - margin));
  const left = Math.max(margin, Math.min(rect.left, window.innerWidth - width - margin));

  els.ttPicker.style.top = `${top}px`;
  els.ttPicker.style.left = `${left}px`;
}

// 칸에 값을 넣거나(value) 비우고(null) 저장. 선택 창을 닫고 그 칸에 초점을 돌려줘요.
function setTimetableCell(key, value) {
  if (value) timetable.cells[key] = value;
  else delete timetable.cells[key];
  saveTimetable();
  els.ttPicker.close();
  renderTimetable();
  const cell = els.timetableTable.querySelector(`[data-cell="${key}"]`);
  if (cell) cell.focus();
}

// '직접 추가' 저장: 등록한 과목과 이름이 같으면 그 과목으로 넣어요.
function handleTimetableCustomAdd(e) {
  e.preventDefault();
  const name = els.ttPickerAddName.value.trim();
  if (!name) {
    els.ttPickerError.textContent = '이름을 입력해 주세요.';
    return;
  }
  const kind = subjects.some((s) => s.name === name) ? 'subject' : 'custom';
  setTimetableCell(pickerCellKey, { kind, name });
}

// ---------------------------------------------------------
// 7. 날짜를 눌렀을 때: 그날의 일정 목록 창
// ---------------------------------------------------------
function openDayDialog(dateKey) {
  openDayKey = dateKey;
  renderDayDialog();
  if (!els.dayDialog.open) els.dayDialog.showModal();
  updateMemoToggles(); // 창이 화면에 나타난 뒤에야 메모 길이를 잴 수 있어요
  placeUndoToast(); // 되돌리기 알림이 떠 있으면 창 안에서도 눌리도록
}

// 일정 목록 창에서 전날(-1)/다음날(+1)로 넘어가기
// 다른 달로 넘어가면 뒤의 달력도 그 달로 함께 이동해요.
function moveDay(step) {
  const date = parseDateKey(openDayKey);
  date.setDate(date.getDate() + step); // 31일 + 1 → 다음 달 1일도 알아서 계산
  // 같은 달 안에서 움직일 때는 setMonth가 아무 연출 없이 그대로 다시 그리기만 해요.
  setMonth(date.getFullYear(), date.getMonth());
  openDayKey = toDateKey(date);
  renderDayDialog();
}

function renderDayDialog() {
  const key = openDayKey;
  els.dayTitle.textContent = formatDateLabel(key);

  const holidayNames = holidayMap[key];
  els.dayHoliday.textContent = holidayNames ? holidayNames.join(' · ') : '';
  els.dayHoliday.hidden = !holidayNames;

  const rangeEvents = getRangeEventsOn(key);
  const singleEvents = getSingleEventsOn(key);
  els.dayEmpty.hidden = rangeEvents.length + singleEvents.length > 0;

  // 기간 일정은 위에 고정하고, 하루 일정끼리만 끌어서 순서를 바꿔요.
  // (하루 일정이 2개 이상일 때만 맨 왼쪽에 순서 바꾸기 손잡이)
  els.dayRangeList.hidden = rangeEvents.length === 0;
  els.dayList.hidden = singleEvents.length === 0;
  els.dayRangeList.replaceChildren(...rangeEvents.map((ev) => createDayEventItem(ev, key, false)));
  els.dayList.replaceChildren(
    ...singleEvents.map((ev) => createDayEventItem(ev, key, singleEvents.length > 1))
  );
  updateMemoToggles();
}

// 하루 일정 창의 일정 한 줄 만들기
function createDayEventItem(ev, dateKey, withHandle) {
  const type = getEventType(ev.type);

  const li = document.createElement('li');
  li.className = 'day-event';
  li.dataset.key = ev.id; // 끌어서 순서 바꿀 때 쓰는 이름표

  // 왼쪽: 모양 (교시가 있는 수행평가는 동그라미 안에 숫자)
  const marker = createMarker(type.shape, getEventColor(ev), getMarkerNumber(ev));

  // 가운데: 종류·과목·교시 + 내용
  const body = document.createElement('div');
  body.className = 'day-event-body';
  const meta = document.createElement('div');
  meta.className = 'day-event-meta';
  const metaParts = [type.label];
  if (type.useSubject && ev.subject) metaParts.push(ev.subject);
  if (isRangeEvent(ev)) metaParts.push(formatRangeLabel(ev.date, ev.endDate));
  if (ev.series) metaParts.push(formatRepeatLabel(ev.series));
  if (usesDailyPeriods(ev)) {
    // 수행평가 기간 일정: 그날 시간표의 교시 (없으면 빼요)
    const periods = getTimetablePeriods(ev.subject, dateKey).join('·');
    if (periods) metaParts.push(`${periods}교시`);
  } else if (ev.period) {
    metaParts.push(`${ev.period}교시`);
  }
  meta.textContent = metaParts.join(' · ');
  const title = document.createElement('div');
  title.className = 'day-event-title';
  title.textContent = ev.title;
  body.append(meta, title);
  // 정기고사: 그날의 시험을 '1교시 문학'처럼 적어요.
  const examSlots = ev.examSlots && ev.examSlots[dateKey];
  if (examSlots) {
    const list = document.createElement('div');
    list.className = 'day-event-slots';
    Object.keys(examSlots).map(Number).sort((a, b) => a - b).forEach((period) => {
      const slot = document.createElement('span');
      slot.className = 'day-event-slot';
      const subject = examSlots[period];
      slot.append(createMarker('dot', getSubjectColor(subject)), `${period}교시 ${subject}`);
      list.appendChild(slot);
    });
    body.appendChild(list);
  }
  if (ev.memo) body.append(...createMemoBlock(ev));

  // 오른쪽: D-day / 수정 / 삭제 버튼
  const actions = document.createElement('div');
  actions.className = 'day-event-actions';
  const ddayBtn = document.createElement('button');
  ddayBtn.type = 'button';
  ddayBtn.className = 'small-btn dday-toggle';
  ddayBtn.textContent = 'D-day';
  ddayBtn.setAttribute('aria-pressed', ev.dday ? 'true' : 'false'); // 켜져 있으면 색칠된 버튼
  ddayBtn.title = ev.dday ? 'D-day 해제' : 'D-day 설정';
  ddayBtn.addEventListener('click', () => toggleDday(ev));
  const editBtn = document.createElement('button');
  editBtn.type = 'button';
  editBtn.className = 'small-btn';
  editBtn.textContent = '수정';
  editBtn.addEventListener('click', () => {
    // 반복 일정은 범위를 먼저 골라요.
    if (ev.series) openScopeDialog('수정', (scope) => openEventForm(ev, null, scope));
    else openEventForm(ev);
  });
  const deleteBtn = document.createElement('button');
  deleteBtn.type = 'button';
  deleteBtn.className = 'small-btn danger';
  deleteBtn.textContent = '삭제';
  deleteBtn.addEventListener('click', () => deleteEvent(ev));
  actions.append(ddayBtn, editBtn, deleteBtn);

  if (withHandle) li.append(createDragHandle(ev.title));
  li.append(marker, body, actions);
  return li;
}

// 메모 글과 '더 보기' 버튼 만들기 (내용은 textContent로만 넣어요)
function createMemoBlock(event) {
  const memo = document.createElement('div');
  memo.className = 'day-event-memo';
  memo.dataset.eventId = event.id;
  memo.textContent = event.memo;

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'memo-toggle';
  toggle.addEventListener('click', () => {
    if (expandedMemoIds.has(event.id)) expandedMemoIds.delete(event.id);
    else expandedMemoIds.add(event.id);
    updateMemoToggles();
  });
  return [memo, toggle];
}

// 메모마다 3줄이 넘는지 재서, 넘을 때만 '더 보기 / 접기' 버튼을 보여 줘요.
// (창이 닫혀 있으면 길이를 잴 수 없어서 건너뛰어요. 창을 열 때 다시 불러요)
function updateMemoToggles() {
  if (!els.dayDialog.open) return;
  els.dayDialog.querySelectorAll('.day-event-memo').forEach((memo) => {
    const toggle = memo.nextElementSibling;
    memo.classList.add('collapsed'); // 일단 접은 상태로 재요
    const isLong = memo.scrollHeight > memo.clientHeight + 1;
    const isExpanded = isLong && expandedMemoIds.has(memo.dataset.eventId);

    memo.classList.toggle('collapsed', !isExpanded);
    toggle.hidden = !isLong;
    toggle.textContent = isExpanded ? '접기' : '더 보기';
    toggle.setAttribute('aria-expanded', isExpanded ? 'true' : 'false');
  });
}

// 하루 일정 목록에서 끌어서 순서를 바꿨을 때
// 그날 일정마다 dayOrder(0, 1, 2...)를 붙여 저장 → 달력 칸에도 같은 순서로 보여요.
function reorderDayEvents(ids) {
  ids.forEach((id, index) => {
    // 반복 일정의 날짜('id@날짜')는 그 날짜의 순서만 저장해요.
    const [baseId, dateKey] = id.split('@');
    const ev = events.find((e) => e.id === baseId);
    if (!ev) return;
    if (dateKey) {
      if (!ev.repeat.dayOrders) ev.repeat.dayOrders = {};
      ev.repeat.dayOrders[dateKey] = index;
    } else {
      ev.dayOrder = index;
    }
  });
  saveEvents();
  renderCalendar();
  renderDayDialog();
}

// 삭제 직전 상태를 복사해 둬요. (시험 시간표, 반복 규칙까지 통째로)
function createUndoEntries(list) {
  return list.map((event) => ({
    event: JSON.parse(JSON.stringify(event)),
    index: events.indexOf(event),
  }));
}

// 일정 삭제: 확인 창 없이 바로 지우고, 약 5초 동안 되돌릴 수 있는 알림을 보여 줘요.
// 삭제 직전의 일정을 통째로 복사해 두어서 날짜·메모·교시·순서·D-day까지 그대로 되살릴 수 있어요.
// 반복 일정은 범위를 먼저 골라요.
function deleteEvent(event) {
  if (event.series) {
    openScopeDialog('삭제', (scope) => deleteRepeatEvent(event, scope));
    return;
  }
  const entries = createUndoEntries([event]);
  events = events.filter((ev) => ev.id !== event.id);
  finishDelete(entries);
}

function finishDelete(entries) {
  saveEvents();
  renderCalendar();
  renderDdayList(); // D-day였던 일정이면 목록에서도 사라져요
  if (els.dayDialog.open) renderDayDialog();
  showUndoToast(entries);
}

// 반복 일정 삭제
//   이 일정만: 그날을 규칙에서 빼요.
//   이 일정과 이후 모두: 전날까지로 끊고, 그날 이후의 따로 고친 날도 지워요.
//   전체: 반복 일정과 따로 고친 날을 모두 지워요.
//   남은 날짜가 하나도 없으면 반복 일정 자체를 지워요. 어느 경우든 되돌릴 수 있어요.
function deleteRepeatEvent(occurrence, scope) {
  const series = events.find((ev) => ev.id === occurrence.series.id);
  if (!series) return;
  const key = occurrence.date;
  const detached = events.filter((ev) => {
    if (ev.seriesId !== series.id) return false;
    return scope === 'all' || (scope === 'from' && ev.date >= key);
  });
  const entries = createUndoEntries(events.filter((ev) => ev === series || detached.includes(ev)));

  events = events.filter((ev) => !detached.includes(ev));
  if (scope === 'all') {
    events = events.filter((ev) => ev !== series);
  } else {
    if (scope === 'single') series.repeat.excludedDates = [...(series.repeat.excludedDates || []), key];
    else series.repeat.until = getPreviousDayKey(key);
    if (getOccurrenceDates(series).length === 0) events = events.filter((ev) => ev !== series);
  }
  finishDelete(entries);
}

// 반복 일정의 수정·삭제 범위 고르는 창 ('이 일정만 / 이 일정과 이후 모두 / 전체')
function openScopeDialog(actionName, onChoose) {
  els.scopeTitle.textContent = `이 반복 일정을 어떻게 ${actionName}할까요?`;
  scopeChoiceHandler = onChoose;
  els.scopeDialog.showModal();
}

function handleScopeChoice(e) {
  const button = e.target.closest('[data-scope]');
  if (!button) return;
  els.scopeDialog.close();
  const handler = scopeChoiceHandler;
  scopeChoiceHandler = null;
  if (button.dataset.scope && handler) handler(button.dataset.scope);
}

const UNDO_TOAST_MS = 5000; // 되돌리기 알림을 보여 주는 시간

// 알림 띄우기: 이미 떠 있으면 앞의 삭제는 확정되고, 가장 최근 삭제만 되돌릴 수 있어요. 5초도 새로 시작해요.
function showUndoToast(entries) {
  if (pendingUndo) clearTimeout(pendingUndo.timer);
  cancelUndoToastExit(); // 알림이 내려가던 중이면 멈추고 다시 띄워요
  pendingUndo = { entries, timer: setTimeout(hideUndoToast, UNDO_TOAST_MS) };
  els.undoToast.hidden = false;
  placeUndoToast();
  const ms = getMotionMs();
  if (ms) {
    els.undoToast.animate(
      [{ opacity: 0, translate: '0 12px' }, { opacity: 1, translate: '0 0' }],
      { duration: ms, easing: 'ease' }
    );
  }
}

// 알림 내리기: 올라올 때와 반대로 아래로 내려가며 사라져요. (시간이 다 되면 삭제가 확정돼요)
function hideUndoToast() {
  if (pendingUndo) clearTimeout(pendingUndo.timer);
  pendingUndo = null; // 내려가는 중에 버튼을 눌러도 되돌려지지 않아요
  if (els.undoToast.hidden || undoToastExit) return;

  const ms = getMotionMs();
  if (!ms) {
    els.undoToast.hidden = true;
    return;
  }
  const animation = els.undoToast.animate(
    [{ opacity: 1, translate: '0 0' }, { opacity: 0, translate: '0 12px' }],
    { duration: ms, easing: 'ease', fill: 'forwards' } // 끝난 모습을 유지해야 사라지기 직전에 깜빡이지 않아요
  );
  const timer = setTimeout(() => {
    cancelUndoToastExit();
    els.undoToast.hidden = true;
  }, ms);
  undoToastExit = { animation, timer };
}

function cancelUndoToastExit() {
  if (!undoToastExit) return;
  clearTimeout(undoToastExit.timer);
  undoToastExit.animation.cancel();
  undoToastExit = null;
}

// 일정 창이 열려 있으면 그 바깥은 눌리지 않아서, 알림을 창 안으로 옮겨요. 창이 닫히면 다시 본문으로.
function placeUndoToast() {
  const parent = els.dayDialog.open ? els.dayDialog : document.body;
  if (els.undoToast.parentElement !== parent) parent.appendChild(els.undoToast);
}

// 되돌리기: 복사해 둔 일정을 원래 자리에 그대로 되살려요.
function undoDelete() {
  if (!pendingUndo) return;
  const { entries } = pendingUndo;
  hideUndoToast();

  entries.forEach(({ event, index }) => {
    // 반복 일정처럼 남아 있는 일정은 삭제 전 상태로 되돌려요.
    const existing = events.findIndex((ev) => ev.id === event.id);
    if (existing !== -1) {
      events[existing] = event;
      return;
    }
    // 5초 안에 같은 날 순서를 다시 바꿔서 번호가 겹치면, 뒤의 일정들을 한 칸씩 밀어 가장 가까운 자리에 넣어요.
    if (typeof event.dayOrder === 'number') {
      const sameDay = events.filter((ev) => ev.date === event.date && typeof ev.dayOrder === 'number');
      if (sameDay.some((ev) => ev.dayOrder === event.dayOrder)) {
        sameDay.filter((ev) => ev.dayOrder >= event.dayOrder).forEach((ev) => ev.dayOrder++);
      }
    }
    events.splice(Math.min(index, events.length), 0, event);
  });
  saveEvents();

  // 다른 달을 보고 있어도 화면은 그대로 두고, 보이는 내용만 새로 그려요.
  renderCalendar();
  renderDdayList();
  if (els.dayDialog.open) renderDayDialog();
}

// ---------------------------------------------------------
// 8. 일정 추가/수정 창
// ---------------------------------------------------------

// 종류 선택 버튼 만들기 (config.js의 EVENT_TYPES 순서대로)
function buildTypeOptions() {
  els.formTypeOptions.replaceChildren(
    ...EVENT_TYPES.map((type) => {
      const label = document.createElement('label');
      label.className = 'type-option';
      const radio = document.createElement('input');
      radio.type = 'radio';
      radio.name = 'eventType';
      radio.value = type.id;
      radio.addEventListener('change', () => {
        formTouched.type = true; // 직접 고른 종류는 '기간'을 켜도 바꾸지 않아요
        updateTypeFields();
      });
      const color = type.useSubject ? 'var(--text-muted)' : type.color;
      const text = document.createElement('span');
      text.textContent = type.label;
      label.append(radio, createMarker(type.shape, color), text);
      return label;
    })
  );
}

// 과목 고르기 목록 채우기 (범례의 과목 순서 그대로)
// 수정하는 일정의 과목이 지금 목록에 없으면(삭제한 과목) 목록에 잠깐 추가해 둡니다.
function fillSubjectOptions(extraSubject) {
  const names = subjects.map((s) => s.name);
  if (extraSubject && !names.includes(extraSubject)) names.push(extraSubject);

  const placeholder = new Option('과목을 선택하세요', '');
  els.formSubject.replaceChildren(placeholder, ...names.map((name) => new Option(name, name)));
}

function getSelectedTypeId() {
  const checked = els.formTypeOptions.querySelector('input[name="eventType"]:checked');
  return checked ? checked.value : null;
}

// 교시 고르기 목록 채우기: 고른 종류와 날짜에 맞춰
//   시험 → 1~3교시, 수행평가 → 월·수·금 1~7교시 / 화·목 1~6교시
// 이미 고른 교시가 새 목록에도 있으면 그대로 두고, 없으면 '선택 안 함'으로 돌려요.
function fillPeriodOptions(selected) {
  const typeId = getSelectedTypeId();
  // 수행평가의 기간·반복 일정은 교시를 고르지 않아요. (날마다 시간표에서 찾아요)
  const isMultiDay = els.formRangeToggle.checked || getFormRepeatFreq() !== 'none';
  const dailyPeriods = isMultiDay && typeId && getEventType(typeId).useTimetable;
  const count = typeId && !dailyPeriods ? getPeriodCount(getEventType(typeId), els.formDate.value || openDayKey) : 0;
  const options = [new Option('선택 안 함', '')];
  for (let p = 1; p <= count; p++) options.push(new Option(`${p}교시`, String(p)));
  els.formPeriod.replaceChildren(...options);
  els.formPeriod.value = selected && selected <= count ? String(selected) : '';
}

// 종류·날짜에 따라 과목 칸, 교시 칸을 보여 주거나 숨깁니다.
//   과목: 시험·수행평가일 때
//   교시: 그 종류·날짜에 고를 교시가 있을 때 (토·일의 수행평가는 숨김)
function updateTypeFields() {
  const isRange = els.formRangeToggle.checked;
  syncTypeOptions(isRange);
  const typeId = getSelectedTypeId();
  const type = typeId ? getEventType(typeId) : null;
  els.formSubjectField.hidden = !(type && type.useSubject);

  // 기간을 켜면 시작일·종료일 칸으로 보여 줘요.
  els.formEndField.hidden = !isRange;
  els.formRangeField.hidden = Boolean(formScope); // 반복 일정을 고칠 때는 기간을 켤 수 없어요

  // 반복 칸: 수행평가·기타의 하루 일정에서만 보여요. 못 쓰게 되면 '반복 안 함'으로 돌아가요.
  // ('이 일정만' 고치는 날은 하루 일정으로 분리되니까 반복이 없어요)
  const canRepeat = Boolean(!isRange && type && type.repeatable && formScope !== 'single');
  els.repeatField.hidden = !canRepeat;
  if (!canRepeat) setFormRepeatFreq('none');
  const freq = getFormRepeatFreq();
  els.repeatWeekdays.hidden = freq !== 'weekly';
  els.repeatUntilField.hidden = freq === 'none';
  els.repeatSkipField.hidden = freq === 'none';
  els.formDateLabel.textContent = isRange || freq !== 'none' ? '시작일' : '날짜';

  fillPeriodOptions(Number(els.formPeriod.value) || null);
  els.formPeriodField.hidden = els.formPeriod.options.length <= 1;
  els.formPeriodNote.hidden = !((isRange || freq !== 'none') && type && type.useTimetable);
  renderExamSchedule(Boolean(isRange && type && type.examSchedule));
  applyTimetableAutoSelect();
}

function selectEventType(typeId) {
  els.formTypeOptions.querySelectorAll('input[name="eventType"]').forEach((radio) => {
    radio.checked = radio.value === typeId;
  });
}

// 기간이 꺼져 있으면 모의고사, 켜져 있으면 정기고사만 보여 줘요.
// 선택돼 있던 종류가 숨겨지면 기본 종류로 바꿔요.
function syncTypeOptions(isRange) {
  els.formTypeOptions.querySelectorAll('.type-option').forEach((label) => {
    const radio = label.querySelector('input');
    const type = getEventType(radio.value);
    label.hidden = isRange ? Boolean(type.singleOnly) : Boolean(type.rangeOnly);
    // 반복 일정의 '전체'·'이후 모두' 수정에서는 반복할 수 있는 종류만 골라요.
    if ((formScope === 'all' || formScope === 'from') && !type.repeatable) label.hidden = true;
    if (label.hidden && radio.checked) {
      selectEventType(isRange ? DEFAULT_RANGE_EVENT_TYPE_ID : DEFAULT_EVENT_TYPE_ID);
    }
  });
}

function getFormRepeatFreq() {
  const checked = els.repeatFreq.querySelector('input:checked');
  return checked ? checked.value : 'none';
}

function setFormRepeatFreq(freq) {
  els.repeatFreq.querySelectorAll('input').forEach((radio) => {
    radio.checked = radio.value === freq;
  });
}

function getFormWeekdays() {
  return [...els.repeatWeekdays.querySelectorAll('input:checked')].map((box) => Number(box.value));
}

function setFormWeekdays(weekdays) {
  els.repeatWeekdays.querySelectorAll('input').forEach((box) => {
    box.checked = weekdays.includes(Number(box.value));
  });
}

// 매주를 고르면 시작일의 요일을 미리 선택해 줘요.
function handleRepeatFreqChange() {
  if (getFormRepeatFreq() === 'weekly' && getFormWeekdays().length === 0 && els.formDate.value) {
    setFormWeekdays([parseDateKey(els.formDate.value).getDay()]);
  }
  updateTypeFields();
}

// '기간'을 켜면 종료일 칸이 나와요. 비어 있거나 시작일보다 빠르면 시작일 다음 날로 채워요.
// 종류를 직접 고른 적이 없으면 기간 일정의 기본 종류(정기고사)로 바꿔요.
function handleRangeToggle() {
  if (els.formRangeToggle.checked) {
    if (!formTouched.type) selectEventType(DEFAULT_RANGE_EVENT_TYPE_ID);
    if (els.formDate.value) {
      const end = els.formEndDate.value;
      if (!end || end <= els.formDate.value) {
        const next = parseDateKey(els.formDate.value);
        next.setDate(next.getDate() + 1);
        els.formEndDate.value = toDateKey(next);
      }
    }
  }
  updateTypeFields();
}

// 정기고사 시험 시간표 칸 그리기: 시작일~종료일의 평일마다 1~3교시 과목 고르기
// (주말과 공휴일은 빼요. 이미 적힌 시험이 그날 있으면 보여 줘요)
function renderExamSchedule(isVisible) {
  els.examScheduleField.hidden = !isVisible;
  if (!isVisible) {
    els.examScheduleRows.replaceChildren();
    return;
  }
  const start = els.formDate.value;
  const end = els.formEndDate.value;
  const rows = [];
  if (start && end && start <= end) {
    // 연도를 입력하는 도중에는 기간이 아주 길게 잡힐 수 있어서 최대 92일까지만 줄을 만들어요.
    const date = parseDateKey(start);
    for (let i = 0; i < 92 && toDateKey(date) <= end; i++, date.setDate(date.getDate() + 1)) {
      const key = toDateKey(date);
      const isSchoolDay = PERIODS_PER_WEEKDAY[date.getDay()] && !holidayMap[key];
      if (isSchoolDay || formExamSlots[key]) rows.push(createExamRow(key));
    }
  }
  els.examScheduleRows.replaceChildren(...rows);
}

// 시험 시간표 한 줄: [11/26 (목)] [1교시 ▾] [2교시 ▾] [3교시 ▾]
function createExamRow(dateKey) {
  const date = parseDateKey(dateKey);
  const row = document.createElement('div');
  row.className = 'exam-row';
  const label = document.createElement('div');
  label.className = 'exam-row-date';
  label.textContent = `${date.getMonth() + 1}/${date.getDate()} (${WEEKDAY_NAMES[date.getDay()]})`;
  row.appendChild(label);

  const saved = formExamSlots[dateKey] || {};
  for (let period = 1; period <= EXAM_SLOT_PERIODS; period++) {
    const field = document.createElement('label');
    field.className = 'exam-slot';
    const name = document.createElement('span');
    name.textContent = `${period}교시`;

    // 과목 목록에 없는(삭제한) 과목이 이미 적혀 있으면 목록에 잠깐 추가해 둬요.
    const names = subjects.map((s) => s.name);
    if (saved[period] && !names.includes(saved[period])) names.push(saved[period]);
    const select = document.createElement('select');
    select.setAttribute('aria-label', `${label.textContent} ${period}교시 과목`);
    select.append(new Option('없음', ''), ...names.map((n) => new Option(n, n)));
    select.value = saved[period] || '';
    select.addEventListener('change', () => {
      if (!formExamSlots[dateKey]) formExamSlots[dateKey] = {};
      if (select.value) formExamSlots[dateKey][period] = select.value;
      else delete formExamSlots[dateKey][period];
      if (Object.keys(formExamSlots[dateKey]).length === 0) delete formExamSlots[dateKey];
    });
    field.append(name, select);
    row.appendChild(field);
  }
  return row;
}

// 저장할 시험 시간표: 시작일~종료일 안의 날짜만 남겨요. (없으면 null)
function collectExamSlots(start, end) {
  const result = {};
  Object.keys(formExamSlots).forEach((key) => {
    if (key >= start && key <= end) result[key] = formExamSlots[key];
  });
  return Object.keys(result).length > 0 ? result : null;
}

// 새 수행평가를 추가할 때 시간표를 보고 빈 칸을 자동으로 골라 줘요.
//   교시를 고르면 → 그 시간의 과목
//   과목을 고르면 → 그날 그 과목이 한 번만 있을 때 그 교시 (두 번 이상이면 어느 교시인지 모르니 비워 둠)
// 시간표 칸이 비어 있거나 직접 추가한 이름(동아리 등)이면 고르지 않아요.
// 사용자가 직접 고른 칸은 건드리지 않고, 일정 수정 창에서는 동작하지 않아요.
function applyTimetableAutoSelect() {
  if (editingId || formScope) return;
  const typeId = getSelectedTypeId();
  const date = els.formDate.value;

  // 시간표를 쓰지 않는 종류로 바꾸거나 기간·반복을 켜면, 자동으로 골랐던 값을 지워요.
  // (수행평가 기간·반복 일정의 교시는 저장하지 않고 날마다 시간표에서 찾아 달력에 보여 줘요)
  const isMultiDay = els.formRangeToggle.checked || getFormRepeatFreq() !== 'none';
  if (!typeId || !getEventType(typeId).useTimetable || !date || isMultiDay) {
    if (!formTouched.subject) els.formSubject.value = '';
    if (!formTouched.period) els.formPeriod.value = '';
    return;
  }

  const weekday = parseDateKey(date).getDay();
  if (formTouched.period && !formTouched.subject) {
    const period = els.formPeriod.value;
    const cell = period ? timetable.cells[`${weekday}-${period}`] : null;
    const isSubject = cell && cell.kind === 'subject' && subjects.some((s) => s.name === cell.name);
    els.formSubject.value = isSubject ? cell.name : '';
  } else if (formTouched.subject && !formTouched.period) {
    const name = els.formSubject.value;
    const matches = [];
    for (let period = 1; period <= (PERIODS_PER_WEEKDAY[weekday] || 0); period++) {
      const cell = timetable.cells[`${weekday}-${period}`];
      if (name && cell && cell.kind === 'subject' && cell.name === name) matches.push(period);
    }
    els.formPeriod.value = matches.length === 1 ? String(matches[0]) : '';
  }
}

// event가 있으면 수정, 없으면 새 일정 추가 (날짜는 열려 있는 날짜로 미리 채움)
// range: 달력에서 끌어서 고른 기간 { start, end } (이때는 기간이 켜져 있고 종류는 정기고사로 시작)
// scope: 반복 일정을 고칠 때 고른 범위 ('single' | 'from' | 'all'), event는 그 날짜의 일정이에요.
function openEventForm(event, range, scope) {
  formScope = scope || null;
  formOccurrence = scope ? event : null;
  // 전체 수정은 반복 일정 원본(시작일 포함)을 채우고, 나머지는 그 날짜의 일정을 채워요.
  if (scope === 'all') event = events.find((ev) => ev.id === formOccurrence.series.id);
  editingId = event && (!scope || scope === 'all') ? event.id : null;
  formTouched.subject = false;
  formTouched.period = false;
  formTouched.type = Boolean(event); // 기존 일정을 고칠 때는 '기간'을 켜도 종류를 바꾸지 않아요
  formExamSlots = event && event.examSlots ? JSON.parse(JSON.stringify(event.examSlots)) : {};
  els.eventDialogTitle.textContent = event ? '일정 수정' : '일정 추가';
  els.formError.textContent = '';

  fillSubjectOptions(event && event.subject);
  els.formDate.value = event ? event.date : range ? range.start : openDayKey;
  els.formRangeToggle.checked = Boolean(range || (event && event.endDate));
  els.formEndDate.value = range ? range.end : (event && event.endDate) || '';
  els.formSubject.value = (event && event.subject) || '';
  els.formTitle.value = event ? event.title : '';
  els.formMemo.value = (event && event.memo) || '';

  // 반복 칸 채우기 ('이 일정만'은 하루 일정이 되니 반복 없이)
  const repeat = event && scope !== 'single' ? event.repeat : null;
  setFormRepeatFreq(repeat ? repeat.freq : 'none');
  setFormWeekdays(repeat && repeat.weekdays ? repeat.weekdays : []);
  els.repeatUntil.value = repeat ? repeat.until : '';
  els.repeatSkip.checked = repeat ? Boolean(repeat.skipHolidays) : true;

  // 새 일정의 기본 종류는 config.js에서 정해요
  selectEventType(event ? event.type : range ? DEFAULT_RANGE_EVENT_TYPE_ID : DEFAULT_EVENT_TYPE_ID);
  fillPeriodOptions(event && event.period); // 종류를 먼저 고른 뒤에 채워야 교시 수가 맞아요
  updateTypeFields();

  els.eventDialog.showModal();
  els.formTitle.focus();
}

function handleEventSubmit(e) {
  e.preventDefault(); // 페이지가 새로고침되지 않도록

  const date = els.formDate.value;
  const typeId = getSelectedTypeId();
  const type = typeId ? getEventType(typeId) : null;
  const subject = (type && type.useSubject && els.formSubject.value) || null;
  // 기간: 종료일이 시작일과 같으면 하루 일정으로 저장해요.
  const rangeEnd = els.formRangeToggle.checked ? els.formEndDate.value : '';
  const endDate = rangeEnd && rangeEnd > date ? rangeEnd : null;
  // 교시 칸이 보일 때만 교시를 저장 (안 골랐으면 없음)
  const period = !els.formPeriodField.hidden && els.formPeriod.value ? Number(els.formPeriod.value) : null;
  const title = els.formTitle.value.trim();
  // 메모: 앞뒤 공백만 지우고 가운데 줄바꿈은 그대로 (공백뿐이면 없는 것으로)
  const memo = els.formMemo.value.trim();
  // 반복 규칙 (반복 안 함이면 null)
  const freq = getFormRepeatFreq();
  const repeat = freq === 'none' ? null : { freq, until: els.repeatUntil.value, skipHolidays: els.repeatSkip.checked };
  if (repeat && freq === 'weekly') repeat.weekdays = getFormWeekdays();

  // 빠진 값이 있으면 저장하지 않고 안내 문구를 보여 줍니다.
  let error = '';
  const subjectRequired = type && type.useSubject;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) error = '날짜를 선택해 주세요.';
  else if (els.formRangeToggle.checked && !rangeEnd) error = '종료일을 선택해 주세요.';
  else if (rangeEnd && rangeEnd < date) error = '종료일은 시작일보다 앞일 수 없어요.';
  else if (!type) error = '종류를 선택해 주세요.';
  else if (type.rangeOnly && !endDate) error = '정기고사는 이틀 이상이에요. 하루 시험은 모의고사로 만들어 주세요.';
  else if (subjectRequired && subjects.length === 0 && !subject) {
    error = "과목이 없어요. 범례의 '+ 과목 추가'로 먼저 과목을 만들어 주세요.";
  } else if (subjectRequired && !subject) error = '과목을 선택해 주세요.';
  else if (!title) error = '내용을 입력해 주세요.';
  else if (repeat && freq === 'weekly' && repeat.weekdays.length === 0) error = '반복할 요일을 골라 주세요.';
  else if (repeat && !repeat.until) error = '반복 종료일을 선택해 주세요.';
  else if (repeat && repeat.until < date) error = '반복 종료일은 시작일보다 앞일 수 없어요.';
  else if (repeat && getOccurrenceDates({ date, repeat }).length === 0) error = '이 조건에 맞는 날짜가 하나도 없어요.';
  if (error) {
    els.formError.textContent = error;
    return;
  }

  // 정기고사의 시험 시간표 (기간 밖 날짜는 지워져요)
  const examSlots = type.examSchedule ? collectExamSlots(date, endDate) : null;

  if (formScope === 'single') {
    // 이 일정만: 그날을 규칙에서 빼고 보통 하루 일정으로 따로 만들어요.
    const series = events.find((ev) => ev.id === formOccurrence.series.id);
    series.repeat.excludedDates = [...(series.repeat.excludedDates || []), formOccurrence.date];
    const detached = { id: createId(), date, type: typeId, subject, title, createdAt: Date.now(), seriesId: series.id };
    if (period) detached.period = period;
    if (memo) detached.memo = memo;
    // 같은 날이면 그날 정해 둔 순서를 이어받아요.
    if (date === formOccurrence.date && typeof formOccurrence.dayOrder === 'number') {
      detached.dayOrder = formOccurrence.dayOrder;
    }
    events.push(detached);
    if (getOccurrenceDates(series).length === 0) events = events.filter((ev) => ev !== series);
  } else if (formScope === 'from') {
    // 이 일정과 이후 모두: 전날까지로 끊고 그날부터 새 일정(보통은 새 반복 일정)을 만들어요.
    const series = events.find((ev) => ev.id === formOccurrence.series.id);
    const cutKey = formOccurrence.date;
    const newEvent = { id: createId(), date, type: typeId, subject, title, createdAt: Date.now() };
    if (period) newEvent.period = period;
    if (memo) newEvent.memo = memo;
    if (repeat) {
      // 빠진 날과 날짜별 순서 중 그날 이후의 것은 새 반복 일정으로 넘겨요.
      repeat.excludedDates = (series.repeat.excludedDates || []).filter((key) => key >= cutKey);
      repeat.dayOrders = {};
      Object.entries(series.repeat.dayOrders || {}).forEach(([key, order]) => {
        if (key >= cutKey) repeat.dayOrders[key] = order;
      });
      newEvent.repeat = repeat;
    }
    // D-day는 앞으로의 날짜가 있는 새 일정으로 옮겨요.
    if (series.dday) {
      newEvent.dday = true;
      newEvent.ddayOrder = series.ddayOrder;
      delete series.dday;
      delete series.ddayOrder;
    }
    // 그날 이후의 따로 고친 날은 새 반복 일정에 연결해요.
    events.forEach((ev) => {
      if (ev.seriesId === series.id && ev.date >= cutKey) ev.seriesId = newEvent.id;
    });
    series.repeat.until = getPreviousDayKey(cutKey);
    events.push(newEvent);
    if (getOccurrenceDates(series).length === 0) events = events.filter((ev) => ev !== series);
  } else if (editingId) {
    // 수정: 기존 일정의 내용만 바꿉니다.
    const target = events.find((ev) => ev.id === editingId);
    if (target) {
      // 다른 날로 옮기면, 원래 날에서 정해 둔 순서는 의미가 없으니 지워요.
      // (옮겨 간 날에서는 기본 순서대로 알맞은 자리에 들어가요)
      // 기간 일정은 위에 고정이라 하루 안 순서도 필요 없어요.
      if (target.date !== date || endDate || repeat) delete target.dayOrder;
      if (repeat) {
        // 전체 수정: 빠진 날과 날짜별 순서는 유지해요.
        const old = target.repeat || {};
        target.repeat = { ...repeat, excludedDates: old.excludedDates || [], dayOrders: old.dayOrders || {} };
      } else {
        delete target.repeat;
      }
      Object.assign(target, { date, type: typeId, subject, title });
      if (endDate) target.endDate = endDate;
      else delete target.endDate;
      if (period) target.period = period;
      else delete target.period;
      if (memo) target.memo = memo;
      else delete target.memo;
      if (examSlots) target.examSlots = examSlots;
      else delete target.examSlots;
    }
  } else {
    // 추가
    const newEvent = { id: createId(), date, type: typeId, subject, title, createdAt: Date.now() };
    if (endDate) newEvent.endDate = endDate;
    if (period) newEvent.period = period;
    if (memo) newEvent.memo = memo;
    if (examSlots) newEvent.examSlots = examSlots;
    if (repeat) newEvent.repeat = { ...repeat, excludedDates: [], dayOrders: {} };
    events.push(newEvent);
  }
  saveEvents();
  els.eventDialog.close();

  // 저장한 날짜가 있는 달로 이동하고, 일정 목록 창도 그 날짜로 바꿔 보여 줍니다.
  // (수정하면서 날짜를 다른 달로 옮겼을 때도 바로 확인할 수 있게)
  // 단, 기간·반복 일정이 지금 보는 달에 걸쳐 있으면 달을 옮기지 않아요.
  const lastKey = endDate || (repeat && repeat.until) || date;
  const viewFirst = toDateKey(new Date(state.year, state.month, 1));
  const viewLast = toDateKey(new Date(state.year, state.month + 1, 0));
  if ((endDate || repeat) && date <= viewLast && lastKey >= viewFirst) {
    renderCalendar();
  } else {
    const saved = parseDateKey(date);
    setMonth(saved.getFullYear(), saved.getMonth());
  }
  renderDdayList(); // D-day 일정의 날짜나 내용이 바뀌었을 수 있으니 목록도 새로
  if (els.dayDialog.open) {
    // 보고 있던 날이 기간 안에 있으면 그 날의 창을 유지해요.
    if (!(openDayKey >= date && openDayKey <= lastKey)) openDayKey = date;
    renderDayDialog();
  }
}

// ---------------------------------------------------------
// 8-1. 백업: JSON 파일로 내보내기 / 가져오기
// ---------------------------------------------------------
const BACKUP_APP_NAME = 'student-calendar'; // 이 앱에서 만든 백업 파일인지 알아보는 표시
// 1: 일정만 / 2: 일정 + 과목 목록 / 3: 일정 + 과목 목록 + 시간표 / 4: 시험이 정기고사·모의고사로 나뉨 / 5: 반복 일정
const BACKUP_VERSION = 5;

// 백업의 반복 규칙 검사. 틀리면 null (= 보통 하루 일정으로 읽어요)
function normalizeImportedRepeat(raw, startDate) {
  const isDate = (key) =>
    typeof key === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(key) && toDateKey(parseDateKey(key)) === key;
  if (!raw || typeof raw !== 'object' || !isDate(raw.until) || raw.until < startDate) return null;
  if (raw.freq !== 'weekly' && raw.freq !== 'monthly') return null;

  const repeat = { freq: raw.freq, until: raw.until, skipHolidays: raw.skipHolidays === true };
  if (raw.freq === 'weekly') {
    const days = Array.isArray(raw.weekdays) ? raw.weekdays : [];
    repeat.weekdays = [...new Set(days.filter((d) => Number.isInteger(d) && d >= 0 && d <= 6))];
    if (repeat.weekdays.length === 0) return null;
  }
  repeat.excludedDates = Array.isArray(raw.excludedDates) ? raw.excludedDates.filter(isDate) : [];
  repeat.dayOrders = {};
  Object.entries(raw.dayOrders && typeof raw.dayOrders === 'object' ? raw.dayOrders : {}).forEach(([key, order]) => {
    if (isDate(key) && typeof order === 'number') repeat.dayOrders[key] = order;
  });
  return repeat;
}

// 지금 일정 전체와 과목 목록, 시간표를 파일로 저장 (D-day 설정, 교시, 정한 순서도 함께 들어가요)
function exportEvents() {
  const data = {
    app: BACKUP_APP_NAME,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    subjects: subjects,
    timetable: timetable,
    events: events,
  };
  // 사람이 열어 봐도 읽기 쉽게 줄바꿈·들여쓰기를 넣어서 저장
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  // 보이지 않는 링크를 만들어 눌러서 파일을 내려받게 합니다.
  const link = document.createElement('a');
  link.href = url;
  link.download = `달력 백업(${getTodayKey()}).json`; // 예: 달력 백업(2026-10-30).json
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

// 파일에서 읽은 일정 하나를 검사하고 앱이 쓰는 모양으로 다듬습니다.
// 날짜·내용이 없거나 형식이 틀리면 null (= 건너뜀)
function normalizeImportedEvent(original, usedIds) {
  if (!original || typeof original !== 'object') return null;
  // 예전 백업의 '시험'은 지금 종류로 바꿔서 읽어요. (파일 내용 자체는 건드리지 않아요)
  const raw = { ...original };
  migrateOldExam(raw);
  if (typeof raw.date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(raw.date)) return null;
  // '2026-13-45'처럼 모양은 맞지만 없는 날짜도 걸러냅니다. (Date로 바꿨다가 되돌렸을 때 그대로여야 진짜 날짜)
  if (toDateKey(parseDateKey(raw.date)) !== raw.date) return null;
  if (typeof raw.title !== 'string' || !raw.title.trim()) return null;

  // 모르는 종류면 마지막 종류('기타')로
  const type = EVENT_TYPES.some((t) => t.id === raw.type) ? raw.type : EVENT_TYPES[EVENT_TYPES.length - 1].id;
  const useSubject = getEventType(type).useSubject;

  // id가 없거나 겹치면 새로 만들어 줘요.
  let id = typeof raw.id === 'string' && raw.id && !raw.id.includes('@') ? raw.id : createId();
  while (usedIds.has(id)) id = createId();
  usedIds.add(id);

  const event = {
    id,
    date: raw.date,
    type,
    subject: useSubject && typeof raw.subject === 'string' ? raw.subject : null,
    title: raw.title.trim().slice(0, 100),
    createdAt: typeof raw.createdAt === 'number' ? raw.createdAt : Date.now(),
  };
  if (raw.dday === true) {
    event.dday = true;
    event.ddayOrder = typeof raw.ddayOrder === 'number' ? raw.ddayOrder : Date.now();
  }
  // 교시: 교시를 쓰는 종류이고 1~10 사이 정수일 때만
  if (getEventType(type).periods && Number.isInteger(raw.period) && raw.period >= 1 && raw.period <= 10) {
    event.period = raw.period;
  }
  // 기간 일정의 종료일: 진짜 날짜이고 시작일보다 뒤일 때만 (없는 예전 백업도 그대로 읽혀요)
  const validEnd =
    typeof raw.endDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(raw.endDate) &&
    toDateKey(parseDateKey(raw.endDate)) === raw.endDate && raw.endDate > raw.date;
  if (validEnd) {
    event.endDate = raw.endDate;
    // 수행평가 기간 일정의 교시는 저장하지 않아요. (날마다 시간표에서 찾아요)
    if (getEventType(type).useTimetable) delete event.period;
    // 정기고사의 시험 시간표: 기간 안의 날짜, 1~3교시, 과목 이름이 있는 칸만 받아요.
    if (getEventType(type).examSchedule && raw.examSlots && typeof raw.examSlots === 'object') {
      const slots = {};
      Object.keys(raw.examSlots).forEach((key) => {
        if (key < raw.date || key > raw.endDate || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return;
        const day = raw.examSlots[key];
        if (!day || typeof day !== 'object') return;
        Object.keys(day).forEach((p) => {
          const period = Number(p);
          const subject = day[p];
          if (!Number.isInteger(period) || period < 1 || period > EXAM_SLOT_PERIODS) return;
          if (typeof subject !== 'string' || !subject.trim()) return;
          if (!slots[key]) slots[key] = {};
          slots[key][period] = subject.trim().slice(0, 20);
        });
      });
      if (Object.keys(slots).length > 0) event.examSlots = slots;
    }
  } else if (getEventType(type).rangeOnly) {
    event.type = 'exam'; // 종료일이 잘못된 정기고사는 하루 일정인 모의고사로 읽어요
  }
  // 날짜 창에서 정한 순서 (기간 일정에는 없어요)
  if (typeof raw.dayOrder === 'number' && !validEnd) event.dayOrder = raw.dayOrder;
  // 반복 규칙: 반복할 수 있는 종류의 하루 일정만
  if (!validEnd && getEventType(type).repeatable) {
    const repeat = normalizeImportedRepeat(raw.repeat, raw.date);
    if (repeat) {
      event.repeat = repeat;
      delete event.dayOrder;
      if (getEventType(type).useTimetable) delete event.period; // 교시는 날마다 시간표에서 찾아요
    }
  }
  // '이 일정만' 따로 고친 날이 가리키는 원래 반복 일정
  if (typeof raw.seriesId === 'string' && raw.seriesId) event.seriesId = raw.seriesId;
  // 메모 (없는 예전 백업도 그대로 읽혀요)
  if (typeof raw.memo === 'string' && raw.memo.trim()) event.memo = raw.memo.trim().slice(0, 1000);
  return event;
}

// 파일 내용(글자)을 일정 목록으로 바꿉니다. 이 앱의 백업 파일이 아니면 오류를 던져요.
function parseBackup(text) {
  let data;
  try {
    data = JSON.parse(text);
  } catch (e) {
    throw new Error('JSON 형식의 파일이 아니에요.');
  }
  // { events: [...] } 모양이 기본이지만, 일정 배열만 들어 있는 파일도 받아 줘요.
  const list = Array.isArray(data) ? data : data && Array.isArray(data.events) ? data.events : null;
  if (!list) throw new Error('달력 백업 파일이 아니에요.');

  const usedIds = new Set();
  const imported = list
    .map((raw) => normalizeImportedEvent(raw, usedIds))
    .filter(Boolean)
    .filter((ev) => !isRepeatEvent(ev) || getOccurrenceDates(ev).length > 0); // 날짜가 하나도 없는 반복 일정은 빼요
  // 과목 목록이 들어 있는 백업(버전 2부터)이면 과목도 가져와요. 없으면 null (= 지금 과목 유지)
  const importedSubjects =
    data && Array.isArray(data.subjects) ? normalizeSubjectList(data.subjects) : null;
  // 시간표가 들어 있는 백업(버전 3부터)이면 시간표도 가져와요. 없으면 null (= 지금 시간표 유지)
  const importedTimetable = data ? normalizeTimetable(data.timetable) : null;
  return { imported, skipped: list.length - imported.length, importedSubjects, importedTimetable };
}

// 고른 파일을 읽어서, 확인을 받은 뒤 기존 일정을 덮어씁니다.
async function importEventsFromFile(file) {
  let result;
  try {
    result = parseBackup(await file.text());
  } catch (e) {
    alert(`가져오지 못했어요.\n${e.message}`);
    return;
  }
  const { imported, skipped, importedSubjects, importedTimetable } = result;

  // 쓸 수 있는 일정이 하나도 없으면 기존 일정을 지우지 않도록 여기서 멈춰요.
  // 다만 일정이 원래 없고 시간표나 과목만 있는 백업은 정상 파일이니 가져올 수 있어요.
  const hasOtherData = importedTimetable || (importedSubjects && importedSubjects.length > 0);
  if (imported.length === 0 && (skipped > 0 || !hasOtherData)) {
    alert('가져올 수 있는 일정이 없어요. 파일 내용을 확인해 주세요.');
    return;
  }

  let message = `'${file.name}' 파일의 일정 ${imported.length}개를 가져올까요?\n\n`;
  if (skipped > 0) message += `(형식이 맞지 않는 일정 ${skipped}개는 건너뛰어요)\n\n`;
  message += events.length > 0
    ? `⚠️ 지금 저장된 일정 ${events.length}개는 모두 지워지고 파일 내용으로 바뀌어요.\n필요하면 먼저 '내보내기'로 백업해 두세요.`
    : '지금 저장된 일정은 없어요.';
  if (importedSubjects) {
    message += `\n\n과목 목록도 파일에 있는 과목 ${importedSubjects.length}개로 바뀌어요.`;
  }
  if (importedTimetable) {
    message += '\n\n시간표도 파일 내용으로 바뀌어요.';
  }
  if (!confirm(message)) return;

  hideUndoToast(); // 일정 전체가 바뀌니 되돌리기는 취소해요
  events = imported;
  saveEvents();
  if (importedSubjects) {
    subjects = importedSubjects;
    saveSubjects();
  }
  if (importedTimetable) {
    timetable = importedTimetable;
    saveTimetable();
  }
  renderLegend();
  renderCalendar();
  renderDdayList();
  renderTimetable();
  alert(`일정 ${imported.length}개를 가져왔어요.`);
}

// ---------------------------------------------------------
// 9. 달 이동
// ---------------------------------------------------------

// 보여 줄 달을 바꾸는 모든 곳(화살표, 오늘, 직접 입력, D-day, 일정 창 화살표)이 이 함수를 써요.
// 달이 실제로 바뀌면 날짜 칸들이 옆에서 부드럽게 밀려 들어오는 연출을 넣습니다.
//   미래 달로 가면 → 오른쪽에서, 과거 달로 가면 → 왼쪽에서 들어와요.
function setMonth(year, month) {
  // 몇 달 차이인지 계산해서 방향만 알아냅니다. (+1 = 앞으로, -1 = 뒤로, 0 = 그대로)
  const direction = Math.sign((year - state.year) * 12 + (month - state.month));
  state.year = year;
  state.month = month;
  renderCalendar();
  if (direction !== 0) playSlide(direction);
}

function playSlide(direction) {
  const grid = els.grid;
  grid.classList.remove('slide-next', 'slide-prev');
  // 빠르게 여러 번 눌러도 매번 처음부터 다시 움직이도록, 브라우저가 한 번 화면을 계산하게 합니다.
  void grid.offsetWidth;
  grid.classList.add(direction > 0 ? 'slide-next' : 'slide-prev');
}

// step이 -1이면 이전 달, +1이면 다음 달
function moveMonth(step) {
  // Date가 12월 → 다음 해 1월 같은 계산을 대신 해 줍니다.
  const moved = new Date(state.year, state.month + step, 1);
  setMonth(moved.getFullYear(), moved.getMonth());
}

function goToToday() {
  const now = new Date();
  setMonth(now.getFullYear(), now.getMonth());
}

// 연도·월 입력칸에 직접 입력한 값으로 이동합니다.
// 잘못된 값(빈칸, 13월, 범위 밖 연도 등)이면 원래 보고 있던 달로 되돌립니다.
const YEAR_MIN = 1900;
const YEAR_MAX = 2100;

function goToInputMonth() {
  const year = Number(els.yearInput.value);
  const month = Number(els.monthInput.value);
  const isValid =
    Number.isInteger(year) && year >= YEAR_MIN && year <= YEAR_MAX &&
    Number.isInteger(month) && month >= 1 && month <= 12;

  if (isValid) {
    setMonth(year, month - 1); // 다시 자바스크립트 기준(0~11)으로
  } else {
    renderCalendar(); // 잘못된 값이면 이 과정에서 입력칸이 원래 값으로 돌아갑니다.
  }
}

// ---------------------------------------------------------
// 9-1. 오늘 날짜·요일 + 현재 시각 (24시간제 '시:분', 마우스를 올리면 ':초'도 보여요)
// ---------------------------------------------------------

// '2026년 10월 31일 토요일' — 요일은 달력과 같은 색 (토 파랑, 일·공휴일 빨강)
// 연도·월·일·요일을 따로따로 만들어 두어서, 자리가 모자라면 하나씩 숨길 수 있게 해요.
// 날짜가 바뀔 때만 다시 만들어요.
function updateTodayDate() {
  const key = getTodayKey();
  if (els.todayDate.dataset.key === key) return;
  els.todayDate.dataset.key = key;

  const now = parseDateKey(key);
  const part = (className, text) => {
    const span = document.createElement('span');
    span.className = className;
    span.textContent = text;
    return span;
  };
  const weekday = part('td-weekday', `${WEEKDAY_NAMES[now.getDay()]}요일`);
  if (now.getDay() === 6) weekday.classList.add('sat');
  if (now.getDay() === 0 || holidayMap[key]) weekday.classList.add('sun');

  els.todayDate.replaceChildren(
    part('td-year', `${now.getFullYear()}년`),
    part('td-month', `${now.getMonth() + 1}월`),
    part('td-day', `${now.getDate()}일`),
    weekday
  );
  fitNow(); // 글자 길이가 바뀌었을 수 있으니 (예: 9월 → 10월) 다시 맞춰요
}

// 빈 공간에 들어가는 만큼만 날짜를 보여 줘요.
// 단계(level)가 높을수록 많이 보여요. 넓어질수록 시각 → 일 → 요일 → 월 → 연도 순으로 늘어나요.
//   4: 2026년 10월 31일 토요일 19:02
//   3: 10월 31일 토요일 19:02
//   2: 31일 토요일 19:02
//   1: 31일 19:02
//   0: 19:02
// 가장 많이 보이는 단계부터 하나씩 줄여 가며, 글자가 칸 밖으로 넘치지 않는 첫 단계를 골라요.
function fitNow() {
  for (let level = 4; level >= 0; level--) {
    els.now.dataset.level = level;
    if (els.now.scrollWidth <= els.now.clientWidth) return;
  }
}

function updateClock() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  els.clockHM.textContent = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  els.clockSec.textContent = `:${pad(now.getSeconds())}`;
  els.clock.dateTime = now.toISOString();

  // 달력을 켜 둔 채 자정이 지나면 '오늘' 표시, D-day 숫자, 시간표의 오늘 요일을 새로 계산해요.
  if (getTodayKey() !== renderedTodayKey) {
    holidayMap = buildHolidayMap();
    renderCalendar();
    renderDdayList();
    renderTimetable();
  }
  updateTodayDate();
}

// 창 크기가 바뀌거나 휴대폰을 가로/세로로 돌리면 날짜를 얼마나 보여 줄지 다시 맞춰요.
// (달력 판의 크기가 바뀌는 것을 지켜보다가 바뀔 때마다 fitNow 실행)
new ResizeObserver(() => fitNow()).observe(els.now.parentElement);

// 매초 정각(0.000초)에 맞춰 바뀌도록, 다음 초까지 남은 시간만큼 기다렸다가 다시 실행해요.
function startClock() {
  updateClock();
  setTimeout(startClock, 1000 - (Date.now() % 1000));
}

// ---------------------------------------------------------
// 10. 라이트/다크 모드
//    - 저장된 선택이 없으면 시스템 설정을 따릅니다. (CSS가 처리)
//    - 버튼을 누르면 <html data-theme="..."> 을 바꾸고 저장합니다.
// ---------------------------------------------------------
const systemDarkQuery = window.matchMedia('(prefers-color-scheme: dark)');

// 지금 실제로 보이는 모드가 무엇인지 알아냅니다.
function getCurrentTheme() {
  const chosen = document.documentElement.dataset.theme;
  if (chosen === 'light' || chosen === 'dark') return chosen;
  return systemDarkQuery.matches ? 'dark' : 'light';
}

// 테마 버튼 아이콘 (윤곽선만 있는 그림, 색은 글자색을 따라감)
const ICONS = {
  moon: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>',
  sun:
    '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.5"/>' +
    '<path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41"/></svg>',
};

// 버튼 아이콘을 "누르면 바뀔 모드" 기준으로 보여 줍니다.
// (지금 라이트 → 달 모양, 지금 다크 → 해 모양)
function updateThemeButton() {
  const isDark = getCurrentTheme() === 'dark';
  const label = isDark ? '라이트 모드로 전환' : '다크 모드로 전환';
  els.theme.innerHTML = isDark ? ICONS.sun : ICONS.moon;
  els.theme.setAttribute('aria-label', label);
  els.theme.title = label;
}

function applySavedTheme() {
  const saved = loadSetting(STORAGE_KEYS.theme);
  if (saved === 'light' || saved === 'dark') {
    document.documentElement.dataset.theme = saved;
  }
  updateThemeButton();
}

function toggleTheme() {
  const next = getCurrentTheme() === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = next;
  saveSetting(STORAGE_KEYS.theme, next);
  updateThemeButton();
}

// ---------------------------------------------------------
// 11. 시작하기: 버튼 연결 후 첫 화면 그리기
// ---------------------------------------------------------
els.prev.addEventListener('click', () => moveMonth(-1));
els.next.addEventListener('click', () => moveMonth(1));
els.today.addEventListener('click', goToToday);
els.theme.addEventListener('click', toggleTheme);

// 연도·월 입력칸: Enter를 누르거나 다른 곳을 클릭하면('change') 그 달로 이동
// 칸을 누르면 숫자 전체가 선택돼서 바로 새 숫자를 쳐 넣을 수 있어요.
[els.yearInput, els.monthInput].forEach((input) => {
  input.addEventListener('change', goToInputMonth);
  input.addEventListener('focus', () => input.select());
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') input.blur(); // Enter 후 입력칸에서 빠져나오기
  });
});

// 날짜 칸 클릭 → 그날의 일정 목록 창 (일정 위를 눌러도 그 아래 날짜의 창이 열려요)
// (칸이 매번 새로 만들어지므로, 칸마다가 아니라 달력 전체에 한 번만 연결합니다)
els.grid.addEventListener('click', (e) => {
  if (rangeDragJustEnded) return; // 끌어서 기간을 고른 직후의 클릭은 무시
  const cell = e.target.closest('.day') || getDayCellAt(e.clientX, e.clientY);
  if (cell) openDayDialog(cell.dataset.date);
});

// 달력에서 끌어서 기간 고르기
els.grid.addEventListener('pointerdown', handleRangeDragStart);
// 휴대폰에서 길게 누른 뒤 끌 때는 화면이 스크롤되지 않게, 길게 누른 순간 메뉴가 뜨지 않게 막아요.
els.grid.addEventListener('touchmove', (e) => {
  if (rangeDrag && rangeDrag.active) e.preventDefault();
}, { passive: false });
els.grid.addEventListener('contextmenu', (e) => {
  if (rangeDrag && rangeDrag.isTouch) e.preventDefault();
});
els.grid.addEventListener('keydown', (e) => {
  const cell = e.target.closest('.day');
  if (cell && (e.key === 'Enter' || e.key === ' ')) {
    e.preventDefault();
    openDayDialog(cell.dataset.date);
  }
});

// 일정 목록 창: 닫기 버튼, 바깥(어두운 부분) 클릭으로 닫기, 일정 추가 버튼
// (일정을 끌다가 창 바깥에서 손을 뗐을 때는 닫지 않아요)
els.dayClose.addEventListener('click', () => els.dayDialog.close());
els.dayDialog.addEventListener('click', (e) => {
  if (e.target === els.dayDialog && !dragJustEnded) els.dayDialog.close();
});
els.addEvent.addEventListener('click', () => openEventForm(null));
els.dayDialog.addEventListener('close', () => {
  expandedMemoIds.clear(); // 창을 닫으면 메모를 다시 접어요
  placeUndoToast(); // 되돌리기 알림은 남은 시간 동안 본문에서 계속 보여요
});
els.undoBtn.addEventListener('click', undoDelete);
// 창 폭이 바뀌면 메모 줄 수도 달라지니 '더 보기' 버튼을 다시 맞춰요.
window.addEventListener('resize', updateMemoToggles);

// 일정 목록 창: 양옆 화살표 버튼, 키보드 ← → 로 전날/다음날 이동
els.dayPrev.addEventListener('click', () => moveDay(-1));
els.dayNext.addEventListener('click', () => moveDay(1));
els.dayDialog.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowLeft') moveDay(-1);
  if (e.key === 'ArrowRight') moveDay(1);
});

// 일정 추가/수정 창 (입력하던 내용이 날아가지 않게 바깥 클릭으로는 닫히지 않아요. 취소 또는 Esc)
els.eventForm.addEventListener('submit', handleEventSubmit);
els.formCancel.addEventListener('click', () => els.eventDialog.close());
// 날짜를 바꾸면 그 요일에 맞게 교시 목록(6교시/7교시)을 다시 만들어요.
els.formDate.addEventListener('change', updateTypeFields);
els.formRangeToggle.addEventListener('change', handleRangeToggle);
els.formEndDate.addEventListener('change', updateTypeFields); // 시험 시간표의 날짜 줄을 다시 만들어요
els.repeatFreq.addEventListener('change', handleRepeatFreqChange);
els.scopeDialog.addEventListener('click', handleScopeChoice);
// 과목이나 교시를 직접 고르면 기억해 두고, 나머지 칸을 시간표에서 자동으로 골라요.
els.formSubject.addEventListener('change', () => {
  formTouched.subject = true;
  applyTimetableAutoSelect();
});
els.formPeriod.addEventListener('change', () => {
  formTouched.period = true;
  applyTimetableAutoSelect();
});

// 시간표: 등록/수정/완료 버튼, 전체 비우기
els.timetableRegister.addEventListener('click', toggleTimetableEditing);
els.timetableEdit.addEventListener('click', toggleTimetableEditing);
els.timetableClear.addEventListener('click', clearTimetable);
// 시간표 칸 클릭 → 작은 선택 창 (수정 모드의 칸에만 data-cell이 있어요)
els.timetableTable.addEventListener('click', (e) => {
  const cell = e.target.closest('[data-cell]');
  if (cell) openTimetablePicker(cell.dataset.cell, cell);
});

// 시간표 선택 창: 바깥 클릭으로 닫기, 직접 추가, 비우기
els.ttPicker.addEventListener('click', (e) => {
  if (e.target === els.ttPicker) els.ttPicker.close();
});
els.ttPickerAddToggle.addEventListener('click', () => {
  els.ttPickerAddToggle.hidden = true;
  els.ttPickerAddForm.hidden = false;
  els.ttPickerAddName.focus();
  // 입력칸이 나타나 창이 길어졌으니 화면 안에 들어오도록 다시 맞춰요.
  const anchor = els.timetableTable.querySelector(`[data-cell="${pickerCellKey}"]`);
  if (anchor) positionTimetablePicker(anchor);
});
els.ttPickerAddForm.addEventListener('submit', handleTimetableCustomAdd);
els.ttPickerClear.addEventListener('click', () => setTimetableCell(pickerCellKey, null));

// 끌어서 순서 바꾸기: 하루 일정 목록, 과목 목록
makeSortable(els.dayList, reorderDayEvents);
makeSortable(els.legendSubjects, reorderSubjects);

// 과목 추가/수정 창
els.addSubject.addEventListener('click', () => openSubjectForm(null));
els.subjectForm.addEventListener('submit', handleSubjectSubmit);
els.subjectCancel.addEventListener('click', () => els.subjectDialog.close());
els.subjectDelete.addEventListener('click', deleteSubject);
els.subjectColor.addEventListener('input', updateColorSelection); // '직접 고르기'로 색을 바꿨을 때

// 직접 모드를 고르지 않은 상태에서 시스템 설정이 바뀌면 버튼 아이콘도 맞춰 줍니다.
systemDarkQuery.addEventListener('change', updateThemeButton);

// 달력을 켜 둔 채 자정이 지나면, 다시 볼 때 '오늘'과 '지난 날짜'를 새로 계산합니다.
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && getTodayKey() !== renderedTodayKey) {
    holidayMap = buildHolidayMap(); // 해가 바뀌었으면 공휴일 표시 범위도 다시 계산
    renderCalendar();
    renderDdayList(); // D-day 숫자도 하루씩 바뀌어야 하니까
    renderTimetable(); // 시간표의 오늘 요일 강조도
  }
});

// 백업: 내보내기 / 가져오기
els.exportBtn.addEventListener('click', exportEvents);
els.importBtn.addEventListener('click', () => els.importFile.click()); // 파일 고르는 창 열기
els.importFile.addEventListener('change', () => {
  const file = els.importFile.files[0];
  if (file) importEventsFromFile(file);
  els.importFile.value = ''; // 같은 파일을 다시 골라도 동작하도록 비워 둠
});

// D-day 정렬 바꾸기 (선택한 정렬은 저장돼서 다음에 열어도 유지)
els.ddaySort.addEventListener('change', () => {
  saveSetting(STORAGE_KEYS.ddaySort, els.ddaySort.value);
  renderDdayList();
});

applySavedTheme();
buildTypeOptions();
buildColorOptions();
renderLegend();
renderCalendar();
renderDdayList();
renderTimetable();
startClock();
