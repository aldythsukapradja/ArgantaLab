'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { ImageStudio, VideoStudio, ClippingStudio, VibeMotionStudio, LipSyncStudio, RecastStudio, CinemaStudio, AudioStudio, MarketingStudio, AiInfluencerStudio, LibraryStudio, CharacterStudio, GraphStudio, PublisherStudio, getUserBalance, subscribeCharacters, getActiveCharacterId, listCharacters } from 'studio';
import axios from 'axios';
import ApiKeyModal from './ApiKeyModal';

const TABS = [
  { id: 'image',   label: 'Image Studio',   short: 'Image',   icon: '🖼️', group: 'Create' },
  { id: 'video',   label: 'Video Studio',   short: 'Video',   icon: '🎬', group: 'Create' },
  { id: 'cinema',  label: 'Cinema Studio',  short: 'Cinema',  icon: '🎥', group: 'Create' },
  { id: 'audio',   label: 'Audio Studio',   short: 'Audio',   icon: '🎵', group: 'Create' },
  { id: 'lipsync', label: 'Lip Sync',       short: 'LipSync', icon: '💬', group: 'Create' },
  { id: 'body-swap', label: 'Body Swap',    short: 'Recast',  icon: '🕺', group: 'Create' },
  { id: 'vibe-motion', label: 'Vibe Motion', short: 'Motion', icon: '✨', group: 'Create' },
  { id: 'clipping', label: 'AI Clipping',   short: 'Clip',    icon: '✂️', group: 'Create' },
  { id: 'characters', label: 'Souls',       short: 'Souls',   icon: '👤', group: 'Identity' },
  { id: 'publisher', label: 'Publisher', short: 'Publish', icon: '🚀', group: 'Publish' },
  { id: 'marketing', label: 'Marketing Studio', short: 'Marketing', icon: '📣', group: 'Publish' },
  { id: 'ai-influencer', label: 'AI Influencer Studio', short: 'Influencer', icon: '🌟', group: 'Publish' },
  { id: 'library', label: 'Library',        short: 'Library', icon: '📚', group: 'Library' },
  { id: 'graph',   label: 'Knowledge Graph', short: 'Graph',  icon: '🕸️', group: 'Library' },
];

const NAV_GROUPS = ['Create', 'Identity', 'Publish', 'Library'];

const STORAGE_KEY = 'muapi_key';

