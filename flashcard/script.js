import { api, toast } from '../shared/api.js';

const area = document.querySelector('#learningArea');
const studyTop = document.querySelector('#studyTop');
const counter = document.querySelector('#counter');
const bar = document.querySelector('#progressBar');
const query = new URLSearchParams(location.search);
const deckSlug = query.get('deck');
const deckTitle = query.get('title') || 'Bộ thẻ đã chọn';
const requestedBack = query.get('back');
const deckBack = requestedBack?.startsWith('../vocabulary-detail/') ? requestedBack : '../vocabulary-list/';
let mode = 'MIXED';
let sessionType = deckSlug ? 'deck' : null;
let cards = [];
let index = 0;
let showingAnswer = false;
let answerUnlocked = false;
let overviewCards = [];
let countdownTimer;
const scores = { FORGOT: 0, HARD: 0, REMEMBERED: 0, TOO_EASY: 0 };

function esc(value) {
  const node = document.createElement('div');
  node.textContent = value ?? '';
  return node.innerHTML;
}

document.querySelectorAll('.modes button').forEach(button => button.addEventListener('click', async () => {
  document.querySelector('.modes .active')?.classList.remove('active');
  button.classList.add('active');
  mode = button.dataset.mode;
  await loadSession();
}));

document.querySelector('#exitStudy').addEventListener('click', () => {
  if (sessionType === 'deck') location.href = deckBack;
  else location.href = '../flashcard/';
});

function cardState(card, now = Date.now()) {
  if (card.newWord) return 'new';
  if (card.nextReviewAt && new Date(card.nextReviewAt).getTime() <= now) return 'due';
  return 'upcoming';
}

function remainingText(nextReviewAt) {
  const remaining = new Date(nextReviewAt).getTime() - Date.now();
  if (remaining <= 0) return 'Đến hạn';
  const minutes = Math.ceil(remaining / 60000);
  if (minutes < 60) return `Còn ${minutes} phút`;
  const hours = Math.floor(minutes / 60);
  const extraMinutes = minutes % 60;
  if (hours < 24) return `Còn ${hours} giờ${extraMinutes ? ` ${extraMinutes} phút` : ''}`;
  const days = Math.floor(hours / 24);
  const extraHours = hours % 24;
  if (days < 30) return `Còn ${days} ngày${extraHours ? ` ${extraHours} giờ` : ''}`;
  const months = Math.floor(days / 30);
  const extraDays = days % 30;
  return `Còn ${months} tháng${extraDays ? ` ${extraDays} ngày` : ''}`;
}

function reviewDelayText(seconds) {
  if (seconds == null) return '—';
  if (seconds < 3600) return `${Math.round(seconds / 60)} phút`;
  if (seconds < 86400) return `${Math.round(seconds / 3600)} giờ`;
  const days = seconds / 86400;
  return `${Number.isInteger(days) ? days : days.toFixed(1)} ngày`;
}

function updateCountdowns() {
  document.querySelectorAll('[data-next-review]').forEach(badge => {
    const text = remainingText(badge.dataset.nextReview);
    badge.textContent = text;
    if (text === 'Đến hạn') {
      badge.classList.remove('upcoming');
      badge.classList.add('due');
    }
  });
}

function renderOverviewList(filter = 'all') {
  const list = document.querySelector('#allVocabularyList');
  if (!list) return;
  const visible = filter === 'all' ? overviewCards : overviewCards.filter(card => cardState(card) === filter);
  list.innerHTML = visible.length ? visible.map((card, position) => {
    const state = cardState(card);
    const badge = state === 'new'
      ? '<span class="schedule-badge new">Từ mới</span>'
      : state === 'due'
        ? '<span class="schedule-badge due">Đến hạn</span>'
        : `<span class="schedule-badge upcoming" data-next-review="${esc(card.nextReviewAt)}">${remainingText(card.nextReviewAt)}</span>`;
    return `<article>
      <span class="due-number">${String(position + 1).padStart(2, '0')}</span>
      <div><strong>${esc(card.word)}</strong><small>${esc(card.partOfSpeech)} · ${esc(card.ukIpa || 'chưa có IPA')}</small></div>
      <p>${esc(card.meaning)}</p>${badge}
    </article>`;
  }).join('') : '<div class="empty-filter">Không có từ vựng trong nhóm này.</div>';
  updateCountdowns();
}

