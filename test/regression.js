#!/usr/bin/env node
// Lightweight regression harness for PassGen.
//
// Drives a real headless Chrome instance against this static site (via the Chrome
// DevTools Protocol, no extra dependencies) and asserts on a handful of behaviors
// that have broken silently in the past: the URL/API query-param handling, the
// passphrase word-length/duplicate logic, and basic page-load health.
//
// Usage:
//   node test/regression.js
//
// Chrome is located automatically on common Windows/macOS/Linux install paths;
// set CHROME_PATH to override. Exits non-zero if any check fails.

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const PORT = 8791;
const DEBUG_PORT = 9291;

function findChrome() {
	if (process.env.CHROME_PATH && fs.existsSync(process.env.CHROME_PATH)) return process.env.CHROME_PATH;
	const candidates = [
		'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
		'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
		'C:\\Program Files\\Microsoft\\Edge\\Application\\msedge.exe',
		'/usr/bin/google-chrome',
		'/usr/bin/chromium-browser',
		'/usr/bin/chromium',
		'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
	];
	for (const c of candidates) if (fs.existsSync(c)) return c;
	throw new Error('Could not find a Chrome/Edge executable. Set CHROME_PATH to its full path.');
}

function startServer() {
	const mime = { '.html': 'text/html', '.txt': 'text/plain', '.jsonc': 'application/json' };
	const server = http.createServer((req, res) => {
		let p = req.url.split('?')[0];
		if (p === '/') p = '/index.html';
		const fp = path.join(ROOT, p);
		fs.readFile(fp, (err, data) => {
			if (err) { res.writeHead(404); res.end('not found'); return; }
			res.writeHead(200, { 'Content-Type': mime[path.extname(fp)] || 'application/octet-stream' });
			res.end(data);
		});
	});
	return new Promise((resolve) => server.listen(PORT, () => resolve(server)));
}

function launchChrome(chromePath) {
	const proc = spawn(chromePath, [
		'--headless=new', '--disable-gpu', '--no-sandbox',
		`--remote-debugging-port=${DEBUG_PORT}`,
		'--window-size=900,1300',
		'about:blank',
	], { stdio: 'ignore' });
	return proc;
}

async function waitForDebugger(timeoutMs = 8000) {
	const start = Date.now();
	while (Date.now() - start < timeoutMs) {
		try {
			const res = await fetch(`http://localhost:${DEBUG_PORT}/json`);
			if (res.ok) {
				const list = await res.json();
				const page = list.find(t => t.type === 'page');
				if (page) return page.webSocketDebuggerUrl;
			}
		} catch (e) { /* not up yet */ }
		await new Promise(r => setTimeout(r, 150));
	}
	throw new Error('Timed out waiting for Chrome remote debugging port.');
}

class CDP {
	constructor(ws) {
		this.ws = ws;
		this.nextId = 1;
		this.pending = new Map();
		this.exceptions = [];
		ws.addEventListener('message', (ev) => {
			const msg = JSON.parse(ev.data);
			if (msg.id !== undefined && this.pending.has(msg.id)) {
				const { resolve, reject } = this.pending.get(msg.id);
				this.pending.delete(msg.id);
				if (msg.error) reject(new Error(JSON.stringify(msg.error)));
				else resolve(msg.result);
			} else if (msg.method === 'Runtime.exceptionThrown') {
				this.exceptions.push(msg.params.exceptionDetails.exception?.description || JSON.stringify(msg.params.exceptionDetails));
			}
		});
	}
	send(method, params = {}) {
		const id = this.nextId++;
		return new Promise((resolve, reject) => {
			this.pending.set(id, { resolve, reject });
			this.ws.send(JSON.stringify({ id, method, params }));
		});
	}
	clearExceptions() { this.exceptions = []; }
}

async function connect(wsUrl) {
	const ws = new WebSocket(wsUrl);
	await new Promise((resolve, reject) => {
		ws.addEventListener('open', resolve);
		ws.addEventListener('error', reject);
	});
	const cdp = new CDP(ws);
	await cdp.send('Page.enable');
	await cdp.send('Runtime.enable');
	return cdp;
}

async function navigateAndEval(cdp, url, expression) {
	cdp.clearExceptions();
	await cdp.send('Page.navigate', { url });
	await new Promise(r => setTimeout(r, 900)); // let the initial synchronous script + async word-list fetch settle
	const result = await cdp.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
	if (result.exceptionDetails) {
		throw new Error('Page threw during evaluate: ' + JSON.stringify(result.exceptionDetails));
	}
	return { value: result.result.value, exceptions: [...cdp.exceptions] };
}

const BASE = `http://localhost:${PORT}/index.html`;
const tests = [];
function test(name, fn) { tests.push({ name, fn }); }

test('plain page load has no console exceptions', async (cdp) => {
	const { exceptions } = await navigateAndEval(cdp, BASE, '(function(){ return true; })()');
	assert(exceptions.length === 0, `unexpected exceptions: ${exceptions.join(' | ')}`);
});

test('URL params do not crash the page (regression: selectAllBtn TDZ)', async (cdp) => {
	const { value, exceptions } = await navigateAndEval(cdp,
		`${BASE}?mode=password&length=16&format=text`,
		`(function(){ const pre=document.querySelector('pre'); return pre? pre.textContent.trim() : null; })()`
	);
	assert(exceptions.length === 0, `unexpected exceptions: ${exceptions.join(' | ')}`);
	assert(value && value.length === 16, `expected a 16-char password, got: ${JSON.stringify(value)}`);
});

