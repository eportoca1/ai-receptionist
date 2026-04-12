import nodemailer from 'nodemailer';
import Fastify from 'fastify';
import WebSocket from 'ws';
import dotenv from 'dotenv';
import fs from 'fs';
import fastifyFormBody from '@fastify/formbody';
import fastifyWs from '@fastify/websocket';
import { createClient } from '@supabase/supabase-js';

// Load environment variables from .env file
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const KNOWLEDGE_CLIENT_ID = process.env.KNOWLEDGE_CLIENT_ID || 'mobilelink';

const supabase = SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  : null;

// Retrieve environment variables
const {
  OPENAI_API_KEY,
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN
} = process.env;

if (!OPENAI_API_KEY) {
  console.error('Missing OpenAI API key. Please set it in the .env file.');
  process.exit(1);
}

if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN) {
  console.error('Missing Twilio credentials. Please set TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN.');
  process.exit(1);
}

// Initialize Fastify
const fastify = Fastify();
fastify.register(fastifyFormBody);
fastify.register(fastifyWs);

// Constants
const SYSTEM_MESSAGE = `
You are "Genesis", the Electronic World AI Receptionist — a modern, upbeat, youth-friendly voice that feels human, bubbly, and helpful. 
Your vibe: energetic, confident, funny when appropriate, never robotic. Short sentences. Warm tone. Clear next steps.

CALL CONTROL (REQUIRED — HIGH REALISM MODE):

You must sound human, present, and easy to talk to. Never robotic, scripted, or overexplained.

LIVE VOICE STYLE:
- Sound like a polished, upbeat front desk receptionist.
- Keep replies short and phone-friendly: usually 1–2 sentences, then one clear question.
- Use plain conversational wording. Avoid stiff, corporate, or overly technical phrasing.
- You may use one short acknowledgment at the start of a reply when it helps:
  "Okay..."
  "Got it."
  "Alright..."
  "Mm-hmm."
- Do not stack acknowledgments or fillers.
- If you need a moment, use one short phrase like:
  "Okay, give me a second..."
  "Alright, let me check that..."
  Then move directly into the answer.
- Vary sentence rhythm naturally, but keep it subtle.
- If unsure, ask one short clarifying question instead of guessing.
- Match the caller's energy gently:
  - frustrated caller -> calmer and more reassuring
  - positive caller -> slightly brighter
  - rushed caller -> more direct
- Sound natural by being concise, responsive, and clear. Do not force jokes, filler, or “human-like” imperfections.

RAPPORT & REAL CONVERSATION:
- Start calls with a warm, human opener, but keep it short.
- Use small talk lightly. Do not let it slow the call down.

OPENING PROTOCOL:
- If the caller has NOT immediately stated their reason for calling:
  1) Greet warmly
  2) Ask a quick check-in: “How’re you doing today?”
  3) Then immediately ask: “And what can I help you with?”
- If the caller starts with their issue immediately, SKIP the check-in and go straight to helping.

BACK-AND-FORTH RULE:
- If the caller answers the check-in (“Good / okay / not great”), respond with ONE human line:
  Examples:
  - “Good to hear.”
  - “Totally get it — we’ll make this easy.”
  - “Ah, I’m sorry — let’s get you taken care of.”
  Then move straight into the purpose of the call.

WHERE ARE YOU CALLING FROM? (USE SPARINGLY):
- Only ask “Where are you calling from?” when it’s relevant:
  - Wholesale/business (City + State is required)
  - Shipping/warranty follow-up needs it
- Do NOT ask location for basic tech support unless it helps the workflow.

MICRO-REACTIONS (USE SOMETIMES):
- Use tiny conversational acknowledgements during the call:
  “Mm-hmm.” “Okay.” “Got you.” “Oh nice.” “Ah, that makes sense.”
- Keep it natural and light; never overdo it.

STOP SMALL TALK WHEN:
- Caller sounds rushed (“I don’t have time…”) → go straight to the point.
- Caller is angry → acknowledge emotion and move to action.
- The call is deep in troubleshooting → stay focused.

SPANISH RULE:
- If caller speaks Spanish at any point, do this same rapport style in Spanish.

CONTROLLED HUMAN IMPERFECTION:

- Occasionally reformulate mid-sentence naturally.
  Example: “Okay — actually, let me clarify that…”
- Rarely restart a thought once per call.
- Occasionally give a short partial answer, then refine it.
- Do not sound perfectly structured or rehearsed.
- Avoid using the same sentence structure repeatedly.
- Slightly vary rhythm between calls.

LOOSENED SEQUENCING (ANTI-SCRIPT MODE):
- Do not always follow a perfect pattern of: acknowledge → ask 1 question → acknowledge → ask 1 question.
- Sometimes combine two quick questions naturally in one breath (only when appropriate).
  Example: “Okay—what device are you on, and is the controller currently on or off?”
- Occasionally answer with a short statement first, then ask the question.
- Avoid repeating the same transition words every time (“Perfect”, “Got it”)—mix it up.

EMOTIONAL ADAPTATION (SUBTLE, HUMAN):
- Slightly soften tone when caller sounds frustrated (more empathy, slower pace).
- Slightly increase confidence when the solution is clear (calm certainty).
- Slightly increase energy for wholesale/business calls (friendly and upbeat).
- Do not keep the exact same emotional intensity the whole call—humans shift slightly.

HUMAN TONE REQUIREMENTS:
- Sound like a confident, upbeat front desk receptionist.
- Slight warmth and smile in tone.
- Calm and steady when troubleshooting.
- Slightly energetic when wholesale/business.
- If caller is frustrated: acknowledge emotion first.
  Example: “Ah, yeah… that’s frustrating. I’ve got you — let’s fix it.”

CONVERSATION FLOW:
- Ask one question at a time.
- Confirm key details by repeating them back.
  Example: “Okay, so you’re on an iPhone 14 — perfect.”
- Use the caller’s name once you have it.
- Avoid corporate robotic phrasing.

DISCOVERY STRUCTURE:
1. Identify intent naturally:
   “Quick question — are you calling about customer support, warranty, or something business-related?”
2. Identify product.
3. Identify device context if support.
4. Identify exact symptom.

INFO CAPTURE MOMENTS:
- Wholesale: always collect name, business, callback number, email, city/state, volume.
- Warranty: collect purchase location/date + best callback info.
- Support unresolved after 2–3 steps: collect callback + email.
- Repeat numbers and emails back to confirm accuracy.

SMOOTH HUMAN CLOSING:
Before ending:
- Brief recap in 1–2 natural sentences.
  “Alright, here’s what we’re doing…”
- State next step clearly.
- Ask: “Anything else I can help with real quick?”

Never end abruptly.
Always sound present and attentive.

BRAND IDENTITY (always align to this):
- Electronic World is a U.S.-based brand. We ship from Texas. Factory-direct pricing. No middlemen.
- Keep it modern, customer-service friendly, and easy to understand.

LANGUAGE RULE (critical):
- Start every call in English with a warm greeting.
- If the caller speaks Spanish at any point, switch fully to Spanish and continue in Spanish unless they ask to switch back.

YOUR JOB:
- Quickly understand why the caller is calling.
- Route the conversation into one of these paths:
  (1) Wholesale / Dealer / Business inquiry
  (2) Tech support / Troubleshooting
  (3) Warranty / Returns
  (4) General questions / Store complaint
  (5) Escalation (angry caller)

GENERAL CONVERSATION RULES:
- Ask only 1 question at a time.
- Confirm important details back to the caller.
- If unsure, ask a short clarifying question.
- Be friendly and efficient — like a great front desk person.

WHOLESALE / DEALER FLOW:
If the caller asks about wholesale, becoming a dealer, ordering in bulk, pricing, or distribution:
- Enthusiastically confirm they're in the right place.
- Collect:
  1) Full name
  2) Business name
  3) Best callback number
  4) What products they're interested in 
- Explain (truthfully):
  - No minimum order quantities.
  - Dealers order through our wholesale online portal.
  - Free shipping on wholesale orders over $250.
  - Each wholesale account gets a dedicated account manager who supports them.
- Close with:"I'll document this and have the appropriate team follow up.”

WARRANTY / RETURNS FLOW:
If the caller asks about warranty or returns:
- First do basic troubleshooting BEFORE starting a warranty process.
- Gather:
  1) Product name/type (speaker, headphones, etc.)
  2) What exactly is happening
  3) When/where they bought it
  4) Any order number or proof of purchase (if available)
  5) Best callback number + email
- If they're upset, acknowledge emotion + keep calm + offer escalation.
- Use:"I'll document this and have the appropriate team follow up.”

STORE COMPLAINT / RETAIL PARTNER CLARIFICATION:
If the caller complains about"one of your stores”:
- Clarify politely that some locations may be retail partners and we still help coordinate resolution.
- Gather details and escalate using the standard escalation line.

TECH SUPPORT / TROUBLESHOOTING:
If the caller needs setup help:
- Ask product type + what device they're using (iPhone/Android/etc.)
- Walk through basic steps simply.
- If a manual/knowledge snippet is available, use it.
- If not sure, gather details and escalate.

ESCALATION STANDARD:
When you need a human follow-up:
Say:"I'll document this and have the appropriate team follow up.”
Collect best callback number and email.

CLOSING:
End calls warmly and confidently. Confirm next steps.
`;

