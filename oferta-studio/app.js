import {
	COMPANIES,
	VAT_RATES,
	MAX_ITEMS,
	createExample,
	calculateOffer,
	validateOffer,
	money,
	escapeHtml as esc,
	restoreState,
	localDate
} from './core.js';
import {
	loadFont,
	layoutOffer,
	pageSvg,
	generatePdf
} from './pdf.js';

const $ = selector => document.querySelector(selector),
	$$ = selector => [...document.querySelectorAll(selector)];
const STORAGE = 'oferta-studio:current:v1',
	SNAPSHOTS = 'oferta-studio:snapshots:v1';
const icon = name => `<svg aria-hidden="true"><use href="#i-${name}"/></svg>`;
let state = createExample(),
	font, layout, currentPage = 0,
	activeTab = 'company',
	timer, toastTimer, saveTimer, storageAvailable = true,
	pdfBusy = false;
try {
	const saved = localStorage.getItem(STORAGE);
	if (saved) state = restoreState(JSON.parse(saved));
} catch {
	storageAvailable = false;
}

function toast(message) {
	$('#toast').textContent = message;
	$('#toast').classList.add('visible');
	clearTimeout(toastTimer);
	toastTimer = setTimeout(() => $('#toast').classList.remove('visible'), 4200);
}

function getSnapshots() {
	try {
		const data = JSON.parse(localStorage.getItem(SNAPSHOTS) || '[]');
		return Array.isArray(data) ? data.filter(d => d && typeof d.id === 'string' && d.data)
			.slice(0, 20) : [];
	} catch {
		return [];
	}
}

function persist() {
	clearTimeout(saveTimer);
	$('#save-indicator').innerHTML = '<span></span>Zapisywanie…';
	saveTimer = setTimeout(() => {
		try {
			localStorage.setItem(STORAGE, JSON.stringify(state));
			storageAvailable = true;
			$('#save-indicator').innerHTML = '<span></span>Zapisano lokalnie';
		} catch {
			storageAvailable = false;
			$('#save-indicator').textContent = 'Szkic w pamięci';
		}
	}, 400);
}

function setValue(path, value) {
	if (path.startsWith('client.')) state.client[path.split('.')[1]] = value;
	else state[path] = value;
}

function getValue(path) {
	return path.startsWith('client.') ? state.client[path.split('.')[1]] : state[path];
}

function updateFields() {
	for (const input of $$('[data-field]')) input.value = getValue(input.dataset.field) ?? '';
	$('#editor-number').textContent = state.number || 'Nowa oferta';
}

function renderCompanies() {
	$('#company-grid').innerHTML = COMPANIES.map(c =>
		`<button type="button" class="company-card ${state.company===c.id?'selected':''}" data-company="${c.id}" aria-pressed="${state.company===c.id}" style="--brand-color:${c.color};--brand-pale:${c.color}09"><span class="company-symbol">${c.initials}</span><span><span class="company-name">${c.name}</span><span class="company-type">${c.field}</span></span>${state.company===c.id?`<span class="selected-mark">${icon('check')}</span>`:''}</button>`
		).join('');
	const company = COMPANIES.find(c => c.id === state.company) || COMPANIES[0];
	$('#company-details').innerHTML = icon('check') +
		`<span>${esc(company.address)} · dane przykładowe</span>`;
}

function itemCard(item, index) {
	return `<article class="item-card" data-item="${esc(item.id)}"><div class="item-header"><span>POZYCJA ${String(index+1).padStart(2,'0')}</span><div class="item-actions"><button type="button" data-action="duplicate" aria-label="Duplikuj pozycję ${index+1}" title="Duplikuj">${icon('copy')}</button><button type="button" data-action="remove" aria-label="Usuń pozycję ${index+1}" title="Usuń">${icon('trash')}</button></div></div><label class="field">Nazwa usługi lub produktu<input data-item-field="name" value="${esc(item.name)}" maxlength="300" placeholder="np. Projekt identyfikacji wizualnej" required></label><label class="field">Opis zakresu<textarea data-item-field="description" rows="2" maxlength="1000" placeholder="Krótko opisz, co obejmuje ta pozycja">${esc(item.description)}</textarea></label><div class="item-numbers"><label class="field">Ilość<input data-item-field="quantity" value="${esc(item.quantity)}" inputmode="decimal" maxlength="14" required></label><label class="field">Jednostka<select data-item-field="unit">${['szt.','projekt','godz.','mies.','usługa','kpl.','m²'].map(u=>`<option ${item.unit===u?'selected':''}>${u}</option>`).join('')}</select></label><label class="field">Cena netto (zł)<input data-item-field="price" value="${esc(item.price)}" inputmode="decimal" maxlength="14" required></label><label class="field">VAT<select data-item-field="vat">${VAT_RATES.map(v=>`<option value="${v}" ${item.vat===v?'selected':''}>${v==='zw'?'zw.':v+'%'}</option>`).join('')}</select></label></div><div class="item-total"><span>Netto po rabacie</span><strong data-item-total="${esc(item.id)}"></strong></div></article>`;
}

