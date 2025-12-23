
import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { GameState, Genre, Song, Label, Award, SocialPost, SocialPlatform, SponsoredOffer } from './types';
import { LABELS, REAL_ARTISTS_DATA, RealArtist } from './constants';
import { StatsBar } from './components/StatsBar';
import { generateSongLyrics, generateIndustryNews, calculateSongImpact, generateSocialEngagement, generateThumbnail, generateFanInteraction, generateCareerSummary, generateTrendingTopics, generateSponsoredOffer } from './services/geminiService';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

type RecordingPhase = 'idle' | 'drafting' | 'review' | 'recording' | 'results';
type SocialSubTab = 'live' | 'production' | 'vault' | 'deals';
type ViewType = 'home' | 'studio' | 'tour' | 'management' | 'charts' | 'awards' | 'social';

const SAVE_KEY = 'stardom_v1_save';
const SESSION_NOTES_REQUIRED = 5;
const BASE_STUDIO_RENT = 500;
const BASE_GHOSTWRITER_FEE = 2500;

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
    history: [{ month: 0, fans: 100 }],
    news: ["Fresh start. The path to Gold begins today."]
  });

  const [view, setView] = useState<ViewType>('home');
  const [activePlatform, setActivePlatform] = useState<SocialPlatform>('Instagram');
  const [socialSubTab, setSocialSubTab] = useState<SocialSubTab>('live');
  const [isBusy, setIsBusy] = useState(false);
  const [showNotification, setShowNotification] = useState<string | null>(null);
  const [activeEvent, setActiveEvent] = useState<{ event: RandomEvent, resultNarrative?: string } | null>(null);
  const [activeFanInteraction, setActiveFanInteraction] = useState<{ data: FanInteraction, resultNarrative?: string } | null>(null);

  const [postDraft, setPostDraft] = useState({ content: '', type: 'Photo', targetSongId: '', videoTitle: '', videoDescription: '' });
  const [isPosting, setIsPosting] = useState(false);

  const [recordingPhase, setRecordingPhase] = useState<RecordingPhase>('idle');
  const [draftForm, setDraftForm] = useState({ title: '', genre: Genre.POP, feature: '', useGhostwriter: false });
  const [miniGameScore, setMiniGameScore] = useState<number[]>([]); 
  const [sliderPos, setSliderPos] = useState(0);
  const [sliderDir, setSliderDir] = useState(1);
  const [lastAccuracy, setLastAccuracy] = useState<{ text: string, color: string } | null>(null);
  const [activeLyrics, setActiveLyrics] = useState<string>('');
  const requestRef = useRef<number>(null);

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

  const notify = (msg: string) => {
    setShowNotification(msg);
    setTimeout(() => setShowNotification(null), 3000);
  };

  const getStreamRate = useCallback((fans: number) => {
    const baseRate = 750 / 1500; 
    if (fans < 1000000) return baseRate;
    return baseRate + (fans - 1000000) * 0.0000001;
  }, []);

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
      const newTotalStreams = song.streams + Math.max(1, weeklyGain);
      return { ...song, streams: newTotalStreams, revenue: newTotalStreams * currentRate };
    });

    if (nextWeek > 4) {
      nextWeek = 1; 
      nextDate.setMonth(nextDate.getMonth() + 1);
      newTrending = await generateTrendingTopics();
      if (Math.random() < 0.6) {
        const offer = await generateSponsoredOffer(prev.player.fame);
        newOffers = [offer, ...newOffers].slice(0, 3);
      }
      if (nextDate.getMonth() === 0) {
        const wonAwards = runAwardsSeason(prev);
        if (wonAwards.length > 0) {
          newAwards = [...newAwards, ...wonAwards];
          newPlayerState.fame += wonAwards.length * 500000;
          newPlayerState.money += wonAwards.length * 100000;
        }
      }
      const monthlyActivity = updatedSongs.reduce((acc, song) => {
        const oldSong = prev.songs.find(s => s.id === song.id);
        return acc + (song.streams - (oldSong?.streams || 0));
      }, 0);
      const label = LABELS.find(l => l.id === prev.player.labelId);
      const share = (label?.revenueSplit || 100) / 100;
      newPlayerState.money += monthlyActivity * currentRate * share;
      newPlayerState.fans += Math.floor(prev.player.fans * 0.05);
      newHistory.push({ month: newHistory.length, fans: newPlayerState.fans });
      if (Math.random() < 0.45) {
        const randomEvent = RANDOM_EVENTS[Math.floor(Math.random() * RANDOM_EVENTS.length)];
        setActiveEvent({ event: randomEvent });
      }
    } else {
      newPlayerState.fans += Math.floor(prev.player.fans * 0.01);
    }
    const nextState: GameState = { ...prev, currentDate: nextDate, currentWeek: nextWeek, player: newPlayerState, songs: updatedSongs, awards: newAwards, news: newNews.slice(0, 15), history: newHistory, trendingTopics: newTrending, activeOffers: newOffers };
    setGameState(nextState);
    saveToStorage(nextState);
  }, [gameState, getStreamRate]);

  const handleStartGame = () => {
    if (!setupData.name || !setupData.stageName) return;
    const initial: GameState = {
      player: { name: setupData.name, stageName: setupData.stageName, genre: setupData.genre, money: 5000, fans: 100, fame: 0, followers: { Instagram: 50, TikTok: 75, YouTube: 20, Spotify: 10, AppleMusic: 5 }, skills: { songwriting: 20, vocals: 30, production: 10, charisma: 40 }, labelId: 'indie_self' },
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

  const handleEventChoice = (option: RandomEventOption) => {
    const { playerUpdate, narrative } = option.effect(gameState);
    const nextState = { ...gameState, player: { ...gameState.player, ...playerUpdate, skills: { ...gameState.player.skills, ...(playerUpdate.skills || {}) } } };
    setGameState(nextState);
    saveToStorage(nextState);
    setActiveEvent({ ...activeEvent!, resultNarrative: narrative });
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
    if (recordingPhase === 'recording') requestRef.current = requestAnimationFrame(updateSlider);
    else if (requestRef.current) cancelAnimationFrame(requestRef.current);
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
      if (newScores.length >= SESSION_NOTES_REQUIRED) setTimeout(() => setRecordingPhase('results'), 1000);
      return newScores;
    });
  };

  const startDrafting = () => {
    setSessionCosts({ rent: Math.floor(BASE_STUDIO_RENT * (0.8 + Math.random() * 0.4)), ghostwriter: Math.floor(BASE_GHOSTWRITER_FEE * (0.8 + Math.random() * 0.4)) });
    setDraftForm({ title: '', genre: gameState.player.genre, feature: '', useGhostwriter: false });
    setRecordingPhase('drafting');
  };

  const startReview = async () => {
    setIsBusy(true);
    notify("Writing Song Layout...");
    const lyrics = await generateSongLyrics(draftForm.title, draftForm.genre);
    setActiveLyrics(lyrics);
    setRecordingPhase('review');
    setIsBusy(false);
  };

  const saveToVaultDraft = () => {
    const newSong: Song = { id: Math.random().toString(36).substr(2, 9), title: draftForm.title, genre: draftForm.genre, featuredArtist: draftForm.feature || undefined, quality: 0, releaseDate: new Date(gameState.currentDate), streams: 0, revenue: 0, lyrics: activeLyrics, isMastered: false };
    setGameState(prev => ({ ...prev, unreleasedSongs: [newSong, ...prev.unreleasedSongs] }));
    setRecordingPhase('idle');
    notify("Song idea saved to Vault!");
  };

  const startRecordingFromDraft = (song: Song) => {
    setDraftForm({ title: song.title, genre: song.genre, feature: song.featuredArtist || '', useGhostwriter: false });
    setActiveLyrics(song.lyrics || '');
    setMiniGameScore([]);
    setRecordingPhase('recording');
    setView('studio');
  };

  const startRecording = () => {
    setMiniGameScore([]);
    setRecordingPhase('recording');
  };

  const saveToVault = async () => {
    setIsBusy(true);
    const performanceBonus = miniGameScore.reduce((a, b) => a + b, 0) / miniGameScore.length;
    let baseQuality = (gameState.player.skills.songwriting + gameState.player.skills.production + gameState.player.skills.vocals) / 3;
    const quality = Math.floor((baseQuality * 0.7) + (performanceBonus * 0.3) + (Math.random() * 5));
    const newSong: Song = { id: Math.random().toString(36).substr(2, 9), title: draftForm.title, genre: draftForm.genre, featuredArtist: draftForm.feature || undefined, quality: Math.min(100, quality), releaseDate: new Date(gameState.currentDate), streams: 0, revenue: 0, lyrics: activeLyrics, isMastered: true };
    setGameState(prev => ({ ...prev, unreleasedSongs: [newSong, ...prev.unreleasedSongs.filter(s => s.title !== draftForm.title)] }));
    setRecordingPhase('idle');
    setIsBusy(false);
    notify(`Master Recorded: ${newSong.title}`);
  };

  const distributeSong = async (song: Song, platform: SocialPlatform) => {
    setIsBusy(true);
    const { fanGain, reception } = await calculateSongImpact(song.title, song.quality, gameState.player.fans, song.genre);
    const updatedSong = { ...song, releaseDate: new Date(gameState.currentDate), isMusicVideo: platform === 'YouTube' };
    setGameState(prev => ({ ...prev, player: { ...prev.player, fans: prev.player.fans + fanGain }, songs: [updatedSong, ...prev.songs], unreleasedSongs: prev.unreleasedSongs.filter(s => s.id !== song.id) }));
    setIsBusy(false);
    notify(`Published to ${platform}!`);
  };

  const handlePostSocial = async () => {
    setIsPosting(true);
    const engagement = await generateSocialEngagement(gameState.player.stageName, postDraft.content, activePlatform);
    const fanGain = Math.floor(gameState.player.fans * 0.01 + 10);
    setGameState(prev => ({ ...prev, socialPosts: [{ id: Math.random().toString(36).substr(2, 9), platform: activePlatform, content: postDraft.content, type: postDraft.type, likes: fanGain * 2, comments: engagement, timestamp: new Date(), impact: { fans: fanGain, fame: fanGain * 2 } }, ...prev.socialPosts], player: { ...prev.player, fans: prev.player.fans + fanGain, followers: { ...prev.player.followers, [activePlatform]: prev.player.followers[activePlatform] + fanGain } } }));
    setPostDraft({ ...postDraft, content: '' });
    setIsPosting(false);
    notify(`Posted to ${activePlatform}!`);
  };

  const handleAcceptDeal = async (deal: SponsoredOffer) => {
    setIsBusy(true);
    const engagement = await generateSocialEngagement(gameState.player.stageName, deal.requirement, 'Instagram');
    setGameState(prev => ({
      ...prev,
      player: { ...prev.player, money: prev.player.money + deal.payout, skills: { ...prev.player.skills, charisma: Math.max(0, prev.player.skills.charisma - deal.charismaPenalty) } },
      activeOffers: prev.activeOffers.filter(o => o.id !== deal.id),
      socialPosts: [{ id: Math.random().toString(36).substr(2, 9), platform: 'Instagram', content: deal.requirement, type: 'Sponsored', likes: Math.floor(prev.player.fans * 0.05), comments: engagement, timestamp: new Date(), impact: { fans: 0, fame: 5000 } }, ...prev.socialPosts]
    }));
    setIsBusy(false);
    notify(`Contract with ${deal.brand} signed! Received $${deal.payout.toLocaleString()}`);
  };

  const PLATFORM_THEMES: Record<SocialPlatform, { color: string, bg: string, icon: string, action: string }> = {
    'Instagram': { color: '#E1306C', bg: 'bg-gradient-to-tr from-[#F58529] via-[#DD2A7B] to-[#8134AF]', icon: '📸', action: 'Feed' },
    'TikTok': { color: '#EE1D52', bg: 'bg-gradient-to-tr from-[#00f2ea] via-[#000000] to-[#ff0050]', icon: '🎵', action: 'For You' },
    'YouTube': { color: '#FF0000', bg: 'bg-[#FF0000]', icon: '📺', action: 'Studio' },
    'Spotify': { color: '#1DB954', bg: 'bg-[#1DB954]', icon: '🎧', action: 'Music' },
    'AppleMusic': { color: '#FA243C', bg: 'bg-[#FA243C]', icon: '🍎', action: 'Music' }
  };

  const ViewIcon: React.FC<{ active: boolean, onClick: () => void, icon: string, label: string }> = ({ active, onClick, icon, label }) => (
    <button onClick={onClick} className={`flex flex-col items-center gap-1 p-2 rounded-xl transition-all ${active ? 'text-amber-500' : 'text-zinc-500'}`}>
      <span className="text-2xl">{icon}</span>
      <span className="text-[8px] font-black uppercase tracking-widest">{label}</span>
    </button>
  );

  const NavButton: React.FC<{ children: React.ReactNode; active: boolean; onClick: () => void; icon: string; }> = ({ children, active, onClick, icon }) => (
    <button onClick={onClick} className={`flex items-center gap-2 sm:gap-4 px-3 sm:px-6 py-3 sm:py-4 rounded-[1rem] sm:rounded-[1.5rem] font-black transition-all text-[9px] sm:text-[11px] uppercase tracking-widest ${active ? 'bg-amber-500 text-black shadow-2xl scale-105' : 'text-zinc-600 hover:text-white'}`}>
      <span className="text-lg sm:text-xl">{icon}</span>
      <span className="hidden md:inline">{children}</span>
    </button>
  );

  const activeLabel = LABELS.find(l => l.id === gameState.player.labelId);

  return (
    <div className="min-h-screen bg-black flex flex-col">
      <StatsBar state={gameState} onSaveAndQuit={handleSaveAndQuit} />
      <div className="flex-1 flex overflow-hidden">
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
        </aside>
        <main className="flex-1 overflow-y-auto pb-32 lg:pb-12 px-4 sm:px-8 py-6 no-scrollbar">
          <div className="max-w-6xl mx-auto">
            {view === 'home' && (
              <div className="space-y-8 animate-in fade-in duration-700 min-h-[500px] relative rounded-[2rem] overflow-hidden">
                 <div className="absolute inset-0 z-0">
                    <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent z-10" />
                    <img src="https://images.unsplash.com/photo-1470225620780-dba8ba36b745?auto=format&fit=crop&w=1600&q=80" className="w-full h-full object-cover opacity-40" alt="Concert stage" />
                 </div>
                 <div className="relative z-10 p-4 sm:p-8 space-y-8 sm:space-y-12">
                    <h2 className="text-3xl sm:text-4xl font-black italic tracking-tighter uppercase text-white gold-glow">The Big Stage</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl">
                        <h2 className="text-[10px] font-black uppercase text-amber-500 mb-6 tracking-widest">Growth</h2>
                        <div className="h-[150px] w-full"><ResponsiveContainer width="100%" height="100%"><LineChart data={gameState.history}><XAxis dataKey="month" hide /><YAxis hide /><Line type="monotone" dataKey="fans" stroke="#D4AF37" strokeWidth={4} dot={false} /></LineChart></ResponsiveContainer></div>
                      </div>
                      <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-3xl p-6 shadow-2xl">
                        <h2 className="text-[10px] font-black uppercase text-amber-500 mb-6 tracking-widest">Contract</h2>
                        <div className="flex items-center gap-4"><span className="text-5xl">{activeLabel?.logo}</span><div><div className="font-black text-white text-lg uppercase tracking-tight">{activeLabel?.name}</div><div className="text-[10px] text-zinc-400 font-bold">Level {activeLabel?.prestige}</div></div></div>
                      </div>
                    </div>
                 </div>
              </div>
            )}
            {view === 'studio' && (
              <div className="bg-zinc-950 border border-white/5 rounded-3xl p-6 sm:p-12 min-h-[500px] flex flex-col items-center justify-center text-center shadow-2xl relative overflow-hidden">
                {recordingPhase === 'idle' && (
                  <div className="space-y-8">
                    <div className="text-6xl mb-4">🎙️</div>
                    <h2 className="text-4xl font-black italic uppercase gold-glow">Soundstage</h2>
                    <button onClick={startDrafting} className="bg-white text-black px-12 py-5 rounded-full font-black text-xs uppercase tracking-widest hover:bg-amber-500 transition-all active:scale-95">Book Session</button>
                  </div>
                )}
                {recordingPhase === 'drafting' && (
                   <div className="w-full max-w-md space-y-8 text-left animate-in slide-in-from-bottom-4">
                      <h2 className="text-2xl font-black italic uppercase">New Song</h2>
                      <div className="space-y-4">
                        <input type="text" className="w-full bg-zinc-900 border border-white/5 rounded-xl p-4 text-white font-bold" placeholder="Song title..." value={draftForm.title} onChange={e => setDraftForm({...draftForm, title: e.target.value})} />
                        <select className="w-full bg-zinc-900 border border-white/5 rounded-xl p-4 text-white font-bold" value={draftForm.genre} onChange={e => setDraftForm({...draftForm, genre: e.target.value as Genre})}>{Object.values(Genre).map(g => <option key={g} value={g}>{g}</option>)}</select>
                      </div>
                      <button disabled={!draftForm.title || isBusy} onClick={startReview} className="w-full bg-white text-black py-4 rounded-xl font-black text-xs uppercase tracking-widest">{isBusy ? 'Brainstorming...' : 'Write Lyrics'}</button>
                   </div>
                )}
                {recordingPhase === 'review' && (
                  <div className="w-full max-w-2xl space-y-8 animate-in fade-in">
                    <div className="bg-zinc-900/50 p-8 rounded-3xl border border-white/5"><p className="text-xl sm:text-2xl italic font-light leading-relaxed text-zinc-100">"{activeLyrics}"</p></div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <button onClick={saveToVaultDraft} className="bg-zinc-800 text-white py-4 rounded-xl font-black text-xs uppercase tracking-widest">Save as Draft</button>
                      <button onClick={startRecording} className="bg-white text-black py-4 rounded-xl font-black text-xs uppercase tracking-widest">Record Now</button>
                    </div>
                  </div>
                )}
                {recordingPhase === 'recording' && (
                  <div className="w-full max-w-2xl space-y-12 animate-in slide-in-from-bottom-8">
                    <h2 className="text-[10px] uppercase font-black text-red-600 animate-pulse tracking-[0.4em]">RECORDING: "{draftForm.title}"</h2>
                    <div className="bg-zinc-900/50 p-10 rounded-3xl min-h-[160px] flex items-center justify-center border border-white/5"><p className="text-2xl font-black italic text-zinc-300">"{activeLyrics}"</p></div>
                    <div className="relative h-4 w-full bg-zinc-900 rounded-full overflow-hidden border border-white/5"><div className="absolute w-3 h-full bg-white" style={{ left: `${sliderPos}%` }} /></div>
                    <button onPointerDown={handleTap} className="w-32 h-32 rounded-full bg-crimson hover:bg-red-600 text-white font-black text-sm uppercase shadow-2xl active:scale-90 mx-auto">TAP</button>
                  </div>
                )}
                {recordingPhase === 'results' && (
                  <div className="space-y-10">
                    <h2 className="text-3xl font-black uppercase italic">Mastered</h2>
                    <div className="text-8xl font-black text-amber-500 italic">{Math.round(miniGameScore.reduce((a,b)=>a+b,0)/miniGameScore.length)}%</div>
                    <button onClick={saveToVault} className="bg-white text-black px-16 py-5 rounded-full font-black text-xs uppercase tracking-widest shadow-2xl">Finalize Master</button>
                  </div>
                )}
              </div>
            )}
            {view === 'social' && (
               <div className="max-w-4xl mx-auto space-y-8">
                  <div className="flex bg-zinc-950 p-1 rounded-full border border-white/5 overflow-x-auto no-scrollbar">
                    {(Object.keys(PLATFORM_THEMES) as SocialPlatform[]).map(plat => (
                      <button key={plat} onClick={() => setActivePlatform(plat)} className={`flex-shrink-0 flex items-center gap-2 px-6 py-4 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${activePlatform === plat ? `${PLATFORM_THEMES[plat].bg} text-white shadow-xl` : 'text-zinc-500'}`}><span>{PLATFORM_THEMES[plat].icon}</span>{plat}</button>
                    ))}
                  </div>
                  <div className="flex bg-zinc-950 p-1.5 rounded-full border border-white/5 w-fit mx-auto">
                    <button onClick={() => setSocialSubTab('live')} className={`px-8 py-2.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${socialSubTab === 'live' ? 'bg-white text-black' : 'text-zinc-500'}`}>Feed</button>
                    <button onClick={() => setSocialSubTab('vault')} className={`px-8 py-2.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${socialSubTab === 'vault' ? 'bg-white text-black' : 'text-zinc-500'}`}>Vault ({gameState.unreleasedSongs.length})</button>
                    <button onClick={() => setSocialSubTab('deals')} className={`px-8 py-2.5 rounded-full text-[9px] font-black uppercase tracking-widest transition-all ${socialSubTab === 'deals' ? 'bg-white text-black' : 'text-zinc-500'}`}>Deals</button>
                  </div>
                  {socialSubTab === 'vault' && (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                      {gameState.unreleasedSongs.map(song => (
                        <div key={song.id} className="bg-zinc-950 p-6 rounded-3xl border border-white/5 flex flex-col gap-4">
                          <div><h3 className="text-xl font-black italic uppercase text-white">{song.title}</h3><div className="text-[10px] font-black text-zinc-500 uppercase">{song.genre} • {song.isMastered ? `${song.quality}% QLT` : 'Draft'}</div></div>
                          <div className="mt-auto">
                            {!song.isMastered ? (<button onClick={() => startRecordingFromDraft(song)} className="w-full bg-white text-black py-4 rounded-xl font-black text-[10px] uppercase">Record Draft</button>) : (<button onClick={() => distributeSong(song, activePlatform)} className="w-full bg-emerald-600 text-white py-4 rounded-xl font-black text-[10px] uppercase">Publish</button>)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {socialSubTab === 'live' && (
                    <div className="space-y-6">
                       <div className="bg-zinc-950 p-6 rounded-3xl border border-white/5 space-y-4">
                          <textarea value={postDraft.content} onChange={e => setPostDraft({...postDraft, content: e.target.value})} className="w-full bg-black border border-white/5 rounded-2xl p-4 text-white focus:outline-none" placeholder={`Compose for ${activePlatform}...`} />
                          <button onClick={handlePostSocial} disabled={!postDraft.content || isPosting} className={`w-full py-4 rounded-2xl font-black text-xs uppercase text-white ${PLATFORM_THEMES[activePlatform].bg}`}>Post</button>
                       </div>
                       <div className="space-y-4">{gameState.socialPosts.filter(p => p.platform === activePlatform).map(post => (<div key={post.id} className="bg-zinc-950 p-6 rounded-3xl border border-white/5"><p className="text-lg italic font-light mb-4">"{post.content}"</p></div>))}</div>
                    </div>
                  )}
               </div>
            )}
            {view === 'management' && (
              <div className="space-y-12">
                <div className="bg-zinc-950 p-8 rounded-3xl border border-amber-500/20 shadow-2xl relative overflow-hidden">
                   <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 blur-3xl rounded-full" />
                   <h2 className="text-3xl font-black italic uppercase text-white mb-6">Mobile Distribution Suite</h2>
                   <p className="text-zinc-400 text-sm mb-8 leading-relaxed">As a web-based simulator, we offer PWA installation which functions exactly like an APK on Android. For a native Play Store build, follow the technical steps below.</p>
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="bg-black/40 p-6 rounded-2xl border border-white/5">
                        <div className="text-amber-500 text-[10px] font-black uppercase mb-4 tracking-widest">Option 1: Install PWA</div>
                        <p className="text-xs text-zinc-500 mb-6">Optimized for Android/iOS. Works offline with low storage footprint.</p>
                        <button onClick={() => notify("Tap 'Add to Home Screen' in your browser menu.")} className="w-full bg-white text-black py-4 rounded-xl font-black text-[10px] uppercase">Install Game</button>
                      </div>
                      <div className="bg-black/40 p-6 rounded-2xl border border-white/5">
                        <div className="text-emerald-500 text-[10px] font-black uppercase mb-4 tracking-widest">Option 2: Build Native APK</div>
                        <p className="text-xs text-zinc-500 mb-6">Use Capacitor to wrap this code into a signed Android binary.</p>
                        <button onClick={() => notify("Instructions exported to logs.")} className="w-full bg-emerald-600 text-white py-4 rounded-xl font-black text-[10px] uppercase tracking-widest">Download Guide</button>
                      </div>
                   </div>
                   <div className="mt-8 pt-8 border-t border-white/5">
                      <div className="text-[10px] font-black text-zinc-600 uppercase mb-4">Terminal Output (Simulated)</div>
                      <div className="bg-black p-4 rounded-xl font-mono text-[10px] text-green-500 overflow-x-auto whitespace-nowrap">
                        > npm install @capacitor/core @capacitor/cli<br/>
                        > npx cap init "Stardom" "com.stardom.game"<br/>
                        > npx cap add android<br/>
                        > npx cap copy android<br/>
                        > ./gradlew assembleDebug<br/>
                        > BUILD SUCCESSFUL: app-debug.apk created.
                      </div>
                   </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  {LABELS.filter(l => l.id !== 'indie_self').map(label => {
                    const eligible = gameState.player.fame >= label.fameRequirement;
                    return (<div key={label.id} className={`bg-zinc-950 p-8 rounded-3xl border ${eligible ? 'border-amber-900/30' : 'border-zinc-900 opacity-40'}`}><div className="text-5xl mb-4">{label.logo}</div><h3 className="text-2xl font-black uppercase text-white">{label.name}</h3><button disabled={!eligible || gameState.player.labelId === label.id} onClick={() => setGameState(s => ({...s, player: {...s.player, money: s.player.money + label.signingBonus, labelId: label.id }}))} className={`w-full py-4 rounded-xl font-black text-[10px] uppercase mt-6 ${gameState.player.labelId === label.id ? 'bg-zinc-800 text-zinc-500' : eligible ? 'bg-white text-black' : 'bg-zinc-900 text-zinc-700'}`}>{gameState.player.labelId === label.id ? 'Signed' : eligible ? 'Sign Deal' : `Req: ${(label.fameRequirement/1000).toFixed(0)}K`}</button></div>);
                  })}
                </div>
              </div>
            )}
            {view === 'charts' && (
              <div className="bg-zinc-950 border border-white/5 rounded-3xl p-6 sm:p-10 shadow-2xl">
                <h2 className="text-4xl font-black italic tracking-tighter uppercase gold-glow mb-12">World Charts</h2>
                <div className="space-y-4">{REAL_ARTISTS_DATA.slice(0, 50).sort((a,b) => b.fame - a.fame).map((artist, i) => (<div key={i} className="flex items-center gap-6 p-4 bg-zinc-900/20 rounded-2xl border border-white/5"><div className="text-2xl font-black text-zinc-700 italic w-8">#{i+1}</div><div className="flex-1"><div className="font-black text-white text-lg uppercase">{artist.name}</div></div><div className="text-right text-amber-500 font-black">{(artist.fame / 1000000).toFixed(1)}M</div></div>))}</div>
              </div>
            )}
          </div>
        </main>
      </div>
      <div className="fixed bottom-0 left-0 right-0 z-[100] bg-black/80 backdrop-blur-2xl border-t border-white/5 lg:hidden flex justify-around items-center px-2 py-3 safe-pb">
        <ViewIcon active={view === 'home'} onClick={() => setView('home')} icon="🌑" label="Lobby" />
        <ViewIcon active={view === 'studio'} onClick={() => setView('studio')} icon="🎙️" label="Studio" />
        <ViewIcon active={view === 'social'} onClick={() => setView('social')} icon="✨" label="Social" />
        <ViewIcon active={view === 'management'} onClick={() => setView('management')} icon="👔" label="Exec" />
        <button onClick={advanceTime} className="bg-white text-black p-4 rounded-2xl shadow-xl active:scale-95 transition-all mx-2"><span className="text-xl font-black italic">NEXT</span></button>
      </div>
    </div>
  );
};

export default App;
