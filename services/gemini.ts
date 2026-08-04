import { GoogleGenAI } from "@google/genai";
import { Coordinates } from "../types";

const PLACEHOLDER_VALUES = ['', 'your_gemini_api_key_here', 'PLACEHOLDER_API_KEY'];

function getApiKey(): string {
  const key = import.meta.env.VITE_GEMINI_API_KEY || '';
  if (PLACEHOLDER_VALUES.includes(key)) {
    throw new Error(
      'VITE_GEMINI_API_KEY is not configured. ' +
      'Set it in .env.local — get one at https://aistudio.google.com/apikey'
    );
  }
  return key;
}

// Lazily initialized — the globe renders without a key, errors surface on first API call
let _ai: GoogleGenAI | null = null;
function getAI(): GoogleGenAI {
  if (!_ai) _ai = new GoogleGenAI({ apiKey: getApiKey() });
  return _ai;
}

// Helper to determine if a string is JSON
const cleanJSON = (text: string) => {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start === -1 || end === -1) return text;
    return text.substring(start, end + 1);
}

export const resolveLocationFromText = async (query: string): Promise<{ lat: number, lon: number, name: string } | null> => {
    try {
        const systemInstruction = `
            You are a navigation system. Extract the geographical location from the user's query.
            Return a JSON object with: 
            - "lat" (number)
            - "lon" (number)
            - "name" (string, the city/place name)
            
            If the query does not contain a specific location (e.g. "Hello", "Why is the sky blue?"), return null.
            Do not provide explanations. Only JSON.
        `;

        const response = await getAI().models.generateContent({
            model: 'gemini-2.5-flash',
            contents: query,
            config: {
                systemInstruction,
                temperature: 0.1, // Low temperature for factual coordinate extraction
            }
        });

        const text = response.text || "";
        if (text === "null" || !text.includes("{")) return null;

        const data = JSON.parse(cleanJSON(text));
        
        if (data && typeof data.lat === 'number' && typeof data.lon === 'number') {
            return data;
        }
        return null;

    } catch (e) {
        console.warn("Location resolution failed", e);
        return null;
    }
}

export const generateLocationInsight = async (
  coords: Coordinates, 
  userPrompt?: string
): Promise<string> => {
  try {
    const { lat, lon } = coords;
    
    // Determine a rough location description for context
    const latDir = lat >= 0 ? "North" : "South";
    const lonDir = lon >= 0 ? "East" : "West";
    const formattedLat = `${Math.abs(lat).toFixed(1)}° ${latDir}`;
    const formattedLon = `${Math.abs(lon).toFixed(1)}° ${lonDir}`;

    const systemInstruction = `
      You are an expert geographer and planetary scientist. 
      The user is looking at a 3D globe centered at coordinates: ${formattedLat}, ${formattedLon}.
      
      Your goal is to provide interesting, educational, and concise insights about this location.
      If the coordinates are in the ocean, talk about the ocean, currents, depths, or nearby islands.
      If on land, talk about the country, region, geography, climate, or cultural significance.
      
      Keep responses concise (under 150 words) unless asked otherwise. 
      Format loosely with Markdown.
    `;

    const prompt = userPrompt || `Tell me what is interesting about the area visible at ${formattedLat}, ${formattedLon}.`;

    const response = await getAI().models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        systemInstruction,
        temperature: 0.7,
      }
    });

    return response.text || "No insight available for this location.";
  } catch (error: any) {
    console.error("Gemini API Error Raw:", error);
    
    // Robust Error Parsing for various SDK error shapes
    let status = error.status;
    let code = error.code;
    let message = error.message || '';
    
    // Check nested error object (Common in Google APIs)
    if (error.error) {
        status = error.error.status || status;
        code = error.error.code || code;
        message = error.error.message || message;
    }

    // Check for Quota Exceeded (429) or Resource Exhausted
    if (
        status === 429 || 
        code === 429 || 
        status === 'RESOURCE_EXHAUSTED' ||
        message.includes('429') || 
        message.includes('quota') ||
        message.includes('RESOURCE_EXHAUSTED')
    ) {
        throw new Error("SYSTEM ALERT: API Quota Exceeded. The planetary database is temporarily unavailable. Please check your plan or try again later.");
    }
    
    throw new Error("Failed to retrieve insights from the planetary database.");
  }
};

export const generateLocationImage = async (
    coords: Coordinates,
    description: string
): Promise<string | null> => {
    try {
        const prompt = `
            Create a high-tech, futuristic architectural wireframe or neon-schematic illustration of: ${description}.
            Style: Sci-fi HUD, dark background, cyan and amber neon lines, minimalist, vector art style.
            Perspective: Isometric or top-down drone view.
            No text overlay.
        `;

        const response = await getAI().models.generateContent({
            model: 'gemini-2.5-flash-image',
            contents: {
                parts: [{ text: prompt }]
            },
            config: {}
        });
        
        if (response.candidates?.[0]?.content?.parts) {
            for (const part of response.candidates[0].content.parts) {
                if (part.inlineData) {
                    return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                }
            }
        }
        return null;
    } catch (error) {
        // Suppress image errors to not block the main UI, but log for debug
        console.warn("Gemini Image Gen Error:", error);
        return null;
    }
}