async function showAllOverview() {
  studyTop.classList.add('hidden');
  area.innerHTML = '<div class="loader"></div>';
  try {
    overviewCards = await api('/learning/all?direction=MIXED');
    if (!overviewCards.length) {
      area.innerHTML = `<section class="due-hero card all-done">
        <div class="due-icon">◇</div><p class="eyebrow">Kho từ của bạn</p>
        <h1>Chưa có từ vựng</h1>
        <p>Hãy chọn hoặc nhập một bộ thẻ trong thư viện để bắt đầu học.</p>
        <a class="btn btn-primary" href="../vocabulary-list/">Khám phá thư viện →</a>
      </section>`;
      return;
    }
    const counts = overviewCards.reduce((result, card) => {
      result[cardState(card)]++;
      return result;
    }, { due: 0, new: 0, upcoming: 0 });
    area.innerHTML = `<section class="all-hero card">
      <div class="all-copy"><p class="eyebrow">Kho từ của bạn</p><h1>Học tất cả từ vựng của tôi</h1>
      <p>Xem toàn bộ từ đã lưu. Từ đến hạn được ưu tiên trước, sau đó là từ mới và các từ đang chờ lịch ôn.</p>
      <button class="btn btn-primary" id="startAll">◇ Bắt đầu học ${overviewCards.length} từ →</button></div>
      <div class="learning-stats"><div class="due-stat"><strong>${counts.due}</strong><span>Đến hạn ôn</span></div><div class="new-stat"><strong>${counts.new}</strong><span>Từ mới</span></div><div class="upcoming-stat"><strong>${counts.upcoming}</strong><span>Chưa đến hạn</span></div><div><strong>${overviewCards.length}</strong><span>Tổng cộng</span></div></div>
    </section>
    <section class="due-heading all-heading"><div><p class="eyebrow">Danh sách từ vựng</p><h2>Tất cả từ</h2></div>
      <div class="list-filters"><button class="active" data-filter="all">Tất cả</button><button data-filter="due">Đến hạn</button><button data-filter="upcoming">Chưa đến hạn</button><button data-filter="new">Từ mới</button></div>
    </section>
    <section class="due-list card" id="allVocabularyList"></section>`;
    renderOverviewList();
    document.querySelector('#startAll').addEventListener('click', () => {
      sessionType = 'all';
      loadSession();
    });
    document.querySelectorAll('[data-filter]').forEach(button => button.addEventListener('click', () => {
      document.querySelector('[data-filter].active')?.classList.remove('active');
      button.classList.add('active');
      renderOverviewList(button.dataset.filter);
    }));
    clearInterval(countdownTimer);
    countdownTimer = setInterval(updateCountdowns, 30000);
  } catch (error) {
    area.innerHTML = `<div class="card empty">${esc(error.message)}</div>`;
    toast(error.message, 'error');
  }
}

async function loadSession() {
  studyTop.classList.remove('hidden');
  area.innerHTML = '<div class="loader"></div>';
  index = 0;
  showingAnswer = false;
  answerUnlocked = false;
  Object.keys(scores).forEach(key => scores[key] = 0);
  clearInterval(countdownTimer);
  const endpoint = sessionType === 'all'
    ? `/learning/all?direction=${mode}`
    : `/learning/session?direction=${mode}&limit=40&deck=${encodeURIComponent(deckSlug)}`;
  try {
    cards = await api(endpoint);
    render();
  } catch (error) {
    area.innerHTML = `<div class="card empty">${esc(error.message)}</div>`;
    toast(error.message, 'error');
  }
}

function render() {
  counter.textContent = `${Math.min(index + 1, cards.length)} / ${cards.length}`;
  bar.style.width = `${cards.length ? index / cards.length * 100 : 0}%`;
  if (!cards.length) {
    area.innerHTML = `<div class="card empty"><h2>Không có thẻ để học</h2><p>Hãy chọn một bộ thẻ khác hoặc quay lại khi có từ đến hạn.</p><a class="btn btn-primary" href="../vocabulary-list/">Mở thư viện</a></div>`;
    return;
  }
  if (index >= cards.length) {
    summary();
    return;
  }
  renderStudyCard();
}

function questionFace(card) {
  const viFirst = card.direction === 'VIETNAMESE_TO_ENGLISH';
  return `<div class="card-label">${viFirst ? 'Nghĩa tiếng Việt' : 'Từ tiếng Anh'} ${card.newWord ? '· Từ mới' : '· Ôn tập'}</div>
    <h2 class="question">${esc(viFirst ? card.meaning : card.word)}</h2>
    ${viFirst ? '' : `<span class="pos">${esc(card.partOfSpeech)}</span><div class="ipa">UK ${esc(card.ukIpa || '—')} · US ${esc(card.usIpa || '—')}</div>`}
    <div class="hint">Chạm để xem mặt còn lại</div>`;
}

