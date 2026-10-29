const DEFAULT_IDS = '1,2,3';
const MAX_IDS = 5;
const MAX_DELAY = 5000;

const usersEl = document.getElementById('users');
const summaryEl = document.getElementById('summary');
const cancelBtn = document.getElementById('cancel');

function isIntegerString(value) {
  const number = Number(value);
  return Number.isInteger(number) && String(number) === value;
}

function isValidId(value) {
  return isIntegerString(value) && Number(value) > 0;
}

function isValidDelay(value) {
  const number = Number(value);
  return isIntegerString(value) && number >= 0 && number <= MAX_DELAY;
}

function parseParams() {
  const params = new URLSearchParams(location.search);
  const rawIds = params.has('ids') ? params.get('ids') : DEFAULT_IDS;
  const rawDelay = params.has('delay') ? params.get('delay') : '0';

  const parts = rawIds.split(',');

  if (parts.length > MAX_IDS || !parts.every(isValidId)) {
    return {
      error: 'Некорректный параметр ids: нужно от 1 до 5 положительных целых чисел через запятую.'
    };
  }

  if (!isValidDelay(rawDelay)) {
    return {
      error: 'Некорректный параметр delay: нужно целое число от 0 до 5000.'
    };
  }

  return { ids: parts.map(Number), delay: Number(rawDelay) };
}

function setSummary(state, text) {
  summaryEl.dataset.state = state;
  summaryEl.textContent = text;
}

function createPlaceholder(id) {
  const article = document.createElement('article');
  article.dataset.id = String(id);
  article.dataset.state = 'loading';
  article.textContent = 'Загрузка пользователя ' + id + '...';
  return article;
}

function fillSuccess(article, user) {
  article.dataset.state = 'success';
  article.replaceChildren();

  const name = document.createElement('h2');
  name.className = 'name';
  name.textContent = user.firstName + ' ' + user.lastName;

  const email = document.createElement('a');
  email.className = 'email';
  email.href = 'mailto:' + user.email;
  email.textContent = user.email;

  const city = document.createElement('span');
  city.className = 'city';
  city.textContent = user.address?.city ?? '';

  const company = document.createElement('span');
  company.className = 'company';
  company.textContent = user.company?.name ?? '';

  article.append(name, email, city, company);
}

function fillFailure(article, state, message) {
  article.dataset.state = state;
  article.replaceChildren();

  const span = document.createElement('span');
  span.className = 'message';
  span.textContent = message;

  article.append(span);
}

function updateFinalSummary(ok, failed, aborted) {
  if (aborted > 0) {
    setSummary(
      'aborted',
      'Отменено; загружено: ' + ok + '; ошибок: ' + failed + '; отменено запросов: ' + aborted
    );
  } else if (failed === 0) {
    setSummary('success', 'Загружено: ' + ok + '; ошибок: 0');
  } else if (ok > 0) {
    setSummary('partial', 'Загружено: ' + ok + '; ошибок: ' + failed);
  } else {
    setSummary('error', 'Загружено: 0; ошибок: ' + failed);
  }
}

async function fetchUser(id, delay, signal) {
  const url = new URL('https://dummyjson.com/users/' + id);
  url.searchParams.set('delay', String(delay));

  const response = await fetch(url, { signal: signal });

  if (!response.ok) {
    throw new Error('HTTP ' + response.status);
  }

  return await response.json();
}

async function main() {
  const parsed = parseParams();

  if (parsed.error) {
    setSummary('error', parsed.error);
    cancelBtn.disabled = true;
    return;
  }

  const ids = parsed.ids;
  const delay = parsed.delay;
  const controller = new AbortController();
  let finished = false;

  const articles = ids.map(createPlaceholder);
  usersEl.append(...articles);

  function onCancelClick() {
    if (!finished) {
      controller.abort();
    }
  }
  cancelBtn.addEventListener('click', onCancelClick);

  const requests = [];
  for (let i = 0; i < ids.length; i++) {
    requests.push(fetchUser(ids[i], delay, controller.signal));
  }

  const results = await Promise.allSettled(requests);
  finished = true;

  let ok = 0;
  let failed = 0;
  let aborted = 0;

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    const article = articles[i];

    if (result.status === 'fulfilled') {
      fillSuccess(article, result.value);
      ok++;
    } else if (result.reason?.name === 'AbortError') {
      fillFailure(article, 'aborted', 'Запрос отменён');
      aborted++;
    } else {
      fillFailure(article, 'error', result.reason?.message || 'Ошибка сети');
      failed++;
    }
  }

  updateFinalSummary(ok, failed, aborted);
}

main();