function renderItems() {
	$('#items-list').innerHTML = state.items.map(itemCard).join('');
	$('#add-item').disabled = state.items.length >= MAX_ITEMS;
	renderTotals();
}

function renderTotals() {
	const {
		lines,
		totals,
		vatGroups
	} = calculateOffer(state);
	for (const item of lines) {
		const label = $(`[data-item-total="${item.id}"]`);
		if (label) label.textContent = item.valid ? money(item.net) : 'Sprawdź dane';
	}
	$('#calculation').innerHTML =
		`<div class="calc-line"><span>Suma netto przed rabatem</span><strong>${money(totals.base)}</strong></div>${totals.discount?`<div class="calc-line"><span>Rabat ${esc(state.discount)}%</span><strong>−${money(totals.discount)}</strong></div>`:''}${vatGroups.map(g=>`<div class="calc-line"><span>VAT ${g.rate==='zw'?'zw.':g.rate+'%'}</span><strong>${money(g.tax)}</strong></div>`).join('')}<div class="calc-line total"><span>Łącznie brutto</span><strong>${money(totals.gross)}</strong></div>`;
	$('#download-total').textContent = money(totals.gross) + ' · dokument gotowy do wysłania';
}

function updateValidation() {
	const errors = validateOffer(state);
	$('#document-status').innerHTML = errors.length ?
		`${icon('info')}Uzupełnij dane (${errors.length})` : `${icon('check')}Gotowa do pobrania`;
	return errors;
}

function renderPreview() {
	if (!font) return;
	try {
		layout = layoutOffer(state, font);
		currentPage = Math.min(currentPage, layout.pages.length - 1);
		$('#paper').innerHTML = pageSvg(layout, currentPage);
		$('#page-count').textContent = `${currentPage+1} / ${layout.pages.length}`;
		$('#prev-page').disabled = currentPage === 0;
		$('#next-page').disabled = currentPage === layout.pages.length - 1;
		updateValidation();
	} catch (error) {
		$('#paper').innerHTML =
			'<div class="paper-loading">Sprawdź dane oferty i spróbuj ponownie.</div>';
		toast(error.message);
	}
}

function schedulePreview() {
	clearTimeout(timer);
	timer = setTimeout(renderPreview, 220);
	renderTotals();
	updateValidation();
	persist();
}

function selectTab(tab, focus = false) {
	activeTab = tab;
	for (const button of $$('[data-tab]')) {
		const selected = button.dataset.tab === tab;
		button.classList.toggle('active', selected);
		button.setAttribute('aria-selected', selected);
		button.tabIndex = selected ? 0 : -1;
	}
	for (const panel of $$('.panel')) panel.hidden = panel.id !== `panel-${tab}`;
	if (focus) $(`#tab-${tab}`).focus();
}

function renderAll() {
	updateFields();
	renderCompanies();
	renderItems();
	for (const b of $$('[data-template]')) {
		b.classList.toggle('active', b.dataset.template === state.template);
		b.setAttribute('aria-pressed', b.dataset.template === state.template);
	}
	$('#draft-count').textContent = getSnapshots().length;
	renderPreview();
}

function openModal(title, html) {
	$('#modal-title').textContent = title;
	$('#modal-body').innerHTML = html;
	if (!$('#modal').open) $('#modal').showModal();
}

function confirmReplace(title, callback) {
	openModal(title,
		`<p class="modal-copy">Bieżący szkic zostanie zastąpiony. Zapisane wersje pozostaną dostępne w zakładce „Zapisane oferty”.</p><div class="modal-actions"><button class="button dark" id="confirm-replace">Kontynuuj</button><button class="button secondary" id="cancel-replace">Wróć do oferty</button></div>`
		);
	$('#confirm-replace').onclick = () => {
		$('#modal').close();
		callback();
	};
	$('#cancel-replace').onclick = () => $('#modal').close();
}

