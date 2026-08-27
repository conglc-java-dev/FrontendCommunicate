import { API_BASE_URL } from './config.js';

export const API_BASE = API_BASE_URL;

export async function api(path, options = {}) {
  const config = { ...options, headers: { ...(options.headers || {}) } };
  if (config.body && !(config.body instanceof FormData)) config.headers['Content-Type'] = 'application/json';
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, config);
  } catch {
    throw new Error('Không thể kết nối máy chủ. Vui lòng thử lại sau.');
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const details = payload.errors ? Object.values(payload.errors).join(', ') : '';
    throw new Error([payload.message || 'Yêu cầu không thành công', details].filter(Boolean).join(': '));
  }
  return payload.data;
}

export const formatDate = value => value
  ? new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(value))
  : '—';

export function toast(message, type = 'success') {
  let node = document.querySelector('.toast');
  if (!node) {
    node = document.createElement('div');
    node.className = 'toast';
    document.body.append(node);
  }
  node.textContent = message;
  node.dataset.type = type;
  node.classList.add('show');
  clearTimeout(window.__toastTimer);
  window.__toastTimer = setTimeout(() => node.classList.remove('show'), 3200);
}
