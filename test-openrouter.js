/**
 * OpenRouter API Test-Skript
 */

import { OpenAI } from 'openai';
import dotenv from 'dotenv';

// Lade Umgebungsvariablen aus .env
dotenv.config();

console.log('Starte OpenRouter API-Test...');

// Überprüfe, ob der API-Schlüssel vorhanden ist
const apiKey = process.env.ANTHROPIC_API_KEY;
console.log(`ANTHROPIC_API_KEY vorhanden: ${Boolean(apiKey)}`);
console.log(`Verwende API-Schlüssel: ${apiKey ? apiKey.substring(0, 5) + '...' + apiKey.substring(apiKey.length - 4) : 'nicht gefunden'}`);

// Initialisiere OpenAI-Client mit OpenRouter-Konfiguration
const client = new OpenAI({
  apiKey: apiKey,
  baseURL: 'https://openrouter.ai/api/v1',
  defaultHeaders: {
    'HTTP-Referer': 'https://task-master-ai.app',
    'X-Title': 'Task Master AI'
  }
});

// Analysiere die Client-Objektstruktur
function analyzeObject(obj, name = 'client', maxDepth = 2, currentDepth = 0) {
  if (currentDepth > maxDepth) return '[Max Tiefe erreicht]';
  if (obj === null) return 'null';
  if (obj === undefined) return 'undefined';
  
  const type = typeof obj;
  if (type !== 'object') return type;
  
  if (Array.isArray(obj)) return `Array[${obj.length}]`;
  
  const properties = Object.getOwnPropertyNames(obj);
  const result = {};
  
  for (const prop of properties) {
    if (prop.startsWith('_')) continue; // Private Eigenschaften überspringen
    try {
      const value = obj[prop];
      result[prop] = analyzeObject(value, `${name}.${prop}`, maxDepth, currentDepth + 1);
    } catch (error) {
      result[prop] = `[Error: ${error.message}]`;
    }
  }
  
  return result;
}

async function runTest() {
  try {
    // Analysiere Client-Struktur
    console.log('\nClient-Objektstruktur:');
    const clientStructure = analyzeObject(client);
    console.log(JSON.stringify(clientStructure, null, 2));
    
    // Überprüfe spezifische Pfade
    console.log('\nÜberprüfe wichtige Pfade:');
    console.log('client.chat existiert:', !!client.chat);
    console.log('client.chat.completions existiert:', !!(client.chat && client.chat.completions));
    console.log('client.chat.completions.create existiert:', !!(client.chat && client.chat.completions && client.chat.completions.create));
    
    console.log('\nSende Testanfrage an OpenRouter...');
    
    // Einfacher Text-Test
    const response = await client.chat.completions.create({
      model: 'anthropic/claude-3.7-sonnet',
      messages: [{ role: 'user', content: 'Sag einfach "Hallo Welt".' }],
      max_tokens: 50,
      temperature: 0.5,
      stream: false
    });
    
    console.log('Antwort erhalten:');
    console.log('- Vollständige Antwort:', JSON.stringify(response));
    console.log('- Antworttext:', response.choices[0].message.content);
    
    // Debug: Streaming-Test
    console.log('\nDebug: Streaming-Test starten...');
    const stream = await client.chat.completions.create({
      model: 'anthropic/claude-3.7-sonnet',
      messages: [{ role: 'user', content: 'Zähle von 1 bis 3.' }],
      max_tokens: 50,
      temperature: 0.5,
      stream: true
    });
    
    console.log('Stream-Objekt erhalten, erste Chunks verarbeiten:');
    let count = 0;
    for await (const chunk of stream) {
      console.log('Chunk erhalten:', JSON.stringify(chunk));
      count++;
      if (count >= 3) break; // Nur die ersten 3 Chunks ausgeben
    }
    
    console.log('API-Test erfolgreich!');
  } catch (error) {
    console.error('Fehler beim API-Test:', error);
    console.error('Fehlerdetails:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    process.exit(1);
  }
}

runTest(); 