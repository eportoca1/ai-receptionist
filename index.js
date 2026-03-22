import nodemailer from 'nodemailer';
import Fastify from 'fastify';
import WebSocket from 'ws';
import dotenv from 'dotenv';
import fs from 'fs';
import fastifyFormBody from '@fastify/formbody';
import fastifyWs from '@fastify/websocket';

// Load environment variables from .env file
dotenv.config();

// Retrieve the OpenAI API key from environment variables.
const { OPENAI_API_KEY } = process.env;

if (!OPENAI_API_KEY) {
  console.error('Missing OpenAI API key. Please set it in the .env file.');
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

You must sound extremely human. Not robotic. Not scripted. Not “AI-like.”

- Use subtle, natural conversational fillers occasionally:
  “Okay…”
  “Got it…”
  “Hmm, quick question…”
  “Alright, so…”
  “Perfect.”
  “Yeah, no worries.”
- Do NOT overuse fillers. Use them lightly and naturally.
- Vary sentence rhythm so you don’t sound repetitive.
- Use short pauses in tone when transitioning thoughts.
- Keep responses short (1–2 sentences), then ask ONE clear question.

HUMAN TIMING & DELIVERY (CRITICAL):

- Do not answer instantly. Add a subtle natural pause before answering important questions.
- Occasionally start responses with natural micro-reactions:
  "Okay..."
  "Got it..."
  "Alright..."
  "Hmm, let me think for a second..."
  "Yeah, so..."
- Do NOT overuse fillers.
- Vary sentence length naturally.
- Sometimes answer with one short sentence before asking a question.
- Avoid overly structured transitions like:
  "First... Second... Next..."
  unless summarizing at the end.
- Allow conversational imperfections. Do not sound like a script.
- Never sound rehearsed.

MID-SENTENCE HUMAN ADJUSTMENT:
- Occasionally slightly revise yourself mid-sentence naturally.
  Example:
  “Okay — actually, wait — let’s try this first.”
  “Yeah, so… hmm, let me back up for a second.”
- Do this at most once per call.
- Keep it subtle and believable.

DYNAMIC EMOTIONAL MIRRORING:
- Slightly soften tone and slow down when caller sounds frustrated.
- Slightly increase brightness and energy when caller sounds positive.
- If caller laughs or is casual, respond slightly more casual.
- Do not keep identical emotional tone throughout the call.

RHYTHM VARIATION:
- Vary sentence length unpredictably.
- Sometimes respond with a short phrase first:
  “Yeah.” 
  “Got it.”
  Then continue.
- Do not maintain consistent two-sentence response structure.

RAPPORT & REAL CONVERSATION (HUMAN, NOT SCRIPTED):

- Start calls with a warm, human opener, but keep it SHORT.
- Use small talk to make the caller feel comfortable, not to interview them.

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

const VOICE = 'marin';
const TEMPERATURE = 0.92;
const PORT = process.env.PORT || 5050;

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

      return `
        <div style="margin-bottom: 14px; padding-bottom: 14px; border-bottom: 1px solid #f3f4f6;">
          <div style="font-size: 12px; font-weight: 700; color: ${isCaller ? '#111827' : '#528238'}; margin-bottom: 4px;">${escapeHtml(speaker)}</div>
          <div style="font-size: 14px; line-height: 1.7; color: #374151;">${escapeHtml(text)}</div>
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
  console.log('📼 Recording callback received');
  console.log('CallSid:', request.body.CallSid);
  console.log('RecordingSid:', request.body.RecordingSid);
  console.log('RecordingUrl:', request.body.RecordingUrl);

  reply.send({ ok: true });
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

    let callerPhone = 'Unknown';
    let callSid = 'Unknown';
    const callStartedAt = Date.now();

    const openAiWs = new WebSocket(`wss://api.openai.com/v1/realtime?model=gpt-realtime&temperature=${TEMPERATURE}`, {
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      }
    });

    const initializeSession = () => {
      const sessionUpdate = {
        type: 'session.update',
        session: {
          type: 'realtime',
          model: 'gpt-realtime',
          output_modalities: ['audio'],
          input_audio_transcription: {
            model: 'gpt-4o-mini-transcribe'
          },
          audio: {
            input: {
              format: { type: 'audio/pcmu' },
              turn_detection: { type: 'server_vad' }
            },
            output: {
              format: { type: 'audio/pcmu' },
              voice: VOICE
            },
          },
          instructions:
            SYSTEM_MESSAGE +
            '\n\n============================\nEW CORE COMPANY + POLICIES\n============================\n' +
            EW_CORE_CARD +
            '\n\n============================\nEW ENTERPRISE STRATEGIC INTELLIGENCE\n============================\n' +
            EW_ENTERPRISE_CARD +
            '\n\n============================\nINTERNAL PRODUCT SUPPORT CARD: PLAY FORCE\n============================\n' +
            PLAYFORCE_SUPPORT_CARD,
        },
      };

      console.log('Sending session update');
      openAiWs.send(JSON.stringify(sessionUpdate));
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

        const callEndedAt = Date.now();
        const durationSeconds = Math.round((callEndedAt - callStartedAt) / 1000);
        const durationText = formatDurationFromSeconds(durationSeconds);
        const reportDate = new Date().toLocaleString();

        const transcriptLines = transcript.length > 0 ? transcript : ['No transcript available.'];

        console.log('TRANSCRIPT DEBUG:');
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
            executiveSummary: 'A call was handled by the AI receptionist, but the structured post-call analysis could not be fully generated for this call. Please review the transcript directly below.',
            followUpNeeded: 'Unknown',
            escalationNeeded: 'Unknown',
            leadOpportunity: 'None',
            outcomeNotes: 'Structured analysis failed, so the transcript should be reviewed manually.',
            product: 'N/A',
            issue: 'N/A',
            subType: '',
            customerType: 'Unknown',
            purchaseStatus: 'Unknown',
            callContext: 'General Call',
            rootCause: 'Unknown',
            commercialValue: 'Low',
            upsellOpportunity: 'Low',
            escalationStatus: 'Unknown',
            conversationHighlights: ['Structured analysis was unavailable for this call.'],
            recommendedActions: ['Review the transcript manually.']
          };
        }

        const reportData = {
          logoUrl: 'https://via.placeholder.com/120x40?text=EW',
          reportDate,
          callerName: analysis.callerName || 'Unknown Caller',
          callerPhone: callerPhone || 'Unknown',
          callDuration: durationText,

          category: analysis.category || 'General Inquiry',
          resolutionStatus: analysis.resolutionStatus || 'Unknown',
          urgency: analysis.urgency || 'Medium',
          sentiment: analysis.sentiment || 'Neutral',

          executiveSummary: analysis.executiveSummary || 'No summary available.',

          followUpNeeded: analysis.followUpNeeded || 'Unknown',
          escalationNeeded: analysis.escalationNeeded || 'Unknown',
          leadOpportunity: analysis.leadOpportunity || 'None',
          outcomeNotes: analysis.outcomeNotes || 'No outcome notes available.',

          email: analysis.email || 'Not captured',
          businessName: analysis.businessName || 'Not captured',
          product: analysis.product || 'N/A',
          issue: analysis.issue || 'N/A',
          subType: analysis.subType || '',
          customerType: analysis.customerType || 'Unknown',
          purchaseStatus: analysis.purchaseStatus || 'Unknown',
          callContext: analysis.callContext || 'General Call',

          rootCause: analysis.rootCause || 'Unknown',
          commercialValue: analysis.commercialValue || 'Low',
          upsellOpportunity: analysis.upsellOpportunity || 'Low',
          escalationStatus: analysis.escalationStatus || 'No Escalation Needed',

          conversationHighlights: analysis.conversationHighlights || [],
          recommendedActions: analysis.recommendedActions || [],
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
- Sub-Type: ${reportData.subType || 'N/A'}
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
        console.log('✅ Summary email sent.');
      } catch (err) {
        console.error('❌ Summary email failed:', err);
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