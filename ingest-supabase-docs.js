import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import OpenAI, { toFile } from 'openai';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !OPENAI_API_KEY) {
  console.error('Missing required environment variables.');
  console.error('Need: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, OPENAI_API_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

const DEFAULT_BUCKET_NAME = process.env.KNOWLEDGE_BUCKET || 'documents';
const DEFAULT_CLIENT_ID = process.env.KNOWLEDGE_CLIENT_ID || 'mobilelink';
const DEFAULT_MODE = 'ingest';
const MIN_EXTRACTED_TEXT_LENGTH = 50;
const MIN_CHUNK_LENGTH = 100;
const DEFAULT_CHUNK_SIZE = 1200;
const DEFAULT_CHUNK_OVERLAP = 200;
const OCR_MODEL = process.env.OCR_MODEL || 'gpt-4.1-mini';
const OCR_EXTRACTION_PROMPT =
  'Extract all readable text from this PDF manual. Return plain text only. Preserve headings, warnings, bullets, and numbered steps. If no readable text exists, return an empty string.';

function parseArgs(argv = []) {
  const parsed = {
    mode: DEFAULT_MODE,
    clientId: DEFAULT_CLIENT_ID,
    bucketName: DEFAULT_BUCKET_NAME,
    files: [],
    replaceExisting: false,
    useOcrFallback: true
  };

  for (const arg of argv) {
    if (arg === '--replace-existing') {
      parsed.replaceExisting = true;
      continue;
    }

    if (arg === '--no-ocr') {
      parsed.useOcrFallback = false;
      continue;
    }

    if (arg.startsWith('--mode=')) {
      parsed.mode = arg.slice('--mode='.length).trim() || DEFAULT_MODE;
      continue;
    }

    if (arg.startsWith('--client-id=')) {
      parsed.clientId = arg.slice('--client-id='.length).trim() || DEFAULT_CLIENT_ID;
      continue;
    }

    if (arg.startsWith('--bucket=')) {
      parsed.bucketName = arg.slice('--bucket='.length).trim() || DEFAULT_BUCKET_NAME;
      continue;
    }

    if (arg.startsWith('--files=')) {
      parsed.files = arg
        .slice('--files='.length)
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
    }
  }

  if (parsed.mode === 'reingest') {
    parsed.mode = 'ingest';
    parsed.replaceExisting = true;
  }

  return parsed;
}

const runtime = parseArgs(process.argv.slice(2));

function toDisplayProductName(value = '') {
  return String(value || '')
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => {
      if (!/[a-z]/i.test(word) || word === word.toUpperCase()) {
        return word;
      }

      return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
    })
    .join(' ');
}

function stripFileCopyMarkers(value = '') {
  return String(value || '')
    .replace(/\s*\(\d+\)\s*$/i, '')
    .replace(/\s+(final|draft|rev\s*[a-z0-9]+|v\d+)\s*$/i, '')
    .trim();
}

function deriveProductNameFromFileName(fileName = '') {
  const withoutExtension = String(fileName || '').replace(/\.[^.]+$/, '');
  const normalized = stripFileCopyMarkers(
    withoutExtension
      .replace(/[_-]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  );

  const manualMatch = normalized.match(
    /^(.*?)(?:\s*(?:user\s*manual|usermanual|instruction\s*manual|manual|instructions?|quick\s*start(?:\s*guide)?|setup\s*guide)\b.*)?$/i
  );

  const stripped = String(manualMatch?.[1] || normalized)
    .replace(/\s+/g, ' ')
    .trim();

  return toDisplayProductName(stripped || normalized);
}

function chunkText(text, chunkSize = DEFAULT_CHUNK_SIZE, overlap = DEFAULT_CHUNK_OVERLAP) {
  const cleaned = String(text || '').replace(/\s+/g, ' ').trim();
  const chunks = [];

  let start = 0;
  while (start < cleaned.length) {
    const end = Math.min(start + chunkSize, cleaned.length);
    const chunk = cleaned.slice(start, end).trim();

    if (chunk.length > MIN_CHUNK_LENGTH) {
      chunks.push(chunk);
    }

    start += chunkSize - overlap;
  }

  return chunks;
}

async function getEmbedding(text) {
  const response = await openai.embeddings.create({
    model: 'text-embedding-3-small',
    input: text,
  });

  return response.data[0].embedding;
}

async function listStorageFiles(bucketName) {
  const { data, error } = await supabase.storage
    .from(bucketName)
    .list('', { limit: 100 });

  if (error) {
    throw error;
  }

  return (data || []).filter((file) => file.name.toLowerCase().endsWith('.pdf'));
}

async function downloadFile(bucketName, fileName) {
  const { data, error } = await supabase.storage
    .from(bucketName)
    .download(fileName);

  if (error) {
    throw error;
  }

  const arrayBuffer = await data.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

async function extractPdfText(buffer) {
  const parsed = await pdfParse(buffer);
  return parsed.text || '';
}

async function extractPdfTextWithOcr(buffer, fileName) {
  const uploadedFile = await openai.files.create({
    file: await toFile(buffer, fileName),
    purpose: 'user_data'
  });

  try {
    const response = await openai.responses.create({
      model: OCR_MODEL,
      input: [
        {
          role: 'user',
          content: [
            { type: 'input_text', text: OCR_EXTRACTION_PROMPT },
            { type: 'input_file', file_id: uploadedFile.id }
          ]
        }
      ]
    });

    return String(response.output_text || '').trim();
  } finally {
    try {
      await openai.files.delete(uploadedFile.id);
    } catch (cleanupError) {
      console.warn(`Could not delete temporary OCR file ${uploadedFile.id}:`, cleanupError);
    }
  }
}

async function extractTextWithFallback(buffer, fileName, { useOcrFallback = true } = {}) {
  const directText = String((await extractPdfText(buffer)) || '').trim();
  if (directText.length >= MIN_EXTRACTED_TEXT_LENGTH) {
    return {
      text: directText,
      extractedText: 'success',
      extractionMethod: 'pdf-parse'
    };
  }

  if (!useOcrFallback) {
    return {
      text: directText,
      extractedText: 'failure',
      extractionMethod: directText ? 'pdf-parse-too-short' : 'pdf-parse-empty'
    };
  }

  console.log(`Standard extraction weak for ${fileName}. Trying OCR fallback...`);

  try {
    const ocrText = String((await extractPdfTextWithOcr(buffer, fileName)) || '').trim();
    if (ocrText.length >= MIN_EXTRACTED_TEXT_LENGTH) {
      return {
        text: ocrText,
        extractedText: 'success',
        extractionMethod: 'ocr'
      };
    }

    return {
      text: ocrText,
      extractedText: 'failure',
      extractionMethod: ocrText ? 'ocr-too-short' : 'ocr-empty'
    };
  } catch (ocrError) {
    console.error(`OCR fallback failed for ${fileName}:`, ocrError);
    return {
      text: directText,
      extractedText: 'failure',
      extractionMethod: directText ? 'pdf-parse-too-short' : 'ocr-error'
    };
  }
}

function extractSourceFilenameFromContent(content = '') {
  const match = String(content || '').match(/^\[SOURCE:\s*([^\]]+)\]/);
  return match?.[1]?.trim() || '';
}

async function listDocumentRowsForClient(clientId) {
  const rows = [];
  const pageSize = 1000;

  for (let from = 0; ; from += pageSize) {
    const { data, error } = await supabase
      .from('documents')
      .select('source_filename, product_name, content')
      .eq('client_id', clientId)
      .range(from, from + pageSize - 1);

    if (error) {
      throw error;
    }

    rows.push(...(data || []));

    if (!data || data.length < pageSize) {
      break;
    }
  }

  return rows;
}

function buildStoredFileIndex(rows = []) {
  const index = new Map();

  for (const row of rows) {
    const sourceFilename = row.source_filename || extractSourceFilenameFromContent(row.content || '');
    if (!sourceFilename) {
      continue;
    }

    const existing = index.get(sourceFilename) || {
      storedChunkCount: 0,
      storedProductNames: new Set()
    };

    existing.storedChunkCount += 1;

    if (row.product_name) {
      existing.storedProductNames.add(String(row.product_name).trim());
    }

    index.set(sourceFilename, existing);
  }

  return index;
}

function selectStorageFiles(storageFiles, requestedFiles = []) {
  if (!requestedFiles.length) {
    return storageFiles;
  }

  const requested = new Set(requestedFiles);
  return storageFiles.filter((file) => requested.has(file.name));
}

async function deleteExistingChunksForFile(clientId, fileName) {
  const { error } = await supabase
    .from('documents')
    .delete()
    .eq('client_id', clientId)
    .eq('source_filename', fileName);

  if (error) {
    throw error;
  }
}

async function saveChunks({ clientId, fileName, productName, chunks }) {
  for (let i = 0; i < chunks.length; i++) {
    const content = chunks[i];
    const embedding = await getEmbedding(content);

    const { error } = await supabase.from('documents').insert({
      client_id: clientId,
      source_filename: fileName,
      product_name: productName,
      content: `[SOURCE: ${fileName}] ${content}`,
      embedding
    });

    if (error) {
      throw error;
    }

    console.log(`Saved chunk ${i + 1}/${chunks.length} for ${fileName} (${productName})`);
  }
}

async function reconcileFiles({ bucketName, clientId, files, useOcrFallback }) {
  console.log(`Reconciling storage bucket "${bucketName}" against public.documents for client "${clientId}"...`);

  const storageFiles = await listStorageFiles(bucketName);
  const selectedFiles = selectStorageFiles(storageFiles, files);
  const storedRows = await listDocumentRowsForClient(clientId);
  const storedIndex = buildStoredFileIndex(storedRows);

  if (!selectedFiles.length) {
    console.log('No matching PDF files found for reconciliation.');
    return;
  }

  const availableFileNames = new Set(storageFiles.map((file) => file.name));
  const missingSelections = files.filter((fileName) => !availableFileNames.has(fileName));
  if (missingSelections.length) {
    console.warn('Requested files not found in storage:', missingSelections.join(', '));
  }

  const reportRows = [];

  for (const file of selectedFiles) {
    console.log(`Inspecting ${file.name}...`);
    const buffer = await downloadFile(bucketName, file.name);
    const extraction = await extractTextWithFallback(buffer, file.name, { useOcrFallback });
    const chunkCount = extraction.text ? chunkText(extraction.text).length : 0;
    const productName = deriveProductNameFromFileName(file.name);
    const existing = storedIndex.get(file.name) || {
      storedChunkCount: 0,
      storedProductNames: new Set()
    };

    reportRows.push({
      filename: file.name,
      extracted_text: `${extraction.extractedText} (${extraction.extractionMethod})`,
      chunk_count: chunkCount,
      canonical_product_name: productName,
      ai_ready: existing.storedChunkCount > 0 ? 'yes' : 'no',
      stored_chunks: existing.storedChunkCount,
      stored_product_name: Array.from(existing.storedProductNames).join(' | ') || ''
    });
  }

  console.table(reportRows);

  const aiReadyCount = reportRows.filter((row) => row.ai_ready === 'yes').length;
  console.log(`Uploaded files inspected: ${reportRows.length}`);
  console.log(`AI-ready files: ${aiReadyCount}`);
  console.log(`Needs attention: ${reportRows.length - aiReadyCount}`);
}

async function ingestFiles({ bucketName, clientId, files, replaceExisting, useOcrFallback }) {
  console.log(`Ingesting files from bucket "${bucketName}" for client "${clientId}"...`);

  const storageFiles = await listStorageFiles(bucketName);
  const selectedFiles = selectStorageFiles(storageFiles, files);

  if (!selectedFiles.length) {
    console.log('No matching PDF files found to ingest.');
    return;
  }

  const availableFileNames = new Set(storageFiles.map((file) => file.name));
  const missingSelections = files.filter((fileName) => !availableFileNames.has(fileName));
  if (missingSelections.length) {
    console.warn('Requested files not found in storage:', missingSelections.join(', '));
  }

  for (const file of selectedFiles) {
    console.log(`Processing: ${file.name}`);
    const buffer = await downloadFile(bucketName, file.name);
    const extraction = await extractTextWithFallback(buffer, file.name, { useOcrFallback });

    if (extraction.extractedText !== 'success') {
      console.log(`Skipping ${file.name} because extraction failed (${extraction.extractionMethod}).`);
      continue;
    }

    const chunks = chunkText(extraction.text);
    console.log(`Created ${chunks.length} chunks for ${file.name}`);

    if (!chunks.length) {
      console.log(`Skipping ${file.name} because extraction succeeded but 0 usable chunks were created.`);
      continue;
    }

    const productName = deriveProductNameFromFileName(file.name);
    console.log(`Canonical product name: ${productName}`);

    if (replaceExisting) {
      await deleteExistingChunksForFile(clientId, file.name);
      console.log(`Removed existing chunks for ${file.name} before re-ingestion.`);
    }

    await saveChunks({
      clientId,
      fileName: file.name,
      productName,
      chunks
    });
  }
}

async function run() {
  try {
    console.log(`Mode: ${runtime.mode}`);
    console.log(`Client ID: ${runtime.clientId}`);
    console.log(`Bucket: ${runtime.bucketName}`);

    if (runtime.mode === 'reconcile') {
      await reconcileFiles({
        bucketName: runtime.bucketName,
        clientId: runtime.clientId,
        files: runtime.files,
        useOcrFallback: runtime.useOcrFallback
      });
      return;
    }

    await ingestFiles({
      bucketName: runtime.bucketName,
      clientId: runtime.clientId,
      files: runtime.files,
      replaceExisting: runtime.replaceExisting,
      useOcrFallback: runtime.useOcrFallback
    });

    console.log('Done. Selected documents processed.');
  } catch (err) {
    console.error('Ingestion failed:', err);
    process.exit(1);
  }
}

run();
