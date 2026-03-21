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
const SYSTEM_MESSAGE =`
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
const TEMPERATURE = 0.92; // Controls the randomness of the AI's responses
const PORT = process.env.PORT || 5050; // Allow dynamic port assignment

// List of Event Types to log to the console. See the OpenAI Realtime API Documentation: https://platform.openai.com/docs/api-reference/realtime
const LOG_EVENT_TYPES = [
    'error',
    'response.content.done',
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
  html: htmlBody || `<pre style="font-family: Arial, sans-serif; white-space: pre-wrap;">${body}</pre>`,
});
}
// Root Route
fastify.get('/', async (request, reply) => {
    reply.send({ message: 'Twilio Media Stream Server is running!' });
});

// Route for Twilio to handle incoming calls
// <Say> punctuation to improve text-to-speech translation
fastify.all('/incoming-call', async (request, reply) => {
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
    <Stream url="wss://${request.headers.host}/media-stream" />
  </Connect>
</Response>`;

  reply.type('text/xml').send(twimlResponse);
});
// Recording status webhook (Twilio calls this after recording is complete)
fastify.post('/recording-status', async (request, reply) => {
  console.log('📼 Recording callback received');
  console.log('CallSid:', request.body.CallSid);
  console.log('RecordingSid:', request.body.RecordingSid);
  console.log('RecordingUrl:', request.body.RecordingUrl);

  reply.send({ ok: true });
});
// WebSocket route for media-stream
fastify.register(async (fastify) => {
    fastify.get('/media-stream', { websocket: true }, (connection, req) => {
        console.log('Client connected');
        let transcript = [];

        // Connection-specific state
        let streamSid = null;
        let latestMediaTimestamp = 0;
        let lastAssistantItem = null;
        let markQueue = [];
        let responseStartTimestampTwilio = null;

const openAiWs = new WebSocket(`wss://api.openai.com/v1/realtime?model=gpt-realtime&temperature=${TEMPERATURE}`, {
            headers: {
                Authorization: `Bearer ${OPENAI_API_KEY}`,
            }
        });

        // Control initial session with OpenAI
        const initializeSession = () => {
            const sessionUpdate = {
                type: 'session.update',
                session: {
                    type: 'realtime',
                    model: "gpt-realtime",
                    output_modalities: ["audio"],
                    audio: {
                        input: { format: { type: 'audio/pcmu' }, turn_detection: { type: "server_vad" } },
                        output: { format: { type: 'audio/pcmu' }, voice: VOICE },
                    },
instructions: SYSTEM_MESSAGE +
  "\n\n============================\nEW CORE COMPANY + POLICIES\n============================\n" +
  EW_CORE_CARD +
  "\n\n============================\nEW ENTERPRISE STRATEGIC INTELLIGENCE\n============================\n" +
  EW_ENTERPRISE_CARD +
  "\n\n============================\nINTERNAL PRODUCT SUPPORT CARD: PLAY FORCE\n============================\n" +
  PLAYFORCE_SUPPORT_CARD,
                },
            };

            console.log('Sending session update:', JSON.stringify(sessionUpdate));
            openAiWs.send(JSON.stringify(sessionUpdate));

            // Uncomment the following line to have AI speak first:
            // sendInitialConversationItem();
        };

        // Send initial conversation item if AI talks first
        const sendInitialConversationItem = () => {
            const initialConversationItem = {
                type: 'conversation.item.create',
                item: {
                    type: 'message',
                    role: 'user',
                    content: [
                        {
                            type: 'input_text',
                            text: 'Start with: "Hi! Thank you for calling Electronic World. This is Genesis. How can I help you today?"'
                        }
                    ]
                }
            };

            if (SHOW_TIMING_MATH) console.log('Sending initial conversation item:', JSON.stringify(initialConversationItem));
            openAiWs.send(JSON.stringify(initialConversationItem));
            openAiWs.send(JSON.stringify({ type: 'response.create' }));
        };

        // Handle interruption when the caller's speech starts
        const handleSpeechStartedEvent = () => {
            if (markQueue.length > 0 && responseStartTimestampTwilio != null) {
                const elapsedTime = latestMediaTimestamp - responseStartTimestampTwilio;
                if (SHOW_TIMING_MATH) console.log(`Calculating elapsed time for truncation: ${latestMediaTimestamp} - ${responseStartTimestampTwilio} = ${elapsedTime}ms`);

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
                    streamSid: streamSid
                }));

                // Reset
                markQueue = [];
                lastAssistantItem = null;
                responseStartTimestampTwilio = null;
            }
        };

        // Send mark messages to Media Streams so we know if and when AI response playback is finished
        const sendMark = (connection, streamSid) => {
            if (streamSid) {
                const markEvent = {
                    event: 'mark',
                    streamSid: streamSid,
                    mark: { name: 'responsePart' }
                };
                connection.send(JSON.stringify(markEvent));
                markQueue.push('responsePart');
            }
        };

        // Open event for OpenAI WebSocket
        openAiWs.on('open', () => {
            console.log('Connected to the OpenAI Realtime API');
            setTimeout(initializeSession, 600);
        });

        // Listen for messages from the OpenAI WebSocket (and send to Twilio if necessary)
        openAiWs.on('message', (data) => {
            try {
                const response = JSON.parse(data);

                if (LOG_EVENT_TYPES.includes(response.type)) {
                    console.log(`Received event: ${response.type}`, response);
                }

                if (response.type === 'response.output_audio.delta' && response.delta) {
                    const audioDelta = {
                        event: 'media',
                        streamSid: streamSid,
                        media: { payload: response.delta }
                    };
                    connection.send(JSON.stringify(audioDelta));

                    // First delta from a new response starts the elapsed time counter
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

        // Handle incoming messages from Twilio
        connection.on('message', (message) => {
            try {
                const data = JSON.parse(message);

                switch (data.event) {
                    case 'media':
                        latestMediaTimestamp = data.media.timestamp;
                        if (SHOW_TIMING_MATH) console.log(`Received media message with timestamp: ${latestMediaTimestamp}ms`);
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

                        // Reset start and media timestamp on a new stream
                        responseStartTimestampTwilio = null; 
                        latestMediaTimestamp = 0;
                        break;
                    case 'mark':
                        if (markQueue.length > 0) {
                            markQueue.shift();
                        }
                        break;
                    default:
                        console.log('Received non-media event:', data.event);
                        break;
                }
            } catch (error) {
                console.error('Error parsing message:', error, 'Message:', message);
            }
        });

        // Handle connection close
connection.on('close', async () => {
    try {
        if (openAiWs.readyState === WebSocket.OPEN) openAiWs.close();

        const subject = `[EW AI CALL SUMMARY] ${new Date().toLocaleString()}`;

        const body =
`PURPOSE:
Unknown (tagging upgrade next)

SUMMARY:
- AI receptionist handled a call.
- Product support card was available for Play Force.
- Caller may have asked for support, wholesale, warranty, or general info.

CUSTOMER INFO CAPTURED:
- Name:
- Phone:
- Email:
- Business (if any):
- Product (if any):

NEXT STEPS:
- If caller requested follow-up, return call ASAP.
- If wholesale lead, route to account manager.
- If warranty, route to support team.

URGENCY:
Medium`;

        await sendSummaryEmail(subject, body);
        console.log('✅ Summary email sent.');
    } catch (err) {
        console.error('❌ Summary email failed:', err);
    } finally {
        console.log('Client disconnected.');
    }
});

        // Handle WebSocket close and errors
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
      port: process.env.PORT || 5050,
      host: '0.0.0.0'
    });

    console.log('Server started correctly');
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

start();
