
import React from 'react';
import { PersonalityConfig } from '../types';
import { getIcon } from '../constants';
import { soundService } from '../services/soundService';

interface Props {
  personality: PersonalityConfig;
  selected: boolean;
  onSelect: (p: PersonalityConfig) => void;
  avatarUrl?: string;
}

const PersonalityCard: React.FC<Props> = ({ personality, selected, onSelect, avatarUrl }) => {
  const handleClick = () => {
    if (!selected) {
        soundService.playClick();
    }
    onSelect(personality);
  };

  return (
    <button
      onClick={handleClick}
      className={`relative p-6 rounded-3xl text-left transition-all duration-300 transform group hover:-translate-y-2 hover:shadow-xl w-full flex flex-col items-center sm:items-start
      ${selected 
        ? `${personality.color} ring-4 ring-offset-2 ring-primary/20 shadow-xl scale-[1.02]` 
        : 'bg-white border border-stone-100 hover:border-stone-200 shadow-sm'
      }`}
    >
      <div className={`w-24 h-24 rounded-full flex items-center justify-center mb-5 transition-colors overflow-hidden border-4 shadow-sm
        ${selected ? 'bg-white border-primary/20' : 'bg-stone-50 group-hover:bg-stone-100 border-white'}`}>
        {avatarUrl ? (
          <img src={avatarUrl} alt={personality.title} className="w-full h-full object-cover animate-fade-in" />
        ) : (
          getIcon(personality.icon, `w-9 h-9 ${selected ? 'text-current' : 'text-stone-400'}`)
        )}
      </div>
      
      <h3 className="font-serif text-2xl font-medium mb-2 text-center sm:text-left w-full">{personality.title}</h3>
      <p className={`text-sm leading-relaxed text-center sm:text-left ${selected ? 'text-current opacity-90' : 'text-stone-500'}`}>
        {personality.description}
      </p>

      {selected && (
        <div className="absolute top-6 right-6 animate-pulse">
          <div className="w-2.5 h-2.5 rounded-full bg-current"></div>
        </div>
      )}
    </button>
  );
};

export default PersonalityCard;
