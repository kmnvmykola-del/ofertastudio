export const COMPANIES = [
	{
		id: 'forma',
		name: 'Forma Studio',
		legal: 'Forma Studio sp. z o.o.',
		field: 'Design & digital',
		color: '#bf633f',
		dark: '#33241e',
		initials: 'f',
		address: 'ul. Przykładowa 12, 00-001 Warszawa',
		nip: '000-000-00-00',
		krs: '0000000000',
		email: 'hello@forma.example',
		phone: '+48 000 000 001',
		bank: '00 0000 0000 0000 0000 0000 0001',
		tagline: 'Dobrze zaprojektowana współpraca.'
	},
	{
		id: 'north',
		name: 'North Works',
		legal: 'North Works sp. z o.o.',
		field: 'Strategy & consulting',
		color: '#436b62',
		dark: '#203d36',
		initials: 'n',
		address: 'ul. Modelowa 8, 80-001 Gdańsk',
		nip: '000-000-00-01',
		krs: '0000000001',
		email: 'team@north.example',
		phone: '+48 000 000 002',
		bank: '00 0000 0000 0000 0000 0000 0002',
		tagline: 'Dobry kierunek. Konkretne rezultaty.'
	},
	{
		id: 'orbit',
		name: 'Orbit Digital',
		legal: 'Orbit Digital sp. z o.o.',
		field: 'Technology & development',
		color: '#6256a5',
		dark: '#30274f',
		initials: 'o',
		address: 'ul. Testowa 24, 30-001 Kraków',
		nip: '000-000-00-02',
		krs: '0000000002',
		email: 'hello@orbit.example',
		phone: '+48 000 000 003',
		bank: '00 0000 0000 0000 0000 0000 0003',
		tagline: 'Pomysły, które nabierają rozpędu.'
	},
	{
		id: 'atelier',
		name: 'Atelier & Co.',
		legal: 'Atelier & Co. sp. z o.o.',
		field: 'Architecture & interiors',
		color: '#987432',
		dark: '#3c3322',
		initials: 'a',
		address: 'ul. Wzorcowa 5, 50-001 Wrocław',
		nip: '000-000-00-03',
		krs: '0000000003',
		email: 'studio@atelier.example',
		phone: '+48 000 000 004',
		bank: '00 0000 0000 0000 0000 0000 0004',
		tagline: 'Przestrzeń na dobrą współpracę.'
	}
];

export const VAT_RATES = ['23', '8', '5', '0', 'zw'];
export const MAX_ITEMS = 100;
export function localDate(date = new Date()) {
	const d = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
	return d.toISOString().slice(0, 10);
}

export function addDays(value, days) {
	const d = new Date(value + 'T12:00:00');
	d.setDate(d.getDate() + days);
	return localDate(d);
}

export function createExample() {
	const date = localDate();
	return {
		company: 'forma',
		template: 'editorial',
		number: `OF/${date.slice(0,4)}/024`,
		date,
		validUntil: addDays(date, 14),
		title: 'Twoja marka.\nNowy rozdział.',
		subtitle: 'Projekt identyfikacji i strony internetowej',
		client: {
			name: 'Lumen Concept sp. z o.o.',
			contact: 'Anna Nowak',
			email: 'anna@lumen.example',
			nip: '000-000-10-00',
			address: 'ul. Koncepcyjna 18, 00-001 Warszawa'
		},
		items: [{
				id: 'example-1',
				name: 'Strategia i kierunek kreatywny',
				description: 'Warsztat, analiza marki i koncepcja wizualna.',
				quantity: '1',
				unit: 'projekt',
				price: '1800.00',
				vat: '23'
			},
			{
				id: 'example-2',
				name: 'Identyfikacja wizualna',
				description: 'Logo, paleta kolorów, typografia i mini brandbook.',
				quantity: '1',
				unit: 'projekt',
				price: '3200.00',
				vat: '23'
			},
			{
				id: 'example-3',
				name: 'Projekt strony internetowej',
				description: 'Responsywny projekt do 5 podstron.',
				quantity: '1',
				unit: 'projekt',
				price: '4500.00',
				vat: '23'
			}
		],
		discount: '5',
		notes: 'Zakres obejmuje dwie rundy poprawek. Termin realizacji: 21 dni od akceptacji oferty i otrzymania materiałów.',
		payment: 'Przelew · 50% przed rozpoczęciem, 50% po odbiorze',
		signature: 'Michał Kowalski',
		position: 'Project Director'
	};
}

export function decimalUnits(value, places = 2) {
	const raw = String(value ?? '').trim().replace(/\s/g, '').replace(',', '.');
	if (!/^\d+(?:\.\d*)?$/.test(raw)) return null;
	const [a, b = ''] = raw.split('.');
	if (b.length > places) return null;
	const n = Number(a) * 10 ** places + Number(b.padEnd(places, '0'));
	return Number.isSafeInteger(n) ? n : null;
}

function roundedRatio(numerator, denominator) {
	const d = BigInt(denominator);
	return Number((BigInt(numerator) + d / 2n) / d);
}

