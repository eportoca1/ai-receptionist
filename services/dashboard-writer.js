const UNKNOWN_VALUES = new Set([
  '',
  'unknown',
  'unknown caller',
  'not captured',
  'n/a',
  'none',
  'not provided',
  'not available'
]);

const RECEPTIONIST_STATUSES = {
  ANSWERED: 'Answered',
  MISSED: 'Missed',
  AFTER_HOURS: 'After Hours',
  ESCALATED: 'Escalated'
};

function isKnownValue(value) {
  const normalized = String(value ?? '').trim().toLowerCase();
  return !UNKNOWN_VALUES.has(normalized);
}

function toNullableText(value) {
  const text = String(value ?? '').trim();
  return isKnownValue(text) ? text : null;
}

function normalizeTextList(values = []) {
  if (!Array.isArray(values)) return [];
  return Array.from(new Set(
    values
      .map((item) => String(item || '').trim())
      .filter(Boolean)
  ));
}

function toIsoString(timestamp) {
  if (!Number.isFinite(timestamp)) return null;
  return new Date(timestamp).toISOString();
}

function buildSummaryText(...values) {
  const parts = values
    .map((value) => toNullableText(value))
    .filter(Boolean);

  return parts.length > 0 ? parts.join(' ') : null;
}

function buildCallReason(reportData) {
  return (
    toNullableText(reportData.issue) ||
    toNullableText(reportData.callContext) ||
    toNullableText(reportData.category)
  );
}

function normalizeReceptionistStatus(recordingStatus, reportData = {}) {
  const candidates = [
    toNullableText(recordingStatus),
    String(reportData.escalationNeeded || '').trim().toLowerCase() === 'yes'
      ? RECEPTIONIST_STATUSES.ESCALATED
      : null,
    toNullableText(reportData.escalationStatus),
    toNullableText(reportData.resolutionStatus)
  ].filter(Boolean);

  for (const candidate of candidates) {
    const normalized = candidate.toLowerCase();

    if (
      normalized === 'after hours' ||
      normalized === 'after-hours' ||
      normalized.includes('after hours') ||
      normalized.includes('after-hours')
    ) {
      return RECEPTIONIST_STATUSES.AFTER_HOURS;
    }

    if (normalized === 'escalated' || normalized.includes('escalat')) {
      return RECEPTIONIST_STATUSES.ESCALATED;
    }

    if (
      normalized === 'missed' ||
      normalized.includes('no answer') ||
      normalized.includes('busy') ||
      normalized.includes('failed') ||
      normalized.includes('cancelled') ||
      normalized.includes('canceled') ||
      normalized.includes('abandoned') ||
      normalized.includes('voicemail')
    ) {
      return RECEPTIONIST_STATUSES.MISSED;
    }

    if (
      normalized === 'answered' ||
      normalized === 'completed' ||
      normalized === 'complete'
    ) {
      return RECEPTIONIST_STATUSES.ANSWERED;
    }
  }

  return RECEPTIONIST_STATUSES.ANSWERED;
}

function mapReceptionistReason(value) {
  const text = toNullableText(value);
  if (!text) return null;

  const normalized = text.toLowerCase();

  if (
    normalized.includes('claim status') ||
    normalized.includes('warranty status') ||
    normalized.includes('status inquiry') ||
    (
      (normalized.includes('status') || normalized.includes('update') || normalized.includes('follow up')) &&
      (normalized.includes('claim') || normalized.includes('warranty') || normalized.includes('return'))
    )
  ) {
    return 'Warranty Status Check';
  }

  if (
    normalized === 'wholesale / dealer inquiry' ||
    normalized.includes('wholesale') ||
    normalized.includes('dealer') ||
    normalized.includes('reseller') ||
    normalized.includes('distribution') ||
    normalized.includes('bulk')
  ) {
    return 'Wholesale Inquiry';
  }

  if (
    normalized === 'warranty / returns' ||
    normalized.includes('warranty') ||
    normalized.includes('return authorization') ||
    normalized.includes('return request') ||
    normalized.includes('warranty form') ||
    normalized.includes('return')
  ) {
    return 'Warranty Request';
  }

  if (
    normalized.includes('representative') ||
    normalized.includes('real person') ||
    normalized.includes('human') ||
    normalized.includes('agent') ||
    normalized.includes('someone from the team') ||
    normalized.includes('someone on the team')
  ) {
    return 'Representative Request';
  }

  if (
    normalized === 'tech support / troubleshooting' ||
    normalized.includes('troubleshoot') ||
    normalized.includes('trouble shooting') ||
    normalized.includes('not working') ||
    normalized.includes('issue') ||
    normalized.includes('problem') ||
    normalized.includes('setup') ||
    normalized.includes('set up') ||
    normalized.includes('reset') ||
    normalized.includes('pair') ||
    normalized.includes('connect') ||
    normalized.includes('sync')
  ) {
    return 'Troubleshooting';
  }

  if (
    normalized.includes('price') ||
    normalized.includes('pricing') ||
    normalized.includes('quote') ||
    normalized.includes('cost')
  ) {
    return 'Product Pricing Inquiry';
  }

  if (
    normalized === 'general inquiry' ||
    normalized === 'general question' ||
    normalized === 'question'
  ) {
    return 'General Question';
  }

  return null;
}

