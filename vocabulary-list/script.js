import { api, toast } from '../shared/api.js';

const content = document.querySelector('#libraryContent');
const stats = document.querySelector('#libraryStats');
const search = document.querySelector('#deckSearch');
const topicDialog = document.querySelector('#topicDialog');
const importDialog = document.querySelector('#importDialog');
let library;
let selectedFile;

function esc(value) { const node = document.createElement('div'); node.textContent = value ?? ''; return node.innerHTML; }
function allTopics(nodes = library?.topics || [], depth = 0) { return nodes.flatMap(node => [{ ...node, depth }, ...allTopics(node.children, depth + 1)]); }

function renderStats() {
  const items = [['Chủ đề lớn', library.totalTopics], ['Bộ thẻ con', library.totalDecks], ['Tổng thẻ', library.totalCards], ['Đã học', library.learnedCount], ['Cần ôn', library.dueCount]];
  stats.innerHTML = items.map(([label, value], index) => `<article class="stat ${index === 3 ? 'learned' : ''}"><span>${label}</span><strong>${value}</strong></article>`).join('');
}

function descendants(topic) { return topic.children.flatMap(child => [child, ...descendants(child)]); }
function matches(node, keyword) { return `${node.title} ${node.description} ${node.level}`.toLocaleLowerCase('vi').includes(keyword); }

function topicCard(topic) {
  const childCount = descendants(topic).length;
  return `<article class="topic-card">
    <div class="topic-card-top"><div class="level-group"><span class="level">${esc(topic.level)}</span></div><button class="danger-icon" data-delete-topic="${topic.id}" data-title="${esc(topic.title)}" title="Xóa chủ đề">⌫</button></div>
    <h2>${esc(topic.title)}</h2><p>${esc(topic.description)}</p>
    <div class="topic-count"><strong>${childCount} bộ thẻ</strong><span>· ${topic.totalCards} thẻ</span></div>
    <div class="deck-progress"><span style="width:${topic.progressPercent}%"></span><b>${topic.progressPercent}%</b></div>
    <div class="topic-footer"><span class="${topic.dueCount ? 'due' : 'ready'}">${topic.dueCount ? `↻ ${topic.dueCount} thẻ đến hạn` : '● Không có thẻ đến hạn'}</span><a href="../vocabulary-detail/?deck=${encodeURIComponent(topic.slug)}">Xem bộ thẻ →</a></div>
  </article>`;
}

function renderLibrary() {
  const keyword = search.value.trim().toLocaleLowerCase('vi');
  const topics = library.topics.filter(topic => matches(topic, keyword) || descendants(topic).some(child => matches(child, keyword)));
  content.innerHTML = topics.length ? `<div class="topic-grid">${topics.map(topicCard).join('')}</div>` : '<div class="card no-result">Không tìm thấy chủ đề phù hợp.</div>';
}

function refreshSelects(selectedParent = '') {
  const options = allTopics().map(topic => `<option value="${topic.id}">${'— '.repeat(topic.depth)}${esc(topic.title)}</option>`).join('');
  document.querySelector('#topicParent').innerHTML = `<option value="">Không có · chủ đề lớn</option>${options}`;
  document.querySelector('#topicParent').value = selectedParent;
  document.querySelector('#importDeck').innerHTML = `<option value="">Chọn chủ đề đích...</option>${options}`;
}

function openTopic(parentId = '') {
  document.querySelector('#topicForm').reset(); refreshSelects(String(parentId));
  document.querySelector('#topicDialogTitle').textContent = parentId ? 'Tạo chủ đề con' : 'Tạo chủ đề mới';
  topicDialog.showModal();
}

function openImport(deckId = '') { selectedFile = null; document.querySelector('#importForm').reset(); resetFile(); refreshSelects(); document.querySelector('#importDeck').value = String(deckId); document.querySelector('#importResult').innerHTML = ''; importDialog.showModal(); }

