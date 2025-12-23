
import { GoogleGenAI, Type } from "@google/genai";
import { Genre, SocialPlatform, GameState, SponsoredOffer } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateSongLyrics = async (title: string, genre: Genre) => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Write a snippet of hit ${genre} lyrics for a song titled "${title}". Keep it catchy and under 40 words.`,
    });
    return response.text || "The rhythm moves me, the lyrics flow free...";
  } catch (error) {
    console.error("AI Error:", error);
    return "The rhythm moves me, the lyrics flow free...";
  }
};

export const generateTrendingTopics = async (): Promise<string[]> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Generate 5 current trending social media hashtags/topics in the music and pop culture world. Return as a JSON array of strings. Examples: #AIFilters, #RetroRevival, #WorldTour2025.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: { type: Type.STRING }
        }
      }
    });
    const text = response.text?.trim();
    return text ? JSON.parse(text) : ["#MusicVibes", "#Stardom", "#NewArtist", "#ViralBeat", "#StudioLife"];
  } catch (error) {
    return ["#MusicVibes", "#Stardom", "#NewArtist", "#ViralBeat", "#StudioLife"];
  }
};

export const generateSponsoredOffer = async (fame: number): Promise<SponsoredOffer> => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Generate a brand sponsorship offer for a music artist with ${fame} fame. 
      Return JSON with fields: 
      - brand (name of brand)
      - payout (number, higher for more fame)
      - requirement (short instruction on what to post)
      - charismaPenalty (1-10, based on how 'sell-out' it is)`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            brand: { type: Type.STRING },
            payout: { type: Type.NUMBER },
            requirement: { type: Type.STRING },
            charismaPenalty: { type: Type.NUMBER }
          },
          required: ["brand", "payout", "requirement", "charismaPenalty"]
        }
      }
    });
    const text = response.text?.trim();
    return text ? { ...JSON.parse(text), id: Math.random().toString(36).substr(2, 9) } : {
      id: "fallback-offer",
      brand: "GlowWater",
      payout: 5000,
      requirement: "Post a photo drinking GlowWater with the tag #StayGlowing",
      charismaPenalty: 3
    };
  } catch (error) {
    return {
      id: "fallback-offer",
      brand: "GlowWater",
      payout: 5000,
      requirement: "Post a photo drinking GlowWater with the tag #StayGlowing",
      charismaPenalty: 3
    };
  }
};

export const generateIndustryNews = async (playerName: string, recentEvent: string) => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Write a short music industry news headline (max 15 words) about the artist "${playerName}" who just ${recentEvent}. Make it sound like Rolling Stone or Pitchfork.`,
    });
    return response.text || `${playerName} is making waves in the industry!`;
  } catch (error) {
    return `${playerName} is making waves in the industry!`;
  }
};

export const generateSocialEngagement = async (artistName: string, postContent: string, platform: SocialPlatform) => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `Generate 3 short ${platform} comments (max 10 words each) from fans reacting to this post by artist "${artistName}": "${postContent}". Use platform-appropriate slang and emojis.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              user: { type: Type.STRING },
              text: { type: Type.STRING }
            },
            required: ["user", "text"]
          }
        }
      }
    });
    const text = response.text?.trim();
    return text ? JSON.parse(text) : [];
  } catch (error) {
    return [
      { user: "fan_zone", text: "We love you! ❤️" },
      { user: "music_critic", text: "Interesting choice..." },
      { user: "stan_account", text: "STREAM THE NEW SINGLE!" }
    ];
  }
};

export const calculateSongImpact = async (songTitle: string, quality: number, currentFans: number, genre: Genre) => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: `Based on a ${genre} song with ${quality}/100 quality released by an artist with ${currentFans} fans, calculate the numeric fan gain and a 1-sentence reception summary.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            fanGain: { type: Type.INTEGER, description: "Number of new fans gained" },
            reception: { type: Type.STRING, description: "One sentence summary of how the song was received" }
          },
          required: ["fanGain", "reception"]
        }
      }
    });
    
    const text = response.text?.trim();
    if (!text) throw new Error("No content returned from AI");
    return JSON.parse(text);
  } catch (error) {
    const fallbackGain = Math.floor((quality / 100) * (currentFans * 0.2) + 500);
    return { fanGain: fallbackGain, reception: "The track is getting steady rotation on indie playlists." };
  }
};

export const generateThumbnail = async (title: string, artistName: string, genre: Genre) => {
  try {
    const prompt = `A professional high-quality YouTube thumbnail for a ${genre} music video titled "${title}" by the artist "${artistName}". Vibrant colors, eye-catching typography, cinematic atmosphere.`;
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        imageConfig: {
          aspectRatio: "16:9"
        }
      }
    });

    for (const part of response.candidates[0].content.parts) {
      if (part.inlineData) {
        return `data:image/png;base64,${part.inlineData.data}`;
      }
    }
    return null;
  } catch (error) {
    console.error("Image Generation Error:", error);
    return null;
  }
};

export const generateFanInteraction = async (artistName: string, postContent: string) => {
  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: `An artist named "${artistName}" just posted: "${postContent}". Generate a simulated private fan message (DM) and 2 response options with different effects.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            username: { type: Type.STRING },
            message: { type: Type.STRING },
            options: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  label: { type: Type.STRING, description: "Text for the response button" },
                  result: { type: Type.STRING, description: "Narrative outcome" },
                  bonusType: { type: Type.STRING, enum: ["fans", "charisma", "fame", "money"] },
                  bonusValue: { type: Type.INTEGER }
                },
                required: ["label", "result", "bonusType", "bonusValue"]
              }
            }
          },
          required: ["username", "message", "options"]
        }
      }
    });
    const text = response.text?.trim();
    return text ? JSON.parse(text) : null;
  } catch (error) {
    return null;
  }
};

export const generateCareerSummary = async (player: GameState['player'], songCount: number, awardCount: number) => {
  try {
    const prompt = `Write a 1-sentence epic recap of this artist's career for a load screen. 
    Stage Name: ${player.stageName}
    Genre: ${player.genre}
    Fans: ${player.fans.toLocaleString()}
    Fame Score: ${player.fame}
    Songs Released: ${songCount}
    Awards: ${awardCount}
    
    Make it sound like a prestigious Hall of Fame induction. Max 25 words.`;
    
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text?.trim() || "Continuing the journey of a rising star.";
  } catch (error) {
    return "The legacy continues where you last left off.";
  }
};
