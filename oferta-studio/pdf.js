import {
	COMPANIES,
	calculateOffer,
	money,
	dateLabel,
	escapeHtml,
	validateOffer
} from './core.js';

const encoder = new TextEncoder();
let fontPromise;
export async function loadFont(bytes) {
	if (bytes) return parseFont(bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes));
	if (globalThis.OFFER_FONT_BASE64) return fontPromise ??= Promise.resolve(parseFont(
		Uint8Array.from(atob(globalThis.OFFER_FONT_BASE64), c => c.charCodeAt(0))));
	return fontPromise ??= fetch('./assets/DejaVuSans.ttf').then(r => {
		if (!r.ok) throw Error('Nie udało się załadować czcionki.');
		return r.arrayBuffer();
	}).then(b => parseFont(new Uint8Array(b)));
}

function parseFont(bytes) {
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength),
		u16 = o => view.getUint16(o),
		i16 = o => view.getInt16(o),
		u32 = o => view.getUint32(o),
		tables = {};
	for (let i = 0; i < u16(4); i++) {
		const o = 12 + i * 16;
		tables[String.fromCharCode(...bytes.slice(o, o + 4))] = u32(o + 8);
	}
	const units = u16(tables.head + 18),
		metrics = u16(tables.hhea + 34),
		cmap = tables.cmap;
	let sub = 0;
	for (let i = 0; i < u16(cmap + 2); i++) {
		const o = cmap + 4 + i * 8,
			s = cmap + u32(o + 4);
		if (u16(s) === 4 && ((u16(o) === 3 && u16(o + 2) === 1) || !sub)) sub = s;
	}
	if (!sub) throw Error('Brak obsługi znaków Unicode w czcionce.');
	const segments = u16(sub + 6) / 2,
		end = sub + 14,
		start = end + segments * 2 + 2,
		delta = start + segments * 2,
		range = delta + segments * 2;

	function glyph(char) {
		const code = char.codePointAt(0);
		for (let i = 0; i < segments; i++) {
			if (code <= u16(end + 2 * i)) {
				if (code < u16(start + 2 * i)) return 0;
				const shift = i16(delta + 2 * i),
					off = u16(range + 2 * i);
				if (!off) return (code + shift) & 65535;
				const result = u16(range + 2 * i + off + 2 * (code - u16(start + 2 * i)));
				return result ? (result + shift) & 65535 : 0;
			}
		}
		return 0;
	}
	const advance = id => u16(tables.hmtx + Math.min(id, metrics - 1) * 4) / units;
	const width = (text, size) => [...String(text)].reduce((a, c) => a + advance(glyph(c)) * size,
		0);
	return {
		bytes,
		glyph,
		advance,
		width,
		units,
		ascender: i16(tables.hhea + 4) / units * 1000,
		descender: i16(tables.hhea + 6) / units * 1000,
		bbox: [i16(tables.head + 36), i16(tables.head + 38), i16(tables.head + 40), i16(tables
			.head + 42)].map(n => Math.round(n / units * 1000))
	};
}

function wrap(text, width, size, font) {
	const result = [];
	for (const paragraph of String(text ?? '').replace(/\r/g, '').split('\n')) {
		if (!paragraph) {
			result.push('');
			continue;
		}
		let current = '';
		for (const word of paragraph.split(/\s+/)) {
			if (font.width(current ? current + ' ' + word : word, size) <= width) {
				current = current ? current + ' ' + word : word;
				continue;
			}
			if (current) {
				result.push(current);
				current = '';
			}
			for (const ch of word) {
				if (font.width(current + ch, size) > width && current) {
					result.push(current);
					current = '';
				}
				current += ch;
			}
		}
		if (current) result.push(current);
	}
	return result;
}