document.querySelector('#createRoot').addEventListener('click', () => openTopic());
document.querySelector('#openImport').addEventListener('click', () => openImport());
document.querySelectorAll('[data-close]').forEach(button => button.addEventListener('click', () => document.querySelector(`#${button.dataset.close}`).close()));
search.addEventListener('input', renderLibrary);
content.addEventListener('click', async event => {
  const remove = event.target.closest('[data-delete-topic]');
  if (!remove) return;
  const message = `Xóa “${remove.dataset.title}” cùng toàn bộ bộ con và từ vựng bên trong? Lịch sử học sẽ được giữ lại.`;
  if (!confirm(message)) return;
  remove.disabled = true;
  try { await api(`/decks/${remove.dataset.deleteTopic}`, { method: 'DELETE' }); toast('Đã xóa chủ đề'); await load(); }
  catch (error) { toast(error.message, 'error'); remove.disabled = false; }
});

document.querySelector('#topicForm').addEventListener('submit', async event => {
  event.preventDefault(); const submit = event.currentTarget.querySelector('.submit'); submit.disabled = true;
  try { await api('/decks', { method: 'POST', body: JSON.stringify({ title: document.querySelector('#topicTitle').value, description: document.querySelector('#topicDescription').value, level: document.querySelector('#topicLevel').value, parentId: document.querySelector('#topicParent').value || null }) }); topicDialog.close(); toast('Đã tạo chủ đề'); await load(); }
  catch (error) { toast(error.message, 'error'); } finally { submit.disabled = false; }
});

const fileInput = document.querySelector('#file'), dropzone = document.querySelector('#dropzone'), fileRow = document.querySelector('#fileRow'), importButton = document.querySelector('#importButton');
function chooseFile(file) { if (!file) return; if (!file.name.toLowerCase().endsWith('.xlsx')) return toast('Vui lòng chọn tệp .xlsx', 'error'); selectedFile = file; dropzone.hidden = true; fileRow.hidden = false; document.querySelector('#fileName').textContent = file.name; document.querySelector('#fileSize').textContent = `${(file.size / 1024).toFixed(1)} KB`; importButton.disabled = false; }
function resetFile() { selectedFile = null; fileInput.value = ''; dropzone.hidden = false; fileRow.hidden = true; importButton.disabled = true; }
fileInput.addEventListener('change', () => chooseFile(fileInput.files[0])); document.querySelector('#removeFile').addEventListener('click', resetFile);
['dragenter', 'dragover'].forEach(name => dropzone.addEventListener(name, event => { event.preventDefault(); dropzone.classList.add('drag'); }));
['dragleave', 'drop'].forEach(name => dropzone.addEventListener(name, event => { event.preventDefault(); dropzone.classList.remove('drag'); }));
dropzone.addEventListener('drop', event => chooseFile(event.dataTransfer.files[0]));
document.querySelector('#importForm').addEventListener('submit', async event => {
  event.preventDefault(); const deckId = document.querySelector('#importDeck').value; if (!selectedFile || !deckId) return toast('Hãy chọn chủ đề và tệp Excel', 'error');
  importButton.disabled = true; importButton.textContent = 'Đang kiểm tra và nhập...'; const body = new FormData(); body.append('file', selectedFile);
  try { const data = await api(`/vocabularies/import?deckId=${encodeURIComponent(deckId)}`, { method: 'POST', body }); document.querySelector('#importResult').innerHTML = `<div class="import-result"><strong>Đã nhập ${data.successCount}/${data.totalRows} từ</strong><span>${data.duplicateCount} trùng · ${data.failedCount} lỗi</span>${data.errors.length ? `<ul>${data.errors.map(error => `<li>Dòng ${error.row}: ${esc(error.message)}</li>`).join('')}</ul>` : ''}</div>`; toast(`Đã nhập ${data.successCount} từ`); await load(); }
  catch (error) { toast(error.message, 'error'); } finally { importButton.disabled = false; importButton.textContent = 'Nhập từ vựng'; }
});

async function load() { try { library = await api('/decks'); renderStats(); refreshSelects(); renderLibrary(); } catch (error) { stats.innerHTML = ''; content.innerHTML = `<div class="card empty">${esc(error.message)}</div>`; toast(error.message, 'error'); } }
await load();
if (new URLSearchParams(location.search).get('import') === '1') openImport();
