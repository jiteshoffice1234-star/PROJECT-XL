import React from 'react';
import { AppSettings } from '../../types';
import { Settings, Keyboard, Sliders, Moon, Sun, Volume2, Shield, RefreshCw } from 'lucide-react';

interface SettingsViewProps {
  settings: AppSettings;
  onUpdateSettings: (updates: Partial<AppSettings>) => void;
  onResetAllData: () => void;
}

const SHORTCUTS = [
  { key: 'Ctrl + C', desc: 'Copy selected cell(s) TSV' },
  { key: 'Ctrl + V', desc: 'Paste cells (supports Excel / tab-separated data)' },
  { key: 'Ctrl + X', desc: 'Cut selected cells' },
  { key: 'Ctrl + Z', desc: 'Undo last edit or format' },
  { key: 'Ctrl + Y', desc: 'Redo previously undone change' },
  { key: 'Ctrl + A', desc: 'Select all cells in the sheet' },
  { key: 'Delete / Backspace', desc: 'Clear contents of selected cells' },
  { key: 'Enter', desc: 'Commit edit and move to row below' },
  { key: 'Tab', desc: 'Commit edit and move to column on right' },
  { key: 'Shift + Tab', desc: 'Move to previous column' },
  { key: 'Arrow Keys', desc: 'Navigate active cell across grid' },
  { key: 'Shift + Arrow', desc: 'Extend rectangular cell selection' },
  { key: 'Ctrl + Arrow', desc: 'Jump to the boundary of populated data' },
  { key: 'F2 / Double Click', desc: 'Edit formula or value in cell' },
  { key: 'Ctrl + S', desc: 'Instant manual save snapshot' },
  { key: 'Ctrl + K', desc: 'Open Global Search modal' },
];

export const SettingsView: React.FC<SettingsViewProps> = ({
  settings,
  onUpdateSettings,
  onResetAllData,
}) => {
  return (
    <div className="flex-1 flex flex-col bg-neutral-950 text-neutral-200 overflow-y-auto p-6 space-y-6">
      <div className="pb-4 border-b border-neutral-800">
        <div className="flex items-center space-x-2">
          <Settings className="w-6 h-6 text-cyan-400" />
          <h1 className="text-xl font-bold tracking-tight text-white">Application Settings & Shortcuts</h1>
        </div>
        <p className="text-xs text-neutral-400 mt-1">
          Configure interface appearance, keyboard shortcuts reference, and voice preferences.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Appearance & Behavior */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center space-x-2">
            <Sliders className="w-5 h-5 text-cyan-400" />
            <h2 className="text-sm font-bold text-white">Interface & Display Preferences</h2>
          </div>

          <div className="space-y-4 text-xs pt-2">
            <div className="flex items-center justify-between p-3 bg-neutral-950 rounded-lg border border-neutral-800">
              <div>
                <span className="font-semibold text-white block">Theme Mode</span>
                <span className="text-neutral-500 text-[11px]">Choose between Dark Graphite and Light</span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => onUpdateSettings({ theme: 'dark' })}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded text-xs font-semibold transition ${
                    settings.theme === 'dark'
                      ? 'bg-cyan-600 text-white'
                      : 'bg-neutral-800 text-neutral-400 hover:text-white'
                  }`}
                >
                  <Moon className="w-3.5 h-3.5" />
                  <span>Dark</span>
                </button>
                <button
                  onClick={() => onUpdateSettings({ theme: 'light' })}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded text-xs font-semibold transition ${
                    settings.theme === 'light'
                      ? 'bg-cyan-600 text-white'
                      : 'bg-neutral-800 text-neutral-400 hover:text-white'
                  }`}
                >
                  <Sun className="w-3.5 h-3.5" />
                  <span>Light</span>
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between p-3 bg-neutral-950 rounded-lg border border-neutral-800">
              <div>
                <span className="font-semibold text-white block">Show Grid Lines</span>
                <span className="text-neutral-500 text-[11px]">Display crisp borders between cells</span>
              </div>
              <input
                type="checkbox"
                checked={settings.showGridLines}
                onChange={(e) => onUpdateSettings({ showGridLines: e.target.checked })}
                className="w-4 h-4 text-cyan-600 rounded bg-neutral-900 border-neutral-700 focus:ring-cyan-500"
              />
            </div>

            <div className="flex items-center justify-between p-3 bg-neutral-950 rounded-lg border border-neutral-800">
              <div>
                <span className="font-semibold text-white block">Voice Feedback (TTS)</span>
                <span className="text-neutral-500 text-[11px]">Default speech model for announcements</span>
              </div>
              <select
                value={settings.ttsVoice}
                onChange={(e) => onUpdateSettings({ ttsVoice: e.target.value })}
                className="bg-neutral-900 text-white px-2.5 py-1 text-xs border border-neutral-700 rounded outline-none"
              >
                <option value="Kore">Kore (Clear Female)</option>
                <option value="Puck">Puck (Dynamic Male)</option>
                <option value="Fenrir">Fenrir (Authoritative)</option>
                <option value="Zephyr">Zephyr (Soft)</option>
              </select>
            </div>
          </div>

          <div className="pt-4 border-t border-neutral-800">
            <button
              onClick={() => {
                if (confirm('Reset entire application dataset and settings to factory defaults?')) {
                  onResetAllData();
                }
              }}
              className="flex items-center space-x-1.5 px-3 py-2 bg-rose-950/40 text-rose-300 hover:bg-rose-900/50 rounded text-xs font-semibold border border-rose-800/40 transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reset Application to Factory State</span>
            </button>
          </div>
        </div>

        {/* Keyboard Shortcuts Reference */}
        <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-5 space-y-4">
          <div className="flex items-center space-x-2">
            <Keyboard className="w-5 h-5 text-amber-400" />
            <h2 className="text-sm font-bold text-white">Excel Keyboard Shortcuts</h2>
          </div>
          <p className="text-xs text-neutral-400">
            PROJECT XL replicates genuine Microsoft Excel keyboard conventions.
          </p>

          <div className="space-y-1.5 max-h-[380px] overflow-y-auto pr-1">
            {SHORTCUTS.map((s) => (
              <div
                key={s.key}
                className="flex items-center justify-between p-2 bg-neutral-950 rounded border border-neutral-800 text-xs"
              >
                <kbd className="px-2 py-0.5 bg-neutral-800 text-cyan-300 rounded font-mono text-[11px] font-bold border border-neutral-700">
                  {s.key}
                </kbd>
                <span className="text-neutral-400 text-right">{s.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
