import React from 'react';
import { PianistApp } from './components/pianist/PianistApp';

export default function App() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <PianistApp initialSubTab="touch-grass" />
    </div>
  );
}