function answerFace(card) {
  return `<div class="answer"><div class="card-label">Đáp án · Có thể lật lại</div>
    <h2 class="answer-word">${esc(card.word)}</h2><span class="pos">${esc(card.partOfSpeech)}</span>
    <div class="ipa">UK ${esc(card.ukIpa || '—')} · US ${esc(card.usIpa || '—')}</div>
    <div class="meaning">${esc(card.meaning)}</div>
    <div class="example">${esc(card.exampleEnglish)}<span>${esc(card.exampleVietnamese)}</span></div></div>`;
}

function renderStudyCard() {
  const card = cards[index];
  const context = sessionType === 'deck' ? deckTitle : 'Tất cả từ vựng';
  const delays = card.reviewAfterSeconds || {};
  area.innerHTML = `<p class="session-name">${esc(context)}</p>
    <article class="card flashcard ${showingAnswer ? 'is-answer' : ''}" id="flashcard">
      ${showingAnswer ? answerFace(card) : questionFace(card)}
    </article>
    <button class="btn btn-secondary reveal" id="flipCard">↻ ${showingAnswer ? 'Quay lại câu hỏi' : 'Lật thẻ xem đáp án'}</button>
    ${answerUnlocked ? `<div class="ratings">
      <button class="rating" data-rating="FORGOT"><span>1 · Học lại</span><strong>${reviewDelayText(delays.FORGOT)}</strong></button>
      <button class="rating" data-rating="HARD"><span>2 · Khó</span><strong>${reviewDelayText(delays.HARD)}</strong></button>
      <button class="rating" data-rating="REMEMBERED"><span>3 · Tốt</span><strong>${reviewDelayText(delays.REMEMBERED)}</strong></button>
      <button class="rating" data-rating="TOO_EASY"><span>4 · Dễ</span><strong>${reviewDelayText(delays.TOO_EASY)}</strong></button>
    </div>` : ''}
    <p class="keyboard">Phím Space lật qua lại · Phím 1–4 đánh giá</p>`;
  document.querySelector('#flashcard').addEventListener('click', toggleCard);
  document.querySelector('#flipCard').addEventListener('click', toggleCard);
  document.querySelectorAll('.rating').forEach(button => button.addEventListener('click', () => rate(button.dataset.rating)));
}

function toggleCard() {
  if (index >= cards.length) return;
  showingAnswer = !showingAnswer;
  if (showingAnswer) answerUnlocked = true;
  renderStudyCard();
}

async function rate(rating) {
  if (!answerUnlocked) return;
  document.querySelectorAll('.rating').forEach(button => button.disabled = true);
  const card = cards[index];
  try {
    await api('/learning/review', {
      method: 'POST',
      body: JSON.stringify({ vocabularyId: card.vocabularyId, rating, learningDirection: card.direction })
    });
    scores[rating]++;
    index++;
    showingAnswer = false;
    answerUnlocked = false;
    render();
  } catch (error) {
    toast(error.message, 'error');
    document.querySelectorAll('.rating').forEach(button => button.disabled = false);
  }
}

function summary() {
  bar.style.width = '100%';
  counter.textContent = `${cards.length} / ${cards.length}`;
  area.innerHTML = `<section class="card summary"><div class="summary-icon">🎉</div><p class="eyebrow">Hoàn thành phiên học</p>
    <h2>Làm tốt lắm!</h2><p class="subtitle">Bạn vừa hoàn thành ${cards.length} lượt học. Hệ thống đã lên lịch ôn tiếp theo.</p>
    <div class="summary-grid"><div><strong>${scores.FORGOT}</strong><span>Quên</span></div><div><strong>${scores.HARD}</strong><span>Khó</span></div><div><strong>${scores.REMEMBERED}</strong><span>Đã nhớ</span></div><div><strong>${scores.TOO_EASY}</strong><span>Quá dễ</span></div></div>
    <a class="btn btn-primary" href="${sessionType === 'deck' ? deckBack : '../flashcard/'}">Hoàn tất</a></section>`;
}

document.addEventListener('keydown', event => {
  if (event.code === 'Space' && !studyTop.classList.contains('hidden')) {
    event.preventDefault();
    toggleCard();
  }
  if (answerUnlocked && ['1', '2', '3', '4'].includes(event.key)) {
    rate(['FORGOT', 'HARD', 'REMEMBERED', 'TOO_EASY'][Number(event.key) - 1]);
  }
});

if (deckSlug) await loadSession();
else await showAllOverview();
