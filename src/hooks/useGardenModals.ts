import { useState } from 'react';

/**
 * Modal state management hook
 * Centralizes all modal visibility state in one place
 */
export function useGardenModals() {
  const [showCalendar, setShowCalendar] = useState(false);
  const [showAI, setShowAI] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [showSaveLoad, setShowSaveLoad] = useState(false);
  const [showRotation, setShowRotation] = useState(false);
  const [showWeather, setShowWeather] = useState(false);
  const [showWatering, setShowWatering] = useState(false);
  const [showPlotMap, setShowPlotMap] = useState(false);
  const [showJournal, setShowJournal] = useState(false);
  const [showDocs, setShowDocs] = useState(false);
  const [showSeedInventory, setShowSeedInventory] = useState(false);
  const [showPlantingSuggestions, setShowPlantingSuggestions] = useState(false);
  const [showTasks, setShowTasks] = useState(false);
  const [showMonthlyPlanner, setShowMonthlyPlanner] = useState(false);
  const [showGrowGuide, setShowGrowGuide] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [showWelcome, setShowWelcome] = useState(false);
  const [showShoppingList, setShowShoppingList] = useState(false);

  return {
    showCalendar,
    setShowCalendar,
    showAI,
    setShowAI,
    showAuth,
    setShowAuth,
    showSaveLoad,
    setShowSaveLoad,
    showRotation,
    setShowRotation,
    showWeather,
    setShowWeather,
    showWatering,
    setShowWatering,
    showPlotMap,
    setShowPlotMap,
    showJournal,
    setShowJournal,
    showDocs,
    setShowDocs,
    showSeedInventory,
    setShowSeedInventory,
    showPlantingSuggestions,
    setShowPlantingSuggestions,
    showTasks,
    setShowTasks,
    showMonthlyPlanner,
    setShowMonthlyPlanner,
    showGrowGuide,
    setShowGrowGuide,
    showClearConfirm,
    setShowClearConfirm,
    showWelcome,
    setShowWelcome,
    showShoppingList,
    setShowShoppingList,
  };
}
