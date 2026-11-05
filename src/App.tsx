import React, { useState, useEffect } from 'react';
import { RouteOption, RunSession, SavedPlace, LatLng } from './types';
import { storage } from './services/storage';
import { PlanScreen } from './components/PlanScreen';
import { ActiveRunScreen } from './components/ActiveRunScreen';
import { SummaryScreen } from './components/SummaryScreen';
import { HistoryScreen } from './components/HistoryScreen';
import { SavedPlacesScreen } from './components/SavedPlacesScreen';
import { UpdateModal } from './components/UpdateModal';
import { Compass, TrendingUp, Bookmark, Smartphone, Monitor, Download } from 'lucide-react';

type Screen = 'plan' | 'run' | 'summary' | 'history' | 'places';

export function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('plan');
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);
  const [runs, setRuns] = useState<RunSession[]>([]);
  const [userCoords, setUserCoords] = useState<LatLng | null>(null);

  // Active generation / session states
  const [activeRoute, setActiveRoute] = useState<RouteOption | null>(null);
  const [startPlaceName, setStartPlaceName] = useState<string>('Start Point');
  const [endPlaceName, setEndPlaceName] = useState<string>('Finish Point');
  const [completedSession, setCompletedSession] = useState<RunSession | null>(null);

  // Update modal state
  const [isUpdateOpen, setIsUpdateOpen] = useState<boolean>(false);

  // PC preview mobile frame toggle
  const [isPhoneFrame, setIsPhoneFrame] = useState<boolean>(true);

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
          // Default fallback (Tunis coords)
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
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center relative font-sans text-slate-100">
      {/* Top PC Web Toolbar */}
      <header className="w-full bg-slate-900/90 border-b border-slate-800 px-4 py-2 flex items-center justify-between text-xs z-50">
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full bg-sky-400"></span>
          <span className="font-extrabold tracking-tight text-white text-sm">
            LoopRunner
          </span>
          <span className="hidden sm:inline bg-sky-950 text-sky-400 font-mono text-[10px] px-2 py-0.5 rounded border border-sky-800">
            OpenStreetMap • Free Routing
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsUpdateOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-950 hover:bg-sky-900 text-sky-300 text-xs font-bold border border-sky-800 transition"
          >
            <Download className="w-3.5 h-3.5" />
            <span>APK Updates</span>
          </button>

          <button
            onClick={() => setIsPhoneFrame(!isPhoneFrame)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition"
          >
            {isPhoneFrame ? (
              <>
                <Monitor className="w-3.5 h-3.5 text-sky-400" />
                <span className="hidden sm:inline">Full Screen</span>
              </>
            ) : (
              <>
                <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Phone View</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Container */}
      <main
        className={`w-full flex-1 flex flex-col transition-all duration-300 ${
          isPhoneFrame
            ? 'max-w-[430px] my-3 h-[850px] max-h-[92vh] rounded-[38px] border-[8px] border-slate-800 shadow-2xl shadow-sky-950/40 overflow-hidden relative'
            : 'max-w-4xl h-full'
        }`}
      >
        {/* Dynamic Screen */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {renderScreen()}
        </div>

        {/* Bottom Nav Bar (Hidden during active run & summary for zero distraction) */}
        {currentScreen !== 'run' && currentScreen !== 'summary' && (
          <nav className="bg-slate-900 border-t border-slate-800 px-6 py-2.5 flex items-center justify-around z-40">
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