export default function StandaloneShell() {
  const params = useParams();
  const router = useRouter();
  const slug = params?.slug || [];

  // Initialize activeTab from URL slug or default to 'image'
  const getInitialTab = () => {
    const firstSegment = slug[0];
    if (firstSegment && TABS.find(t => t.id === firstSegment)) return firstSegment;
    return 'image';
  };
  
  const [apiKey, setApiKey] = useState(null);
  const [activeTab, setActiveTab] = useState(getInitialTab());

  const [balance, setBalance] = useState(null);
  const [showSettings, setShowSettings] = useState(false);
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [hasMounted, setHasMounted] = useState(false);
  const [activeSoul, setActiveSoul] = useState(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Reflect the active Soul character in the header (updates live on change).
  useEffect(() => {
    const sync = async () => {
      const id = getActiveCharacterId();
      if (!id) { setActiveSoul(null); return; }
      const all = await listCharacters();
      setActiveSoul(all.find((c) => c.id === id) || null);
    };
    sync();
    return subscribeCharacters(sync);
  }, []);

  // Drag and Drop State
  const [isDragging, setIsDragging] = useState(false);
  const [droppedFiles, setDroppedFiles] = useState(null);

  // ── Global Generation Notifications ────────────────────────────────────────
  const [notifications, setNotifications] = useState([]);
  const activeTabRef = useRef(null);
  useEffect(() => { activeTabRef.current = activeTab; }, [activeTab]);

  const pushNotification = useCallback((notif) => {
    const id = `notif-${Date.now()}-${Math.random()}`;
    const entry = { ...notif, id };
    setNotifications(prev => [entry, ...prev].slice(0, 5));
    const ttl = notif.type === 'success' ? 8000 : 6000;
    setTimeout(() => setNotifications(prev => prev.filter(n => n.id !== id)), ttl);
  }, []);

  const dismissNotification = useCallback((id) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  const makeSuccessCallback = useCallback((tabId) => (data) => {
    const tab = TABS.find(t => t.id === tabId);
    pushNotification({ type: 'success', tabId, label: tab?.label || tabId, data });
  }, [pushNotification]);

  const makeErrorCallback = useCallback((tabId) => (message) => {
    const tab = TABS.find(t => t.id === tabId);
    pushNotification({ type: 'error', tabId, label: tab?.label || tabId, message });
  }, [pushNotification]);

  // Popstate event listener to sync tab state with URL on back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const path = window.location.pathname;
      const segments = path.split('/').filter(Boolean);
      const tabId = segments[1] || 'image';
      if (TABS.find(t => t.id === tabId)) {
        setActiveTab(tabId);
      }
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const handleTabChange = (tabId) => {
    window.history.pushState(null, '', `/studio/${tabId}`);
    setActiveTab(tabId);
    setMobileNavOpen(false);
  };

  const handleTabClick = (e, tabId) => {
    if (e.button === 0 && !e.ctrlKey && !e.metaKey && !e.shiftKey && !e.altKey) {
      e.preventDefault();
      handleTabChange(tabId);
    }
  };

  const fetchBalance = useCallback(async (key) => {
    if (key === 'local') return; // sovereign-only mode — no upstream account
    try {
      const data = await getUserBalance(key);
      setBalance(data.balance);
    } catch (err) {
      console.error('Balance fetch failed:', err);
    }
  }, []);

  useEffect(() => {
    setHasMounted(true);
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      setApiKey(stored);
      fetchBalance(stored);
      // Sync cookie immediately on mount to establish identity for background requests
      document.cookie = `muapi_key=${stored}; path=/; max-age=31536000; SameSite=Lax`;
    }
  }, [fetchBalance]);

  const handleKeySave = useCallback((key) => {
    localStorage.setItem(STORAGE_KEY, key);
    setApiKey(key);
    fetchBalance(key);
    document.cookie = `muapi_key=${key}; path=/; max-age=31536000; SameSite=Lax`;
  }, [fetchBalance]);

  const handleKeyChange = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setApiKey(null);
    setBalance(null);
    document.cookie = "muapi_key=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
  }, []);

  // Inject API key into all outgoing Axios requests (prop-based approach)
  // We use an interceptor to be selective and NOT send the key to external domains like S3
  useEffect(() => {
    // Safety: Clear any global defaults that might have been set previously
    delete axios.defaults.headers.common['x-api-key'];

    if (!apiKey) return;

    const interceptorId = axios.interceptors.request.use((config) => {
      // Check if URL is local/proxied
      const isRelative = config.url.startsWith('/') || !config.url.startsWith('http');
      const isInternalProxy = config.url.includes('/api/app') || config.url.includes('/api/workflow') || config.url.includes('/api/agents') || config.url.includes('/api/api') || config.url.includes('/api/v1');

      if (isRelative || isInternalProxy) {
        config.headers['x-api-key'] = apiKey;
      }
      
      return config;
    });

    return () => {
      axios.interceptors.request.eject(interceptorId);
    };
  }, [apiKey]);

  // Poll for balance every 30 seconds if key is present
  useEffect(() => {
    if (!apiKey) return;
    const interval = setInterval(() => fetchBalance(apiKey), 30000);
    return () => clearInterval(interval);
  }, [apiKey, fetchBalance]);

  // Drag and Drop Handlers
  const handleDragOver = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDragEnter = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
      setIsDragging(true);
    }
  }, []);

  const handleDragLeave = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    // Only set to false if we're leaving the container itself, not moving between children
    if (e.currentTarget.contains(e.relatedTarget)) return;
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) {
      setDroppedFiles(files);
    }
  }, []);

  const handleFilesHandled = useCallback(() => {
    setDroppedFiles(null);
  }, []);

  if (!hasMounted) return (
    <div className="min-h-screen bg-[#050505] flex items-center justify-center">
      <div className="animate-spin text-[#22d3ee] text-3xl">◌</div>
    </div>
  );

  if (!apiKey) {
    return <ApiKeyModal onSave={handleKeySave} />;
  }

  return (
    <div 
      className="h-screen bg-[#030303] flex flex-col overflow-hidden text-white relative"
      onDragOver={handleDragOver}
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* ── Wow: animated aurora backdrop (behind everything, non-interactive) ── */}
      <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
        <div className="aurora-blob aurora-1" />
        <div className="aurora-blob aurora-2" />
        <div className="aurora-blob aurora-3" />
        <div className="absolute inset-0 bg-[#030303]/40" />
      </div>

      {/* Drag Overlay */}
      {isDragging && (
        <div className="fixed inset-0 z-[100] bg-[#22d3ee]/10 backdrop-blur-md border-4 border-dashed border-[#22d3ee]/50 flex items-center justify-center pointer-events-none transition-all duration-300">
          <div className="bg-[#0a0a0a] p-8 rounded-3xl border border-white/10 shadow-2xl flex flex-col items-center gap-4 scale-110 animate-pulse">
            <div className="w-20 h-20 bg-[#22d3ee] rounded-2xl flex items-center justify-center">
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="black" strokeWidth="2.5">
                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12"/>
              </svg>
            </div>
            <div className="flex flex-col items-center">
              <span className="text-xl font-bold text-white">Drop your media here</span>
              <span className="text-sm text-white/40">Images, videos, or audio files</span>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      {isHeaderVisible && (
        <header className="flex-shrink-0 h-14 border-b border-white/[0.06] flex items-center justify-between px-3 sm:px-6 bg-black/30 backdrop-blur-xl z-40 gap-2 sm:gap-4">
          {/* Left: hamburger (mobile) + Logo */}
          <div className="flex-shrink-0 flex items-center gap-2">
            <button
              onClick={() => setMobileNavOpen(true)}
              aria-label="Open menu"
              className="lg:hidden w-9 h-9 -ml-1 flex items-center justify-center rounded-lg text-white/70 hover:text-white hover:bg-white/10 transition-colors active:scale-95"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 12h18M3 6h18M3 18h18"/></svg>
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-gradient-to-br from-[#22d3ee] to-[#a855f7] shadow-[0_0_16px_rgba(34,211,238,0.35)]">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/>
                </svg>
              </div>
              <span className="text-sm font-bold tracking-tight hidden sm:block bg-gradient-to-r from-white to-white/60 bg-clip-text text-transparent">ArgantaStudio</span>
            </div>
          </div>

          {/* Center: desktop navigation (hidden on mobile — drawer takes over) */}
          <nav className="hidden lg:flex items-center gap-1 flex-1 justify-center min-w-0 overflow-x-auto scrollbar-none">
            {TABS.map((tab) => (
              <a
                key={tab.id}
                href={`/studio/${tab.id}`}
                onClick={(e) => handleTabClick(e, tab.id)}
                className={`relative text-[13px] font-medium transition-all duration-300 whitespace-nowrap px-3 py-1.5 rounded-lg flex-shrink-0 ${
                  activeTab === tab.id
                    ? 'text-[#22d3ee] bg-[#22d3ee]/10'
                    : 'text-white/50 hover:text-white hover:bg-white/5'
                }`}
              >
                <span className="relative z-10">{tab.short}</span>
              </a>
            ))}
          </nav>

          {/* Mobile: current tab name (center) */}
          <div className="lg:hidden flex-1 min-w-0 flex items-center justify-center">
            <span className="text-[13px] font-bold text-white/90 truncate flex items-center gap-1.5">
              <span>{TABS.find(t => t.id === activeTab)?.icon}</span>
              {TABS.find(t => t.id === activeTab)?.label}
            </span>
          </div>

          {/* Right: Actions */}
          <div className="flex-shrink-0 flex items-center gap-2 sm:gap-3">
            {activeSoul && (
              <button
                onClick={() => handleTabChange('characters')}
                title={`Active Soul: ${activeSoul.name} (${activeSoul.trigger_token}) — injected into every generation`}
                className="flex items-center gap-2 bg-[#22d3ee]/10 border border-[#22d3ee]/30 px-2 sm:px-3 py-1.5 rounded-full hover:bg-[#22d3ee]/20 transition-colors"
              >
                <div className="w-2 h-2 rounded-full bg-[#22d3ee] animate-pulse" />
                <span className="text-xs font-bold text-[#22d3ee] max-w-[80px] sm:max-w-[120px] truncate hidden sm:block">{activeSoul.name}</span>
              </button>
            )}
            {apiKey !== 'local' && (
              <div className="hidden sm:flex items-center gap-3 bg-white/5 px-3 py-1.5 rounded-full border border-white/5">
                <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                <span className="text-xs font-bold text-white/90">${balance !== null ? `${balance}` : '---'}</span>
              </div>
            )}

            <button
              onClick={() => setShowSettings(true)}
              title="Settings"
              className="flex items-center gap-2 px-2.5 sm:px-3 py-1.5 rounded-lg border border-white/10 bg-white/5 text-[13px] font-bold text-white/80 hover:text-white hover:bg-white/10 hover:border-white/20 transition-colors active:scale-95"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              <span className="hidden sm:inline">Settings</span>
            </button>
          </div>
        </header>
      )}

      {/* ── Mobile navigation drawer ── */}
      {mobileNavOpen && (
        <div className="lg:hidden fixed inset-0 z-[90]" onClick={() => setMobileNavOpen(false)}>
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in-up" style={{ animationDuration: '160ms' }} />
          <div
            className="absolute inset-y-0 left-0 w-[78%] max-w-[320px] bg-[#0a0a0c] border-r border-white/10 shadow-2xl flex flex-col"
            style={{ animation: 'slideInLeft 240ms cubic-bezier(0.16,1,0.3,1) forwards' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-5 h-14 border-b border-white/10 flex-shrink-0">
              <span className="text-sm font-bold bg-gradient-to-r from-[#22d3ee] to-[#a855f7] bg-clip-text text-transparent">ArgantaStudio</span>
              <button onClick={() => setMobileNavOpen(false)} aria-label="Close menu" className="w-8 h-8 flex items-center justify-center rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-colors">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6L6 18M6 6l12 12"/></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto py-3 px-3">
              {NAV_GROUPS.map((group) => (
                <div key={group} className="mb-4">
                  <div className="px-3 mb-1.5 text-[10px] uppercase tracking-widest text-white/30 font-bold">{group}</div>
                  {TABS.filter((t) => t.group === group).map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => handleTabChange(tab.id)}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all ${
                        activeTab === tab.id
                          ? 'bg-gradient-to-r from-[#22d3ee]/20 to-[#a855f7]/10 text-white border border-[#22d3ee]/30'
                          : 'text-white/60 hover:text-white hover:bg-white/5 border border-transparent'
                      }`}
                    >
                      <span className="text-lg w-6 text-center">{tab.icon}</span>
                      <span className="text-sm font-medium">{tab.label}</span>
                      {activeTab === tab.id && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-[#22d3ee]" />}
                    </button>
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Studio Content */}
      <div className="flex-1 min-h-0 relative overflow-hidden">
        <div className={activeTab === 'image' ? "h-full w-full" : "hidden"}>
          <ImageStudio apiKey={apiKey} droppedFiles={droppedFiles} onFilesHandled={handleFilesHandled} onGenerationComplete={makeSuccessCallback('image')} onGenerationError={makeErrorCallback('image')} />
        </div>
        <div className={activeTab === 'video' ? "h-full w-full" : "hidden"}>
          <VideoStudio apiKey={apiKey} droppedFiles={droppedFiles} onFilesHandled={handleFilesHandled} onGenerationComplete={makeSuccessCallback('video')} onGenerationError={makeErrorCallback('video')} />
        </div>
        <div className={activeTab === 'clipping' ? "h-full w-full" : "hidden"}>
          <ClippingStudio apiKey={apiKey} droppedFiles={droppedFiles} onFilesHandled={handleFilesHandled} onGenerationComplete={makeSuccessCallback('clipping')} onGenerationError={makeErrorCallback('clipping')} />
        </div>
        <div className={activeTab === 'vibe-motion' ? "h-full w-full" : "hidden"}>
          <VibeMotionStudio apiKey={apiKey} onGenerationComplete={makeSuccessCallback('vibe-motion')} onGenerationError={makeErrorCallback('vibe-motion')} />
        </div>
        <div className={activeTab === 'lipsync' ? "h-full w-full" : "hidden"}>
          <LipSyncStudio apiKey={apiKey} droppedFiles={droppedFiles} onFilesHandled={handleFilesHandled} onGenerationComplete={makeSuccessCallback('lipsync')} onGenerationError={makeErrorCallback('lipsync')} />
        </div>
        <div className={activeTab === 'body-swap' ? "h-full w-full" : "hidden"}>
          <RecastStudio apiKey={apiKey} droppedFiles={droppedFiles} onFilesHandled={handleFilesHandled} onGenerationComplete={makeSuccessCallback('body-swap')} onGenerationError={makeErrorCallback('body-swap')} />
        </div>
        <div className={activeTab === 'cinema' ? "h-full w-full" : "hidden"}>
          <CinemaStudio apiKey={apiKey} onGenerationComplete={makeSuccessCallback('cinema')} onGenerationError={makeErrorCallback('cinema')} />
        </div>
        <div className={activeTab === 'audio' ? "h-full w-full" : "hidden"}>
          <AudioStudio apiKey={apiKey} droppedFiles={droppedFiles} onFilesHandled={handleFilesHandled} onGenerationComplete={makeSuccessCallback('audio')} onGenerationError={makeErrorCallback('audio')} />
        </div>
        <div className={activeTab === 'marketing' ? "h-full w-full" : "hidden"}>
          <MarketingStudio apiKey={apiKey} droppedFiles={droppedFiles} onFilesHandled={handleFilesHandled} onGenerationComplete={makeSuccessCallback('marketing')} onGenerationError={makeErrorCallback('marketing')} />
        </div>
        <div className={activeTab === 'ai-influencer' ? "h-full w-full" : "hidden"}>
          <AiInfluencerStudio apiKey={apiKey} />
        </div>
        <div className={activeTab === 'characters' ? "h-full w-full" : "hidden"}>
          <CharacterStudio />
        </div>
        <div className={activeTab === 'library' ? "h-full w-full" : "hidden"}>
          <LibraryStudio apiKey={apiKey} />
        </div>
        <div className={activeTab === 'graph' ? "h-full w-full" : "hidden"}>
          <GraphStudio />
        </div>
        <div className={activeTab === 'publisher' ? "h-full w-full" : "hidden"}>
          <PublisherStudio />
        </div>
      </div>

      {/* ── Global Generation Notification Stack ── */}
      {notifications.length > 0 && (
        <div
          aria-live="polite"
          className="fixed bottom-6 right-6 z-[200] flex flex-col gap-3 pointer-events-none"
          style={{ maxWidth: '360px' }}
        >
          {notifications.map((notif) => (
            <div
              key={notif.id}
              className="pointer-events-auto flex items-start gap-3 bg-[#0e0e10] border rounded-xl px-4 py-3 shadow-2xl shadow-black/60"
              style={{
                borderColor: notif.type === 'success' ? 'rgba(34,211,238,0.35)' : 'rgba(239,68,68,0.35)',
                borderLeftWidth: '3px',
                borderLeftColor: notif.type === 'success' ? '#22d3ee' : '#ef4444',
                animation: 'slideInRight 280ms cubic-bezier(0.16,1,0.3,1) forwards',
              }}
            >
              {/* Icon */}
              <div
                className="flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center mt-0.5"
                style={{ background: notif.type === 'success' ? 'rgba(34,211,238,0.12)' : 'rgba(239,68,68,0.12)' }}
              >
                {notif.type === 'success' ? (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#22d3ee" strokeWidth="3"><polyline points="20 6 9 17 4 12" /></svg>
                ) : (
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="3"><line x1="12" y1="8" x2="12" y2="12" /><line x1="12" y1="16" x2="12.01" y2="16" /></svg>
                )}
              </div>

              {/* Body */}
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-bold text-white/90 leading-tight">
                  {notif.label}
                  <span className="font-normal text-white/50">
                    {notif.type === 'success' ? ' · Generation complete' : ' · Generation failed'}
                  </span>
                </p>
                {notif.type === 'error' && notif.message && (
                  <p className="text-[11px] text-red-400/80 mt-0.5 leading-snug truncate" title={notif.message}>
                    {notif.message}
                  </p>
                )}
                {notif.type === 'success' && (
                  <button
                    onClick={() => { handleTabChange(notif.tabId); dismissNotification(notif.id); }}
                    className="mt-1.5 text-[11px] font-bold text-[#22d3ee] hover:underline"
                  >
                    Open →
                  </button>
                )}
              </div>

              {/* Dismiss */}
              <button
                onClick={() => dismissNotification(notif.id)}
                className="flex-shrink-0 text-white/30 hover:text-white/70 transition-colors text-lg leading-none mt-0.5"
                aria-label="Dismiss"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Keyframe for toast slide-in */}
      <style>{`
        @keyframes slideInRight {
          from { transform: translateX(110%); opacity: 0; }
          to   { transform: translateX(0);    opacity: 1; }
        }
      `}</style>

      {/* Settings Modal */}
      {showSettings && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 animate-fade-in-up">
          <div className="bg-[#0a0a0a] border border-white/10 rounded-xl p-8 w-full max-w-sm shadow-2xl">
            <h2 className="text-white font-bold text-lg mb-2">Settings</h2>
            <p className="text-white/40 text-[13px] mb-8">
              Manage your AI studio preferences and authentication.
            </p>
            
            <div className="space-y-4 mb-8">
              <div className="bg-white/5 border border-white/[0.03] rounded-md p-4">
                <label className="block text-xs font-bold text-white/30 mb-2">
                   Active API Key
                </label>
                <div className="text-[13px] font-mono text-white/80">
                  {apiKey.slice(0, 8)}••••••••••••••••
                </div>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleKeyChange}
                className="flex-1 h-10 rounded-md bg-red-500/10 text-red-400 hover:bg-red-500/20 text-xs font-semibold transition-all"
              >
                Change Key
              </button>
              <button
                onClick={() => setShowSettings(false)}
                className="flex-1 h-10 rounded-md bg-white/5 text-white/80 hover:bg-white/10 text-xs font-semibold transition-all border border-white/5"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
