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

async function showDueOverview() {
  studyTop.classList.add('hidden');
  area.innerHTML = '<div class="loader"></div>';
  try {
    const dueCards = await api('/learning/due?direction=MIXED&limit=100');
    if (!dueCards.length) {
      area.innerHTML = `<section class="due-hero card all-done">
        <div class="due-icon">✓</div><p class="eyebrow">Lịch học hôm nay</p>
        <h1>Bạn chưa có từ đến hạn</h1>
        <p>Hãy chọn một bộ thẻ trong thư viện để học từ mới. Những từ đã học sẽ tự quay lại đây đúng lịch ôn.</p>
        <a class="btn btn-primary" href="../vocabulary-list/">Khám phá thư viện →</a>
      </section>`;
      return;
    }
    area.innerHTML = `<section class="due-heading">
      <div><p class="eyebrow">Lịch ôn tập</p><h1>Từ cần học hôm nay</h1><p>${dueCards.length} từ đã đến hạn. Ôn trước khi học thêm từ mới nhé.</p></div>
      <button class="btn btn-primary" id="startDue">Bắt đầu học ${dueCards.length} từ →</button>
    </section>
    <section class="due-list card">${dueCards.map((card, position) => `<article>
      <span class="due-number">${String(position + 1).padStart(2, '0')}</span>
      <div><strong>${esc(card.word)}</strong><small>${esc(card.partOfSpeech)} · ${esc(card.ukIpa || 'chưa có IPA')}</small></div>
      <p>${esc(card.meaning)}</p><span class="due-badge">Đến hạn</span>
    </article>`).join('')}</section>`;
    document.querySelector('#startDue').addEventListener('click', () => {
      sessionType = 'due';
      loadSession();
    });
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
  const endpoint = sessionType === 'due'
    ? `/learning/due?direction=${mode}&limit=100`
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
  const context = sessionType === 'deck' ? deckTitle : 'Ôn tập đến hạn';
  area.innerHTML = `<p class="session-name">${esc(context)}</p>
    <article class="card flashcard ${showingAnswer ? 'is-answer' : ''}" id="flashcard">
      ${showingAnswer ? answerFace(card) : questionFace(card)}
    </article>
    <button class="btn btn-secondary reveal" id="flipCard">↻ ${showingAnswer ? 'Quay lại câu hỏi' : 'Lật thẻ xem đáp án'}</button>
    ${answerUnlocked ? `<div class="ratings">
      <button class="rating" data-rating="FORGOT">1 · Quên<small>Ôn lại sau 10 phút</small></button>
      <button class="rating" data-rating="HARD">2 · Khó<small>Đi chậm hơn</small></button>
      <button class="rating" data-rating="REMEMBERED">3 · Đã nhớ<small>Đúng lịch</small></button>
      <button class="rating" data-rating="TOO_EASY">4 · Quá dễ<small>Tiến nhanh hơn</small></button>
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
else await showDueOverview();