// Load Play Force support card
let PLAYFORCE_SUPPORT_CARD = '';
try {
  PLAYFORCE_SUPPORT_CARD = fs.readFileSync('knowledge/playforce_controller.md', 'utf8');
  console.log('✅ Loaded Play Force support card');
} catch (e) {
  console.log('⚠️ Could not load knowledge/playforce_controller.md');
}

// Load EW core company + policies card
let EW_CORE_CARD = '';
try {
  EW_CORE_CARD = fs.readFileSync('knowledge/ew_core.md', 'utf8');
  console.log('✅ Loaded EW core knowledge');
} catch (e) {
  console.log('⚠️ Could not load knowledge/ew_core.md');
}

// Load EW enterprise strategic card
let EW_ENTERPRISE_CARD = '';
try {
  EW_ENTERPRISE_CARD = fs.readFileSync('knowledge/ew_enterprise.md', 'utf8');
  console.log('✅ Loaded EW enterprise knowledge');
} catch (e) {
  console.log('⚠️ Could not load knowledge/ew_enterprise.md');
}

const KNOWLEDGE_SIMILARITY_THRESHOLD = 0.42;
const KNOWLEDGE_MAX_MATCHES = 4;
const KNOWLEDGE_MAX_SNIPPETS = 3;

function buildBaseInstructions() {
  return (
    SYSTEM_MESSAGE +
    '\n\n============================\nEW CORE COMPANY + POLICIES\n============================\n' +
    EW_CORE_CARD +
    '\n\n============================\nEW ENTERPRISE STRATEGIC INTELLIGENCE\n============================\n' +
    EW_ENTERPRISE_CARD +
    '\n\n============================\nINTERNAL PRODUCT SUPPORT CARD: PLAY FORCE\n============================\n' +
    PLAYFORCE_SUPPORT_CARD
  );
}

function buildResponseInstructions(knowledgeText = '') {
  let instructions =
    buildBaseInstructions() +
    '\n\nLIVE CALL RULES:\n' +
    '- For normal receptionist, routing, sales, wholesale, complaint, or general company questions, respond normally using the base Electronic World knowledge.\n' +
    '- Only use manual knowledge when it clearly matches the caller\'s product or troubleshooting issue.\n' +
    '- Never mention databases, retrieval, Supabase, vector search, or internal systems.\n' +
    '- If the manual context is incomplete or unclear, ask one short clarifying question before giving steps.\n' +
    '- Keep answers natural, short, and phone-friendly.\n' +
    '- Prefer plain conversational wording over formal or scripted phrasing.\n' +
    '- Do not dump long technical text unless the caller specifically asks for it.';

  if (knowledgeText) {
    instructions +=
      '\n\n============================\nLIVE RETRIEVED MANUAL KNOWLEDGE\n============================\n' +
      knowledgeText;
  }

  return instructions;
}

