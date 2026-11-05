import React, { useState } from 'react';
import { SavedPlace, LatLng } from '../types';
import { LeafletMap } from './LeafletMap';
import { Bookmark, MapPin, Trash2, ArrowLeft, Plus, Check } from 'lucide-react';

interface SavedPlacesScreenProps {
  savedPlaces: SavedPlace[];
  onSavePlace: (place: Omit<SavedPlace, 'id' | 'createdAt'>) => void;
  onDeletePlace: (id: string) => void;
  onBackToPlan: () => void;
  userCoords: LatLng | null;
}

export const SavedPlacesScreen: React.FC<SavedPlacesScreenProps> = ({
  savedPlaces,
  onSavePlace,
  onDeletePlace,
  onBackToPlan,
  userCoords,
}) => {
  const [selectedCoords, setSelectedCoords] = useState<LatLng>(
    userCoords || { lat: 36.8065, lng: 10.1815 }
  );
  const [placeName, setPlaceName] = useState<string>('');
  const [isDefaultStart, setIsDefaultStart] = useState<boolean>(false);
  const [showForm, setShowForm] = useState<boolean>(false);

  const handleMapClick = (coords: LatLng) => {
    setSelectedCoords(coords);
    setShowForm(true);
  };

  const handleSave = () => {
    if (!placeName.trim()) return;
    onSavePlace({
      name: placeName.trim(),
      coords: selectedCoords,
      isDefaultStart,
    });
    setPlaceName('');
    setIsDefaultStart(false);
    setShowForm(false);
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 text-slate-100">
      {/* Top Header */}
      <div className="px-4 py-3 border-b border-slate-800 bg-slate-900/60 flex items-center justify-between">
        <button
          onClick={onBackToPlan}
          className="flex items-center gap-1.5 text-xs font-semibold text-slate-400 hover:text-white px-2.5 py-1.5 rounded-lg bg-slate-800/80 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Plan
        </button>
        <span className="text-xs font-bold text-amber-400 flex items-center gap-1.5">
          <Bookmark className="w-4 h-4" />
          Saved Locations ({savedPlaces.length})
        </span>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Leaflet Map to Pick Location */}
        <div className="relative">
          <LeafletMap
            center={selectedCoords}
            zoom={14}
            startPoint={selectedCoords}
            savedPlaces={savedPlaces}
            onMapClick={handleMapClick}
            className="h-48 w-full rounded-2xl"
          />
          <div className="absolute top-2 left-2 right-2 bg-slate-900/90 text-slate-300 text-[11px] py-1.5 px-3 rounded-lg backdrop-blur text-center border border-slate-700 pointer-events-none shadow">
            Tap map to drop a pin and save a new favorite place
          </div>
        </div>

        {/* New Place Input Form (pops up on tap or button) */}
        {showForm && (
          <div className="bg-slate-900 rounded-2xl p-4 border border-sky-500/50 shadow-xl space-y-3 animate-fadeIn">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-sky-400 flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5" />
                New Place Pin
              </span>
              <span className="text-[10px] text-slate-500 font-mono">
                {selectedCoords.lat.toFixed(4)}, {selectedCoords.lng.toFixed(4)}
              </span>
            </div>

            <input
              type="text"
              placeholder="e.g. Home, Morning Park, Beach Boardwalk..."
              value={placeName}
              onChange={e => setPlaceName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-sky-500"
              autoFocus
            />

            <label className="flex items-center gap-2 cursor-pointer text-xs text-slate-300">
              <input
                type="checkbox"
                checked={isDefaultStart}
                onChange={e => setIsDefaultStart(e.target.checked)}
                className="rounded accent-sky-500"
              />
              <span>Set as default starting point for runs</span>
            </label>
          </div>
        )}

        {/* List of Existing Places */}
        <div className="space-y-2">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider px-1">
            My Saved Locations
          </p>

          {savedPlaces.map(place => (
            <div
              key={place.id}
              className="bg-slate-900/90 rounded-xl p-3 border border-slate-800 flex items-center justify-between hover:border-slate-700 transition"
            >
              <div
                className="flex items-center gap-2.5 cursor-pointer flex-1"
                onClick={() => setSelectedCoords(place.coords)}
              >
                <div className="w-8 h-8 rounded-lg bg-sky-500/10 border border-sky-500/20 flex items-center justify-center text-sky-400">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-200 flex items-center gap-1.5">
                    {place.name}
                    {place.isDefaultStart && (
                      <span className="text-[10px] bg-amber-500/20 text-amber-300 px-1.5 py-0.5 rounded font-normal">
                        Default Start
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] text-slate-500 font-mono">
                    {place.coords.lat.toFixed(4)}, {place.coords.lng.toFixed(4)}
                  </p>
                </div>
              </div>

              <button
                onClick={() => onDeletePlace(place.id)}
                className="text-slate-500 hover:text-rose-400 p-2 rounded-lg transition"
                title="Delete Place"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Main Actions (Strictly 1-2 Prominent Buttons) */}
      <div className="p-4 border-t border-slate-800 bg-slate-900 flex gap-3">
        {showForm ? (
          <button
            type="button"
            disabled={!placeName.trim()}
            onClick={handleSave}
            className="flex-1 py-3.5 px-4 rounded-xl bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-400 hover:to-emerald-400 text-white font-extrabold text-base shadow-lg shadow-sky-500/20 active:scale-[0.98] transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Check className="w-5 h-5" />
            <span>Save Location Pin</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => setShowForm(true)}
            className="flex-1 py-3.5 px-4 rounded-xl bg-gradient-to-r from-sky-500 to-emerald-500 hover:from-sky-400 hover:to-emerald-400 text-white font-extrabold text-base shadow-lg shadow-sky-500/20 active:scale-[0.98] transition flex items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5" />
            <span>Add New Saved Place</span>
          </button>
        )}
      </div>
    </div>
  );
};
