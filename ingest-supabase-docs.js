import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import OpenAI from 'openai';
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

const BUCKET_NAME = 'documents';
const CLIENT_ID = 'mobilelink';

function chunkText(text, chunkSize = 1200, overlap = 200) {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  const chunks = [];

  let start = 0;
  while (start < cleaned.length) {
    const end = Math.min(start + chunkSize, cleaned.length);
    const chunk = cleaned.slice(start, end).trim();

    if (chunk.length > 100) {
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

async function listFiles() {
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
    .list('', { limit: 100 });

  if (error) {
    throw error;
  }

  return (data || []).filter(file => file.name.toLowerCase().endsWith('.pdf'));
}

async function downloadFile(fileName) {
  const { data, error } = await supabase.storage
    .from(BUCKET_NAME)
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

async function saveChunks(fileName, chunks) {
  for (let i = 0; i < chunks.length; i++) {
    const content = chunks[i];
    const embedding = await getEmbedding(content);

    const { error } = await supabase.from('documents').insert({
      client_id: CLIENT_ID,
      content: `[SOURCE: ${fileName}] ${content}`,
      embedding,
    });

    if (error) {
      throw error;
    }

    console.log(`Saved chunk ${i + 1}/${chunks.length} for ${fileName}`);
  }
}

async function run() {
  try {
    console.log('Listing files from Supabase bucket...');
    const files = await listFiles();

    if (!files.length) {
      console.log('No PDF files found in bucket.');
      return;
    }

    console.log(`Found ${files.length} PDF files.`);

    for (const file of files) {
      console.log(`Processing: ${file.name}`);
      const buffer = await downloadFile(file.name);
      const text = await extractPdfText(buffer);

      if (!text || text.trim().length < 50) {
        console.log(`Skipping ${file.name} because no usable text was extracted.`);
        continue;
      }

      const chunks = chunkText(text);
      console.log(`Created ${chunks.length} chunks for ${file.name}`);

      await saveChunks(file.name, chunks);
    }

    console.log('Done. All documents processed.');
  } catch (err) {
    console.error('Ingestion failed:', err);
    process.exit(1);
  }
}

run();