export function layoutOffer(state, font) {
	const company = COMPANIES.find(c => c.id === state.company) || COMPANIES[0],
		{
			lines,
			totals,
			vatGroups
		} = calculateOffer(state);
	const pages = [],
		width = 595.28,
		height = 841.89,
		ink = '#292c29',
		muted = '#787d76',
		paper = state.template === 'minimal' ? '#ffffff' : '#fffefb',
		accent = company.color;
	let page, y;
	const rect = (x, t, w, h, color) => page.push({
		type: 'rect',
		x,
		y: t,
		w,
		h,
		color
	});
	const text = (value, x, t, size = 9, color = ink, bold = false, align = 'left') => {
		const str = String(value ?? '').replace(/\u00a0/g, ' ');
		page.push({
			type: 'text',
			text: str,
			x: align === 'right' ? x - font.width(str, size) : x,
			y: t,
			size,
			color,
			bold
		});
	};
	const rule = (t) => rect(44, t, 507.28, .6, '#e7e8e1');

	function newPage(first = false) {
		page = [];
		pages.push(page);
		rect(0, 0, width, height, paper);
		rect(0, 0, width, 5, accent);
		rect(44, 39, 32, 32, accent);
		text(company.initials, 53, 42, 24, '#ffffff', true);
		text(company.name, 87, 39, 17, ink, true);
		text(company.field, 87, 63, 8, muted);
		text('OFERTA HANDLOWA', 551.28, 42, 7.5, muted, true, 'right');
		text(state.number || 'Numer oferty', 551.28, 57, 9, ink, false, 'right');
		rule(94);
		y = 120;
		if (!first) {
			text('Zakres współpracy · kontynuacja', 44, 111, 11, ink, true);
			y = 143;
		} else y = 112;
	}

	function tableHeader() {
		rect(44, y, 507.28, 26, state.template === 'classic' ? company.dark : '#f0f0e9');
		const color = state.template === 'classic' ? '#ffffff' : muted;
		text('USŁUGA / PRODUKT', 55, y + 8, 7, color, true);
		text('ILOŚĆ', 342, y + 8, 7, color, true, 'right');
		text('CENA NETTO', 438, y + 8, 7, color, true, 'right');
		text('NETTO PO RABACIE', 541, y + 8, 6.5, color, true, 'right');
		y += 26;
	}
	newPage(true);
	const titleLines = wrap(state.title || 'Twoja oferta', 470, state.template === 'minimal' ? 30 :
		34, font);
	for (const l of titleLines) {
		if (y > 650) {
			newPage();
		}
		text(l, 44, y, state.template === 'minimal' ? 30 : 34, company.dark, true);
		y += 36;
	}
	y += 7;
	for (const l of wrap(state.subtitle, 480, 10, font)) {
		text(l, 44, y, 10, muted);
		y += 15;
	}
	y += 28;
	const sellerLines = wrap(company.legal + '\n' + company.address + '\nNIP: ' + company.nip +
		' · KRS: ' + company.krs, 230, 8.5, font);
	const clientLines = wrap((state.client.name || 'Nazwa klienta') + '\n' + [state.client.contact,
		state.client.address, state.client.nip ? 'NIP: ' + state.client.nip : '', state
		.client.email
	].filter(Boolean).join('\n'), 235, 8.5, font);
	if (y + Math.max(sellerLines.length, clientLines.length) * 13 + 100 > 720) newPage();
	text('PRZYGOTOWANA PRZEZ', 44, y, 7, accent, true);
	text('PRZYGOTOWANA DLA', 316, y, 7, accent, true);
	y += 20;
	sellerLines.forEach((l, i) => text(l, 44, y + i * 13, 8.5, i ? muted : ink, !i));
	clientLines.forEach((l, i) => text(l, 316, y + i * 13, 8.5, i ? muted : ink, !i));
	y += Math.max(sellerLines.length, clientLines.length) * 13 + 16;
	rect(44, y, 507.28, 42, '#f4f3ed');
	text('DATA OFERTY', 55, y + 8, 6.5, muted, true);
	text(dateLabel(state.date), 55, y + 22, 8.5, ink);
	text('WAŻNA DO', 253, y + 8, 6.5, muted, true);
	text(dateLabel(state.validUntil), 253, y + 22, 8.5, ink);
	text('WALUTA', 465, y + 8, 6.5, muted, true);
	text('PLN', 465, y + 22, 8.5, ink);
	y += 64;
	if (y > 665) newPage();
	tableHeader();
	for (const [i, item] of lines.entries()) {
		const name = wrap(item.name || 'Nowa pozycja', 265, 9, font),
			description = wrap(item.description, 265, 7.5, font);
		const combined = [...name.map(t => ({
			t,
			size: 9,
			bold: true
		})), ...description.filter(Boolean).map(t => ({
			t,
			size: 7.5,
			bold: false
		}))];
		const fullHeight = Math.max(48, combined.length * 13 + 20);
		if (y + fullHeight > 735 && fullHeight <= 566) {
			newPage();
			tableHeader();
		}
		let offset = 0,
			first = true;
		do {
			if (y + 38 > 735) {
				newPage();
				tableHeader();
			}
			const capacity = Math.max(1, Math.floor((735 - y - 20) / 13));
			const chunk = combined.slice(offset, offset + capacity);
			const rowHeight = Math.max(48, chunk.length * 13 + 20);
			if (i % 2 === 1) rect(44, y, 507.28, rowHeight, '#f8f7f2');
			chunk.forEach((l, j) => text(l.t, 55, y + 12 + j * 13, l.size, l.bold ? ink : muted, l
				.bold));
			if (first) {
				text(String(item.quantity).replace('.', ',') + ' ' + item.unit, 342, y + 12, 8,
					muted, false, 'right');
				text(money(Math.round(Number(String(item.price).replace(',', '.')) * 100) || 0),
					438, y + 12, 8, ink, false, 'right');
				text(money(item.net), 541, y + 12, 8.5, ink, true, 'right');
				text(item.vat === 'zw' ? 'VAT zw.' : `VAT ${item.vat}%`, 541, y + 28, 6.5, muted,
					false, 'right');
			}
			y += rowHeight;
			rule(y);
			offset += chunk.length;
			first = false;
			if (offset < combined.length) {
				newPage();
				tableHeader();
			}
		} while (offset < combined.length);
	}
	y += 25;
	const summaryHeight = 105 + vatGroups.length * 16 + (totals.discount ? 18 : 0);
	if (y + summaryHeight > 735) newPage();
	const summaryStart = y;
	rect(356, y, 195, summaryHeight, '#f2f1eb');
	let sy = y + 15;
	text('Wartość netto', 369, sy, 8, muted);
	text(money(totals.base), 538, sy, 8, ink, false, 'right');
	sy += 18;
	if (totals.discount) {
		text(`Rabat ${String(state.discount).replace('.',',')}%`, 369, sy, 8, muted);
		text('-' + money(totals.discount), 538, sy, 8, accent, false, 'right');
		sy += 18;
	}
	for (const group of vatGroups) {
		text(group.rate === 'zw' ? 'VAT zw.' : `VAT ${group.rate}%`, 369, sy, 8, muted);
		text(money(group.tax), 538, sy, 8, ink, false, 'right');
		sy += 16;
	}
	rect(369, sy + 3, 169, .6, '#d9dbd2');
	sy += 17;
	text('ŁĄCZNIE BRUTTO', 369, sy, 7, accent, true);
	text(money(totals.gross), 369, sy + 18, 19, company.dark, true);
	const conditions = wrap((state.notes ? 'WARUNKI WSPÓŁPRACY\n' + state.notes + '\n\n' : '') + (
		state.payment ? 'PŁATNOŚĆ\n' + state.payment : ''), 284, 8, font);
	let index = 0,
		cy = summaryStart;
	while (index < conditions.length) {
		if (cy + 13 > 730) {
			newPage();
			cy = y;
		}
		text(conditions[index], 44, cy, 8, muted, /^(WARUNKI WSPÓŁPRACY|PŁATNOŚĆ)$/.test(conditions[
			index]));
		cy += 13;
		index++;
	}
	let end = cy;
	if (end + 48 > 746) {
		newPage();
		end = y;
	}
	text(state.signature || company.name, 44, end + 23, 10, ink, true);
	text(state.position || 'Opiekun projektu', 44, end + 40, 7.5, muted);
	for (let i = 0; i < pages.length; i++) {
		page = pages[i];
		rect(44, 766, 507.28, .6, '#e1e3da');
		text(company.email + '   ·   ' + company.phone, 44, 778, 7.3, muted);
		text(`${i+1} / ${pages.length}`, 551, 778, 7.3, muted, false, 'right');
		text('Rachunek: ' + company.bank, 44, 791, 6.3, muted);
		text('Dane przykładowe · dokument nie jest fakturą', 44, 807, 6, muted);
		text(company.tagline, 551, 807, 6, accent, false, 'right');
	}
	return {
		pages,
		width,
		height,
		company
	};
}

