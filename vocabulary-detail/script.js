import { api, toast } from '../shared/api.js';

const detail = document.querySelector('#detail');
const dialog = document.querySelector('#editDialog');
const slug = new URLSearchParams(location.search).get('deck');
const fields = ['word', 'partOfSpeech', 'ukIpa', 'usIpa', 'meaning', 'exampleEnglish', 'exampleVietnamese'];
let library;
let topic;
let words = [];
let editingId;

function esc(value) { const node = document.createElement('div'); node.textContent = value ?? ''; return node.innerHTML; }
function flatten(nodes, parent = null) { return nodes.flatMap(node => [{ ...node, parent }, ...flatten(node.children, node)]); }

function childCard(child) {
  return `<article class="child-card">
    <div class="child-top"><span class="level">${esc(child.level)}</span><button class="delete-small" data-delete-deck="${child.id}" data-title="${esc(child.title)}" title="Xóa bộ thẻ">⌫</button></div>
    <h3>${esc(child.title)}</h3><p>${esc(child.description)}</p>
    <div class="child-count"><strong>${child.children.length} bộ con</strong><span>· ${child.totalCards} thẻ</span></div>
    <div class="mini-progress"><span style="width:${child.progressPercent}%"></span></div>
    <div class="child-footer"><span>${child.dueCount ? `${child.dueCount} đến hạn` : 'Sẵn sàng'}</span><a href="?deck=${encodeURIComponent(child.slug)}">Xem chi tiết →</a></div>
  </article>`;
}

function wordRow(item, index) {
  return `<article class="word-row">
    <span class="word-number">${index + 1}</span>
    <div class="word-main"><strong>${esc(item.word)}</strong><small><i>${esc(item.partOfSpeech)}</i> · ${esc(item.ukIpa || item.usIpa || 'Chưa có IPA')}</small></div>
    <div class="word-meaning"><strong>${esc(item.meaning)}</strong><p>${esc(item.exampleEnglish)}<span>${esc(item.exampleVietnamese)}</span></p></div>
    <button class="edit-word" data-edit-word="${item.id}">Sửa</button>
  </article>`;
}

function render() {
  const back = topic.parent ? `?deck=${encodeURIComponent(topic.parent.slug)}` : '../vocabulary-list/';
  const returnPath = `../vocabulary-detail/?deck=${encodeURIComponent(topic.slug)}`;
  const study = topic.containsCards ? `<a class="btn btn-primary" href="../flashcard/?deck=${encodeURIComponent(topic.slug)}&title=${encodeURIComponent(topic.title)}&back=${encodeURIComponent(returnPath)}">◇ Học bằng Flashcard</a>` : '';
  detail.innerHTML = `<a class="back" href="${back}">← ${topic.parent ? `Quay lại ${esc(topic.parent.title)}` : 'Quay lại thư viện'}</a>
    <section class="deck-hero card"><div><p class="eyebrow">${topic.parent ? 'Bộ thẻ' : 'Chủ đề lớn'}</p><div class="hero-title"><span class="level">${esc(topic.level)}</span><h1>${esc(topic.title)}</h1></div><p>${esc(topic.description)}</p><div class="hero-stats"><strong>${topic.totalCards} thẻ</strong><span>${topic.children.length} bộ con</span><span>${topic.learnedCount} đã học</span><span>${topic.dueCount} đến hạn</span></div></div><div class="hero-actions">${study}<button class="btn danger" data-delete-deck="${topic.id}" data-title="${esc(topic.title)}">Xóa bộ thẻ</button></div></section>
    ${topic.children.length ? `<section class="children-section"><div class="section-heading"><h2>Các bộ thẻ bên trong</h2><span>${topic.children.length} bộ</span></div><div class="children-grid">${topic.children.map(childCard).join('')}</div></section>` : ''}
    <section class="words-section"><div class="section-heading"><div><p class="eyebrow">Danh sách từ</p><h2>Từ vựng trong bộ này</h2></div><span>${words.length} từ</span></div>
      ${words.length ? `<div class="word-list card">${words.map(wordRow).join('')}</div>` : '<div class="card empty"><h3>Chưa có từ trực tiếp trong bộ này</h3><p>Hãy chọn một bộ con hoặc nhập Excel vào bộ này.</p></div>'}
    </section>`;
}

async function load() {
  try {
    library = await api('/decks');
    topic = flatten(library.topics).find(item => item.slug === slug);
    if (!topic) throw new Error('Không tìm thấy bộ thẻ');
    const result = await api(`/vocabularies?deck=${encodeURIComponent(topic.slug)}&size=100&sort=word`);
    words = result.content;
    render();
  } catch (error) { detail.innerHTML = `<div class="card empty">${esc(error.message)}</div>`; toast(error.message, 'error'); }
}

async function removeDeck(button) {
  if (!confirm(`Xóa “${button.dataset.title}” cùng toàn bộ bộ con và từ vựng bên trong?`)) return;
  button.disabled = true;
  try {
    await api(`/decks/${button.dataset.deleteDeck}`, { method: 'DELETE' });
    toast('Đã xóa bộ thẻ');
    if (String(topic.id) === button.dataset.deleteDeck) location.href = topic.parent ? `?deck=${encodeURIComponent(topic.parent.slug)}` : '../vocabulary-list/';
    else await load();
  } catch (error) { toast(error.message, 'error'); button.disabled = false; }
}

function openEdit(id) {
  const item = words.find(word => String(word.id) === String(id));
  if (!item) return;
  editingId = item.id;
  fields.forEach(field => document.querySelector(`#${field}`).value = item[field] ?? '');
  document.querySelector('#editTitle').textContent = item.word;
  dialog.showModal();
}

detail.addEventListener('click', event => {
  const remove = event.target.closest('[data-delete-deck]');
  const edit = event.target.closest('[data-edit-word]');
  if (remove) removeDeck(remove);
  if (edit) openEdit(edit.dataset.editWord);
});

document.querySelector('#closeEdit').addEventListener('click', () => dialog.close());
document.querySelector('#editForm').addEventListener('submit', async event => {
  event.preventDefault();
  const button = document.querySelector('#saveWord');
  button.disabled = true; button.textContent = 'Đang lưu...';
  const body = Object.fromEntries(fields.map(field => [field, document.querySelector(`#${field}`).value.trim()]));
  try { await api(`/vocabularies/${editingId}`, { method: 'PUT', body: JSON.stringify(body) }); dialog.close(); toast('Đã cập nhật từ vựng'); await load(); }
  catch (error) { toast(error.message, 'error'); }
  finally { button.disabled = false; button.textContent = 'Lưu thay đổi'; }
});

await load();
