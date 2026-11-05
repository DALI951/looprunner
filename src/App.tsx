import React, { useState, useEffect } from 'react';
import { RouteOption, RunSession, SavedPlace, LatLng } from './types';
import { storage } from './services/storage';
import { PlanScreen } from './components/PlanScreen';
import { ActiveRunScreen } from './components/ActiveRunScreen';
import { SummaryScreen } from './components/SummaryScreen';
import { HistoryScreen } from './components/HistoryScreen';
import { SavedPlacesScreen } from './components/SavedPlacesScreen';
import { UpdateModal } from './components/UpdateModal';
import { Compass, TrendingUp, Bookmark } from 'lucide-react';
import { Capacitor } from '@capacitor/core';

type Screen = 'plan' | 'run' | 'summary' | 'history' | 'places';

export function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('plan');
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);
  const [runs, setRuns] = useState<RunSession[]>([]);
  const [userCoords, setUserCoords] = useState<LatLng | null>(() => {
    const places = storage.getSavedPlaces();
    const defaultStart = places.find(p => p.isDefaultStart) || places[0];
    return defaultStart ? defaultStart.coords : { lat: 36.8065, lng: 10.1815 };
  });

  // Active generation / session states
  const [activeRoute, setActiveRoute] = useState<RouteOption | null>(null);
  const [startPlaceName, setStartPlaceName] = useState<string>('Start Point');
  const [endPlaceName, setEndPlaceName] = useState<string>('Finish Point');
  const [completedSession, setCompletedSession] = useState<RunSession | null>(null);

  // Update modal state
  const [isUpdateOpen, setIsUpdateOpen] = useState<boolean>(false);

  // Detect whether running in native APK / mobile environment
  const isNative = Capacitor.isNativePlatform();

  // Load local data on mount
  useEffect(() => {
    setSavedPlaces(storage.getSavedPlaces());
    setRuns(storage.getRuns());

    // Try to get user current location for map center
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        pos => {
          setUserCoords({
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
          });
        },
        () => {
          setUserCoords({ lat: 36.8065, lng: 10.1815 });
        },
        { timeout: 4000 }
      );
    }
  }, []);

  const handleStartRun = (
    route: RouteOption,
    startName: string,
    endName: string
  ) => {
    setActiveRoute(route);
    setStartPlaceName(startName);
    setEndPlaceName(endName);
    setCurrentScreen('run');
  };

  const handleFinishRun = (session: RunSession) => {
    setCompletedSession(session);
    setCurrentScreen('summary');
  };

  const handleSaveRun = () => {
    if (completedSession) {
      storage.saveRun(completedSession);
      setRuns(storage.getRuns());
    }
    setCompletedSession(null);
    setActiveRoute(null);
    setCurrentScreen('history');
  };

  const handleDiscardRun = () => {
    setCompletedSession(null);
    setActiveRoute(null);
    setCurrentScreen('plan');
  };

  const handleSavePlace = (place: Omit<SavedPlace, 'id' | 'createdAt'>) => {
    const saved = storage.savePlace(place);
    setSavedPlaces(storage.getSavedPlaces());
    return saved;
  };

  const handleDeletePlace = (id: string) => {
    storage.deletePlace(id);
    setSavedPlaces(storage.getSavedPlaces());
  };

  const handleDeleteRun = (id: string) => {
    storage.deleteRun(id);
    setRuns(storage.getRuns());
  };

  const personalRecords = storage.getPersonalRecords();

  const renderScreen = () => {
    switch (currentScreen) {
      case 'plan':
        return (
          <PlanScreen
            savedPlaces={savedPlaces}
            userCoords={userCoords}
            onStartRun={handleStartRun}
            onOpenSavedPlaces={() => setCurrentScreen('places')}
          />
        );

      case 'run':
        if (!activeRoute) {
          setCurrentScreen('plan');
          return null;
        }
        return (
          <ActiveRunScreen
            route={activeRoute}
            startName={startPlaceName}
            endName={endPlaceName}
            onFinishRun={handleFinishRun}
            onCancelRun={() => setCurrentScreen('plan')}
          />
        );

      case 'summary':
        if (!completedSession) {
          setCurrentScreen('plan');
          return null;
        }
        return (
          <SummaryScreen
            session={completedSession}
            personalRecords={personalRecords}
            onSaveRun={handleSaveRun}
            onDiscardRun={handleDiscardRun}
          />
        );

      case 'history':
        return (
          <HistoryScreen
            runs={runs}
            personalRecords={personalRecords}
            onPlanNewRun={() => setCurrentScreen('plan')}
            onOpenUpdates={() => setIsUpdateOpen(true)}
            onDeleteRun={handleDeleteRun}
          />
        );

      case 'places':
        return (
          <SavedPlacesScreen
            savedPlaces={savedPlaces}
            userCoords={userCoords}
            onSavePlace={handleSavePlace}
            onDeletePlace={handleDeletePlace}
            onBackToPlan={() => setCurrentScreen('plan')}
          />
        );

      default:
        return null;
    }
  };

  return (
    <div className="w-full h-full min-h-screen bg-slate-950 flex flex-col font-sans text-slate-100 overflow-hidden">
      {/* 
        Native App Layout: 
        No PC toolbar, no fake phone borders, fills 100% of the screen natively 
      */}
      <main className="w-full flex-1 flex flex-col h-full overflow-hidden">
        {/* Dynamic Screen */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {renderScreen()}
        </div>

        {/* Bottom Nav Bar (Hidden during active run & summary for zero distraction) */}
        {currentScreen !== 'run' && currentScreen !== 'summary' && (
          <nav className="bg-slate-900 border-t border-slate-800 px-6 py-2.5 flex items-center justify-around z-40 select-none pb-safe">
            <button
              onClick={() => setCurrentScreen('plan')}
              className={`flex flex-col items-center gap-1 transition ${
                currentScreen === 'plan'
                  ? 'text-sky-400 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Compass className="w-5 h-5" />
              <span className="text-[10px]">Planner & Map</span>
            </button>

            <button
              onClick={() => setCurrentScreen('places')}
              className={`flex flex-col items-center gap-1 transition ${
                currentScreen === 'places'
                  ? 'text-sky-400 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Bookmark className="w-5 h-5" />
              <span className="text-[10px]">Saved Places</span>
            </button>

            <button
              onClick={() => setCurrentScreen('history')}
              className={`flex flex-col items-center gap-1 transition ${
                currentScreen === 'history'
                  ? 'text-sky-400 font-bold'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <TrendingUp className="w-5 h-5" />
              <span className="text-[10px]">Progress</span>
            </button>
          </nav>
        )}
      </main>

      {/* In-App APK Updates Modal */}
      <UpdateModal isOpen={isUpdateOpen} onClose={() => setIsUpdateOpen(false)} />
    </div>
  );
}

export default App;