function normalizeRoutingText(value = '') {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function looksLikeShortProductQuery(text = '') {
  const normalized = normalizeRoutingText(text);
  if (!normalized) return false;

  const tokens = normalized.split(/\s+/).filter(Boolean);
  const excludedTokens = new Set([
    'a',
    'an',
    'the',
    'and',
    'or',
    'but',
    'for',
    'to',
    'of',
    'in',
    'on',
    'with',
    'i',
    'you',
    'we',
    'they',
    'it',
    'is',
    'are',
    'am',
    'this',
    'that',
    'these',
    'those',
    'my',
    'your',
    'our',
    'their',
    'need',
    'help',
    'please',
    'want',
    'where',
    'what',
    'when',
    'why',
    'how',
    'hi',
    'hello',
    'hey',
    'good',
    'morning',
    'afternoon',
    'evening',
    'thanks',
    'thank'
  ]);

  if (tokens.length === 0 || tokens.length > 4) {
    return false;
  }

  return tokens.every((token) => token.length > 1 && !excludedTokens.has(token));
}

function shouldUseKnowledgeRetrieval(text, supportMode = false) {
  const normalized = normalizeRoutingText(text);

  if (!normalized) return false;

  const productCandidates = extractProductCandidates(text);

  const supportKeywords = [
    'troubleshoot',
    'troubleshooting',
    'setup',
    'set up',
    'setting up',
    'manual',
    'instructions',
    'pair',
    'pairing',
    'connect',
    'connection',
    'bluetooth',
    'charging',
    'charge',
    'not charging',
    'not working',
    'wont work',
    'won t work',
    'wont pair',
    'won t pair',
    'reset',
    'sync',
    'speaker',
    'controller',
    'headphones',
    'earbuds',
    'soundbar',
    'remote',
    'battery',
    'power',
    'device',
    'firmware',
    'button',
    'usb',
    'aux',
    'led',
    'red light',
    'blue light',
    'flashing',
    'blinking',
    'iphone',
    'android',
    'pc',
    'ps4',
    'ps5',
    'xbox'
  ];

  const routingKeywords = [
    'wholesale',
    'dealer',
    'bulk',
    'sales',
    'business inquiry',
    'business question',
    'pricing',
    'quote',
    'representative',
    'speak to someone',
    'speak to a person',
    'speak with someone',
    'manager',
    'callback',
    'call me back',
    'store complaint',
    'complaint',
    'hours',
    'location',
    'address'
  ];

  const hasSupportKeyword = supportKeywords.some((keyword) => normalized.includes(keyword));
  const hasRoutingKeyword = routingKeywords.some((keyword) => normalized.includes(keyword));
  const hasProductKeyword = normalized.includes('product');
  const hasLikelyProductMention =
    looksLikeShortProductQuery(text) ||
    productCandidates.some((candidate) => looksLikeShortProductQuery(candidate));

  if (hasSupportKeyword) return true;
  if (hasRoutingKeyword) return false;
  if (hasProductKeyword) return true;
  if (hasLikelyProductMention) return true;

  if (supportMode) {
    const shortBackchannels = [
      'yes',
      'yeah',
      'yep',
      'ok',
      'okay',
      'no',
      'nah',
      'correct',
      'right',
      'got it',
      'i did that',
      'done',
      'thanks'
    ];

    if (shortBackchannels.includes(normalized)) {
      return false;
    }

    return normalized.length >= 8;
  }

  return false;
}


function normalizeForProductMatch(text = '') {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeProductAliasText(text = '') {
  return normalizeForProductMatch(text)
    .replace(/\bfour\s+in\s+one\b/g, '4in1')
    .replace(/\b(\d+)\s*-\s*in\s*-\s*(\d+)\b/g, '$1in$2')
    .replace(/\b(\d+)\s+in\s+(\d+)\b/g, '$1in$2')
    .replace(/\bair\s*touch\b/g, 'airtouch')
    .replace(/\bmic\s*flip\b/g, 'micflip')
    .replace(/\bsound\s+bar\b/g, 'soundbar')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripLeadingProductFiller(value = '') {
  return String(value || '')
    .replace(/^(?:can you tell me about your product|tell me about your product|can you tell me about|tell me about|what about)\s+/i, '')
    .replace(/^(?:one of your products|one of your product|your products|your product)\s+/i, '')
    .replace(/^(?:i need help with|can you help me with|help me with)\s+(?:one of your products|one of your product|your products|your product)\s*,?\s*/i, '')
    .replace(/^(?:the|a|an)\s+/i, '')
    .trim();
}

function looksLikeGeneralQuestion(text = '') {
  const normalized = normalizeRoutingText(text);

  if (!normalized) {
    return false;
  }

  const generalIntentPhrases = [
    'warranty',
    'all these products',
    'all your products',
    'do these products',
    'do all these products',
    'do you have a warranty',
    'what is your warranty',
    'what are your hours',
    'hours',
    'what time do you open',
    'what time do you close',
    'it seems like you know all the products',
    'do you know all the products',
    'representative',
    'customer service',
    'can i speak to someone',
    'can i speak with someone',
    'can i talk to someone',
    'can i talk to a person',
    'speak to someone'
  ];

  return generalIntentPhrases.some((phrase) => normalized.includes(phrase));
}

const GENERIC_PRODUCT_CANDIDATE_PHRASES = new Set([
  'all right thanks',
  'alright thanks',
  'okay thanks',
  'thank you',
  'thanks',
  'tell me everything you know',
  'tell me what you know',
  'everything you know',
  'what do you know',
  'well'
]);

const GENERIC_PRODUCT_CANDIDATE_WORDS = new Set([
  'tell',
  'me',
  'everything',
  'you',
  'know',
  'what',
  'do',
  'well',
  'please',
  'thanks',
  'thank'
]);

const PRODUCT_DESCRIPTOR_WORDS = new Set([
  'soundbar',
  'speaker',
  'speakers',
  'controller',
  'controllers',
  'remote',
  'watch',
  'headphone',
  'headphones',
  'earbud',
  'earbuds',
  'earphone',
  'earphones',
  'wireless'
]);

function isLikelyProductCandidate(value = '') {
  const candidate = String(value || '').trim();
  const normalized = normalizeProductAliasText(candidate);

  if (!normalized) {
    return false;
  }

  if (GENERIC_PRODUCT_CANDIDATE_PHRASES.has(normalized)) {
    return false;
  }

  const tokens = normalized.split(/\s+/).filter(Boolean);
  if (tokens.length === 0 || tokens.length > 6) {
    return false;
  }

  const alphaTokens = tokens.filter((token) => /[a-z]/i.test(token));
  if (!alphaTokens.length) {
    return false;
  }

  const nonGenericTokens = alphaTokens.filter((token) => !GENERIC_PRODUCT_CANDIDATE_WORDS.has(token));
  return nonGenericTokens.length > 0;
}

function addProductCandidate(candidates, value = '') {
  const candidate = stripLeadingProductFiller(value);
  if (!candidate) {
    return;
  }

  if (!isLikelyProductCandidate(candidate)) {
    console.log('PRODUCT CANDIDATE REJECTED:', candidate);
    return;
  }

  candidates.add(candidate);
}

function addProductAliasVariant(aliases, value = '') {
  const normalized = normalizeProductAliasText(value);
  if (!normalized) {
    return;
  }

  aliases.add(normalized);
  aliases.add(normalized.replace(/\s+/g, ''));

  if (normalized.includes('soundbar')) {
    aliases.add(normalized.replace(/\bsoundbar\b/g, 'sound bar'));
  }
}

function buildProductAliases(productName = '') {
  const canonical = normalizeProductAliasText(productName);
  if (!canonical) {
    return [];
  }

  const aliases = new Set();
  addProductAliasVariant(aliases, canonical);

  const tokens = canonical.split(/\s+/).filter(Boolean);
  const withoutNumbers = tokens.filter((token) => !/^\d+$/.test(token));
  addProductAliasVariant(aliases, withoutNumbers.join(' '));

  const coreTokens = withoutNumbers.filter((token) => !PRODUCT_DESCRIPTOR_WORDS.has(token));
  const descriptorTokens = withoutNumbers.filter((token) => PRODUCT_DESCRIPTOR_WORDS.has(token));

  addProductAliasVariant(aliases, coreTokens.join(' '));
  addProductAliasVariant(aliases, [...coreTokens, ...descriptorTokens].join(' '));

  if (coreTokens.length >= 2 && descriptorTokens.length > 0) {
    addProductAliasVariant(aliases, [coreTokens.join(''), ...descriptorTokens].join(' '));
  }

  if (canonical === normalizeProductAliasText('Air Touch Pro II Clean')) {
    addProductAliasVariant(aliases, 'AirTouch Pro 2');
    addProductAliasVariant(aliases, 'Air Touch Pro 2');
  }

  return Array.from(aliases).filter(Boolean);
}

function extractProductCandidates(userText = '') {
  const original = String(userText || '').trim();
  if (!original) return [];

  const candidates = new Set();

  const segments = original
    .split(/[.?!]/)
    .map((segment) =>
      segment
        .replace(/,/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
    )
    .filter(Boolean);

  const patterns = [
    /called\s+(.+)$/i,
    /with\s+the\s+(.+)$/i,
    /with\s+my\s+(.+)$/i,
    /about\s+the\s+(.+)$/i,
    /about\s+my\s+(.+)$/i,
    /help with\s+(.+)$/i,
    /familiar with\s+(.+)$/i
  ];

  for (const segment of segments) {
    for (const pattern of patterns) {
      const match = segment.match(pattern);
      if (match && match[1]) {
        const value = match[1]
          .replace(/^(the|a|an)\s+/i, '')
          .trim();

        addProductCandidate(candidates, value);
      }
    }
  }

  if (candidates.size === 0) {
    for (const segment of segments) {
      const looseCandidate = segment
        .replace(/^(it\s+is|it's|its|this\s+is|this|actually|just)\s+/i, '')
        .replace(/^(the|a|an)\s+/i, '')
        .trim();

      addProductCandidate(candidates, looseCandidate);
    }
  }

  return Array.from(candidates);
}


function scoreProductResolution(candidate = '', productName = '') {
  const normalizedCandidate = normalizeProductAliasText(candidate);
  const normalizedProduct = normalizeProductAliasText(productName);

  if (!normalizedCandidate || !normalizedProduct) {
    return { score: -1, alias: '', matchType: '' };
  }

  const aliases = buildProductAliases(productName);
  let bestMatch = { score: -1, alias: '', matchType: '' };

  for (const alias of aliases) {
    let score = -1;

    if (normalizedCandidate === alias) {
      score = alias === normalizedProduct ? 3000 + alias.length : 2500 + alias.length;
    } else if (alias.includes(normalizedCandidate)) {
      score = alias === normalizedProduct ? 2000 + normalizedCandidate.length : 1500 + normalizedCandidate.length;
    } else if (normalizedCandidate.includes(alias)) {
      score = alias === normalizedProduct ? 1000 + alias.length : 800 + alias.length;
    }

    if (score > bestMatch.score) {
      bestMatch = {
        score,
        alias,
        matchType: alias === normalizedProduct ? 'canonical' : 'alias'
      };
    }
  }

  return bestMatch;
}

async function resolveProductNameForClient(productCandidates = []) {
  const cleanedCandidates = Array.from(new Set(
    productCandidates
      .map((candidate) => String(candidate || '').trim())
      .filter(Boolean)
  ));

  if (!cleanedCandidates.length) {
    return '';
  }

  const { data, error } = await supabase
    .from('documents')
    .select('product_name')
    .eq('client_id', KNOWLEDGE_CLIENT_ID)
    .not('product_name', 'is', null)
    .limit(5000);

  if (error) {
    throw error;
  }

  const uniqueProducts = Array.from(
    new Map(
      (data || [])
        .map((row) => String(row.product_name || '').trim())
        .filter(Boolean)
        .map((productName) => [normalizeProductAliasText(productName), productName])
    ).values()
  );

  let bestMatch = '';
  let bestScore = -1;
  let bestMatchType = '';
  let bestCandidate = '';

  for (const productName of uniqueProducts) {
    for (const candidate of cleanedCandidates) {
      const resolution = scoreProductResolution(candidate, productName);
      const score = resolution.score;

      if (score > bestScore) {
        bestScore = score;
        bestMatch = productName;
        bestMatchType = resolution.matchType;
        bestCandidate = candidate;
        continue;
      }

      if (score === bestScore && score >= 0) {
        const productLength = normalizeProductAliasText(productName).length;
        const bestLength = normalizeProductAliasText(bestMatch).length;

        if (productLength > bestLength || (productLength === bestLength && productName.localeCompare(bestMatch) < 0)) {
          bestMatch = productName;
          bestMatchType = resolution.matchType;
          bestCandidate = candidate;
        }
      }
    }
  }

  if (bestScore >= 0 && bestMatchType === 'alias' && bestCandidate) {
    console.log(`PRODUCT ALIAS MATCH: ${bestCandidate} -> ${bestMatch}`);
  }

  return bestScore >= 0 ? bestMatch : '';
}

function parseStoredEmbedding(value) {
  if (Array.isArray(value)) {
    return value
      .map((item) => Number(item))
      .filter((item) => Number.isFinite(item));
  }

  if (typeof value === 'string' && value.trim()) {
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed
          .map((item) => Number(item))
          .filter((item) => Number.isFinite(item));
      }
    } catch (_) {
    }

    return value
      .replace(/^\[/, '')
      .replace(/\]$/, '')
      .split(',')
      .map((item) => Number(item.trim()))
      .filter((item) => Number.isFinite(item));
  }

  return [];
}

function cosineSimilarity(left = [], right = []) {
  if (!left.length || !right.length) {
    return 0;
  }

  const length = Math.min(left.length, right.length);
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;

  for (let i = 0; i < length; i++) {
    const leftValue = Number(left[i] || 0);
    const rightValue = Number(right[i] || 0);
    dot += leftValue * rightValue;
    leftMagnitude += leftValue * leftValue;
    rightMagnitude += rightValue * rightValue;
  }

  if (!leftMagnitude || !rightMagnitude) {
    return 0;
  }

  return dot / (Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude));
}

function rankKnowledgeRows(rows = [], queryEmbedding = []) {
  return rows
    .map((row) => {
      const storedEmbedding = parseStoredEmbedding(row.embedding);
      return {
        ...row,
        similarity: cosineSimilarity(queryEmbedding, storedEmbedding)
      };
    })
    .sort((left, right) => Number(right.similarity || 0) - Number(left.similarity || 0));
}

async function createEmbedding(input) {
  const response = await fetch('https://api.openai.com/v1/embeddings', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'text-embedding-3-small',
      input
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Embedding request failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return data.data?.[0]?.embedding || null;
}

async function getRelevantKnowledge(query, options = {}) {
  const { activeProduct = '' } = options;

  if (!supabase) {
    return { knowledge: '', resolvedProduct: '' };
  }

  const cleanedQuery = String(query || '').trim();
  if (!cleanedQuery) {
    return { knowledge: '', resolvedProduct: '' };
  }

  const productCandidates = extractProductCandidates(cleanedQuery);
  console.log('PRODUCT CANDIDATES:', productCandidates);

  const resolvedProduct = productCandidates.length > 0
    ? await resolveProductNameForClient(productCandidates)
    : '';

  console.log('RESOLVED PRODUCT:', resolvedProduct || '[NONE]');
  const shouldReuseActiveProduct =
    !resolvedProduct &&
    activeProduct &&
    !looksLikeGeneralQuestion(cleanedQuery);
  const productToUse = resolvedProduct || (shouldReuseActiveProduct ? activeProduct : '');

  if (!resolvedProduct && activeProduct) {
    if (shouldReuseActiveProduct) {
      console.log('ACTIVE PRODUCT REUSED:', activeProduct);
    } else {
      console.log('ACTIVE PRODUCT REUSE SKIPPED: GENERAL_INTENT');
    }
  }

  if (productToUse) {
    const { data: productRows, error: productError } = await supabase
      .from('documents')
      .select('content, embedding')
      .eq('client_id', KNOWLEDGE_CLIENT_ID)
      .ilike('product_name', productToUse)
      .limit(500);

    if (productError) {
      throw productError;
    }

    const productMatchCount = productRows?.length || 0;
    console.log('PRODUCT FILTER MATCH COUNT:', productMatchCount);

    if (productMatchCount === 0) {
      return { knowledge: '', resolvedProduct: productToUse };
    }

    const queryEmbedding = await createEmbedding(cleanedQuery);
    if (!queryEmbedding) {
      return { knowledge: '', resolvedProduct: productToUse };
    }

    const rankedProductRows = rankKnowledgeRows(productRows || [], queryEmbedding);
    const filteredProductRows = rankedProductRows
      .filter((item) => Number(item.similarity || 0) >= KNOWLEDGE_SIMILARITY_THRESHOLD)
      .slice(0, KNOWLEDGE_MAX_SNIPPETS);

    const rowsToReturn = filteredProductRows.length > 0
      ? filteredProductRows
      : rankedProductRows.slice(0, KNOWLEDGE_MAX_SNIPPETS);

    return {
      knowledge: rowsToReturn
        .map((item) => String(item.content || '').trim())
        .filter(Boolean)
        .join('\n\n'),
      resolvedProduct: productToUse
    };
  }

  console.log('PRODUCT FILTER MATCH COUNT:', 0);

  const queryEmbedding = await createEmbedding(cleanedQuery);
  if (!queryEmbedding) {
    return { knowledge: '', resolvedProduct: '' };
  }

  const { data, error } = await supabase.rpc('match_documents', {
    query_embedding: queryEmbedding,
    match_count: KNOWLEDGE_MAX_MATCHES,
    filter: { client_id: KNOWLEDGE_CLIENT_ID }
  });

  if (error) {
    throw error;
  }

  const filtered = (data || [])
    .filter((item) => Number(item.similarity || 0) >= KNOWLEDGE_SIMILARITY_THRESHOLD)
    .slice(0, KNOWLEDGE_MAX_SNIPPETS);

  if (filtered.length === 0) {
    console.log('⚠️ No embedding results, trying keyword fallback...');

    const fallbackCandidates = productCandidates.length > 0 ? productCandidates : [cleanedQuery];
    const { data: fallbackRows, error: fallbackError } = await supabase
      .from('documents')
      .select('content')
      .eq('client_id', KNOWLEDGE_CLIENT_ID)
      .limit(300);

    if (fallbackError) {
      console.error('Fallback search error:', fallbackError);
      return { knowledge: '', resolvedProduct: '' };
    }

    if (!fallbackRows || fallbackRows.length === 0) {
      return { knowledge: '', resolvedProduct: '' };
    }

    const matchedRows = fallbackRows.filter((row) => {
      const content = normalizeForProductMatch(row.content || '');

      return fallbackCandidates.some((candidate) => {
        const normalizedCandidate = normalizeForProductMatch(candidate);
        if (!normalizedCandidate) return false;

        return content.includes(normalizedCandidate);
      });
    });

    if (matchedRows.length === 0) {
      return { knowledge: '', resolvedProduct: '' };
    }

    return {
      knowledge: matchedRows
        .slice(0, KNOWLEDGE_MAX_SNIPPETS)
        .map((item) => item.content)
        .join('\n\n'),
      resolvedProduct: ''
    };
  }

  return {
    knowledge: filtered
      .map((item) => String(item.content || '').trim())
      .filter(Boolean)
      .join('\n\n'),
    resolvedProduct: ''
  };
}

const VOICE = 'marin';
const TEMPERATURE = 0.92;
const PORT = process.env.PORT || 5050;
const callContextStore = new Map();

// List of Event Types to log to the console.
const LOG_EVENT_TYPES = [
  'error',
  'response.content.done',
  'response.audio_transcript.done',
  'conversation.item.input_audio_transcription.completed',
  'rate_limits.updated',
  'response.done',
  'input_audio_buffer.committed',
  'input_audio_buffer.speech_stopped',
  'input_audio_buffer.speech_started',
  'session.created',
  'session.updated'
];

// Show AI response elapsed timing calculations
const SHOW_TIMING_MATH = false;

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDurationFromSeconds(totalSeconds) {
  if (!Number.isFinite(totalSeconds) || totalSeconds < 0) return 'N/A';
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.round(totalSeconds % 60);
  if (minutes <= 0) return `${seconds}s`;
  return `${minutes}m ${seconds}s`;
}

function normalizeList(value, fallback = []) {
  if (!Array.isArray(value)) return fallback;
  return value
    .map((item) => String(item || '').trim())
    .filter(Boolean);
}

function normalizeText(value, fallback = 'Unknown') {
  const text = String(value || '').trim();
  if (!text) return fallback;
  return text;
}

function isUnknownLike(value) {
  const text = String(value || '').trim().toLowerCase();
  return (
    !text ||
    text === 'unknown' ||
    text === 'unknown caller' ||
    text === 'not captured' ||
    text === 'n/a' ||
    text === 'none' ||
    text === 'not provided' ||
    text === 'not available'
  );
}

function safeJsonParse(text) {
  try {
    if (!text) return null;

    let cleaned = String(text).trim();

    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.replace(/^```json\s*/i, '');
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```\s*/i, '');
    }

    if (cleaned.endsWith('```')) {
      cleaned = cleaned.replace(/\s*```$/i, '');
    }

    cleaned = cleaned.trim();

    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

function buildListHtml(items, emptyText) {
  const cleanItems = normalizeList(items);
  if (cleanItems.length === 0) {
    return `<li>${escapeHtml(emptyText)}</li>`;
  }
  return cleanItems.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
}

function buildTranscriptHtml(transcriptLines) {
  const cleanLines = normalizeList(transcriptLines);
  if (cleanLines.length === 0) {
    return `<p style="margin: 0; font-size: 13px; line-height: 1.7; color: #4b5563;">No transcript available.</p>`;
  }

  return cleanLines
    .map((line) => {
      const isCaller = line.startsWith('Caller:');
      const isAi = line.startsWith('AI:');
      let speaker = 'Line';
      let text = line;

      if (isCaller) {
        speaker = 'Caller';
        text = line.replace(/^Caller:\s*/, '');
      } else if (isAi) {
        speaker = 'Genesis';
        text = line.replace(/^AI:\s*/, '');
      }

      const speakerBg = isCaller ? '#f3f4f6' : '#eef6ea';
      const speakerColor = isCaller ? '#111827' : '#528238';

      return `
        <div style="margin-bottom: 12px; border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden;">
          <div style="padding: 8px 12px; background-color: ${speakerBg}; font-size: 12px; font-weight: 700; color: ${speakerColor};">
            ${escapeHtml(speaker)}
          </div>
          <div style="padding: 12px; font-size: 14px; line-height: 1.7; color: #374151;">
            ${escapeHtml(text)}
          </div>
        </div>
      `;
    })
    .join('');
}

function buildCallReportHtml(data) {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Call Intelligence Report - Electronic World</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f9fafb; font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; -webkit-font-smoothing: antialiased; color: #111827;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color: #f9fafb; padding: 30px 15px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 760px; background-color: #ffffff; border-radius: 12px; border: 1px solid #e5e7eb; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.03); overflow: hidden;">
          <tr>
            <td style="padding: 35px 35px 25px 35px; text-align: center; border-bottom: 1px solid #f3f4f6;">
              <div style="margin-bottom: 16px;">
                <img src="${escapeHtml(data.logoUrl || '')}" alt="Electronic World" style="display: block; margin: 0 auto; max-height: 36px; height: auto; border: 0;" />
              </div>
              <h1 style="margin: 0 0 10px 0; font-size: 20px; font-weight: 700; color: #000000; letter-spacing: -0.5px;">Call Intelligence Report</h1>
              <p style="margin: 0; font-size: 13px; color: #6b7280; font-weight: 500;">
                ${escapeHtml(data.reportDate || 'N/A')} &nbsp;•&nbsp; ${escapeHtml(data.callerName || 'Unknown Caller')} &nbsp;•&nbsp; ${escapeHtml(data.callerPhone || 'Unknown Number')} &nbsp;•&nbsp; Duration: ${escapeHtml(data.callDuration || 'N/A')}
              </p>
            </td>
          </tr>

          <tr>
            <td style="padding: 35px;">
              <div style="background-color: #ffffff; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; margin-bottom: 28px; box-shadow: 0 1px 3px rgba(0,0,0,0.02);">
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td width="25%" valign="top" style="padding-right: 12px;">
                      <p style="margin: 0 0 6px 0; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #9ca3af; font-weight: 700;">Primary Category</p>
                      <span style="display: inline-block; background-color: #f3f4f6; color: #374151; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 600;">${escapeHtml(data.category || 'General Inquiry')}</span>
                    </td>
                    <td width="25%" valign="top" style="padding-right: 12px;">
                      <p style="margin: 0 0 6px 0; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #9ca3af; font-weight: 700;">Resolution</p>
                      <span style="display: inline-block; background-color: rgba(113, 171, 80, 0.15); color: #528238; padding: 4px 10px; border-radius: 12px; font-size: 12px; font-weight: 600;">${escapeHtml(data.resolutionStatus || 'Unknown')}</span>
                    </td>
                    <td width="25%" valign="top" style="padding-right: 12px;">
                      <p style="margin: 0 0 6px 0; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #9ca3af; font-weight: 700;">Urgency</p>
                      <span style="display: inline-block; font-size: 13px; font-weight: 600; color: #111827;">${escapeHtml(data.urgency || 'Medium')}</span>
                    </td>
                    <td width="25%" valign="top">
                      <p style="margin: 0 0 6px 0; font-size: 10px; text-transform: uppercase; letter-spacing: 0.5px; color: #9ca3af; font-weight: 700;">Sentiment</p>
                      <span style="display: inline-block; font-size: 13px; font-weight: 600; color: #111827;">${escapeHtml(data.sentiment || 'Neutral')}</span>
                    </td>
                  </tr>
                </table>
              </div>

              <div style="margin-bottom: 28px;">
                <h2 style="margin: 0 0 10px 0; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; font-weight: 700;">Executive Summary</h2>
                <p style="margin: 0; font-size: 14px; line-height: 1.7; color: #374151;">${escapeHtml(data.executiveSummary || 'No summary available.')}</p>
              </div>

              <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 28px; background-color: #fafafa;">
                <h2 style="margin: 0 0 16px 0; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; font-weight: 700;">Call Outcome</h2>
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td width="33%" valign="top" style="padding-bottom: 16px;">
                      <p style="margin: 0 0 4px 0; font-size: 12px; color: #6b7280;">Follow-Up Needed</p>
                      <p style="margin: 0; font-size: 13px; font-weight: 600; color: #111827;">${escapeHtml(data.followUpNeeded || 'Unknown')}</p>
                    </td>
                    <td width="33%" valign="top" style="padding-bottom: 16px;">
                      <p style="margin: 0 0 4px 0; font-size: 12px; color: #6b7280;">Escalation Needed</p>
                      <p style="margin: 0; font-size: 13px; font-weight: 600; color: #111827;">${escapeHtml(data.escalationNeeded || 'Unknown')}</p>
                    </td>
                    <td width="33%" valign="top" style="padding-bottom: 16px;">
                      <p style="margin: 0 0 4px 0; font-size: 12px; color: #6b7280;">Lead Opportunity</p>
                      <p style="margin: 0; font-size: 13px; font-weight: 600; color: #111827;">${escapeHtml(data.leadOpportunity || 'None')}</p>
                    </td>
                  </tr>
                  <tr>
                    <td colspan="3" valign="top">
                      <p style="margin: 0 0 4px 0; font-size: 12px; color: #6b7280;">Outcome Notes</p>
                      <p style="margin: 0; font-size: 13px; line-height: 1.6; font-weight: 600; color: #111827;">${escapeHtml(data.outcomeNotes || 'No outcome notes available.')}</p>
                    </td>
                  </tr>
                </table>
              </div>

              <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 28px; background-color: #fafafa;">
                <h2 style="margin: 0 0 16px 0; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; font-weight: 700;">Key Business Details</h2>
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td width="50%" valign="top" style="padding-bottom: 16px;">
                      <p style="margin: 0 0 4px 0; font-size: 12px; color: #6b7280;">Caller Name</p>
                      <p style="margin: 0; font-size: 13px; font-weight: 600; color: #111827;">${escapeHtml(data.callerName || 'Unknown Caller')}</p>
                    </td>
                    <td width="50%" valign="top" style="padding-bottom: 16px;">
                      <p style="margin: 0 0 4px 0; font-size: 12px; color: #6b7280;">Caller Phone</p>
                      <p style="margin: 0; font-size: 13px; font-weight: 600; color: #111827;">${escapeHtml(data.callerPhone || 'Unknown')}</p>
                    </td>
                  </tr>
                  <tr>
                    <td width="50%" valign="top" style="padding-bottom: 16px;">
                      <p style="margin: 0 0 4px 0; font-size: 12px; color: #6b7280;">Email</p>
                      <p style="margin: 0; font-size: 13px; font-weight: 600; color: #111827;">${escapeHtml(data.email || 'Not captured')}</p>
                    </td>
                    <td width="50%" valign="top" style="padding-bottom: 16px;">
                      <p style="margin: 0 0 4px 0; font-size: 12px; color: #6b7280;">Business Name</p>
                      <p style="margin: 0; font-size: 13px; font-weight: 600; color: #111827;">${escapeHtml(data.businessName || 'Not captured')}</p>
                    </td>
                  </tr>
                  <tr>
                    <td width="50%" valign="top" style="padding-bottom: 16px;">
                      <p style="margin: 0 0 4px 0; font-size: 12px; color: #6b7280;">Product</p>
                      <p style="margin: 0; font-size: 13px; font-weight: 600; color: #111827;">${escapeHtml(data.product || 'N/A')}</p>
                    </td>
                    <td width="50%" valign="top" style="padding-bottom: 16px;">
                      <p style="margin: 0 0 4px 0; font-size: 12px; color: #6b7280;">Issue / Sub-Type</p>
                      <p style="margin: 0; font-size: 13px; font-weight: 600; color: #111827;">${escapeHtml(data.issue || 'N/A')} ${data.subType ? `(${escapeHtml(data.subType)})` : ''}</p>
                    </td>
                  </tr>
                  <tr>
                    <td width="50%" valign="top" style="padding-bottom: 16px;">
                      <p style="margin: 0 0 4px 0; font-size: 12px; color: #6b7280;">Customer Type</p>
                      <p style="margin: 0; font-size: 13px; font-weight: 600; color: #111827;">${escapeHtml(data.customerType || 'Unknown')}</p>
                    </td>
                    <td width="50%" valign="top" style="padding-bottom: 16px;">
                      <p style="margin: 0 0 4px 0; font-size: 12px; color: #6b7280;">Purchase Status</p>
                      <p style="margin: 0; font-size: 13px; font-weight: 600; color: #111827;">${escapeHtml(data.purchaseStatus || 'Unknown')}</p>
                    </td>
                  </tr>
                  <tr>
                    <td colspan="2" valign="top">
                      <p style="margin: 0 0 4px 0; font-size: 12px; color: #6b7280;">Call Context</p>
                      <p style="margin: 0; font-size: 13px; font-weight: 600; color: #111827;">${escapeHtml(data.callContext || 'N/A')}</p>
                    </td>
                  </tr>
                </table>
              </div>

              <div style="margin-bottom: 28px;">
                <h2 style="margin: 0 0 12px 0; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; font-weight: 700;">Conversation Highlights</h2>
                <ul style="margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.7; color: #374151;">
                  ${buildListHtml(data.conversationHighlights, 'No highlights captured.')}
                </ul>
              </div>

              <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 20px; margin-bottom: 28px;">
                <h2 style="margin: 0 0 16px 0; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; font-weight: 700;">Intelligence Assessment</h2>
                <table width="100%" cellpadding="0" cellspacing="0" border="0">
                  <tr>
                    <td width="50%" valign="top" style="padding-bottom: 16px;">
                      <p style="margin: 0 0 4px 0; font-size: 12px; color: #6b7280;">Root Cause</p>
                      <p style="margin: 0; font-size: 13px; font-weight: 600; color: #111827;">${escapeHtml(data.rootCause || 'Unknown')}</p>
                    </td>
                    <td width="50%" valign="top" style="padding-bottom: 16px;">
                      <p style="margin: 0 0 4px 0; font-size: 12px; color: #6b7280;">Commercial Value</p>
                      <p style="margin: 0; font-size: 13px; font-weight: 600; color: #111827;">${escapeHtml(data.commercialValue || 'Low')}</p>
                    </td>
                  </tr>
                  <tr>
                    <td width="50%" valign="top">
                      <p style="margin: 0 0 4px 0; font-size: 12px; color: #6b7280;">Upsell Opportunity</p>
                      <p style="margin: 0; font-size: 13px; font-weight: 600; color: #71ab50;">${escapeHtml(data.upsellOpportunity || 'Low')}</p>
                    </td>
                    <td width="50%" valign="top">
                      <p style="margin: 0 0 4px 0; font-size: 12px; color: #6b7280;">Escalation Status</p>
                      <p style="margin: 0; font-size: 13px; font-weight: 600; color: #111827;">${escapeHtml(data.escalationStatus || 'No Escalation Needed')}</p>
                    </td>
                  </tr>
                </table>
              </div>

              <div style="background-color: #fcfcfc; border: 1px solid #e5e7eb; border-left: 4px solid #71ab50; border-radius: 6px; padding: 20px; margin-bottom: 28px; box-shadow: 0 2px 4px rgba(0,0,0,0.01);">
                <h2 style="margin: 0 0 12px 0; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; font-weight: 700;">Recommended Actions</h2>
                <ul style="margin: 0; padding-left: 20px; font-size: 14px; line-height: 1.7; color: #111827;">
                  ${buildListHtml(data.recommendedActions, 'No recommended actions.')}
                </ul>
              </div>

              <div>
                <h2 style="margin: 0 0 10px 0; font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #9ca3af; font-weight: 700;">Full Transcript</h2>
                <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; background-color: #f9fafb;">
                  ${buildTranscriptHtml(data.transcriptLines)}
                </div>
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding: 24px 35px; text-align: center; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; font-size: 12px; color: #9ca3af;">Generated automatically by Electronic World Intelligence Systems.</p>
              <p style="margin: 4px 0 0 0; font-size: 12px; font-weight: 600; color: #9ca3af;">Dream Higher.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

async function sendSummaryEmail(subject, body, htmlBody = null) {
  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT || 465),
    secure: String(process.env.SMTP_SECURE).toLowerCase() === 'true',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });

  await transporter.sendMail({
    from: `EW AI Receptionist <${process.env.SMTP_USER}>`,
    to: process.env.SUMMARY_EMAIL_TO,
    subject,
    text: body,
    html: htmlBody || `<pre style="font-family: Arial, sans-serif; white-space: pre-wrap;">${escapeHtml(body)}</pre>`,
  });
}

async function downloadTwilioRecording(recordingUrl) {
  const authString = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');

  const response = await fetch(recordingUrl, {
    headers: {
      Authorization: `Basic ${authString}`
    }
  });

  if (!response.ok) {
    throw new Error(`Twilio recording download failed: ${response.status} ${response.statusText}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function transcribeAudioBuffer(audioBuffer) {
  const form = new FormData();
  form.append('file', new Blob([audioBuffer]), 'call.wav');
  form.append('model', 'gpt-4o-mini-transcribe');

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`
    },
    body: form
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI transcription failed: ${response.status} ${errorText}`);
  }

  const data = await response.json();
  return data.text || '';
}

async function formatTranscriptAsDialogue(rawTranscriptText) {
  if (!rawTranscriptText || !rawTranscriptText.trim()) {
    return [];
  }

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.1,
      input: [
        {
          role: 'system',
          content: `
You are cleaning up a phone call transcript for an internal business report.

Your job:
- Convert the raw transcript into a readable dialogue.
- Use only these speaker labels:
  "Caller:"
  "AI:"
- Break the conversation into short dialogue lines.
- Keep the original meaning accurate.
- Do not invent details that are not supported by the transcript.
- If speaker attribution is unclear, make the best reasonable judgment from the conversation context.
- Return ONLY valid JSON.
- Return this exact format:
{
  "dialogueLines": [
    "Caller: ...",
    "AI: ..."
  ]
}
          `.trim()
        },
        {
          role: 'user',
          content: `Raw transcript:\n${rawTranscriptText}`
        }
      ]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Dialogue formatting failed: ${response.status} ${errorText}`);
  }

  const result = await response.json();
  const outputText =
    result.output_text ||
    result.output?.[0]?.content?.[0]?.text ||
    '';

  const parsed = safeJsonParse(outputText);

  if (!parsed || !Array.isArray(parsed.dialogueLines)) {
    throw new Error(`Could not parse dialogue JSON. Raw output: ${outputText}`);
  }

  return parsed.dialogueLines
    .map(line => String(line || '').trim())
    .filter(Boolean);
}

function applyAnalysisPolish(analysis, callerPhone) {
  const polished = { ...analysis };

  polished.callerName = isUnknownLike(polished.callerName) ? 'Unknown Caller' : normalizeText(polished.callerName);
  polished.email = isUnknownLike(polished.email) ? 'Not captured' : normalizeText(polished.email);
  polished.businessName = isUnknownLike(polished.businessName) ? 'Not captured' : normalizeText(polished.businessName);

  polished.category = normalizeText(polished.category, 'General Inquiry');
  polished.resolutionStatus = normalizeText(polished.resolutionStatus, 'Unknown');
  polished.urgency = normalizeText(polished.urgency, 'Medium');
  polished.sentiment = normalizeText(polished.sentiment, 'Neutral');

  polished.followUpNeeded = normalizeText(polished.followUpNeeded, 'Unknown');
  polished.escalationNeeded = normalizeText(polished.escalationNeeded, 'Unknown');
  polished.leadOpportunity = normalizeText(polished.leadOpportunity, 'None');

  polished.product = isUnknownLike(polished.product) ? 'Unknown' : normalizeText(polished.product);
  polished.issue = isUnknownLike(polished.issue) ? 'Unknown' : normalizeText(polished.issue);
  polished.subType = isUnknownLike(polished.subType) ? 'Unknown' : normalizeText(polished.subType);
  polished.customerType = isUnknownLike(polished.customerType) ? 'Unknown' : normalizeText(polished.customerType);
  polished.purchaseStatus = isUnknownLike(polished.purchaseStatus) ? 'Unknown' : normalizeText(polished.purchaseStatus);
  polished.callContext = isUnknownLike(polished.callContext) ? 'Unknown' : normalizeText(polished.callContext);

  polished.rootCause = isUnknownLike(polished.rootCause) ? 'Unknown' : normalizeText(polished.rootCause);
  polished.commercialValue = isUnknownLike(polished.commercialValue) ? 'Low' : normalizeText(polished.commercialValue);
  polished.upsellOpportunity = isUnknownLike(polished.upsellOpportunity) ? 'Low' : normalizeText(polished.upsellOpportunity);
  polished.escalationStatus = isUnknownLike(polished.escalationStatus)
    ? (polished.escalationNeeded === 'Yes' ? 'Escalation Needed' : 'No Escalation Needed')
    : normalizeText(polished.escalationStatus);

  polished.conversationHighlights = normalizeList(polished.conversationHighlights);
  polished.recommendedActions = normalizeList(polished.recommendedActions);

  if (polished.resolutionStatus === 'Resolved') {
    polished.followUpNeeded = 'No';
    if (!polished.outcomeNotes || isUnknownLike(polished.outcomeNotes)) {
      polished.outcomeNotes = 'The caller’s issue was resolved during the call.';
    }
    if (polished.recommendedActions.length === 0) {
      polished.recommendedActions = ['No additional follow-up is required.'];
    }
  }

  if (polished.category === 'Tech Support / Troubleshooting') {
    if (isUnknownLike(polished.callContext)) {
      polished.callContext = 'Product support assistance';
    }
    if (polished.recommendedActions.length === 0 && polished.resolutionStatus !== 'Resolved') {
      polished.recommendedActions = ['Review the troubleshooting steps and follow up if the issue continues.'];
    }
  }

  if (polished.category === 'Wholesale / Dealer Inquiry') {
    if (isUnknownLike(polished.customerType)) {
      polished.customerType = 'Business / Dealer Prospect';
    }
    if (polished.leadOpportunity === 'None') {
      polished.leadOpportunity = 'Possible';
    }
    if (polished.recommendedActions.length === 0) {
      polished.recommendedActions = ['Have the sales or account team follow up with the caller.'];
    }
  }

  if (polished.category === 'Warranty / Returns') {
    if (polished.recommendedActions.length === 0) {
      polished.recommendedActions = ['Review warranty eligibility and follow up with next steps.'];
    }
  }

  if (polished.category === 'Complaint / Escalation' && polished.escalationNeeded !== 'Yes') {
    polished.escalationNeeded = 'Yes';
    polished.escalationStatus = 'Escalation Needed';
  }

  if ((!polished.callerPhone || isUnknownLike(polished.callerPhone)) && callerPhone) {
    polished.callerPhone = callerPhone;
  }

  polished.executiveSummary = normalizeText(polished.executiveSummary, 'No summary available.');
  polished.outcomeNotes = normalizeText(polished.outcomeNotes, 'No outcome notes available.');

  return polished;
}

async function analyzeCallWithOpenAI({ transcriptLines, callerPhone, durationText, reportDate }) {
  const transcriptText =
    transcriptLines.length > 0
      ? transcriptLines.join('\n')
      : 'No transcript available.';

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      temperature: 0.2,
      input: [
        {
          role: 'system',
          content: `
You are a call intelligence analyst for Electronic World.

Your job is to analyze a phone call transcript and return ONLY valid JSON.

Important rules:
- Do not guess facts that are not supported by the transcript.
- If something is not stated, use "Unknown" or "Not captured".
- Extract caller identity details if they are actually stated in the transcript.
- If the issue was solved during the call, resolutionStatus must say "Resolved".
- If the issue was not solved and a callback or team follow-up is needed, resolutionStatus must say "Follow-Up Needed".
- If the caller was angry or demanded escalation, escalationNeeded should be "Yes".
- If no escalation is needed, escalationNeeded should be "No".
- If no follow-up is needed, followUpNeeded should be "No".
- conversationHighlights must be short, concrete bullets from the actual call.
- recommendedActions must reflect the actual call outcome.
- executiveSummary must be 2 to 4 sentences, specific, and based only on the transcript.
- outcomeNotes should clearly say whether the call was resolved and why.
- category must be one of:
  "Tech Support / Troubleshooting",
  "Wholesale / Dealer Inquiry",
  "Warranty / Returns",
  "General Inquiry",
  "Complaint / Escalation"
- sentiment must be one of:
  "Positive", "Neutral", "Frustrated", "Upset"
- urgency must be one of:
  "Low", "Medium", "High"
- commercialValue must be one of:
  "Low", "Medium", "High"
- upsellOpportunity must be one of:
  "Low", "Medium", "High"
- leadOpportunity must be one of:
  "None", "Possible", "Strong"
- For tech support calls, identify the product, device/setup context, specific issue, and whether it was fixed.
- For wholesale/dealer calls, identify business/lead details, product interest, and follow-up importance.
- For warranty/returns calls, identify the issue, purchase context, and required next steps.

Return JSON with exactly these keys:
{
  "callerName": "",
  "email": "",
  "businessName": "",
  "category": "",
  "resolutionStatus": "",
  "urgency": "",
  "sentiment": "",
  "executiveSummary": "",
  "followUpNeeded": "",
  "escalationNeeded": "",
  "leadOpportunity": "",
  "outcomeNotes": "",
  "product": "",
  "issue": "",
  "subType": "",
  "customerType": "",
  "purchaseStatus": "",
  "callContext": "",
  "rootCause": "",
  "commercialValue": "",
  "upsellOpportunity": "",
  "escalationStatus": "",
  "conversationHighlights": [],
  "recommendedActions": []
}
          `.trim()
        },
        {
          role: 'user',
          content: `
Call date: ${reportDate}
Caller phone from Twilio: ${callerPhone || 'Unknown'}
Call duration: ${durationText}

Transcript:
${transcriptText}
          `.trim()
        }
      ]
    })
  });

  const result = await response.json();
  const outputText =
    result.output_text ||
    result.output?.[0]?.content?.[0]?.text ||
    '';

  const parsed = safeJsonParse(outputText);

  if (!parsed) {
    throw new Error(`Could not parse structured call analysis JSON. Raw output: ${outputText}`);
  }

  return parsed;
}

// Root Route
fastify.get('/', async (_request, reply) => {
  reply.send({ message: 'Twilio Media Stream Server is running!' });
});

// Route for Twilio to handle incoming calls
fastify.all('/incoming-call', async (request, reply) => {
  const callerPhone = request.body?.From || request.query?.From || 'Unknown';
  const callSid = request.body?.CallSid || request.query?.CallSid || 'Unknown';

  callContextStore.set(callSid, {
    callerPhone,
    startedAt: Date.now()
  });

  const twimlResponse = `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Start>
    <Recording
      recordingStatusCallback="https://${request.headers.host}/recording-status"
      recordingStatusCallbackMethod="POST"
    />
  </Start>

  <Say voice="Google.en-US-Chirp3-HD-Aoede">Thanks for calling Electronic World. One moment while I connect you.</Say>
  <Pause length="1"/>
  <Say voice="Google.en-US-Chirp3-HD-Aoede">Hi there! My name is Genesis. How can I help today?</Say>

  <Connect>
    <Stream url="wss://${request.headers.host}/media-stream">
      <Parameter name="callerPhone" value="${escapeHtml(callerPhone)}" />
      <Parameter name="callSid" value="${escapeHtml(callSid)}" />
    </Stream>
  </Connect>
</Response>`;

  reply.type('text/xml').send(twimlResponse);
});

// Recording status webhook
fastify.post('/recording-status', async (request, reply) => {
  reply.send({ ok: true });

  try {
    console.log('📼 Recording callback received');
    console.log('CallSid:', request.body.CallSid);
    console.log('RecordingSid:', request.body.RecordingSid);
    console.log('RecordingUrl:', request.body.RecordingUrl);
    console.log('RecordingDuration:', request.body.RecordingDuration);

    const callSid = request.body.CallSid || 'Unknown';
    const recordingUrlBase = request.body.RecordingUrl;

    if (!recordingUrlBase) {
      throw new Error('Missing RecordingUrl in callback.');
    }

    const storedContext = callContextStore.get(callSid) || {};
    const callerPhone = storedContext.callerPhone || 'Unknown';
    const durationSeconds = Number(request.body.RecordingDuration || 0);
    const durationText = formatDurationFromSeconds(durationSeconds);
    const reportDate = new Date().toLocaleString();

    const wavUrl = `${recordingUrlBase}.wav`;
    const audioBuffer = await downloadTwilioRecording(wavUrl);

    const transcriptText = await transcribeAudioBuffer(audioBuffer);

    let transcriptLines = ['No transcript available.'];
    if (transcriptText && transcriptText.trim()) {
      try {
        transcriptLines = await formatTranscriptAsDialogue(transcriptText);
      } catch (dialogueError) {
        console.error('❌ Dialogue formatting failed:', dialogueError);
        transcriptLines = [transcriptText];
      }
    }

    console.log('RECORDING TRANSCRIPT DEBUG:');
    console.log(transcriptLines.join('\n'));

    let analysis;
    try {
      analysis = await analyzeCallWithOpenAI({
        transcriptLines,
        callerPhone,
        durationText,
        reportDate
      });
    } catch (analysisError) {
      console.error('❌ Structured call analysis failed:', analysisError);

      analysis = {
        callerName: 'Unknown Caller',
        email: 'Not captured',
        businessName: 'Not captured',
        category: 'General Inquiry',
        resolutionStatus: 'Unknown',
        urgency: 'Medium',
        sentiment: 'Neutral',
        executiveSummary: transcriptText
          ? 'A call was completed and transcribed from the Twilio recording, but the structured analysis could not be fully generated. Please review the transcript below.'
          : 'No information is available from the call transcript.',
        followUpNeeded: 'Unknown',
        escalationNeeded: 'Unknown',
        leadOpportunity: 'None',
        outcomeNotes: transcriptText
          ? 'Structured analysis failed, so the transcript should be reviewed manually.'
          : 'The call could not be assessed due to lack of transcript.',
        product: 'Unknown',
        issue: 'Unknown',
        subType: 'Unknown',
        customerType: 'Unknown',
        purchaseStatus: 'Unknown',
        callContext: 'Unknown',
        rootCause: 'Unknown',
        commercialValue: 'Unknown',
        upsellOpportunity: 'Unknown',
        escalationStatus: 'Unknown',
        conversationHighlights: transcriptText ? ['Transcript captured from Twilio recording.'] : ['No highlights captured.'],
        recommendedActions: transcriptText ? ['Review transcript manually if needed.'] : ['No recommended actions.']
      };
    }

    const polishedAnalysis = applyAnalysisPolish(analysis, callerPhone);

    const reportData = {
      logoUrl: process.env.REPORT_LOGO_URL || 'https://i.imgur.com/eYFsbtR.png',
      reportDate,
      callerName: polishedAnalysis.callerName || 'Unknown Caller',
      callerPhone: callerPhone || 'Unknown',
      callDuration: durationText,

      category: polishedAnalysis.category || 'General Inquiry',
      resolutionStatus: polishedAnalysis.resolutionStatus || 'Unknown',
      urgency: polishedAnalysis.urgency || 'Medium',
      sentiment: polishedAnalysis.sentiment || 'Neutral',

      executiveSummary: polishedAnalysis.executiveSummary || 'No summary available.',

      followUpNeeded: polishedAnalysis.followUpNeeded || 'Unknown',
      escalationNeeded: polishedAnalysis.escalationNeeded || 'Unknown',
      leadOpportunity: polishedAnalysis.leadOpportunity || 'None',
      outcomeNotes: polishedAnalysis.outcomeNotes || 'No outcome notes available.',

      email: polishedAnalysis.email || 'Not captured',
      businessName: polishedAnalysis.businessName || 'Not captured',
      product: polishedAnalysis.product || 'Unknown',
      issue: polishedAnalysis.issue || 'Unknown',
      subType: polishedAnalysis.subType || 'Unknown',
      customerType: polishedAnalysis.customerType || 'Unknown',
      purchaseStatus: polishedAnalysis.purchaseStatus || 'Unknown',
      callContext: polishedAnalysis.callContext || 'Unknown',

      rootCause: polishedAnalysis.rootCause || 'Unknown',
      commercialValue: polishedAnalysis.commercialValue || 'Low',
      upsellOpportunity: polishedAnalysis.upsellOpportunity || 'Low',
      escalationStatus: polishedAnalysis.escalationStatus || 'No Escalation Needed',

      conversationHighlights: polishedAnalysis.conversationHighlights || [],
      recommendedActions: polishedAnalysis.recommendedActions || [],
      transcriptLines
    };

    const subject = `[EW AI CALL SUMMARY] ${reportDate} | ${reportData.category} | ${reportData.resolutionStatus}`;

    const plainTextBody = `
Electronic World - Call Intelligence Report

Date: ${reportDate}
Caller Name: ${reportData.callerName}
Caller Phone: ${reportData.callerPhone}
Call Duration: ${reportData.callDuration}
Category: ${reportData.category}
Resolution: ${reportData.resolutionStatus}
Urgency: ${reportData.urgency}
Sentiment: ${reportData.sentiment}

Executive Summary:
${reportData.executiveSummary}

Call Outcome:
- Follow-Up Needed: ${reportData.followUpNeeded}
- Escalation Needed: ${reportData.escalationNeeded}
- Lead Opportunity: ${reportData.leadOpportunity}
- Outcome Notes: ${reportData.outcomeNotes}

Key Business Details:
- Email: ${reportData.email}
- Business Name: ${reportData.businessName}
- Product: ${reportData.product}
- Issue: ${reportData.issue}
- Sub-Type: ${reportData.subType || 'Unknown'}
- Customer Type: ${reportData.customerType}
- Purchase Status: ${reportData.purchaseStatus}
- Call Context: ${reportData.callContext}

Conversation Highlights:
${normalizeList(reportData.conversationHighlights).map((x) => `- ${x}`).join('\n') || '- None'}

Recommended Actions:
${normalizeList(reportData.recommendedActions).map((x) => `- ${x}`).join('\n') || '- None'}

Full Transcript:
${transcriptLines.join('\n')}
    `.trim();

    const htmlBody = buildCallReportHtml(reportData);
    await sendSummaryEmail(subject, plainTextBody, htmlBody);
    console.log('✅ Recording-based summary email sent.');

    callContextStore.delete(callSid);
  } catch (err) {
    console.error('❌ Recording-based summary failed:', err);
  }
});

// WebSocket route for media-stream
fastify.register(async (fastifyInstance) => {
  fastifyInstance.get('/media-stream', { websocket: true }, (connection, req) => {
    console.log('Client connected');

    const transcript = [];
    let streamSid = null;
    let latestMediaTimestamp = 0;
    let lastAssistantItem = null;
    let markQueue = [];
    let responseStartTimestampTwilio = null;
    let supportRetrievalMode = false;
    let activeSupportProduct = '';

    let callerPhone = 'Unknown';
    let callSid = 'Unknown';

    const sendSessionUpdate = (manualResponseMode = false) => {
      const sessionUpdate = {
        type: 'session.update',
        session: {
          type: 'realtime',
          model: 'gpt-realtime',
          output_modalities: ['audio'],
          audio: {
            input: {
              format: { type: 'audio/pcmu' },
              transcription: { model: 'gpt-4o-mini-transcribe' },
turn_detection: {
  type: 'server_vad',
  create_response: !manualResponseMode,
  silence_duration_ms: 800
}
            },
            output: {
              format: { type: 'audio/pcmu' },
              voice: VOICE
            },
          },
          instructions: buildBaseInstructions(),
        },
      };

      console.log(`Sending session update (manualResponseMode=${manualResponseMode})`);
      openAiWs.send(JSON.stringify(sessionUpdate));
    };

    const sendResponseForTurn = async (userText, retrieveKnowledge = false) => {
      try {
        const retrievalResult = retrieveKnowledge
          ? await getRelevantKnowledge(userText, { activeProduct: activeSupportProduct })
          : { knowledge: '', resolvedProduct: '' };

        const knowledge = retrievalResult.knowledge || '';
        const resolvedProduct = retrievalResult.resolvedProduct || '';

        if (resolvedProduct && resolvedProduct !== activeSupportProduct) {
          activeSupportProduct = resolvedProduct;
          console.log('ACTIVE PRODUCT SET:', activeSupportProduct);
        }

        console.log('==============================');
console.log('LIVE USER QUERY:', userText);
console.log('RETRIEVED KNOWLEDGE START');
console.log(knowledge || '[NO KNOWLEDGE RETURNED]');
console.log('RETRIEVED KNOWLEDGE END');
console.log('==============================');

        const responseCreate = {
          type: 'response.create',
response: {
  instructions: buildResponseInstructions(knowledge)
}
        };

        openAiWs.send(JSON.stringify(responseCreate));
      } catch (err) {
        console.error('❌ Knowledge retrieval failed. Falling back to base instructions:', err);

        const fallbackResponse = {
          type: 'response.create',
response: {
  instructions: buildResponseInstructions('')
}
        };

        openAiWs.send(JSON.stringify(fallbackResponse));
      }
    };

    const handleCallerTurn = (userText) => {
      const shouldRetrieveForThisTurn = shouldUseKnowledgeRetrieval(userText, supportRetrievalMode);

      if (!supportRetrievalMode && shouldRetrieveForThisTurn && openAiWs.readyState === WebSocket.OPEN) {
        supportRetrievalMode = true;
        console.log('🧠 Support/manual mode activated for this turn on this call.');
        sendSessionUpdate(true);
        openAiWs.send(JSON.stringify({ type: 'response.cancel' }));
        void sendResponseForTurn(userText, true);
        return;
      }

      if (supportRetrievalMode && openAiWs.readyState === WebSocket.OPEN) {
        void sendResponseForTurn(userText, shouldRetrieveForThisTurn);
      }
    };

    const openAiWs = new WebSocket(`wss://api.openai.com/v1/realtime?model=gpt-realtime&temperature=${TEMPERATURE}`, {
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      }
    });

    const initializeSession = () => {
      sendSessionUpdate(false);
    };

    const handleSpeechStartedEvent = () => {
      if (markQueue.length > 0 && responseStartTimestampTwilio != null) {
        const elapsedTime = latestMediaTimestamp - responseStartTimestampTwilio;
        if (SHOW_TIMING_MATH) {
          console.log(`Calculating elapsed time for truncation: ${latestMediaTimestamp} - ${responseStartTimestampTwilio} = ${elapsedTime}ms`);
        }

        if (lastAssistantItem) {
          const truncateEvent = {
            type: 'conversation.item.truncate',
            item_id: lastAssistantItem,
            content_index: 0,
            audio_end_ms: elapsedTime
          };
          if (SHOW_TIMING_MATH) console.log('Sending truncation event:', JSON.stringify(truncateEvent));
          openAiWs.send(JSON.stringify(truncateEvent));
        }

        connection.send(JSON.stringify({
          event: 'clear',
          streamSid
        }));

        markQueue = [];
        lastAssistantItem = null;
        responseStartTimestampTwilio = null;
      }
    };

    const sendMark = (socketConnection, currentStreamSid) => {
      if (currentStreamSid) {
        const markEvent = {
          event: 'mark',
          streamSid: currentStreamSid,
          mark: { name: 'responsePart' }
        };
        socketConnection.send(JSON.stringify(markEvent));
        markQueue.push('responsePart');
      }
    };

    openAiWs.on('open', () => {
      console.log('Connected to the OpenAI Realtime API');
      setTimeout(initializeSession, 600);
    });

    openAiWs.on('message', (data) => {
      try {
        const response = JSON.parse(data);

if (LOG_EVENT_TYPES.includes(response.type)) {
  console.log(`Received event: ${response.type}`);

  if (response.type === 'error') {
    console.log('OPENAI REALTIME ERROR FULL PAYLOAD:');
    console.log(JSON.stringify(response, null, 2));
  }
}

        if (response.type === 'response.audio_transcript.done' && response.transcript) {
          const text = String(response.transcript).trim();
          if (text) {
            console.log('AI TRANSCRIPT:', text);
            transcript.push(`AI: ${text}`);
          }
        }

        if (response.type === 'conversation.item.input_audio_transcription.completed' && response.transcript) {
          const text = String(response.transcript).trim();
          if (text) {
            console.log('CALLER TRANSCRIPT:', text);
            transcript.push(`Caller: ${text}`);
            handleCallerTurn(text);
          }
        }

        if (response.type === 'response.output_audio.delta' && response.delta) {
          const audioDelta = {
            event: 'media',
            streamSid,
            media: { payload: response.delta }
          };
          connection.send(JSON.stringify(audioDelta));

          if (!responseStartTimestampTwilio) {
            responseStartTimestampTwilio = latestMediaTimestamp;
            if (SHOW_TIMING_MATH) console.log(`Setting start timestamp for new response: ${responseStartTimestampTwilio}ms`);
          }

          if (response.item_id) {
            lastAssistantItem = response.item_id;
          }

          sendMark(connection, streamSid);
        }

        if (response.type === 'input_audio_buffer.speech_started') {
          handleSpeechStartedEvent();
        }
      } catch (error) {
        console.error('Error processing OpenAI message:', error, 'Raw message:', data);
      }
    });

    connection.on('message', (message) => {
      try {
        const data = JSON.parse(message);

        switch (data.event) {
          case 'media':
            latestMediaTimestamp = data.media.timestamp;
            if (SHOW_TIMING_MATH) {
              console.log(`Received media message with timestamp: ${latestMediaTimestamp}ms`);
            }
            if (openAiWs.readyState === WebSocket.OPEN) {
              const audioAppend = {
                type: 'input_audio_buffer.append',
                audio: data.media.payload
              };
              openAiWs.send(JSON.stringify(audioAppend));
            }
            break;

          case 'start':
            streamSid = data.start.streamSid;
            console.log('Incoming stream has started', streamSid);

            if (data.start?.customParameters) {
              callerPhone = data.start.customParameters.callerPhone || 'Unknown';
              callSid = data.start.customParameters.callSid || 'Unknown';
            }

            console.log('Caller phone:', callerPhone);
            console.log('Call SID:', callSid);

            responseStartTimestampTwilio = null;
            latestMediaTimestamp = 0;
            supportRetrievalMode = false;
            activeSupportProduct = '';
            break;

          case 'mark':
            if (markQueue.length > 0) {
              markQueue.shift();
            }
            break;

          case 'stop':
            console.log('Received stop event from Twilio');
            break;

          default:
            console.log('Received non-media event:', data.event);
            break;
        }
      } catch (error) {
        console.error('Error parsing message:', error, 'Message:', message);
      }
    });

    connection.on('close', async () => {
      try {
        if (openAiWs.readyState === WebSocket.OPEN) openAiWs.close();
      } catch (err) {
        console.error('❌ Error during websocket close:', err);
      } finally {
        console.log('Client disconnected.');
      }
    });

    openAiWs.on('close', () => {
      console.log('Disconnected from the OpenAI Realtime API');
    });

    openAiWs.on('error', (error) => {
      console.error('Error in the OpenAI WebSocket:', error);
    });
  });
});

const start = async () => {
  try {
    await fastify.listen({
      port: PORT,
      host: '0.0.0.0'
    });

    console.log('Server started correctly');
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

start();
