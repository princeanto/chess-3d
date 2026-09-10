/**
 * The Apps Script the user pastes into their own Google account.
 *
 * Two rules govern everything in here.
 *
 * First, it parses nothing. It searches, it returns, it stops. Every piece of
 * intelligence lives in the app where it can be versioned and tested, so that
 * improving the parser never means asking the user to paste a script again.
 * This file is the one part of the system that is meant to be written once.
 *
 * Second, it reads. The manifest asks for `gmail.readonly` explicitly rather
 * than letting Apps Script infer a scope, because the convenient `GmailApp`
 * class requires full mailbox control — send, modify and delete included — and
 * a program that reads your bank mail has no business being able to delete it.
 * Calling the REST API with the script's own token is what buys the narrower
 * permission.
 */

export const BRIDGE_VERSION = 1;

export const MANIFEST = `{
  "timeZone": "Asia/Kolkata",
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "oauthScopes": [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/script.external_request"
  ],
  "webapp": {
    "executeAs": "USER_DEPLOYING",
    "access": "ANYONE_ANONYMOUS"
  }
}`;

/**
 * `SECRET` is replaced with a value the app generates before it shows you the
 * code, so the deployment URL alone is not enough to read your mail.
 */
export const CODE = String.raw`/**
 * Khata bridge — returns matching Gmail messages and nothing else.
 *
 * It does not parse, store, or send anything anywhere. Requests must carry the
 * secret below, which your copy of the app generated and keeps on your device.
 */

var SECRET = '__SECRET__';
var VERSION = 1;

/** Rejects anything without the secret, so the URL on its own is not a key. */
function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (!SECRET || body.secret !== SECRET) {
      return reply({ error: 'unauthorized' });
    }
    if (body.action === 'ping') {
      return reply({ ok: true, version: VERSION, address: primaryAddress() });
    }
    if (body.action === 'search') {
      return reply(search(body.query || '', body.pageToken || null, body.limit || 100));
    }
    return reply({ error: 'unknown action' });
  } catch (err) {
    return reply({ error: String(err) });
  }
}

/*
 * A browser cannot read the response to a cross-origin GET here, so the app
 * always POSTs. It sends text/plain deliberately: any other content type makes
 * the browser send a CORS preflight, and Apps Script cannot answer one.
 */
function doGet() {
  return reply({ ok: true, version: VERSION, note: 'Khata bridge. POST to use.' });
}

function reply(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(
    ContentService.MimeType.JSON
  );
}

function api(path, params) {
  var query = Object.keys(params || {})
    .filter(function (k) { return params[k] !== null && params[k] !== undefined; })
    .map(function (k) { return k + '=' + encodeURIComponent(params[k]); })
    .join('&');
  var url = 'https://gmail.googleapis.com/gmail/v1/users/me/' + path + (query ? '?' + query : '');
  var res = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: { Authorization: 'Bearer ' + ScriptApp.getOAuthToken() },
    muteHttpExceptions: true
  });
  return JSON.parse(res.getContentText());
}

function primaryAddress() {
  var profile = api('profile', {});
  return profile.emailAddress || null;
}

function search(query, pageToken, limit) {
  var listing = api('messages', {
    q: query,
    maxResults: Math.min(limit, 100),
    pageToken: pageToken
  });
  if (listing.error) return { error: listing.error.message || 'gmail error' };

  var ids = listing.messages || [];
  var messages = [];
  for (var i = 0; i < ids.length; i++) {
    var full = api('messages/' + ids[i].id, { format: 'full' });
    if (full.error) continue;
    messages.push(shape(full));
  }
  return { messages: messages, nextPageToken: listing.nextPageToken || null };
}

function shape(message) {
  var headers = {};
  var list = (message.payload && message.payload.headers) || [];
  for (var i = 0; i < list.length; i++) {
    headers[list[i].name.toLowerCase()] = list[i].value;
  }
  return {
    id: message.id,
    threadId: message.threadId,
    from: headers.from || '',
    subject: headers.subject || '',
    date: Number(message.internalDate),
    body: bodyOf(message.payload)
  };
}

/*
 * Prefers text/plain and falls back to text/html.
 *
 * Bank mail is nearly always multipart with both, and the plain part is far
 * cheaper to move and to read. The HTML is flattened by the app, not here.
 */
function bodyOf(payload) {
  var plain = findPart(payload, 'text/plain');
  var html = findPart(payload, 'text/html');
  var chosen = plain || html;
  if (!chosen) return '';
  return decode(chosen).slice(0, 20000);
}

function findPart(part, mime) {
  if (!part) return null;
  if (part.mimeType === mime && part.body && part.body.data) return part.body;
  var parts = part.parts || [];
  for (var i = 0; i < parts.length; i++) {
    var found = findPart(parts[i], mime);
    if (found) return found;
  }
  return null;
}

function decode(body) {
  var raw = String(body.data || '').replace(/-/g, '+').replace(/_/g, '/');
  try {
    return Utilities.newBlob(Utilities.base64Decode(raw)).getDataAsString('UTF-8');
  } catch (err) {
    return '';
  }
}
`;

/** The code with a freshly generated secret baked in. */
export function codeWithSecret(secret: string): string {
  return CODE.replace('__SECRET__', secret);
}

/**
 * A secret worth having.
 *
 * The deployment has to accept anonymous requests — an Apps Script web app
 * restricted to its owner would need a Google sign-in the app cannot perform —
 * so this value, not the URL, is what actually guards the data.
 */
export function makeSecret(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}
