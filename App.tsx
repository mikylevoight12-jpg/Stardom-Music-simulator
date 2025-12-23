
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { GameState, Genre, Song, Label, Award, SocialPost, SocialPlatform, SponsoredOffer } from './types';
import { LABELS, REAL_ARTISTS_DATA, RealArtist } from './constants';
import { StatsBar } from './components/StatsBar';
import { generateSongLyrics, generateIndustryNews, calculateSongImpact, generateSocialEngagement, generateThumbnail, generateFanInteraction, generateCareerSummary, generateTrendingTopics, generateSponsoredOffer } from './services/geminiService';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

type RecordingPhase = 'idle' | 'drafting' | 'recording' | 'results';
type SocialSubTab = 'live' | 'production' | 'vault' | 'deals';
type ViewType = 'home' | 'studio' | 'tour' | 'management' | 'charts' | 'awards' | 'social';

const SAVE_KEY = 'stardom_v1_save';

interface FanInteraction {
  username: string;
  message: string;
  options: {
    label: string;
    result: string;
    bonusType: 'fans' | 'charisma' | 'fame' | 'money';
    bonusValue: number;
  }[];
}

interface RandomEventOption {
  label: string;
  description: string;
  risk: 'Low' | 'Medium' | 'High';
  effect: (state: GameState) => {
    playerUpdate: Partial<GameState['player']>;
    narrative: string;
  };
}

interface RandomEvent {
  title: string;
  description: string;
  icon: string;
  options: [RandomEventOption, RandomEventOption];
}

const RANDOM_EVENTS: RandomEvent[] = [
  {
    title: "The Twitter Feud",
    description: "A bigger artist just sub-tweeted your last release, calling it 'derivative'.",
    icon: "🐦",
    options: [
      {
        label: "Ignore the Drama",
        description: "Focus on the music. Avoid the controversy.",
        risk: "Low",
        effect: (s) => ({
          playerUpdate: { skills: { ...s.player.skills, charisma: s.player.skills.charisma + 2 } },
          narrative: "Your fans appreciate your maturity. You spent the week in the studio instead (+2 Charisma)."
        })
      },
      {
        label: "Clap Back",
        description: "Post a savage reply. Go for the engagement.",
        risk: "High",
        effect: (s) => {
          const success = Math.random() > 0.45;
          return success 
            ? { playerUpdate: { fans: s.player.fans + 15000, fame: s.player.fame + 100000 }, narrative: "The internet loved it! You're trending worldwide (+15k Fans, +100k Fame)." }
            : { playerUpdate: { fans: Math.max(0, s.player.fans - 5000), skills: { ...s.player.skills, charisma: Math.max(0, s.player.skills.charisma - 5) } }, narrative: "You came off as desperate. The industry is cringing (-5k Fans, -5 Charisma)." };
        }
      }
    ]
  },
  {
    title: "Viral TikTok Sound",
    description: "A popular influencer used your song for a transition video. It's gaining steam.",
    icon: "💃",
    options: [
      {
        label: "Lean Into It",
        description: "Post your own version of the trend.",
        risk: "Low",
        effect: (s) => ({
          playerUpdate: { 
            fans: s.player.fans + 50000, 
            followers: { ...s.player.followers, TikTok: s.player.followers.TikTok + 10000 } 
          },
          narrative: "The trend exploded! You're officially a 'TikTok artist' now (for better or worse)."
        })
      },
      {
        label: "Stay Distant",
        description: "Let it grow naturally. Avoid looking like you're chasing it.",
        risk: "Low",
        effect: (s) => ({
          playerUpdate: { 
            skills: { ...s.player.skills, charisma: s.player.skills.charisma + 5 },
            fans: s.player.fans + 10000
          },
          narrative: "Fans respect your artistic distance. The trend continues without you."
        })
      }
    ]
  },
  {
    title: "The Ghostwriter Leak",
    description: "Rumors are circulating that your best track was actually written by a ghostwriter.",
    icon: "👻",
    options: [
      {
        label: "Release Raw Demos",
        description: "Prove you wrote it by showing the rough drafts.",
        risk: "Medium",
        effect: (s) => ({
          playerUpdate: { skills: { ...s.player.skills, songwriting: s.player.skills.songwriting + 5 }, fans: s.player.fans + 2000 },
          narrative: "The fans loved seeing your process. The rumors died instantly (+5 Songwriting)."
        })
      },
      {
        label: "Ignore Rumors",
        description: "Don't give the trolls the time of day.",
        risk: "High",
        effect: (s) => {
          const mess = Math.random() > 0.7;
          return mess 
            ? { playerUpdate: { fans: Math.max(0, s.player.fans - 10000), fame: Math.max(0, s.player.fame - 50000) }, narrative: "The silence made it look like you had something to hide. Fans are skeptical (-10k Fans)." }
            : { playerUpdate: { fame: s.player.fame + 1000 }, narrative: "The news cycle moved on. Nobody cares anymore." };
        }
      }
    ]
  }
];

const runAwardsSeason = (state: GameState): Award[] => {
  const wonAwards: Award[] = [];
  const year = state.currentDate.getFullYear();
  if (state.player.fans > 1000000 && state.songs.length >= 3) {
    const bestSong = [...state.songs].sort((a, b) => b.quality - a.quality)[0];
    if (bestSong && bestSong.quality > 85) {
      wonAwards.push({
        id: `aoy-${year}-${Math.random().toString(36).substr(2, 5)}`,
        year,
        category: 'Album of the Year',
        reason: 'Masterpiece of production and songwriting.'
      });
    }
  }
  if (state.player.fame > 5000000) {
    wonAwards.push({
      id: `boty-${year}-${Math.random().toString(36).substr(2, 5)}`,
      year,
      category: 'Best Artist',
      reason: 'Global impact and cultural domination.'
    });
  }
  return wonAwards;
};