test('custom prefix is applied (regression: len<=0 short-circuit ate it)', async (cdp) => {
	const { value } = await navigateAndEval(cdp,
		`${BASE}?mode=password&length=20&optPrefix=1&prefixType=custom&prefixCustom=XY&format=text`,
		`(function(){ return document.querySelector('pre').textContent.trim(); })()`
	);
	assert(value.startsWith('XY') && value.length === 20, `expected 20 chars starting with XY, got: ${JSON.stringify(value)}`);
});

test('format=text output is not HTML-injectable (regression: innerHTML XSS)', async (cdp) => {
	const url = `${BASE}?mode=password&length=25&optBeginLetter=0&optPrefix=1&prefixType=custom&` +
		`prefixCustom=${encodeURIComponent('<img src=x')}&optSuffix=1&suffixType=custom&` +
		`suffixCustom=${encodeURIComponent('onerror=1>')}&format=text`;
	const { value } = await navigateAndEval(cdp, url,
		`(function(){ return {text: document.querySelector('pre').textContent, imgCount: document.querySelectorAll('img').length}; })()`
	);
	assert(value.imgCount === 0, `an <img> element was created from URL-supplied text -- XSS regression`);
	assert(value.text.includes('<img'), `expected the raw text to still contain the literal characters (escaped in the DOM)`);
});

test('hexBeginLetter=1 is honored (regression: clobbered by mode-visibility sync)', async (cdp) => {
	const { value } = await navigateAndEval(cdp,
		`${BASE}?mode=hex&length=12&hexBeginLetter=1&count=30&format=text`,
		`(function(){ return document.querySelector('pre').textContent.trim().split('\\n'); })()`
	);
	assert(value.length === 30, `expected 30 lines, got ${value.length}`);
	assert(value.every(l => /^[A-Fa-f]/.test(l)), `expected every hex string to start with a letter, got: ${value.filter(l=>!/^[A-Fa-f]/.test(l)).slice(0,5)}`);
});

test('optSymbols=0 excludes symbols (regression: missing from URL param list)', async (cdp) => {
	const { value } = await navigateAndEval(cdp,
		`${BASE}?mode=password&length=20&optSymbols=0&count=15&format=text`,
		`(function(){ return document.querySelector('pre').textContent.trim().split('\\n'); })()`
	);
	assert(value.length === 15, `expected 15 lines, got ${value.length}`);
	assert(value.every(l => /^[A-Za-z0-9]+$/.test(l)), `found a symbol despite optSymbols=0: ${value.find(l=>!/^[A-Za-z0-9]+$/.test(l))}`);
});

test('passphrase: exact length, no duplicate words, generous budget', async (cdp) => {
	const { value } = await navigateAndEval(cdp,
		`${BASE}?mode=passphrase&ppWords=4&ppDelimiter=.&length=30&count=60&format=text`,
		`(function(){ return document.querySelector('pre').textContent.trim().split('\\n'); })()`
	);
	assert(value.length === 60, `expected 60 passphrases, got ${value.length}`);
	for (const line of value) {
		assert(line.length === 30, `passphrase "${line}" is ${line.length} chars, expected 30`);
		const words = line.split('.').map(w => w.replace(/[0-9]/g, '')).filter(Boolean).map(w => w.toLowerCase());
		assert(new Set(words).size === words.length, `duplicate word in passphrase: ${line}`);
	}
});

test('passphrase: still succeeds and stays duplicate-free under a tight length budget', async (cdp) => {
	const { value } = await navigateAndEval(cdp,
		`${BASE}?mode=passphrase&ppWords=5&ppDelimiter=.&length=24&count=60&format=text`,
		`(function(){ return document.querySelector('pre').textContent.trim().split('\\n'); })()`
	);
	assert(value.length === 60, `expected 60 passphrases, got ${value.length} (generation failures under a tight budget)`);
	for (const line of value) {
		const words = line.split('.').map(w => w.replace(/[0-9]/g, '')).filter(Boolean).map(w => w.toLowerCase());
		assert(new Set(words).size === words.length, `duplicate word in passphrase: ${line}`);
	}
});

test('Reset Defaults refreshes mode-dependent panel visibility', async (cdp) => {
	const { value } = await navigateAndEval(cdp, BASE, `
		(async function(){
			document.getElementById('modeSelect').value='hex';
			document.getElementById('modeSelect').dispatchEvent(new Event('change'));
			document.getElementById('resetDefaultsBtn').click();
			await new Promise(r=>setTimeout(r,80));
			document.getElementById('resetConfirm').click();
			await new Promise(r=>setTimeout(r,80));
			const hexControls = document.getElementById('hexControls');
			return { mode: document.getElementById('modeSelect').value, hexVisible: hexControls.style.display!=='none' };
		})()
	`);
	assert(value.mode === 'password', `expected mode reset to password, got ${value.mode}`);
	assert(value.hexVisible === false, `hex options panel was left visible after resetting to password mode`);
});

function assert(cond, msg) { if (!cond) throw new Error(msg); }

async function main() {
	const chromePath = findChrome();
	console.log(`Using Chrome: ${chromePath}`);
	const server = await startServer();
	const chromeProc = launchChrome(chromePath);
	let failures = 0;
	try {
		const wsUrl = await waitForDebugger();
		const cdp = await connect(wsUrl);
		for (const { name, fn } of tests) {
			process.stdout.write(`- ${name} ... `);
			try {
				await fn(cdp);
				console.log('PASS');
			} catch (e) {
				failures++;
				console.log('FAIL');
				console.log(`    ${e.message}`);
			}
		}
	} finally {
		chromeProc.kill();
		server.close();
	}
	console.log(`\n${tests.length - failures}/${tests.length} passed.`);
	process.exit(failures ? 1 : 0);
}

main().catch(e => { console.error(e); process.exit(1); });
