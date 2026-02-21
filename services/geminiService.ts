import { GoogleGenAI, Type } from "@google/genai";
import { GameWisdom } from "../types";

export const getSenseiWisdom = async (causeOfDeath: string): Promise<GameWisdom> => {
  if (!process.env.API_KEY) {
    return {
      message: "The path of the ninja is fraught with peril. Try again.",
      author: "Unknown Master"
    };
  }

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
    
    // We want a quick, short response. Flash is perfect.
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `The player died in a ninja platformer game by ${causeOfDeath}. 
      Generate a short, mystical, slightly humorous "Sensei's Wisdom" or Haiku about failure and resilience.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            message: { type: Type.STRING },
            author: { type: Type.STRING },
          },
          required: ["message", "author"],
        },
        // Small thinking budget if we wanted reasoning, but not needed for simple creative writing.
        thinkingConfig: { thinkingBudget: 0 } 
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response text");
    
    return JSON.parse(text) as GameWisdom;
  } catch (error) {
    console.error("Failed to get wisdom:", error);
    return {
      message: "Silence is the loudest cry of failure. Rise again.",
      author: "The Void"
    };
  }
};