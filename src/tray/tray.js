const $ = (q)=>document.querySelector(q);

function renderList(items){
  const root = $('#blender-list');
  root.innerHTML = '';
  if(!Array.isArray(items) || items.length===0){
    const empty = document.createElement('div');
    empty.style.color = '#a8b3c7';
    empty.style.fontSize = '12px';
    empty.style.padding = '8px 12px';
    empty.textContent = 'Aucune installation détectée.';
    root.appendChild(empty);
    return;
  }
  for(const it of items){
    const row = document.createElement('div');
    row.className = 'bl-item';
    row.title = it.path || it.exePath || '';

    const img = document.createElement('img');
    img.className = 'bl-icon';
    img.src = it.icon || it.iconDataUrl || '';
    row.appendChild(img);

    const wrap = document.createElement('div');
    wrap.className = 'bl-text';

    const name = document.createElement('div');
    name.className = 'bl-name';
    name.textContent = it.title || it.name || 'Blender';
    wrap.appendChild(name);

    const pathEl = document.createElement('div');
    pathEl.className = 'bl-path';
    pathEl.textContent = it.path || it.exePath || '';
    wrap.appendChild(pathEl);

    row.appendChild(wrap);

    row.addEventListener('click', ()=>{
      const exePath = it.path || it.exePath;
      if (exePath) window.trayAPI.send('tray-launch-blender', { exePath });
    });

    root.appendChild(row);
  }
}

async function loadBlenders(){
  try{
    const list = await window.trayAPI.invoke('get-blenders');
    renderList(list);
  }catch(e){
    renderList([]);
  }
}

window.addEventListener('DOMContentLoaded', ()=>{
  $('#btn-home').addEventListener('click', ()=> window.trayAPI.send('tray-open-home'));
  $('#btn-settings').addEventListener('click', ()=> window.trayAPI.send('tray-open-settings'));
  $('#btn-quit').addEventListener('click', ()=> window.trayAPI.send('tray-quit'));
  loadBlenders();
  // Refresh list when popup is shown
  try { window.trayAPI.on('tray-refresh', () => loadBlenders()); } catch {}
  window.addEventListener('focus', () => loadBlenders());
});
