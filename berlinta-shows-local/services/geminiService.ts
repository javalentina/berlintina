import { GoogleGenAI, Type } from "@google/genai";
import { CustomerBrief } from "../types";

const API_KEY = process.env.API_KEY;

export class GeminiService {
  private ai: GoogleGenAI;

  constructor() {
    this.ai = new GoogleGenAI({ apiKey: API_KEY || 'dummy-key' });
  }

  async extractBrief(userInput: string): Promise<CustomerBrief> {
    if (!API_KEY || process.env.MOCK_MODE === 'true') {
      return {
        eventType: "Private Event",
        desiredCategories: ["CLASSICAL"],
        extraNotes: userInput
      };
    }

    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: `Extract the following details from this event query: "${userInput}". 
        Return JSON format with these keys: eventType, eventDate (ISO), locationCity, audienceCount (number), desiredCategories (CLASSICAL, BAND, ACROBATICS, DANCE), desiredVibes, durationMinutes, budgetMax, languagePreference (de, en, both), extraNotes.`,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              eventType: { type: Type.STRING },
              eventDate: { type: Type.STRING },
              locationCity: { type: Type.STRING },
              audienceCount: { type: Type.NUMBER },
              desiredCategories: { type: Type.ARRAY, items: { type: Type.STRING } },
              desiredVibes: { type: Type.ARRAY, items: { type: Type.STRING } },
              durationMinutes: { type: Type.NUMBER },
              budgetMax: { type: Type.NUMBER },
              languagePreference: { type: Type.STRING },
              extraNotes: { type: Type.STRING }
            }
          }
        }
      });

      return JSON.parse(response.text ?? '{}');
    } catch (error) {
      console.error("Gemini Extraction Error:", error);
      return { extraNotes: userInput };
    }
  }

  async answerShowQuestion(question: string, showFacts: string): Promise<string> {
    if (!API_KEY || process.env.MOCK_MODE === 'true') {
      return "Das ist eine gute Frage! Basierend auf den Informationen der Show scheint dies möglich zu sein. Für Details kontaktieren Sie bitte den Künstler.";
    }

    try {
      const response = await this.ai.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: `You are a helpful event concierge. Answer this question: "${question}" about a show with these facts: "${showFacts}". 
        Be warm and professional. If the answer is not in the facts, politely say you don't know and suggest contacting the artist.`,
      });
      return response.text ?? "Entschuldigung, ich konnte keine Antwort finden.";
    } catch (error) {
      return "Es gab ein Problem bei der Beantwortung Ihrer Frage.";
    }
  }
}

export const geminiService = new GeminiService();