export function calculateOffer(state) {
	const discount = decimalUnits(state.discount);
	const discountBasis = discount !== null && discount <= 10000 ? discount : 0;
	const lines = state.items.map(item => {
		const price = decimalUnits(item.price),
			quantity = decimalUnits(item.quantity, 3);
		const valid = price !== null && quantity !== null && price <= 1000000000 &&
			quantity > 0 && quantity <= 10000000 && VAT_RATES.includes(String(item.vat));
		if (!valid) return {
			...item,
			valid: false,
			base: 0,
			discountAmount: 0,
			net: 0,
			tax: 0,
			gross: 0
		};
		const base = roundedRatio(BigInt(price) * BigInt(quantity), 1000);
		const discountAmount = roundedRatio(BigInt(base) * BigInt(discountBasis), 10000);
		const net = base - discountAmount,
			tax = item.vat === 'zw' ? 0 : roundedRatio(BigInt(net) * BigInt(item.vat), 100);
		return {
			...item,
			valid: true,
			base,
			discountAmount,
			net,
			tax,
			gross: net + tax
		};
	});
	const totals = lines.reduce((a, l) => ({
		base: a.base + l.base,
		discount: a.discount + l.discountAmount,
		net: a.net + l.net,
		tax: a.tax + l.tax,
		gross: a.gross + l.gross
	}), {
		base: 0,
		discount: 0,
		net: 0,
		tax: 0,
		gross: 0
	});
	const vatGroups = VAT_RATES.map(rate => ({
		rate,
		net: lines.filter(l => l.vat === rate).reduce((a, l) => a + l.net, 0),
		tax: lines.filter(l => l.vat === rate).reduce((a, l) => a + l.tax, 0)
	})).filter(x => lines.some(l => l.vat === x.rate));
	return {
		lines,
		totals,
		vatGroups
	};
}

export function validateOffer(state) {
	const errors = [];
	if (!COMPANIES.some(c => c.id === state.company)) errors.push('Wybierz spółkę.');
	if (!state.number?.trim()) errors.push('Uzupełnij numer oferty.');
	if (!state.client?.name?.trim()) errors.push('Uzupełnij nazwę klienta.');
	if (!state.title?.trim()) errors.push('Uzupełnij tytuł oferty.');
	const validDate = value => typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) &&
		Number.isFinite(Date.parse(value + 'T12:00:00Z')) && new Date(value + 'T12:00:00Z')
		.toISOString().slice(0, 10) === value;
	if (!validDate(state.date) || !validDate(state.validUntil) || state.validUntil < state.date)
		errors.push('Sprawdź daty: termin ważności nie może być wcześniejszy niż data oferty.');
	if (!state.items?.length || state.items.length > MAX_ITEMS) errors.push(
		`Dodaj od 1 do ${MAX_ITEMS} pozycji.`);
	if (decimalUnits(state.discount) === null || decimalUnits(state.discount) > 10000) errors.push(
		'Rabat musi wynosić od 0 do 100%.');
	const {
		lines
	} = calculateOffer(state);
	lines.forEach((l, i) => {
		if (!l.name?.trim()) errors.push(`Pozycja ${i+1}: wpisz nazwę.`);
		if (!l.valid) errors.push(`Pozycja ${i+1}: sprawdź ilość, cenę i VAT.`);
	});
	return errors;
}

export const money = cents => new Intl.NumberFormat('pl-PL', {
	style: 'currency',
	currency: 'PLN'
}).format(cents / 100);
export const dateLabel = date => /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(
	date + 'T12:00:00')) ? new Intl.DateTimeFormat('pl-PL', {
	day: '2-digit',
	month: 'long',
	year: 'numeric'
}).format(new Date(date + 'T12:00:00')) : '—';
export const escapeHtml = s => String(s ?? '').replace(/[&<>"']/g, c => ({
	'&': '&amp;',
	'<': '&lt;',
	'>': '&gt;',
	'"': '&quot;',
	"'": '&#39;'
} [c]));
export function restoreState(raw) {
	const example = createExample();
	if (!raw || typeof raw !== 'object' || !Array.isArray(raw.items) || raw.items.length >
		MAX_ITEMS) throw Error('Nieprawidłowy plik oferty.');
	const text = (v, max = 1000) => String(v ?? '').slice(0, max);
	const out = {
		...example
	};
	const limits = {
		company: 30,
		template: 30,
		number: 50,
		date: 10,
		validUntil: 10,
		title: 160,
		subtitle: 240,
		discount: 6,
		notes: 3000,
		payment: 500,
		signature: 100,
		position: 100
	};
	for (const k of Object.keys(limits)) out[k] = text(raw[k] ?? example[k], limits[k]);
	const clientLimits = {
		name: 150,
		contact: 100,
		nip: 25,
		email: 150,
		address: 200
	};
	out.client = Object.fromEntries(Object.keys(example.client).map(k => [k, text(raw.client?.[k] ??
		'', clientLimits[k])]));
	out.items = raw.items.map((item, i) => ({
		id: `import-${Date.now()}-${i}`,
		name: text(item.name, 300),
		description: text(item.description, 1000),
		quantity: text(item.quantity, 20),
		unit: text(item.unit, 30),
		price: text(item.price, 20),
		vat: text(item.vat, 5)
	}));
	if (!COMPANIES.some(c => c.id === out.company)) out.company = example.company;
	if (!['editorial', 'classic', 'minimal'].includes(out.template)) out.template = 'editorial';
	return out;
}
