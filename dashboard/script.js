import { api, toast } from '../shared/api.js';
const metrics = document.querySelector('#metrics');
const specs = [
  ['dueToday','↻','Cần ôn hôm nay'],['newAvailable','＋','Từ mới sẵn sàng'],['learnedToday','✓','Đã học hôm nay'],['totalLearned','▤','Tổng từ đã học'],['currentStreak','🔥','Chuỗi ngày học']
];
try {
  const data = await api('/learning/today');
  metrics.innerHTML = specs.map(([key,icon,label]) => `<article class="card metric"><div class="metric-icon">${icon}</div><strong>${data[key]}</strong><span>${label}</span></article>`).join('');
} catch (error) { metrics.innerHTML = '<div class="card empty"></div>'; metrics.firstElementChild.textContent = error.message; toast(error.message,'error'); }
