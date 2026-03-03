import OpenAI from 'openai';
import { CustomerBrief } from '../types';

const API_KEY = process.env.OPENAI_API_KEY;

const openai = API_KEY ? new OpenAI({ apiKey: API_KEY, dangerouslyAllowBrowser: true }) : null;

const BRIEF_JSON_SCHEMA = `Return a JSON object with these keys only: eventType (string), eventDate (ISO string or null), locationCity (string or null), audienceCount (number or null), desiredCategories (array of: CLASSICAL, BAND, ACROBATICS, DANCE), desiredVibes (array of strings), durationMinutes (number or null), budgetMax (number or null), languagePreference (de, en, or both), extraNotes (string).`;

export class OpenAIService {
  async extractBrief(userInput: string): Promise<CustomerBrief> {
    if (!openai || process.env.MOCK_MODE === 'true') {
      return {
        eventType: 'Private Event',
        desiredCategories: ['CLASSICAL'],
        extraNotes: userInput,
      };
    }

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'user',
            content: `Extract the following details from this event query: "${userInput}". ${BRIEF_JSON_SCHEMA}`,
          },
        ],
        response_format: { type: 'json_object' },
      });

      const text = completion.choices[0]?.message?.content ?? '{}';
      return JSON.parse(text) as CustomerBrief;
    } catch (error) {
      console.error('OpenAI Extraction Error:', error);
      return { extraNotes: userInput };
    }
  }

  async answerShowQuestion(question: string, showFacts: string): Promise<string> {
    if (!openai || process.env.MOCK_MODE === 'true') {
      return 'Das ist eine gute Frage! Basierend auf den Informationen der Show scheint dies möglich zu sein. Für Details kontaktieren Sie bitte den Künstler.';
    }

    try {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content:
              'You are a helpful event concierge. Be warm and professional. If the answer is not in the facts, politely say you do not know and suggest contacting the artist.',
          },
          {
            role: 'user',
            content: `Question: "${question}"\n\nShow facts: "${showFacts}"`,
          },
        ],
      });

      const text = completion.choices[0]?.message?.content?.trim();
      return text ?? 'Entschuldigung, ich konnte keine Antwort finden.';
    } catch (error) {
      console.error('OpenAI Answer Error:', error);
      return 'Es gab ein Problem bei der Beantwortung Ihrer Frage.';
    }
  }
}

export const openaiService = new OpenAIService();
