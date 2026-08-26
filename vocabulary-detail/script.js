import { api, formatDate, toast } from '../shared/api.js';
const id = new URLSearchParams(location.search).get('id'), form = document.querySelector('#form');
const fields = ['word','partOfSpeech','ukIpa','usIpa','meaning','exampleEnglish','exampleVietnamese'];
if (id) {
  try {
    const item = await api(`/vocabularies/${id}`); fields.forEach(key => document.querySelector(`#${key}`).value = item[key] ?? '');
    document.querySelector('#eyebrow').textContent = 'Chỉnh sửa từ vựng'; document.querySelector('#title').textContent = item.word;
    const progress = document.querySelector('#progress'); progress.hidden = false; progress.innerHTML = `<div><span>Trạng thái</span><strong>${item.learningStatus || 'Chưa học'}</strong></div><div><span>Giai đoạn</span><strong>${item.currentStage || '—'}</strong></div><div><span>Tổng lượt ôn</span><strong>${item.totalReviews || 0}</strong></div><div><span>Ôn tiếp</span><strong>${formatDate(item.nextReviewAt)}</strong></div>`;
  } catch (error) { toast(error.message,'error'); }
}
form.addEventListener('submit', async event => {
  event.preventDefault(); const button = document.querySelector('#save'); button.disabled = true; button.textContent = 'Đang lưu...';
  const body = Object.fromEntries(fields.map(key => [key, document.querySelector(`#${key}`).value.trim()]));
  try { const item = await api(id ? `/vocabularies/${id}` : '/vocabularies', { method: id ? 'PUT' : 'POST', body: JSON.stringify(body) }); toast(id ? 'Đã cập nhật từ vựng' : 'Đã thêm từ vựng'); setTimeout(() => location.href = `../vocabulary-detail/?id=${item.id}`, 500); }
  catch (error) { toast(error.message,'error'); button.disabled = false; button.textContent = 'Lưu từ vựng'; }
});