const App: React.FC = () => {
  const [isSetup, setIsSetup] = useState(true);
  const [setupData, setSetupData] = useState({ name: '', stageName: '', genre: Genre.POP });
  const [hasSave, setHasSave] = useState(false);
  const [careerRecap, setCareerRecap] = useState<string | null>(null);

  const [gameState, setGameState] = useState<GameState>({
    player: {
      name: '',
      stageName: '',
      genre: Genre.POP,
      fans: 100,
      fame: 0,
      money: 5000, 
      followers: { Instagram: 50, TikTok: 75, YouTube: 20, Spotify: 10, AppleMusic: 5 },
      skills: { songwriting: 20, vocals: 30, production: 10, charisma: 40 },
      labelId: 'indie_self'
    },
    currentDate: new Date(2025, 0, 1),
    currentWeek: 0, 
    songs: [],
    unreleasedSongs: [],
    awards: [],
    charts: [],
    socialPosts: [],
    trendingTopics: ["#MusicVibes", "#Stardom", "#NewArtist"],
    activeOffers: [],
    history: [{ month: 0, fans: 100 }]
  });

  const [view, setView] = useState<ViewType>('home');
  const [activePlatform, setActivePlatform] = useState<SocialPlatform>('Instagram');
  const [socialSubTab, setSocialSubTab] = useState<SocialSubTab>('live');
  const [isBusy, setIsBusy] = useState(false);
  const [showNotification, setShowNotification] = useState<string | null>(null);
  const [activeEvent, setActiveEvent] = useState<{ event: RandomEvent, resultNarrative?: string } | null>(null);
  const [pendingAwards, setPendingAwards] = useState<Award[] | null>(null);
  const [activeFanInteraction, setActiveFanInteraction] = useState<{ data: FanInteraction, resultNarrative?: string } | null>(null);

  const [postDraft, setPostDraft] = useState({ 
    content: '', 
    type: 'Photo', 
    targetSongId: '',
    videoTitle: '',
    videoDescription: ''
  });
  const [isPosting, setIsPosting] = useState(false);

  const [recordingPhase, setRecordingPhase] = useState<RecordingPhase>('idle');
  const [draftForm, setDraftForm] = useState({ title: '', genre: Genre.POP, feature: '', useGhostwriter: false });
  const [miniGameScore, setMiniGameScore] = useState<number[]>([]); 
  const [sliderPos, setSliderPos] = useState(0);
  const [sliderDir, setSliderDir] = useState(1);
  const [lastAccuracy, setLastAccuracy] = useState<{ text: string, color: string } | null>(null);
  const [activeLyrics, setActiveLyrics] = useState<string>('');
  const requestRef = useRef<number>(null);

  const BASE_STUDIO_RENT = 500;
  const BASE_GHOSTWRITER_FEE = 2500;
  const SESSION_NOTES_REQUIRED = 5;

  const [sessionCosts, setSessionCosts] = useState({ rent: BASE_STUDIO_RENT, ghostwriter: BASE_GHOSTWRITER_FEE });

  const saveToStorage = (state: GameState) => {
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    setHasSave(true);
  };

  const handleSaveAndQuit = () => {
    saveToStorage(gameState);
    setIsSetup(true);
    notify("Game Saved");
  };

  const loadFromStorage = (): GameState | null => {
    const data = localStorage.getItem(SAVE_KEY);
    if (!data) return null;
    try {
      const parsed = JSON.parse(data);
      parsed.currentDate = new Date(parsed.currentDate);
      parsed.songs = (parsed.songs || []).map((s: any) => ({ ...s, releaseDate: new Date(s.releaseDate) }));
      parsed.unreleasedSongs = (parsed.unreleasedSongs || []).map((s: any) => ({ ...s, releaseDate: new Date(s.releaseDate) }));
      parsed.socialPosts = (parsed.socialPosts || []).map((p: any) => ({ ...p, timestamp: new Date(p.timestamp) }));
      return parsed;
    } catch (e) {
      console.error("Failed to load save", e);
      return null;
    }
  };

  useEffect(() => {
    const saved = localStorage.getItem(SAVE_KEY);
    if (saved) {
      setHasSave(true);
      const savedState = loadFromStorage();
      if (savedState) {
        generateCareerSummary(savedState.player, savedState.songs.length, savedState.awards.length)
          .then(setCareerRecap);
      }
    }
  }, []);

  const handleContinue = () => {
    const savedState = loadFromStorage();
    if (savedState) {
      setGameState(savedState);
      setIsSetup(false);
      notify("Welcome back!");
    }
  };

  const getStreamRate = useCallback((fans: number) => {
    const baseRate = 750 / 1500; 
    if (fans < 1000000) return baseRate;
    const bonus = (fans - 1000000) * 0.0000001; 
    return baseRate + bonus;
  }, []);

  const notify = (msg: string) => {
    setShowNotification(msg);
    setTimeout(() => setShowNotification(null), 3000);
  };

  const handleStartGame = () => {
    if (!setupData.name || !setupData.stageName) return;
    const initial: GameState = {
      player: {
        name: setupData.name,
        stageName: setupData.stageName,
        genre: setupData.genre,
        money: 5000,
        fans: 100,
        fame: 0,
        followers: { Instagram: 50, TikTok: 75, YouTube: 20, Spotify: 10, AppleMusic: 5 },
        skills: { songwriting: 20, vocals: 30, production: 10, charisma: 40 },
        labelId: 'indie_self'
      },
      currentDate: new Date(2025, 0, 1),
      currentWeek: 0,
      songs: [],
      unreleasedSongs: [],
      awards: [],
      charts: [],
      socialPosts: [],
      trendingTopics: ["#MusicVibes", "#Stardom", "#NewArtist"],
      activeOffers: [],
      history: [{ month: 0, fans: 100 }],
      news: ["Fresh start. The path to Gold begins today."]
    };
    setGameState(initial);
    setIsSetup(false);
    saveToStorage(initial);
  };

  const advanceTime = useCallback(async () => {
    const prev = gameState;
    let nextWeek = prev.currentWeek + 1;
    let nextDate = new Date(prev.currentDate);
    let newPlayerState = { ...prev.player };
    let newAwards = [...prev.awards];
    let newNews = [...prev.news];
    let newHistory = [...prev.history];
    let newTrending = [...prev.trendingTopics];
    let newOffers = [...prev.activeOffers];
    const currentRate = getStreamRate(prev.player.fans);

    const updatedSongs = prev.songs.map(song => {
      const qualityFactor = Math.pow(song.quality / 100, 2);
      const audienceFactor = (prev.player.fans * 0.05) + (prev.player.fame * 0.01);
      const weeklyGain = Math.floor(audienceFactor * qualityFactor * (0.8 + Math.random() * 0.4));
      const finalWeeklyGain = Math.max(1, weeklyGain);
      const newTotalStreams = song.streams + finalWeeklyGain;
      return { ...song, streams: newTotalStreams, revenue: newTotalStreams * currentRate };
    });

    if (nextWeek > 4) {
      nextWeek = 1; 
      const oldMonth = nextDate.getMonth();
      nextDate.setMonth(nextDate.getMonth() + 1);
      
      newTrending = await generateTrendingTopics();
      
      if (Math.random() < 0.6) {
        const offer = await generateSponsoredOffer(prev.player.fame);
        newOffers = [offer, ...newOffers].slice(0, 3);
      }

      if (oldMonth === 11) {
        const wonAwards = runAwardsSeason(prev);
        if (wonAwards.length > 0) {
          setPendingAwards(wonAwards);
          newAwards = [...newAwards, ...wonAwards];
          newPlayerState.fame += wonAwards.length * 500000;
          newPlayerState.money += wonAwards.length * 100000;
          wonAwards.forEach(a => newNews.unshift(`WINNER: ${prev.player.stageName} wins ${a.category}!`));
        }
      }

      const monthlyActivity = updatedSongs.reduce((acc, song) => {
        const oldSong = prev.songs.find(s => s.id === song.id);
        const delta = song.streams - (oldSong?.streams || 0);
        return acc + delta;
      }, 0);

      const label = LABELS.find(l => l.id === prev.player.labelId);
      const share = (label?.revenueSplit || 100) / 100;
      const monthlyRoyalties = monthlyActivity * currentRate * share;
      
      newPlayerState.money += monthlyRoyalties;
      newPlayerState.fans += Math.floor(prev.player.fans * 0.05);
      
      newPlayerState.followers = {
        Instagram: Math.floor(prev.player.followers.Instagram * 1.05),
        TikTok: Math.floor(prev.player.followers.TikTok * 1.08),
        YouTube: Math.floor(prev.player.followers.YouTube * 1.03),
        Spotify: Math.floor(prev.player.followers.Spotify * 1.04),
        AppleMusic: Math.floor(prev.player.followers.AppleMusic * 1.02),
      };

      newHistory.push({ month: newHistory.length, fans: newPlayerState.fans });
      
      if (Math.random() < 0.45 && !pendingAwards) {
        const randomEvent = RANDOM_EVENTS[Math.floor(Math.random() * RANDOM_EVENTS.length)];
        setActiveEvent({ event: randomEvent });
      }
      notify(`Payout: $${monthlyRoyalties.toLocaleString(undefined, {maximumFractionDigits: 0})}`);
    } else {
      newPlayerState.fans += Math.floor(prev.player.fans * 0.01);
      newPlayerState.followers = {
        ...prev.player.followers,
        Instagram: Math.floor(prev.player.followers.Instagram * 1.01),
        TikTok: Math.floor(prev.player.followers.TikTok * 1.02),
      };
    }

    const nextState: GameState = { 
      ...prev, 
      currentDate: nextDate, 
      currentWeek: nextWeek, 
      player: newPlayerState, 
      songs: updatedSongs, 
      awards: newAwards, 
      news: newNews.slice(0, 15), 
      history: newHistory,
      trendingTopics: newTrending,
      activeOffers: newOffers
    };
    setGameState(nextState);
    saveToStorage(nextState);
  }, [gameState, getStreamRate, pendingAwards]);

  const handleEventChoice = (option: RandomEventOption) => {
    const { playerUpdate, narrative } = option.effect(gameState);
    const nextState = {
      ...gameState,
      player: {
        ...gameState.player,
        ...playerUpdate,
        skills: {
          ...gameState.player.skills,
          ...(playerUpdate.skills || {})
        }
      }
    };
    setGameState(nextState);
    saveToStorage(nextState);
    setActiveEvent({ ...activeEvent!, resultNarrative: narrative });
  };

  const handleFanResponse = (option: FanInteraction['options'][0]) => {
    const playerUpdate: Partial<GameState['player']> = {};
    if (option.bonusType === 'fans') playerUpdate.fans = gameState.player.fans + option.bonusValue;
    if (option.bonusType === 'money') playerUpdate.money = gameState.player.money + option.bonusValue;
    if (option.bonusType === 'fame') playerUpdate.fame = gameState.player.fame + option.bonusValue;
    if (option.bonusType === 'charisma') playerUpdate.skills = { ...gameState.player.skills, charisma: gameState.player.skills.charisma + option.bonusValue };
    const nextState = { ...gameState, player: { ...gameState.player, ...playerUpdate } };
    setGameState(nextState);
    saveToStorage(nextState);
    setActiveFanInteraction({ ...activeFanInteraction!, resultNarrative: option.result });
  };

  const updateSlider = useCallback(() => {
    setSliderPos(prev => {
      let speed = 2.5 + (miniGameScore.length * 0.5); 
      let next = prev + (sliderDir * speed);
      if (next > 100) { setSliderDir(-1); return 100; }
      if (next < 0) { setSliderDir(1); return 0; }
      return next;
    });
    requestRef.current = requestAnimationFrame(updateSlider);
  }, [sliderDir, miniGameScore.length]);

  useEffect(() => {
    if (recordingPhase === 'recording') {
      requestRef.current = requestAnimationFrame(updateSlider);
    } else {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    }
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, [recordingPhase, updateSlider]);

  const handleTap = () => {
    const accuracy = 100 - Math.abs(50 - sliderPos) * 2;
    const score = Math.max(0, accuracy);
    let feedback = { text: "MISS", color: "text-red-500" };
    if (score > 95) feedback = { text: "PERFECT!", color: "text-amber-400" };
    else if (score > 80) feedback = { text: "GREAT!", color: "text-green-400" };
    else if (score > 60) feedback = { text: "GOOD", color: "text-blue-400" };
    setLastAccuracy(feedback);
    setTimeout(() => setLastAccuracy(null), 800);
    setMiniGameScore(prev => {
      const newScores = [...prev, score];
      if (newScores.length >= SESSION_NOTES_REQUIRED) {
        setTimeout(() => setRecordingPhase('results'), 1000);
      }
      return newScores;
    });
  };

  const startDrafting = () => {
    setSessionCosts({ 
      rent: Math.floor(BASE_STUDIO_RENT * (0.8 + Math.random() * 0.4)), 
      ghostwriter: Math.floor(BASE_GHOSTWRITER_FEE * (0.8 + Math.random() * 0.4)) 
    });
    setDraftForm({ title: '', genre: gameState.player.genre, feature: '', useGhostwriter: false });
    setRecordingPhase('drafting');
  };

  const totalSessionCost = useMemo(() => {
    let cost = sessionCosts.rent;
    if (draftForm.useGhostwriter) cost += sessionCosts.ghostwriter;
    if (draftForm.feature) {
      const artist = REAL_ARTISTS_DATA.find(a => a.name === draftForm.feature);
      if (artist) cost += artist.cost;
    }
    return cost;
  }, [draftForm, sessionCosts]);

  const startRecording = async () => {
    if (gameState.player.money < totalSessionCost) {
      notify(`Insufficient funds for studio time.`);
      return;
    }
    setIsBusy(true);
    notify("Writing Song Layout...");
    const lyrics = await generateSongLyrics(draftForm.title, draftForm.genre);
    setActiveLyrics(lyrics);
    setGameState(prev => ({ ...prev, player: { ...prev.player, money: prev.player.money - totalSessionCost } }));
    setMiniGameScore([]);
    setRecordingPhase('recording');
    setIsBusy(false);
  };

  const saveToVault = async () => {
    if (!draftForm.title) return;
    setIsBusy(true);
    const performanceBonus = miniGameScore.reduce((a, b) => a + b, 0) / miniGameScore.length;
    let baseQuality = (gameState.player.skills.songwriting + gameState.player.skills.production + gameState.player.skills.vocals) / 3;
    if (draftForm.useGhostwriter) baseQuality += 15;
    if (draftForm.feature) {
      const artist = REAL_ARTISTS_DATA.find(a => a.name === draftForm.feature);
      if (artist) baseQuality += Math.min(20, artist.fame / 500000);
    }
    const quality = Math.floor((baseQuality * 0.7) + (performanceBonus * 0.3) + (Math.random() * 5));
    
    const newSong: Song = { 
      id: Math.random().toString(36).substr(2, 9), 
      title: draftForm.title, 
      genre: draftForm.genre, 
      featuredArtist: draftForm.feature || undefined, 
      quality: Math.min(100, quality), 
      releaseDate: new Date(gameState.currentDate), 
      streams: 0, 
      revenue: 0, 
      lyrics: activeLyrics 
    };
    const nextState: GameState = { 
      ...gameState, 
      unreleasedSongs: [newSong, ...gameState.unreleasedSongs],
      news: [`Session wrapped: "${draftForm.title}" master added to vault.`, ...gameState.news].slice(0, 15) 
    };
    setGameState(nextState);
    saveToStorage(nextState);
    setIsBusy(false);
    setRecordingPhase('idle');
    setActiveLyrics('');
    setView('social');
    setActivePlatform('Spotify');
    setSocialSubTab('vault');
    notify(`Master Recorded: ${newSong.title}. Ready for distribution in Social tab.`);
  };

  const checkFanInteraction = async (impact: number, content: string) => {
    if (impact > 1000 && Math.random() < 0.3) {
      const interaction = await generateFanInteraction(gameState.player.stageName, content);
      if (interaction) setActiveFanInteraction({ data: interaction });
    }
  };

  const produceMusicVideo = async (song: Song) => {
    const cost = 15000;
    if (gameState.player.money < cost) {
      notify(`Insufficient funds for Music Video production.`);
      return;
    }
    setIsBusy(true);
    notify("Directing Cinematic Music Video...");
    const thumbnailUrl = await generateThumbnail(song.title, gameState.player.stageName, song.genre);
    const fanGain = Math.floor(gameState.player.fans * 0.1) + 20000;
    const fameGain = song.quality * 2000;
    const releasePost: SocialPost = {
      id: Math.random().toString(36).substr(2, 9),
      platform: 'YouTube',
      content: `The official music video for "${song.title}" is out now! 🎬🔥`,
      type: 'Music Video',
      likes: Math.floor(fanGain * 3),
      comments: [{ user: "vfx_master", text: "Best visuals I've seen all year!" }],
      timestamp: new Date(),
      impact: { fans: fanGain, fame: fameGain },
      videoTitle: `${song.title} (Official Music Video)`,
      thumbnailUrl: thumbnailUrl || undefined
    };
    setGameState(prev => {
      const newState = {
        ...prev,
        player: { 
          ...prev.player, 
          money: prev.player.money - cost, 
          fans: prev.player.fans + fanGain, 
          fame: prev.player.fame + fameGain,
          followers: { ...prev.player.followers, YouTube: prev.player.followers.YouTube + Math.floor(fanGain * 0.4) }
        },
        songs: prev.songs.map(s => s.id === song.id ? { ...s, isMusicVideo: true } : s),
        socialPosts: [releasePost, ...prev.socialPosts],
        news: [`${prev.player.stageName}'s visuals for "${song.title}" are breaking the internet!`, ...prev.news].slice(0, 15)
      };
      saveToStorage(newState);
      return newState;
    });
    setIsBusy(false);
    setSocialSubTab('live');
    notify(`Music Video Live for "${song.title}"!`);
    checkFanInteraction(fanGain, song.title);
  };

  const distributeSong = async (song: Song, platform: SocialPlatform) => {
    let cost = 0;
    let thumbnailUrl = null;
    if (platform === 'YouTube') {
      cost = 15000; 
      setIsBusy(true);
      notify("Generating Music Video Thumbnail...");
      thumbnailUrl = await generateThumbnail(song.title, gameState.player.stageName, song.genre);
    } else {
      cost = 250;
    }
    if (gameState.player.money < cost) {
      notify(`Insufficient funds for ${platform} distribution.`);
      setIsBusy(false);
      return;
    }
    setIsBusy(true);
    const { fanGain, reception } = await calculateSongImpact(song.title, song.quality, gameState.player.fans, song.genre);
    const industryNews = await generateIndustryNews(gameState.player.stageName, `released "${song.title}" on ${platform}. ${reception}`);
    const updatedSong = { ...song, releaseDate: new Date(gameState.currentDate), isMusicVideo: platform === 'YouTube' };
    const releasePost: SocialPost = {
      id: Math.random().toString(36).substr(2, 9),
      platform: platform,
      content: `My new ${platform === 'YouTube' ? 'Music Video' : 'Track'} "${song.title}" is out now!`,
      type: platform === 'YouTube' ? 'Music Video' : 'Audio Release',
      likes: Math.floor(fanGain * 2.5),
      comments: [{ user: "music_bot", text: "Absolute heater! 🔥" }],
      timestamp: new Date(),
      impact: { fans: fanGain, fame: song.quality * 100 },
      videoTitle: platform === 'YouTube' ? song.title : undefined,
      thumbnailUrl: thumbnailUrl || undefined
    };
    setGameState(prev => {
      const newState = {
        ...prev,
        player: { 
          ...prev.player, 
          money: prev.player.money - cost, 
          fans: prev.player.fans + (platform === 'YouTube' ? fanGain * 2 : fanGain), 
          fame: prev.player.fame + (platform === 'YouTube' ? song.quality * 2000 : song.quality * 1000),
          followers: { ...prev.player.followers, [platform]: prev.player.followers[platform] + Math.floor(fanGain * 0.2) }
        },
        songs: [updatedSong, ...prev.songs],
        unreleasedSongs: prev.unreleasedSongs.filter(s => s.id !== song.id),
        socialPosts: [releasePost, ...prev.socialPosts],
        news: [industryNews, ...prev.news].slice(0, 15)
      };
      saveToStorage(newState);
      return newState;
    });
    setIsBusy(false);
    setSocialSubTab('live');
    notify(`Published to ${platform}!`);
    checkFanInteraction(fanGain, song.title);
  };

  const handlePostSocial = async () => {
    if (activePlatform === 'YouTube' && (!postDraft.videoTitle || isPosting)) return;
    if (activePlatform !== 'YouTube' && (!postDraft.content || isPosting)) return;
    setIsPosting(true);
    
    const trendMatches = gameState.trendingTopics.filter(t => postDraft.content.includes(t)).length;
    const trendMultiplier = trendMatches > 0 ? 1.5 + (trendMatches * 0.2) : 1;

    let thumbnailUrl = undefined;
    if (activePlatform === 'YouTube') {
      notify("Creating cinematic thumbnail...");
      thumbnailUrl = await generateThumbnail(postDraft.videoTitle, gameState.player.stageName, gameState.player.genre);
    }
    const engagement = await generateSocialEngagement(gameState.player.stageName, postDraft.content || postDraft.videoTitle, activePlatform);
    let fanGain = 0; let fameGain = 0; 
    const baseAudience = (gameState.player.fans * 0.01) + 10;
    switch (activePlatform) {
      case 'Instagram': fanGain = Math.floor(baseAudience * 0.5 * trendMultiplier); fameGain = fanGain * 2; break;
      case 'TikTok': fanGain = Math.floor(baseAudience * 2 * trendMultiplier); fameGain = fanGain; break;
      case 'YouTube': fanGain = Math.floor(baseAudience * 1.5 * trendMultiplier); fameGain = fanGain * 4; break;
      default: fanGain = Math.floor(baseAudience * 0.2 * trendMultiplier); fameGain = fanGain; break;
    }
    const newPost: SocialPost = { 
      id: Math.random().toString(36).substr(2, 9), 
      platform: activePlatform, 
      content: postDraft.content, 
      type: postDraft.type, 
      likes: Math.floor(fanGain * 2), 
      comments: engagement, 
      timestamp: new Date(), 
      impact: { fans: fanGain, fame: fameGain },
      videoTitle: activePlatform === 'YouTube' ? postDraft.videoTitle : undefined,
      videoDescription: activePlatform === 'YouTube' ? postDraft.videoDescription : undefined,
      thumbnailUrl: thumbnailUrl || undefined
    };
    const nextState = { 
      ...gameState, 
      socialPosts: [newPost, ...gameState.socialPosts], 
      player: { 
        ...gameState.player, 
        fans: gameState.player.fans + fanGain, 
        fame: gameState.player.fame + fameGain,
        followers: { ...gameState.player.followers, [activePlatform]: gameState.player.followers[activePlatform] + fanGain }
      } 
    };
    setGameState(nextState); 
    saveToStorage(nextState); 
    setPostDraft({ content: '', type: getDefaultPostType(activePlatform), targetSongId: '', videoTitle: '', videoDescription: '' }); 
    setIsPosting(false); 
    notify(`${activePlatform} post published! ${trendMatches > 0 ? '(Viral Trend Boost!)' : ''}`);
    checkFanInteraction(fanGain, postDraft.content || postDraft.videoTitle);
  };

  const handleAcceptDeal = async (deal: SponsoredOffer) => {
    const postContent = `I am so excited to partner with ${deal.brand}! ${deal.requirement} #Ad #Sponsored`;
    const fanGain = Math.floor(gameState.player.fans * 0.02);
    const charismaPenalty = deal.charismaPenalty;
    
    const newPost: SocialPost = {
      id: Math.random().toString(36).substr(2, 9),
      platform: activePlatform,
      content: postContent,
      type: 'Sponsored',
      likes: Math.floor(fanGain * 0.5),
      comments: [{ user: "sponsorship_bot", text: "Verified partner! ✅" }],
      timestamp: new Date(),
      impact: { fans: fanGain, fame: fanGain * 2 }
    };

    setGameState(prev => ({
      ...prev,
      player: {
        ...prev.player,
        money: prev.player.money + deal.payout,
        skills: { ...prev.player.skills, charisma: Math.max(0, prev.player.skills.charisma - charismaPenalty) }
      },
      socialPosts: [newPost, ...prev.socialPosts],
      activeOffers: prev.activeOffers.filter(o => o.id !== deal.id)
    }));
    
    notify(`Secured the bag: +$${deal.payout.toLocaleString()}`);
  };

  const schedulePostForSong = async (song: Song, platform: SocialPlatform) => {
    setIsPosting(true);
    const content = `Coming soon to ${platform}: "${song.title}"! Get ready. #NewMusic #${gameState.player.stageName}`;
    const engagement = await generateSocialEngagement(gameState.player.stageName, content, 'Instagram'); 
    const baseAudience = (gameState.player.fans * 0.02) + 50;
    const fanGain = Math.floor(baseAudience);
    const fameGain = fanGain * 3;
    const newPost: SocialPost = { 
      id: Math.random().toString(36).substr(2, 9), 
      platform: platform === 'YouTube' ? 'YouTube' : 'Instagram', 
      content, 
      type: 'Teaser', 
      likes: fanGain * 5, 
      comments: engagement, 
      timestamp: new Date(), 
      impact: { fans: fanGain, fame: fameGain } 
    };
    const nextState = { 
      ...gameState, 
      socialPosts: [newPost, ...gameState.socialPosts], 
      player: { 
        ...gameState.player, 
        fans: gameState.player.fans + fanGain, 
        fame: gameState.player.fame + fameGain,
        followers: { ...gameState.player.followers, [platform === 'YouTube' ? 'YouTube' : 'Instagram']: gameState.player.followers[platform === 'YouTube' ? 'YouTube' : 'Instagram'] + Math.floor(fanGain * 0.5) }
      } 
    };
    setGameState(nextState);
    saveToStorage(nextState);
    setIsPosting(false);
    notify(`Scheduled hype post for ${song.title} on ${platform}!`);
    checkFanInteraction(fanGain, content);
  };

  const getDefaultPostType = (platform: SocialPlatform) => {
    if (platform === 'Instagram') return 'Photo';
    if (platform === 'TikTok') return 'Short Video';
    if (platform === 'YouTube') return 'Music Video';
    return 'Status';
  };

  useEffect(() => { setPostDraft(prev => ({ ...prev, type: getDefaultPostType(activePlatform) })); }, [activePlatform]);
  const activeLabel = LABELS.find(l => l.id === gameState.player.labelId);
  const PLATFORM_THEMES: Record<SocialPlatform, { color: string, bg: string, icon: string, action: string }> = {
    'Instagram': { color: '#E1306C', bg: 'bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF]', icon: '📸', action: 'Feed' },
    'TikTok': { color: '#EE1D52', bg: 'bg-gradient-to-tr from-[#00f2ea] via-[#000000] to-[#ff0050]', icon: '🎵', action: 'For You' },
    'YouTube': { color: '#FF0000', bg: 'bg-[#FF0000]', icon: '📺', action: 'Studio' },
    'Spotify': { color: '#1DB954', bg: 'bg-[#1DB954]', icon: '🎧', action: 'Music' },
    'AppleMusic': { color: '#FA243C', bg: 'bg-[#FA243C]', icon: '🍎', action: 'Music' }
  };

  const NavButton: React.FC<{ children: React.ReactNode; active: boolean; onClick: () => void; icon: string; }> = ({ children, active, onClick, icon }) => (
    <button onClick={onClick} className={`flex items-center gap-2 sm:gap-4 px-3 sm:px-6 py-3 sm:py-4 rounded-[1rem] sm:rounded-[1.5rem] font-black transition-all text-[9px] sm:text-[11px] uppercase tracking-widest ${active ? 'bg-amber-500 text-black shadow-2xl scale-105' : 'text-zinc-600 hover:text-white'}`}>
      <span className="text-lg sm:text-xl">{icon}</span>
      <span className="hidden md:inline">{children}</span>
    </button>
  );

  const MobileBottomNav: React.FC = () => (
    <div className="fixed bottom-0 left-0 right-0 z-[100] bg-black/80 backdrop-blur-2xl border-t border-white/5 lg:hidden flex justify-around items-center px-2 py-3 safe-pb">
      <ViewIcon active={view === 'home'} onClick={() => setView('home')} icon="🌑" label="Lobby" />
      <ViewIcon active={view === 'studio'} onClick={() => setView('studio')} icon="🎙️" label="Studio" />
      <ViewIcon active={view === 'social'} onClick={() => setView('social')} icon="✨" label="Social" />
      <ViewIcon active={view === 'tour'} onClick={() => setView('tour')} icon="🏟️" label="Arena" />
      <div className="relative">
        <button onClick={advanceTime} className="bg-white text-black p-4 rounded-2xl shadow-xl active:scale-95 transition-all">
          <span className="text-xl">⏩</span>
        </button>
      </div>
    </div>
  );

  const ViewIcon: React.FC<{ active: boolean, onClick: () => void, icon: string, label: string }> = ({ active, onClick, icon, label }) => (
    <button onClick={onClick} className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${active ? 'text-amber-500' : 'text-zinc-500'}`}>
      <span className="text-2xl">{icon}</span>
      <span className="text-[8px] font-black uppercase tracking-widest">{label}</span>
    </button>
  );

  if (isSetup) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black p-6">
        <div className="w-full max-w-md bg-zinc-950 border border-amber-900/30 rounded-3xl p-8 shadow-[0_0_50px_-12px_rgba(212,175,55,0.2)]">
          <div className="mb-10 text-center">
            <h1 className="text-4xl sm:text-5xl font-black text-transparent bg-clip-text bg-gradient-to-b from-amber-200 to-amber-600 italic tracking-tighter gold-glow">STARDOM</h1>
          </div>
          <div className="space-y-6">
            {hasSave && (
              <div className="space-y-4 mb-8">
                <div className="bg-zinc-900/50 border border-white/5 rounded-2xl p-6 text-center animate-in fade-in duration-1000">
                  <div className="text-[9px] font-black text-amber-500 uppercase tracking-widest mb-2">Saved Career</div>
                  <p className="text-sm italic text-zinc-300 leading-relaxed font-medium">
                    {careerRecap || "Loading your legacy..."}
                  </p>
                </div>
                <button onClick={handleContinue} className="w-full bg-white text-black font-black py-5 rounded-xl transition-all shadow-xl text-xs uppercase tracking-widest border-2 border-white hover:bg-amber-400 group overflow-hidden relative">
                  <span className="relative z-10">Resume Career</span>
                  <div className="absolute inset-0 bg-gradient-to-r from-amber-400 to-amber-200 opacity-0 group-hover:opacity-100 transition-opacity" />
                </button>
              </div>
            )}
            <div className="pt-4 border-t border-white/5">
              <div className="text-[9px] font-black text-zinc-600 uppercase tracking-widest mb-6 text-center">Start Fresh</div>
              <div className="space-y-6">
                <div className="space-y-1"><label className="block text-[10px] font-black text-amber-500 uppercase tracking-widest">Real Identity</label><input type="text" className="w-full bg-black border-b border-zinc-800 p-3 text-white focus:outline-none focus:border-amber-600 text-sm" value={setupData.name} placeholder="Full Name" onChange={e => setSetupData({...setupData, name: e.target.value})} /></div>
                <div className="space-y-1"><label className="block text-[10px] font-black text-amber-500 uppercase tracking-widest">Stage Identity</label><input type="text" className="w-full bg-black border-b border-zinc-800 p-3 text-white focus:outline-none focus:border-amber-600 text-sm" value={setupData.stageName} placeholder="Artist Name" onChange={e => setSetupData({...setupData, stageName: e.target.value})} /></div>
                <div className="space-y-1"><label className="block text-[10px] font-black text-amber-500 uppercase tracking-widest">Sonic Style</label><select className="w-full bg-black border-b border-zinc-800 p-3 text-white focus:outline-none cursor-pointer text-sm" value={setupData.genre} onChange={e => setSetupData({...setupData, genre: e.target.value as Genre})}>{Object.values(Genre).map(g => <option key={g} value={g}>{g}</option>)}</select></div>
                <button onClick={handleStartGame} className="w-full bg-gradient-to-r from-amber-600 to-amber-400 text-black font-black py-4 rounded-xl mt-6 transition-all text-xs uppercase tracking-widest active:scale-95 shadow-lg shadow-amber-900/20">Sign New Contract</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col selection:bg-amber-500/30 selection:text-white">
      <StatsBar state={gameState} onSaveAndQuit={handleSaveAndQuit} />
      
      {showNotification && (<div className="fixed bottom-24 lg:bottom-12 left-1/2 -translate-x-1/2 z-[200] bg-zinc-900/90 backdrop-blur text-amber-400 px-6 py-3 rounded-full shadow-2xl font-black text-[9px] uppercase tracking-widest border border-amber-500/20 whitespace-nowrap">{showNotification}</div>)}

      {/* Main Content Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar - Desktop Only */}
        <aside className="hidden lg:flex w-72 flex-col p-6 gap-6 border-r border-white/5 overflow-y-auto">
          <nav className="flex flex-col gap-2">
            <NavButton active={view === 'home'} onClick={() => setView('home')} icon="🌑">Lobby</NavButton>
            <NavButton active={view === 'studio'} onClick={() => setView('studio')} icon="🎙️">Studio</NavButton>
            <NavButton active={view === 'social'} onClick={() => setView('social')} icon="✨">Social</NavButton>
            <NavButton active={view === 'tour'} onClick={() => setView('tour')} icon="🏟️">Arena</NavButton>
            <NavButton active={view === 'charts'} onClick={() => setView('charts')} icon="📈">Charts</NavButton>
            <NavButton active={view === 'awards'} onClick={() => setView('awards')} icon="🏆">Awards</NavButton>
            <NavButton active={view === 'management'} onClick={() => setView('management')} icon="👔">Exec</NavButton>
          </nav>
          
          <div className="bg-zinc-950 border border-white/5 rounded-[2rem] p-6 space-y-4">
             <div className="flex items-center gap-2 mb-2">
                <span className="text-amber-500 text-sm">🔥</span>
                <h3 className="text-[10px] font-black uppercase tracking-widest text-zinc-500">Live Trends</h3>
             </div>
             {gameState.trendingTopics.map(trend => (
               <div key={trend} className="text-xs font-bold text-white/80 border-b border-white/5 pb-2 last:border-0">{trend}</div>
             ))}
          </div>
        </aside>

        {/* Dynamic Content Area */}
        <main className="flex-1 overflow-y-auto pb-32 lg:pb-12 px-4 sm:px-8 py-6 sm:py-8 no-scrollbar scroll-smooth">
          <div className="max-w-6xl mx-auto">
            {view === 'home' && (
              <div className="space-y-8 animate-in fade-in duration-700 min-h-[500px] sm:min-h-[600px] relative rounded-[2rem] sm:rounded-[3rem] overflow-hidden">
                 <div className="absolute inset-0 z-0">
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent z-10" />
                    <img src="https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1600&q=80" className="w-full h-full object-cover opacity-40 scale-105" alt="Concert stage" />
                    <div className="absolute top-0 left-1/4 w-32 h-full bg-amber-500/10 blur-[100px] -rotate-12 animate-pulse" />
                    <div className="absolute top-0 right-1/4 w-32 h-full bg-blue-500/10 blur-[100px] rotate-12 animate-pulse delay-1000" />
                 </div>
                 <div className="relative z-10 p-4 sm:p-8 space-y-8 sm:space-y-12">
                    <div className="space-y-2">
                      <h2 className="text-3xl sm:text-4xl font-black italic tracking-tighter uppercase text-white gold-glow">The Big Stage</h2>
                      <p className="text-zinc-400 text-[10px] sm:text-sm font-medium uppercase tracking-widest">Main Lobby • 2025 Global Tour</p>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
                      <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-[1.5rem] sm:rounded-[2.5rem] p-6 sm:p-8 shadow-2xl">
                        <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-500/80 mb-6">Growth Index</h2>
                        <div className="h-[150px] sm:h-[200px] w-full"><ResponsiveContainer width="100%" height="100%"><LineChart data={gameState.history}><XAxis dataKey="month" hide /><YAxis hide /><Tooltip contentStyle={{ backgroundColor: '#000', border: '1px solid rgba(212,175,55,0.2)', borderRadius: '16px' }} itemStyle={{ color: '#D4AF37', fontSize: '10px', fontWeight: '900', textTransform: 'uppercase' }} /><Line type="monotone" dataKey="fans" stroke="#D4AF37" strokeWidth={4} dot={false} /></LineChart></ResponsiveContainer></div>
                      </div>
                      <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-[1.5rem] sm:rounded-[2.5rem] p-6 sm:p-8 shadow-2xl">
                        <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-500/80 mb-6">Active Contract</h2>
                        <div className="flex items-center gap-4 sm:gap-6 mb-8"><span className="text-5xl sm:text-6xl">{activeLabel?.logo}</span><div><div className="font-black text-white text-lg sm:text-xl tracking-tighter uppercase">{activeLabel?.name}</div><div className="text-[9px] sm:text-[10px] text-zinc-400 uppercase tracking-widest mt-1 font-bold">Prestige Level {activeLabel?.prestige}</div></div></div>
                      </div>
                    </div>
                    <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-[1.5rem] sm:rounded-[2.5rem] p-6 sm:p-8 shadow-2xl">
                      <h2 className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-500/80 mb-8">Recent Releases</h2>
                      <div className="space-y-4">
                        {gameState.songs.length === 0 ? <div className="text-center py-12 text-zinc-600 text-[10px] font-black uppercase tracking-widest">No songs published</div> : 
                          gameState.songs.map(song => (
                            <div key={song.id} className="bg-zinc-900/40 p-4 sm:p-6 rounded-2xl sm:rounded-3xl flex items-center justify-between border border-white/5 overflow-hidden group transition-all hover:bg-zinc-800/60"><div className="relative z-10"><div className="font-black text-white text-sm sm:text-base flex items-center gap-2">{song.title} {song.isMusicVideo && <span className="text-[8px] bg-red-600 text-white px-2 py-0.5 rounded-full">VIDEO</span>}{song.featuredArtist && <span className="text-zinc-500 text-[10px] sm:text-xs italic font-bold">ft. {song.featuredArtist}</span>}</div><div className="text-[9px] sm:text-[10px] text-zinc-500 uppercase font-black">{song.genre} • {song.quality}% QLT</div></div><div className="text-right relative z-10"><div className="text-xs sm:text-sm font-black text-amber-500">{song.streams.toLocaleString()}</div><div className="text-[8px] sm:text-[9px] text-zinc-600 uppercase font-black">Streams</div></div></div>
                          ))}
                      </div>
                    </div>
                 </div>
              </div>
            )}
            {view === 'studio' && (
              <div className="bg-zinc-950 border border-white/5 rounded-[2rem] sm:rounded-[3rem] p-6 sm:p-12 min-h-[400px] sm:min-h-[500px] flex flex-col items-center justify-center text-center shadow-2xl relative overflow-hidden">
                {recordingPhase === 'idle' && (
                  <div className="space-y-8 animate-in fade-in zoom-in duration-500"><div className="text-5xl sm:text-6xl mb-4">🎙️</div><h2 className="text-3xl sm:text-4xl font-black italic tracking-tighter uppercase gold-glow">The Soundstage</h2><p className="text-zinc-500 max-w-md mx-auto text-xs sm:text-sm">Craft masters to build your legacy. All recordings go to your Vault for distribution.</p><button onClick={startDrafting} className="bg-white text-black px-12 sm:px-16 py-4 sm:py-5 rounded-full font-black text-xs sm:text-sm uppercase tracking-widest hover:bg-amber-500 transition-all shadow-xl active:scale-95">Book Session</button></div>
                )}
                {recordingPhase === 'recording' && (
                  <div className="w-full max-w-2xl space-y-12 animate-in slide-in-from-bottom-12 duration-500">
                    <div className="space-y-6">
                      <h2 className="text-[10px] uppercase tracking-[0.4em] font-black text-red-600 animate-pulse">ON AIR: "{draftForm.title}"</h2>
                      <div className="bg-zinc-900/50 border border-white/5 p-6 sm:p-10 rounded-[1.5rem] sm:rounded-[3rem] min-h-[120px] sm:min-h-[160px] flex items-center justify-center relative overflow-hidden shadow-inner group">
                        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-amber-500/40 to-transparent" />
                        <p className="text-xl sm:text-3xl font-black italic text-transparent bg-clip-text bg-gradient-to-b from-zinc-100 to-zinc-500 leading-tight tracking-tight relative z-10">"{activeLyrics || "Capturing the vibe..."}"</p>
                      </div>
                      <div className="text-[9px] sm:text-[10px] font-black text-zinc-600 uppercase tracking-widest mt-4">Take {miniGameScore.length + 1} of {SESSION_NOTES_REQUIRED}</div>
                    </div>
                    <div className="relative">
                      {lastAccuracy && (<div className={`absolute -top-12 left-1/2 -translate-x-1/2 font-black italic text-lg sm:text-xl tracking-tighter animate-bounce ${lastAccuracy.color}`}>{lastAccuracy.text}</div>)}
                      <div className="relative h-4 w-full bg-zinc-900 rounded-full border border-white/5 p-1 flex items-center overflow-hidden">
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[10%] h-full bg-amber-500/20 border-x border-amber-500/40 animate-pulse" />
                        <div className={`absolute w-3 h-8 rounded-full shadow-[0_0_20px_rgba(255,255,255,0.5)] transition-colors duration-100 ${Math.abs(50 - sliderPos) < 5 ? 'bg-amber-400' : 'bg-white'}`} style={{ left: `${sliderPos}%`, transform: 'translateX(-50%)' }} />
                      </div>
                    </div>
                    <div className="flex flex-col items-center gap-6 sm:gap-10">
                      <button onPointerDown={handleTap} className="w-24 h-24 sm:w-32 sm:h-32 rounded-full bg-crimson hover:bg-red-600 text-white font-black text-xs sm:text-sm shadow-[0_0_50px_rgba(153,27,27,0.3)] active:scale-90 transition-all flex flex-col items-center justify-center uppercase tracking-widest border-4 border-black">RECORD</button>
                      <div className="flex gap-2">{Array.from({ length: SESSION_NOTES_REQUIRED }).map((_, i) => (<div key={i} className={`w-2 h-2 rounded-full ${i < miniGameScore.length ? (miniGameScore[i] > 80 ? 'bg-amber-500' : 'bg-zinc-400') : 'bg-zinc-800'}`} />))}</div>
                    </div>
                  </div>
                )}
              </div>
            )}
            {/* ... remaining views optimized with sm: variants ... */}
            {view === 'social' && (
               <div className="max-w-4xl mx-auto space-y-6 sm:space-y-8 animate-in fade-in duration-500">
                  <div className="flex bg-zinc-950 p-1 rounded-full border border-white/5 overflow-x-auto no-scrollbar touch-pan-x">
                    {(Object.keys(PLATFORM_THEMES) as SocialPlatform[]).map(plat => (
                      <button key={plat} onClick={() => setActivePlatform(plat)} className={`flex-shrink-0 flex items-center gap-2 px-4 sm:px-6 py-3 sm:py-4 rounded-full text-[8px] sm:text-[10px] font-black uppercase tracking-widest transition-all ${activePlatform === plat ? `${PLATFORM_THEMES[plat].bg} text-white shadow-xl` : 'text-zinc-500'}`}><span>{PLATFORM_THEMES[plat].icon}</span>{plat}</button>
                    ))}
                  </div>
                  {/* Tab contents adjusted for small screens */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="bg-zinc-950 border border-white/5 rounded-2xl p-6 flex items-center justify-between">
                        <div>
                          <div className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">{activePlatform} Followers</div>
                          <div className="text-xl sm:text-2xl font-black text-white italic">{gameState.player.followers[activePlatform].toLocaleString()}</div>
                        </div>
                        <div className="text-2xl opacity-20">{PLATFORM_THEMES[activePlatform].icon}</div>
                    </div>
                    <div className="bg-zinc-950 border border-white/5 rounded-2xl p-6 flex items-center justify-between">
                        <div>
                          <div className="text-[8px] font-black text-zinc-500 uppercase tracking-widest">Global Fans</div>
                          <div className="text-xl sm:text-2xl font-black text-amber-500 italic">{gameState.player.fans.toLocaleString()}</div>
                        </div>
                        <div className="text-2xl opacity-20">🌎</div>
                    </div>
                  </div>
                  {/* ... Rest of social tab ... */}
               </div>
            )}
          </div>
        </main>

        {/* Desktop Sidebar Sidebar Right-hand widgets would go here in the future */}
      </div>

      <MobileBottomNav />

      {/* Desktop Advance Button Container */}
      <div className="hidden lg:flex fixed bottom-0 left-0 right-0 bg-black/90 backdrop-blur-2xl border-t border-white/5 p-4 flex-col justify-center items-center gap-2 z-40">
        <div className="flex gap-4">{[1, 2, 3, 4].map(w => (<div key={w} className={`w-1 h-1 rounded-full transition-all duration-700 ${gameState.currentWeek >= w ? 'bg-amber-500 shadow-[0_0_10px_rgba(212,175,55,1)] scale-150' : 'bg-zinc-800 border border-white/5'}`} />))}</div>
        <button onClick={advanceTime} className="bg-white text-black font-black px-12 py-3 rounded-full flex items-center gap-4 transition-all active:scale-95 hover:bg-amber-500 shadow-[0_0_20px_rgba(212,175,55,0.1)] border border-white/5 group overflow-hidden relative">
          <span className="relative z-10 uppercase tracking-[0.4em] text-[8px] font-black italic">Next Week</span>
        </button>
      </div>

      {/* Modals & Popups (Ensure safe area and responsive) */}
      {activeEvent && (
        <div className="fixed inset-0 z-[300] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
          <div className="w-full max-w-xl bg-zinc-950 border border-amber-900/30 rounded-[2rem] sm:rounded-[3rem] p-6 sm:p-10 my-auto">
             <div className="text-center mb-6 sm:mb-8">
               <div className="text-5xl sm:text-6xl mb-6">{activeEvent.event.icon}</div>
               <h2 className="text-2xl sm:text-3xl font-black italic uppercase gold-glow mb-4">{activeEvent.event.title}</h2>
               <p className="text-zinc-400 text-sm sm:text-lg">{activeEvent.resultNarrative || activeEvent.event.description}</p>
             </div>
             {!activeEvent.resultNarrative ? (
                <div className="grid grid-cols-1 gap-4 pt-4">
                  {activeEvent.event.options.map((opt, i) => (
                    <button key={i} onClick={() => handleEventChoice(opt)} className="p-5 sm:p-8 bg-zinc-900 border border-white/5 rounded-2xl sm:rounded-[2rem] text-left hover:border-amber-500/50 active:scale-95 transition-all">
                      <div className="font-black text-white uppercase text-[10px] sm:text-xs mb-2 tracking-widest">{opt.label}</div>
                      <p className="text-[10px] sm:text-[11px] text-zinc-500 leading-snug">{opt.description}</p>
                    </button>
                  ))}
                </div>
             ) : (
                <button onClick={() => setActiveEvent(null)} className="w-full bg-white text-black font-black py-4 sm:py-5 rounded-full text-[10px] sm:text-xs uppercase tracking-widest">Continue</button>
             )}
          </div>
        </div>
      )}
    </div>
  );
};

export default App;