export function pageSvg(layout, index = 0) {
	const {
		width,
		height,
		pages
	} = layout;
	return `<svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Podgląd strony ${index+1} oferty" viewBox="0 0 ${width} ${height}"><style>text{font-family:OfferPDF,sans-serif;white-space:pre}</style>${pages[index].map(op=>op.type==='rect'?`<rect x="${op.x}" y="${op.y}" width="${op.w}" height="${op.h}" fill="${op.color}"/>`:`<text x="${op.x}" y="${op.y+op.size*.81}" font-size="${op.size}" fill="${op.color}" font-weight="${op.bold?'700':'400'}">${escapeHtml(op.text)}</text>`).join('')}</svg>`;
}

function join(chunks) {
	const size = chunks.reduce((s, c) => s + c.length, 0),
		out = new Uint8Array(size);
	let offset = 0;
	for (const c of chunks) {
		out.set(c, offset);
		offset += c.length;
	}
	return out;
}
async function deflate(bytes) {
	if (typeof CompressionStream === 'undefined') return null;
	const stream = new Blob([bytes]).stream().pipeThrough(new CompressionStream('deflate'));
	return new Uint8Array(await new Response(stream).arrayBuffer());
}
export async function generatePdf(state, fontBytes) {
	const errors = validateOffer(state);
	if (errors.length) throw Error(errors[0]);
	const font = await loadFont(fontBytes),
		layout = layoutOffer(state, font),
		objects = [null];
	const reserve = () => {
		objects.push(null);
		return objects.length - 1;
	};
	const set = (id, value) => objects[id] = typeof value === 'string' ? encoder.encode(value) :
		value;
	const add = v => {
		const id = reserve();
		set(id, v);
		return id;
	};
	const stream = (dictionary, bytes) => join([encoder.encode(
			`<< ${dictionary} /Length ${bytes.length} >>\nstream\n`), bytes, encoder
		.encode('\nendstream')
	]);
	const catalog = reserve(),
		pagesObj = reserve(),
		fontObject = reserve(),
		cidFont = reserve(),
		descriptor = reserve();
	const compressed = await deflate(font.bytes),
		file = add(stream(
			`/Length1 ${font.bytes.length}${compressed?' /Filter /FlateDecode':''}`,
			compressed || font.bytes));
	const used = new Map();
	const encodeText = value => [...value].map(char => {
		const glyph = font.glyph(char);
		if (!glyph && char !== '\u0000') throw Error('Nieobsługiwany znak w PDF: ' +
			char);
		if (!used.has(glyph)) used.set(glyph, char.codePointAt(0));
		return glyph.toString(16).padStart(4, '0');
	}).join('');
	const rgb = color => color.slice(1).match(/../g).map(v => (parseInt(v, 16) / 255).toFixed(
		4)).join(' ');
	const pageRefs = [];
	for (const operations of layout.pages) {
		let commands = '';
		for (const op of operations) {
			if (op.type === 'rect') {
				commands +=
					`${rgb(op.color)} rg ${op.x} ${layout.height-op.y-op.h} ${op.w} ${op.h} re f\n`;
			} else commands +=
				`q ${rgb(op.color)} rg ${rgb(op.color)} RG BT /F1 ${op.size} Tf ${op.bold?'0.19 w 2 Tr':'0 Tr'} 1 0 0 1 ${op.x} ${layout.height-op.y-op.size*.81} Tm <${encodeText(op.text)}> Tj ET Q\n`;
		}
		const content = add(stream('', encoder.encode(commands)));
		pageRefs.push(add(
			`<< /Type /Page /Parent ${pagesObj} 0 R /MediaBox [0 0 ${layout.width} ${layout.height}] /Resources << /Font << /F1 ${fontObject} 0 R >> >> /Contents ${content} 0 R >>`
			));
	}
	const entries = [...used].sort((a, b) => a[0] - b[0]);
	let cmap =
		'/CIDInit /ProcSet findresource begin\n12 dict begin\nbegincmap\n/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def\n/CMapName /OfferUnicode def\n/CMapType 2 def\n1 begincodespacerange\n<0000> <FFFF>\nendcodespacerange\n';
	for (let i = 0; i < entries.length; i += 100) {
		const chunk = entries.slice(i, i + 100);
		cmap += `${chunk.length} beginbfchar\n` + chunk.map(([g, c]) =>
			`<${g.toString(16).padStart(4,'0')}> <${c.toString(16).padStart(4,'0')}>`).join(
			'\n') + '\nendbfchar\n';
	}
	cmap += 'endcmap\nCMapName currentdict /CMap defineresource pop\nend\nend';
	const unicode = add(stream('', encoder.encode(cmap)));
	set(descriptor,
		`<< /Type /FontDescriptor /FontName /DejaVuSans /Flags 32 /FontBBox [${font.bbox.join(' ')}] /ItalicAngle 0 /Ascent ${font.ascender} /Descent ${font.descender} /CapHeight ${font.ascender} /StemV 80 /FontFile2 ${file} 0 R >>`
		);
	set(cidFont,
		`<< /Type /Font /Subtype /CIDFontType2 /BaseFont /DejaVuSans /CIDSystemInfo << /Registry (Adobe) /Ordering (Identity) /Supplement 0 >> /FontDescriptor ${descriptor} 0 R /CIDToGIDMap /Identity /DW 1000 /W [${entries.map(([g])=>`${g} [${Math.round(font.advance(g)*1000)}]`).join(' ')}] >>`
		);
	set(fontObject,
		`<< /Type /Font /Subtype /Type0 /BaseFont /DejaVuSans /Encoding /Identity-H /DescendantFonts [${cidFont} 0 R] /ToUnicode ${unicode} 0 R >>`
		);
	set(pagesObj,
		`<< /Type /Pages /Count ${pageRefs.length} /Kids [${pageRefs.map(r=>`${r} 0 R`).join(' ')}] >>`
		);
	set(catalog, `<< /Type /Catalog /Pages ${pagesObj} 0 R /Lang (pl-PL) >>`);
	const info = add(
		'<< /Producer (Oferta Studio) /Creator (Oferta Studio) /Title (Oferta handlowa) >>');
	const chunks = [encoder.encode('%PDF-1.7\n% Oferta Studio\n')],
		offsets = [0];
	let pos = chunks[0].length;
	objects.slice(1).forEach((obj, i) => {
		offsets.push(pos);
		const data = join([encoder.encode(`${i+1} 0 obj\n`), obj, encoder.encode(
			'\nendobj\n')]);
		chunks.push(data);
		pos += data.length;
	});
	const xref =
		`xref\n0 ${objects.length}\n0000000000 65535 f \n${offsets.slice(1).map(o=>String(o).padStart(10,'0')+' 00000 n \n').join('')}trailer\n<< /Size ${objects.length} /Root ${catalog} 0 R /Info ${info} 0 R >>\nstartxref\n${pos}\n%%EOF`;
	chunks.push(encoder.encode(xref));
	return join(chunks);
}
