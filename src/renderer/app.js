const $ = (selector) => document.querySelector(selector);
let state = { tabs: [], activeTabId: null, profiles: [], profile: { name: 'Default' } };

function activeTab() {
  return state.tabs.find((tab) => tab.id === state.activeTabId);
}

async function render(nextState) {
  state = nextState;
  const tabs = $('#tabs');
  tabs.replaceChildren();

  for (const tab of state.tabs) {
    const element = document.createElement('div');
    element.className = `tab${tab.id === state.activeTabId ? ' active' : ''}`;
    element.setAttribute('role', 'tab');
    element.dataset.id = tab.id;

    const icon = document.createElement('img');
    icon.src = tab.favicon || '../assets/logo.svg';
    icon.alt = '';
    const title = document.createElement('span');
    title.className = 'tab-title';
    title.textContent = tab.title || 'New Tab';
    const close = document.createElement('button');
    close.className = 'tab-close';
    close.textContent = '×';
    close.title = 'Close tab';
    close.addEventListener('click', (event) => {
      event.stopPropagation();
      window.lightspeed.closeTab(tab.id);
    });
    element.append(icon, title, close);
    element.addEventListener('click', () => window.lightspeed.activateTab(tab.id));
    tabs.append(element);
  }

  const tab = activeTab();
  if (tab && document.activeElement !== $('#address')) $('#address').value = tab.url;
  $('#back').disabled = !tab?.canGoBack;
  $('#forward').disabled = !tab?.canGoForward;
  $('#reload').textContent = tab?.loading ? '×' : '↻';
  $('#reload').title = tab?.loading ? 'Stop' : 'Reload';
  $('#security-indicator').style.color = tab?.url.startsWith('https:')
    ? 'var(--accent-2)'
    : 'var(--muted)';
  $('#profile').textContent = state.profile?.name || 'Default';
  $('#bookmark').textContent = await window.lightspeed.isBookmarked() ? '★' : '☆';
  renderProfiles();
}

function renderProfiles() {
  const list = $('#profile-list');
  list.replaceChildren();
  for (const profile of state.profiles || []) {
    const button = document.createElement('button');
    button.textContent = profile.name + (profile.id === state.profile?.id ? ' ✓' : '');
    button.addEventListener('click', async () => {
      $('#profile-menu').hidden = true;
      await window.lightspeed.switchProfile(profile.id);
    });
    list.append(button);
  }
}

function togglePopover(target) {
  for (const popover of document.querySelectorAll('.popover')) {
    popover.hidden = popover !== target || !target.hidden;
  }
}

$('#new-tab').addEventListener('click', () => window.lightspeed.newTab());
$('#back').addEventListener('click', () => window.lightspeed.back());
$('#forward').addEventListener('click', () => window.lightspeed.forward());
$('#home').addEventListener('click', () => window.lightspeed.home());
$('#reload').addEventListener('click', () => {
  if (activeTab()?.loading) window.lightspeed.stop();
  else window.lightspeed.reload();
});
$('#address-form').addEventListener('submit', (event) => {
  event.preventDefault();
  window.lightspeed.navigate($('#address').value);
  $('#address').blur();
});
$('#address').addEventListener('focus', (event) => event.target.select());
$('#bookmark').addEventListener('click', async () => {
  const added = await window.lightspeed.toggleBookmark();
  $('#bookmark').textContent = added ? '★' : '☆';
});
$('#menu').addEventListener('click', () => togglePopover($('#app-menu')));
$('#profile').addEventListener('click', () => togglePopover($('#profile-menu')));
$('#extensions').addEventListener('click', async () => {
  $('#app-menu').hidden = true;
  await window.lightspeed.loadExtension();
});
$('#create-profile').addEventListener('click', async () => {
  const name = prompt('Profile name');
  if (name) await window.lightspeed.createProfile(name);
});

for (const button of document.querySelectorAll('[data-page]')) {
  button.addEventListener('click', () => {
    $('#app-menu').hidden = true;
    const page = button.dataset.page;
    if (page === 'lightspeed://newtab') window.lightspeed.newTab();
    else window.lightspeed.navigate(page);
  });
}

document.addEventListener('click', (event) => {
  if (!event.target.closest('.popover, #menu, #profile')) {
    document.querySelectorAll('.popover').forEach((popover) => { popover.hidden = true; });
  }
});

document.addEventListener('keydown', (event) => {
  if (event.ctrlKey && event.key.toLowerCase() === 'l') {
    event.preventDefault();
    $('#address').focus();
  } else if (event.ctrlKey && event.key.toLowerCase() === 't') {
    event.preventDefault();
    window.lightspeed.newTab();
  } else if (event.ctrlKey && event.key.toLowerCase() === 'w') {
    event.preventDefault();
    if (state.activeTabId) window.lightspeed.closeTab(state.activeTabId);
  } else if (event.ctrlKey && event.key.toLowerCase() === 'r') {
    event.preventDefault();
    window.lightspeed.reload();
  } else if (event.altKey && event.key === 'ArrowLeft') {
    window.lightspeed.back();
  } else if (event.altKey && event.key === 'ArrowRight') {
    window.lightspeed.forward();
  }
});

window.lightspeed.onState(render);
window.lightspeed.onFocusAddress(() => {
  $('#address').focus();
  $('#address').select();
});
window.lightspeed.getState().then(render);