function loadState(data) {
	state = restoreState(data);
	currentPage = 0;
	selectTab('company');
	renderAll();
	persist();
}

function downloadBytes(bytes, type, filename) {
	const url = URL.createObjectURL(new Blob([bytes], {
			type
		})),
		anchor = document.createElement('a');
	anchor.href = url;
	anchor.download = filename;
	document.body.append(anchor);
	anchor.click();
	anchor.remove();
	setTimeout(() => URL.revokeObjectURL(url), 15000);
}

function exportJson(data = state) {
	downloadBytes(JSON.stringify(data, null, 2), 'application/json',
		`oferta-${safeFilename(data.number)}.json`);
	toast('Pobrano plik oferty. Możesz go później wczytać.');
}

function safeFilename(value) {
	return String(value || 'nowa').replace(/[^\p{L}\p{N}._-]/gu, '-').slice(0, 80);
}

function openDrafts() {
	const drafts = getSnapshots();
	$('#draft-count').textContent = drafts.length;
	openModal('Zapisane oferty',
		`${drafts.length?drafts.map(d=>`<article class="draft-card"><div><strong>${esc(d.data.number)} · ${esc(d.data.client?.name||'Nowy klient')}</strong><p>${esc(new Date(d.savedAt).toLocaleString('pl-PL',{dateStyle:'medium',timeStyle:'short'}))} · ${money(calculateOffer(restoreState(d.data)).totals.gross)}</p></div><div class="draft-actions"><button class="button small secondary" data-open-draft="${esc(d.id)}">Otwórz</button><button class="icon-button" aria-label="Usuń zapisaną ofertę" data-delete-draft="${esc(d.id)}">${icon('trash')}</button></div></article>`).join(''):'<div class="empty-state">'+icon('file')+'<h3>Tu zaczyna się Twoje archiwum</h3><p>Kliknij „Zapisz wersję”, aby zachować ofertę<br>i wrócić do niej w dowolnym momencie.</p></div>'}<div class="modal-actions"><button class="button secondary" id="export-json">${icon('down')}Eksportuj bieżący szkic</button><button class="button secondary" id="import-json">${icon('upload')}Wczytaj plik oferty</button></div><p class="modal-copy" style="font-size:10px;margin-bottom:0">Oferty są zapisane w tej przeglądarce. Eksport do JSON pozwala zachować kopię lub przenieść szkic na inne urządzenie.</p>`
		);
	$('#export-json').onclick = () => exportJson();
	$('#import-json').onclick = () => $('#import-input').click();
}
$('#offer-form').addEventListener('submit', event => event.preventDefault());
$('#offer-form').addEventListener('input', event => {
	const input = event.target;
	if (input.dataset.field) {
		setValue(input.dataset.field, input.value);
		if (input.dataset.field === 'number') $('#editor-number').textContent = state
			.number || 'Nowa oferta';
	} else if (input.dataset.itemField) {
		const item = state.items.find(x => x.id === input.closest('[data-item]').dataset
			.item);
		if (item) item[input.dataset.itemField] = input.value;
	}
	input.classList.remove('input-invalid');
	schedulePreview();
});
$('#offer-form').addEventListener('change', event => {
	if (event.target.matches('select')) {
		const item = state.items.find(x => x.id === event.target.closest('[data-item]')
			?.dataset.item);
		if (item) {
			item[event.target.dataset.itemField] = event.target.value;
			schedulePreview();
		}
	}
});
$('#company-grid').addEventListener('click', event => {
	const button = event.target.closest('[data-company]');
	if (!button) return;
	state.company = button.dataset.company;
	renderCompanies();
	renderPreview();
	persist();
});
for (const button of $$('[data-tab]')) {
	button.onclick = () => selectTab(button.dataset.tab);
	button.addEventListener('keydown', event => {
		if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
		event.preventDefault();
		const tabs = ['company', 'items', 'details'],
			index = tabs.indexOf(activeTab),
			next = event.key === 'Home' ? 0 : event.key === 'End' ? 2 : (index + (event
				.key === 'ArrowRight' ? 1 : 2)) % 3;
		selectTab(tabs[next], true);
	});
}
for (const button of $$('[data-next]')) button.onclick = () => selectTab(button.dataset.next, true);
$('#add-item').onclick = () => {
	if (state.items.length >= MAX_ITEMS) return toast(
		`Maksymalnie ${MAX_ITEMS} pozycji w jednej ofercie.`);
	state.items.push({
		id: crypto.randomUUID(),
		name: '',
		description: '',
		quantity: '1',
		unit: 'szt.',
		price: '0.00',
		vat: '23'
	});
	renderItems();
	schedulePreview();
	$('#items-list').lastElementChild.querySelector('input').focus();
};

