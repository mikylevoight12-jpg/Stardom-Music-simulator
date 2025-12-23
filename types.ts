
export enum Genre {
  POP = "Pop",
  HIPHOP = "Hip-Hop",
  ROCK = "Rock",
  RNB = "R&B",
  ELECTRONIC = "Electronic",
  COUNTRY = "Country",
  JAZZ = "Jazz",
  INDIE = "Indie"
}

export type SocialPlatform = 'Instagram' | 'TikTok' | 'YouTube' | 'Spotify' | 'AppleMusic';

export interface SocialPost {
  id: string;
  platform: SocialPlatform;
  content: string;
  type: string;
  likes: number;
  comments: { user: string; text: string }[];
  timestamp: Date;
  impact: { fans: number; fame: number; streamsBoost?: number };
  // YouTube specific fields
  videoTitle?: string;
  videoDescription?: string;
  thumbnailUrl?: string;
}

export interface SponsoredOffer {
  id: string;
  brand: string;
  payout: number;
  requirement: string;
  charismaPenalty: number;
}

export interface Label {
  id: string;
  name: string;
  prestige: number;
  fameRequirement: number;
  signingBonus: number;
  revenueSplit: number;
  description: string;
  logo: string;
}

export interface Song {
  id: string;
  title: string;
  genre: Genre;
  quality: number; // 0-100
  releaseDate: Date;
  streams: number;
  revenue: number;
  lyrics?: string;
  chartPosition?: number;
  featuredArtist?: string;
  isMusicVideo?: boolean;
}

export interface Award {
  id: string;
  year: number;
  category: string;
  reason: string;
}

export interface GameState {
  player: {
    name: string;
    stageName: string;
    genre: Genre;
    fans: number;
    fame: number;
    money: number;
    followers: Record<SocialPlatform, number>;
    skills: {
      songwriting: number;
      vocals: number;
      production: number;
      charisma: number;
    };
    labelId: string | null;
  };
  currentDate: Date;
  currentWeek: number; // 1-4
  songs: Song[];
  unreleasedSongs: Song[];
  awards: Award[];
  charts: any[];
  news: string[];
  socialPosts: SocialPost[];
  trendingTopics: string[];
  activeOffers: SponsoredOffer[];
  history: {
    month: number;
    fans: number;
  }[];
}