function normalizeReceptionistReason(reportData = {}) {
  const candidates = [
    reportData.issue,
    reportData.callContext,
    reportData.category
  ];

  for (const candidate of candidates) {
    const normalizedReason = mapReceptionistReason(candidate);
    if (normalizedReason) return normalizedReason;
  }

  return buildCallReason(reportData);
}

function buildCallTags(reportData) {
  const tags = normalizeTextList([
    toNullableText(reportData.category),
    toNullableText(reportData.urgency),
    toNullableText(reportData.resolutionStatus),
    toNullableText(reportData.product)
  ]);

  return tags.length > 0 ? tags : null;
}

function buildBookedCallback(reportData) {
  const haystack = [
    reportData.executiveSummary,
    reportData.outcomeNotes,
    ...normalizeTextList(reportData.recommendedActions)
  ]
    .join(' ')
    .toLowerCase();

  if (!haystack) return false;
  if (haystack.includes('callback') || haystack.includes('call back')) return true;
  return false;
}

function buildRelatedLabel(reportData, callerPhone, callSid) {
  return (
    toNullableText(reportData.businessName) ||
    toNullableText(reportData.callerName) ||
    callerPhone ||
    callSid
  );
}

function buildActionTitle(reportData) {
  const businessName = toNullableText(reportData.businessName);
  const callerName = toNullableText(reportData.callerName);

  if (businessName) return `Follow up with ${businessName}`;
  if (callerName) return `Follow up with ${callerName}`;

  const category = toNullableText(reportData.category) || 'call';
  return `Follow up on ${category.toLowerCase()} call`;
}

function buildOpportunityTitle(reportData, callerPhone) {
  const companyName = toNullableText(reportData.businessName);
  const callerName = toNullableText(reportData.callerName);
  const product = toNullableText(reportData.product);

  if (companyName && product) return `${companyName} - ${product}`;
  if (companyName) return `${companyName} opportunity`;
  if (callerName && product) return `${callerName} - ${product}`;
  if (callerName) return `${callerName} opportunity`;
  if (product) return `${product} opportunity`;
  if (callerPhone) return `Phone opportunity ${callerPhone}`;
  return 'Phone opportunity';
}

function shouldCreateFollowUpAction(reportData) {
  return (
    String(reportData.followUpNeeded || '').trim().toLowerCase() === 'yes' ||
    String(reportData.resolutionStatus || '').trim() === 'Follow-Up Needed' ||
    String(reportData.escalationNeeded || '').trim().toLowerCase() === 'yes'
  );
}

function shouldCreateOpportunity(reportData) {
  return ['Possible', 'Strong'].includes(String(reportData.leadOpportunity || '').trim());
}

function buildOpportunityStage(reportData) {
  return String(reportData.leadOpportunity || '').trim() === 'Strong'
    ? 'Qualified'
    : 'New';
}

async function findExistingBySourceCallId(supabase, tableName, sourceCallId) {
  const { data, error } = await supabase
    .from(tableName)
    .select('id')
    .eq('source_call_id', sourceCallId)
    .limit(1);

  if (error) throw error;
  return Array.isArray(data) && data.length > 0 ? data[0].id : null;
}

