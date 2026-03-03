import { CustomerBrief } from '../types';
import * as apiClient from './apiClient';

export interface AIService {
  extractBrief(userInput: string): Promise<CustomerBrief>;
  answerShowQuestion(question: string, showFacts: string): Promise<string>;
}

/**
 * All AI calls go through the backend (server/) so API keys stay on the server.
 * Run the backend with: cd server && npm install && npm run dev
 */
const aiService: AIService = {
  extractBrief: apiClient.extractBrief,
  answerShowQuestion: apiClient.answerShowQuestion,
};

export { aiService };