$('#items-list').addEventListener('click', event => {
	const button = event.target.closest('[data-action]');
	if (!button) return;
	const index = state.items.findIndex(i => i.id === button.closest('[data-item]').dataset
		.item);
	if (button.dataset.action === 'remove') {
		if (state.items.length === 1) return toast(
			'Oferta musi zawierać co najmniej jedną pozycję.');
		state.items.splice(index, 1);
	} else {
		if (state.items.length >= MAX_ITEMS) return toast(
			`Maksymalnie ${MAX_ITEMS} pozycji.`);
		state.items.splice(index + 1, 0, {
			...state.items[index],
			id: crypto.randomUUID()
		});
	}
	renderItems();
	schedulePreview();
});
for (const button of $$('[data-template]')) button.onclick = () => {
	state.template = button.dataset.template;
	for (const b of $$('[data-template]')) {
		b.classList.toggle('active', b === button);
		b.setAttribute('aria-pressed', b === button);
	}
	renderPreview();
	persist();
};

$('#prev-page').onclick = () => {
	if (currentPage > 0) {
		currentPage--;
		renderPreview();
	}
};

$('#next-page').onclick = () => {
	if (layout && currentPage < layout.pages.length - 1) {
		currentPage++;
		renderPreview();
	}
};

$('#close-modal').onclick = () => $('#modal').close();
$('#modal').addEventListener('click', event => {
	if (event.target === $('#modal')) {
		const rect = $('#modal').getBoundingClientRect();
		if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect
			.top || event.clientY > rect.bottom) $('#modal').close();
	}
});
$('#new-offer').onclick = () => confirmReplace('Przygotować nową ofertę?', () => {
	const fresh = createExample();
	fresh.client = {
		name: '',
		contact: '',
		nip: '',
		email: '',
		address: ''
	};
	fresh.items = [{
		id: crypto.randomUUID(),
		name: '',
		description: '',
		quantity: '1',
		unit: 'szt.',
		price: '0.00',
		vat: '23'
	}];
	fresh.number = `OF/${localDate().slice(0,4)}/${String(Date.now()).slice(-4)}`;
	fresh.title = 'Oferta współpracy';
	fresh.subtitle = '';
	fresh.notes = '';
	fresh.payment = 'Przelew · termin 14 dni';
	loadState(fresh);
	toast('Nowy szkic jest gotowy. Zacznij od danych klienta.');
});
$('#load-example').onclick = () => confirmReplace('Wczytać przykładową ofertę?', () => {
	loadState(createExample());
	toast('Wczytano przykład. Zmieniaj dane i sprawdź podgląd.');
});
$('#save-snapshot').onclick = () => {
	const errors = validateOffer(state);
	if (errors.length) return toast(errors[0]);
	try {
		const snapshots = getSnapshots();
		snapshots.unshift({
			id: crypto.randomUUID(),
			savedAt: new Date().toISOString(),
			data: structuredClone(state)
		});
		localStorage.setItem(SNAPSHOTS, JSON.stringify(snapshots.slice(0, 20)));
		$('#draft-count').textContent = Math.min(snapshots.length, 20);
		toast('Zapisano wersję. Znajdziesz ją w „Zapisane oferty”.');
	} catch {
		toast('Brak miejsca na zapis. Zachowaj ofertę przez eksport JSON.');
	}
};