export async function writeDashboardCall({
  supabase,
  callSid,
  storedContext = {},
  recordingStatus = '',
  durationSeconds = 0,
  reportData = {}
}) {
  if (!supabase || !callSid || callSid === 'Unknown') {
    return;
  }

  const normalizedDuration = Number.isFinite(Number(durationSeconds))
    ? Math.max(0, Number(durationSeconds))
    : 0;

  const startedAtMs = Number.isFinite(storedContext.startedAt)
    ? storedContext.startedAt
    : null;

  const endedAtMs = startedAtMs != null && normalizedDuration > 0
    ? startedAtMs + (normalizedDuration * 1000)
    : Date.now();

  const callerPhone =
    toNullableText(reportData.callerPhone) ||
    toNullableText(storedContext.callerPhone);

  const nextAction = normalizeTextList(reportData.recommendedActions)[0] || null;

  const callPayload = {
    twilio_call_sid: callSid,
    caller_phone: callerPhone,
    caller_name: toNullableText(reportData.callerName),
    company_name: toNullableText(reportData.businessName),
    reason: normalizeReceptionistReason(reportData),
    handled_by: 'AI Receptionist',
    started_at: toIsoString(startedAtMs),
    ended_at: toIsoString(endedAtMs),
    duration_seconds: normalizedDuration,
    status: normalizeReceptionistStatus(recordingStatus, reportData),
    summary: toNullableText(reportData.executiveSummary),
    sentiment: toNullableText(reportData.sentiment),
    tags: buildCallTags(reportData),
    next_step: nextAction,
    booked_callback: buildBookedCallback(reportData)
  };

  const { data: callRows, error: callError } = await supabase
    .from('receptionist_calls')
    .upsert(callPayload, { onConflict: 'twilio_call_sid' })
    .select('id');

  if (callError) {
    throw callError;
  }

  const sourceCallId = Array.isArray(callRows) && callRows.length > 0
    ? callRows[0].id
    : null;

  if (!sourceCallId) {
    return;
  }

  if (shouldCreateFollowUpAction(reportData)) {
    try {
      const existingActionId = await findExistingBySourceCallId(
        supabase,
        'receptionist_actions',
        sourceCallId
      );

      if (!existingActionId) {
        const actionPayload = {
          source_call_id: sourceCallId,
          title: buildActionTitle(reportData),
          owner: null,
          related_label: buildRelatedLabel(reportData, callerPhone, callSid),
          due_at: null,
          due_status: null,
          summary: buildSummaryText(reportData.outcomeNotes, reportData.executiveSummary),
          status: 'Open',
          channel: 'Phone'
        };

        const { error: actionError } = await supabase
          .from('receptionist_actions')
          .insert(actionPayload);

        if (actionError) throw actionError;
      }
    } catch (error) {
      console.error('❌ Dashboard action sync failed:', error);
    }
  }

  if (shouldCreateOpportunity(reportData)) {
    try {
      const existingOpportunityId = await findExistingBySourceCallId(
        supabase,
        'receptionist_opportunities',
        sourceCallId
      );

      if (!existingOpportunityId) {
        const opportunityPayload = {
          source_call_id: sourceCallId,
          title: buildOpportunityTitle(reportData, callerPhone),
          contact_name: toNullableText(reportData.callerName),
          company_name: toNullableText(reportData.businessName),
          service: (
            toNullableText(reportData.product) ||
            toNullableText(reportData.callContext) ||
            toNullableText(reportData.category)
          ),
          estimated_value: null,
          stage: buildOpportunityStage(reportData),
          summary: buildSummaryText(reportData.executiveSummary, reportData.outcomeNotes),
          owner: null,
          confidence: null,
          source: 'AI Receptionist',
          last_touch_at: toIsoString(endedAtMs),
          next_action: nextAction
        };

        const { error: opportunityError } = await supabase
          .from('receptionist_opportunities')
          .insert(opportunityPayload);

        if (opportunityError) throw opportunityError;
      }
    } catch (error) {
      console.error('❌ Dashboard opportunity sync failed:', error);
    }
  }
}
