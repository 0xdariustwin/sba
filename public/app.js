'use strict';

const form = document.querySelector('#job-form');
const statusBox = document.querySelector('#status');
const state = document.querySelector('#state');
const log = document.querySelector('#log');
const button = form.querySelector('button');

async function request(url, options) {
  const token = sessionStorage.getItem('appToken');
  const headers = { ...(options?.headers || {}) };
  if (token) headers.authorization = `Bearer ${token}`;
  const response = await fetch(url, { ...options, headers });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || `Request failed (${response.status})`);
  return body;
}

async function poll(id) {
  const job = await request(`/api/jobs/${id}`);
  state.textContent = `${job.status} — ${job.id}`;
  log.textContent = job.log || 'Waiting for output…';
  log.scrollTop = log.scrollHeight;
  if (job.status === 'queued' || job.status === 'running') setTimeout(() => poll(id).catch(showError), 1000);
  else button.disabled = false;
}

function showError(error) {
  statusBox.hidden = false;
  state.textContent = 'Error';
  log.textContent = error.message;
  button.disabled = false;
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  button.disabled = true;
  statusBox.hidden = false;
  state.textContent = 'Submitting…';
  log.textContent = '';
  const data = new FormData(form);
  try {
    const job = await request('/api/jobs', {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ url: data.get('url'), terms: data.get('terms'), interval: Number(data.get('interval')) })
    });
    await poll(job.id);
  } catch (error) { showError(error); }
});
