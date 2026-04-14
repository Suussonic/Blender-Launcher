const $ = (q)=>document.querySelector(q);

const I18N = {
  fr: {
    sectionTitle: 'Vos Blender',
    home: 'Accueil',
    settings: 'Paramètres',
    quit: 'Quitter',
    empty: 'Aucune installation détectée.',
  },
  en: {
    sectionTitle: 'Your Blender',
    home: 'Home',
    settings: 'Settings',
    quit: 'Quit',
    empty: 'No Blender installation detected.',
  },
};

let currentLang = 'fr';

function t(key){
  const dict = I18N[currentLang] || I18N.fr;
  return dict[key] || I18N.fr[key] || key;
}

function applyLocale(){
  const section = $('#tray-section-title');
  const homeBtn = $('#btn-home');
  const settingsBtn = $('#btn-settings');
  const quitBtn = $('#btn-quit');
  if (section) section.textContent = t('sectionTitle');
  if (homeBtn) homeBtn.textContent = t('home');
  if (settingsBtn) settingsBtn.textContent = t('settings');
  if (quitBtn) quitBtn.textContent = t('quit');
  try { document.documentElement.lang = currentLang; } catch {}
}

async function loadLocale(){
  try {
    const general = await window.trayAPI.invoke('get-general-config');
    currentLang = general?.language === 'en' ? 'en' : 'fr';
  } catch {
    currentLang = 'fr';
  }
  applyLocale();
}

function renderList(items){
  const root = $('#blender-list');
  root.innerHTML = '';
  if(!Array.isArray(items) || items.length===0){
    const empty = document.createElement('div');
    empty.style.color = '#a8b3c7';
    empty.style.fontSize = '12px';
    empty.style.padding = '8px 12px';
    empty.textContent = t('empty');
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
  loadLocale().then(loadBlenders);
  // Refresh list when popup is shown
  try { window.trayAPI.on('tray-refresh', async () => { await loadLocale(); await loadBlenders(); }); } catch {}
  window.addEventListener('focus', async () => { await loadLocale(); await loadBlenders(); });
});