for (const button of $$('[data-nav]')) button.onclick = () => {
	const nav = button.dataset.nav;
	if (nav === 'generator') {
		$('#modal').close();
		selectTab('company');
		$('#offer-form').scrollIntoView({
			behavior: 'smooth',
			block: 'nearest'
		});
	}
	if (nav === 'drafts') openDrafts();
	if (nav === 'companies') openModal('Cztery spółki. Jeden standard.',
		`<p class="modal-copy">Wybór spółki automatycznie zmienia logo, kolor dokumentu i dane wystawcy. Dane firm są przykładowe.</p>${COMPANIES.map(c=>`<article class="company-profile"><span class="company-symbol" style="background:${c.color}">${c.initials}</span><div><h3>${c.name}</h3><p>${c.field}<br>${c.address}<br>${c.email} · ${c.phone}<br>NIP: ${c.nip} · KRS: ${c.krs}</p></div></article>`).join('')}`
		);
};

$('#modal-body').addEventListener('click', event => {
	const open = event.target.closest('[data-open-draft]'),
		remove = event.target.closest('[data-delete-draft]');
	if (open) {
		const draft = getSnapshots().find(d => d.id === open.dataset.openDraft);
		if (draft) confirmReplace('Otworzyć zapisaną wersję?', () => {
			loadState(draft.data);
			toast('Otworzono zapisaną ofertę.');
		});
	}
	if (remove) {
		try {
			localStorage.setItem(SNAPSHOTS, JSON.stringify(getSnapshots().filter(d => d
				.id !== remove.dataset.deleteDraft)));
			openDrafts();
		} catch {
			toast('Nie udało się usunąć wersji.');
		}
	}
});
$('#import-input').onchange = async event => {
	const file = event.target.files?.[0];
	if (!file) return;
	if (file.size > 500000) return toast('Plik jest zbyt duży. Maksymalnie 500 KB.');
	try {
		const parsed = restoreState(JSON.parse(await file.text()));
		confirmReplace('Wczytać ofertę z pliku?', () => {
			loadState(parsed);
			toast('Wczytano ofertę z pliku.');
		});
	} catch {
		toast('Nieprawidłowy plik. Wybierz JSON wyeksportowany z Oferta Studio.');
	}
	event.target.value = '';
};

$('#about-button').onclick = () => openModal('O aplikacji',
	"<div class=\"modal-copy\"><p><strong>Oferta Studio</strong> pomaga przygotować ofertę handlową: od danych wystawcy i klienta po gotowy dokument PDF.</p><p>Wybierz jeden z czterech profili firm, dodaj pozycje, ustaw VAT i rabat. Zmiany od razu zobaczysz w podglądzie. Do wyboru są trzy style dokumentu.</p><p>Szkice i zapisane wersje pozostają w tej przeglądarce. Aby przenieść ofertę na inne urządzenie, wyeksportuj ją do pliku JSON i zaimportuj w aplikacji.</p><p>Dane dołączonych firm są fikcyjne. Generowany dokument jest ofertą handlową.</p></div>"
	);
$('#download-pdf').onclick = async () => {
	if (pdfBusy) return;
	const errors = validateOffer(state);
	if (errors.length) {
		toast(errors[0]);
		if (!state.client.name.trim()) {
			selectTab('company');
			$('[data-field="client.name"]').classList.add('input-invalid');
			$('[data-field="client.name"]').focus();
		} else if (state.items.some(i => !i.name.trim()) || calculateOffer(state).lines
			.some(i => !i.valid)) selectTab('items');
		else selectTab('details');
		return;
	}
	pdfBusy = true;
	const button = $('#download-pdf');
	button.disabled = true;
	button.setAttribute('aria-busy', 'true');
	const title = button.querySelector('strong');
	title.textContent = 'Przygotowujemy PDF…';
	try {
		const bytes = await generatePdf(structuredClone(state));
		downloadBytes(bytes, 'application/pdf', safeFilename(state.number) + '.pdf');
		toast('PDF jest gotowy. Powodzenia w nowej współpracy!');
	} catch (error) {
		toast(error.message || 'Nie udało się wygenerować PDF. Spróbuj ponownie.');
	} finally {
		pdfBusy = false;
		button.disabled = false;
		button.removeAttribute('aria-busy');
		title.textContent = 'Pobierz ofertę PDF';
	}
};

renderAll();
try {
	font = await loadFont();
	await document.fonts.ready;
	renderPreview();
} catch (error) {
	$('#paper').innerHTML =
		'<div class="paper-loading">Nie udało się wczytać czcionki.<br>Odśwież stronę i spróbuj ponownie.</div>';
	toast(error.message);
}
if (!storageAvailable) $('#save-indicator').textContent = 'Szkic w pamięci';
