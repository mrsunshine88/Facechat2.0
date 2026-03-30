"use client"

import React, { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Mail, Book, Users, Star, Settings, User, FileEdit, Search, Shield, HelpCircle, AlertTriangle, CheckCircle, Eye, Camera, Clock, Trash2, Eraser, ShieldAlert, ShieldOff, MessageSquare, Moon, Heart, Zap, Coffee, Ghost, Sun, Gamepad2, Undo, Music, Volume2, VolumeX, ArrowLeft } from 'lucide-react';
import { PROFILE_SONGS } from './songs';
import { createClient } from '@/utils/supabase/client';
import SnakeGame from '@/components/SnakeGame';
import { isUserConfirmed, saveKrypinDesign, toggleUserBlockAction } from '../actions/userActions';
import { sanitizeCSS } from '@/utils/securityUtils';
import { useWordFilter } from '@/hooks/useWordFilter';
import { useUser } from '@/components/UserContext';

const cleanUrl = (url?: string) => url ? url.split('?')[0] : null;

const PrivacyToggle = ({ label }: { label: string }) => {
   const [isVisible, setIsVisible] = useState(false);
   return (
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
         <label style={{ fontSize: '0.875rem', color: 'var(--text-muted)' }}>{label}</label>
         <button type="button" onClick={() => setIsVisible(!isVisible)} style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', padding: '0.2rem 0.5rem', borderRadius: '4px', backgroundColor: isVisible ? '#d1fae5' : '#f3f4f6', color: isVisible ? '#059669' : '#6b7280', border: '1px solid', borderColor: isVisible ? '#34d399' : '#d1d5db', cursor: 'pointer', fontWeight: 'bold' }}>
            {isVisible ? '👁️ Visa' : '🔒 Dölj'}
         </button>
      </div>
   );
};

const KIDS_COLORS = [
   { name: 'Klar Röd', css: '.krypin-layout { background-color: #ef4444 !important; background-image: none !important; }' },
   { name: 'Mörk Röd', css: '.krypin-layout { background-color: #7f1d1d !important; background-image: none !important; }' },
   { name: 'Orange', css: '.krypin-layout { background-color: #f97316 !important; background-image: none !important; }' },
   { name: 'Gul', css: '.krypin-layout { background-color: #eab308 !important; background-image: none !important; }' },
   { name: 'Ljus Grön', css: '.krypin-layout { background-color: #4ade80 !important; background-image: none !important; }' },
   { name: 'Mörk Grön', css: '.krypin-layout { background-color: #14532d !important; background-image: none !important; }' },
   { name: 'Ljus Blå', css: '.krypin-layout { background-color: #38bdf8 !important; background-image: none !important; }' },
   { name: 'Mörk Blå', css: '.krypin-layout { background-color: #1e3a8a !important; background-image: none !important; }' },
   { name: 'Lila', css: '.krypin-layout { background-color: #a855f7 !important; background-image: none !important; }' },
   { name: 'Mörk Lila', css: '.krypin-layout { background-color: #581c87 !important; background-image: none !important; }' },
   { name: 'Rosa', css: '.krypin-layout { background-color: #ec4899 !important; background-image: none !important; }' },
   { name: 'Chockrosa', css: '.krypin-layout { background-color: #be185d !important; background-image: none !important; }' },
   { name: 'Brun', css: '.krypin-layout { background-color: #78350f !important; background-image: none !important; }' },
   { name: 'Svart', css: '.krypin-layout { background-color: #000000 !important; background-image: none !important; }' },
   { name: 'Vit', css: '.krypin-layout { background-color: #ffffff !important; background-image: none !important; }' },
   { name: 'Regnbåge', css: '.krypin-layout { background: linear-gradient(90deg, red, orange, yellow, green, blue, indigo, violet) !important; background-image: linear-gradient(90deg, red, orange, yellow, green, blue, indigo, violet) !important; }' },
   { name: 'Himmel', css: '.krypin-layout { background: linear-gradient(to bottom, #87CEEB, #ffffff) !important; background-image: linear-gradient(to bottom, #87CEEB, #ffffff) !important; }' },
   { name: 'Rymd', css: '.krypin-layout { background: radial-gradient(circle, #3b0764, #000000) !important; background-image: radial-gradient(circle, #3b0764, #000000) !important; }' },
   { name: 'Skog', css: '.krypin-layout { background: linear-gradient(45deg, #064e3b, #10b981) !important; background-image: linear-gradient(45deg, #064e3b, #10b981) !important; }' },
   { name: 'Solnedgång', css: '.krypin-layout { background: linear-gradient(to bottom, #ea580c, #f43f5e) !important; background-image: linear-gradient(to bottom, #ea580c, #f43f5e) !important; }' },
];

const KIDS_FONTS = [
   { name: 'Hacker (Mono)', css: '.krypin-layout, .krypin-layout * { font-family: "Courier New", Courier, monospace !important; }' },
   { name: 'Serietidning', css: '.krypin-layout, .krypin-layout * { font-family: "Comic Sans MS", "Comic Sans", cursive !important; }' },
   { name: 'Maskin (Tjock)', css: '.krypin-layout, .krypin-layout * { font-family: Impact, Charcoal, sans-serif !important; letter-spacing: 1px; }' },
   { name: 'Gammaldags', css: '.krypin-layout, .krypin-layout * { font-family: "Times New Roman", Times, serif !important; }' },
   { name: 'Rund (Verdana)', css: '.krypin-layout, .krypin-layout * { font-family: Verdana, Geneva, sans-serif !important; }' },
   { name: 'Kaxig', css: '.krypin-layout, .krypin-layout * { font-family: "Arial Black", Gadget, sans-serif !important; text-transform: uppercase; }' },
   { name: 'Digital (LCD)', css: '.krypin-layout, .krypin-layout * { font-family: "Lucida Console", Monaco, monospace !important; font-weight: bold; letter-spacing: 2px; }' },
];

const KIDS_TEXT_COLORS = [
   { name: 'Svart', css: 'TARGET, TARGET * { color: #000000 !important; text-shadow: none !important; }' },
   { name: 'Vit', css: 'TARGET, TARGET * { color: #ffffff !important; text-shadow: none !important; }' },
   { name: 'Röd', css: 'TARGET, TARGET * { color: #ef4444 !important; text-shadow: none !important; }' },
   { name: 'Rosa', css: 'TARGET, TARGET * { color: #ec4899 !important; text-shadow: none !important; }' },
   { name: 'Lila', css: 'TARGET, TARGET * { color: #a855f7 !important; text-shadow: none !important; }' },
   { name: 'Blå', css: 'TARGET, TARGET * { color: #3b82f6 !important; text-shadow: none !important; }' },
   { name: 'Ljusblå', css: 'TARGET, TARGET * { color: #38bdf8 !important; text-shadow: none !important; }' },
   { name: 'Grön', css: 'TARGET, TARGET * { color: #22c55e !important; text-shadow: none !important; }' },
   { name: 'Gul', css: 'TARGET, TARGET * { color: #eab308 !important; text-shadow: none !important; }' },
   { name: 'Orange', css: 'TARGET, TARGET * { color: #f97316 !important; text-shadow: none !important; }' },
];

const KIDS_THEMES = [
   { name: 'Nollställ (Rensa allt)', css: '' },
   { name: 'Ninjago (Eld)', css: '.krypin-layout { background-color: #450a0a; } .card { background-color: #000 !important; color: #fca5a5 !important; border: 2px solid #ef4444 !important; border-radius: 0 !important; } .user-link, .username-display, h1, h2, h3, p { color: #fecaca !important; } button { background-color: #7f1d1d !important; color: white !important; border: 1px solid #ef4444 !important; border-radius: 0 !important; font-weight: 900; }' },
   { name: 'Subnautica', css: '.krypin-layout { background-color: #083344; background-image: radial-gradient(circle at center, #06b6d4 0%, #083344 100%); } .card { background-color: rgba(15,23,42,0.6) !important; color: #cffafe !important; border: 1px solid #06b6d4 !important; backdrop-filter: blur(5px); } .card h1, .card h2, .card h3, button { color: #22d3ee !important; } button { background-color: rgba(8, 51, 68, 0.8) !important; border: 1px solid #06b6d4 !important; }' },
   { name: 'Rosa Dröm', css: '.krypin-layout { background-color: #fce7f3; } .card { background-color: #fdf2f8 !important; border: 3px dashed #f472b6 !important; border-radius: 20px !important; color: #831843 !important; } button { background-color: #fbcfe8 !important; color: #831843 !important; border: 2px solid #f472b6 !important; border-radius: 999px !important; }' },
   { name: 'Neon Hacker', css: '.krypin-layout { background-color: #000; } .card { background-color: #111 !important; border: 1px solid #0f0 !important; color: #0f0 !important; box-shadow: 0 0 10px #0f0; } .krypin-layout, .krypin-layout * { font-family: "Courier New", monospace !important; } button { background-color: #000 !important; color: #0f0 !important; border: 1px solid #0f0 !important; }' },
   { name: 'Minecraft', css: '.krypin-layout { background-color: #3f1dcb; background-image: repeating-linear-gradient(45deg, #16a085 25%, transparent 25%, transparent 75%, #16a085 75%, #16a085), repeating-linear-gradient(45deg, #16a085 25%, #2ecc71 25%, #2ecc71 75%, #16a085 75%, #16a085); background-position: 0 0, 20px 20px; background-size: 40px 40px; } .card { background-color: #8b4513 !important; border: 4px solid #5c3a21 !important; color: white !important; border-radius: 0 !important; } button { background-color: #7f8c8d !important; border: 2px solid #bdc3c7 !important; color: white !important; border-radius: 0 !important; font-family: monospace; }' },
   { name: 'Sommarstrand', css: '.krypin-layout { background: linear-gradient(to bottom, #87CEEB 0%, #fef08a 100%); } .card { background-color: rgba(255,255,255,0.8) !important; border: 2px solid #fbbf24 !important; border-radius: 16px !important; color: #b45309 !important; } h1, h2, h3, button { color: #ea580c !important; } button { background-color: #fef08a !important; border: 1px solid #f59e0b !important; }' },
   { name: 'Goth / Emo', css: '.krypin-layout { background-color: #18181b; } .card { background-color: #000 !important; border: 1px solid #52525b !important; color: #a1a1aa !important; border-radius: 4px !important; box-shadow: 0 0 15px rgba(255,0,0,0.1); } .krypin-layout h1, .krypin-layout h2, .krypin-layout h3, .krypin-layout p, .krypin-layout span, .krypin-layout strong, .krypin-layout .user-link { color: #9f1239 !important; } button { background-color: #4c0519 !important; color: #f43f5e !important; border-radius: 2px !important; border: 1px solid #9f1239 !important; }' },
   { name: 'Polkagris', css: '.krypin-layout { background-color: #fff; background-image: repeating-linear-gradient(45deg, #ef4444, #ef4444 20px, #ffffff 20px, #ffffff 40px); } .card { background-color: rgba(255,255,255,0.95) !important; border: 3px solid #ef4444 !important; color: #7f1d1d !important; border-radius: 24px !important; } button { background-color: #fee2e2 !important; color: #b91c1c !important; border: 2px solid #ef4444 !important; border-radius: 20px !important; }' },
   { name: 'Skogen', css: '.krypin-layout { background-color: #064e3b; background-image: radial-gradient(circle at 20% 20%, #10b981 0%, transparent 50%), radial-gradient(circle at 80% 80%, #059669 0%, transparent 50%); } .card { background-color: rgba(6, 78, 59, 0.8) !important; border: 2px solid #34d399 !important; color: #d1fae5 !important; border-radius: 12px !important; } h1, h2, h3, button { color: #a7f3d0 !important; } button { background-color: #065f46 !important; border: 1px solid #10b981 !important; }' }
];

const KIDS_PATTERNS = [
   { name: '👻 Spöken', css: '.krypin-layout { background-image: url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'60\' height=\'60\' viewBox=\'0 0 100 100\'%3E%3Ctext y=\'50\' font-size=\'40\'%3E👻%3C/text%3E%3C/svg%3E") !important; }' },
   { name: '❤️ Hjärtan', css: '.krypin-layout { background-image: url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'60\' height=\'60\' viewBox=\'0 0 100 100\'%3E%3Ctext y=\'50\' font-size=\'40\'%3E❤️%3C/text%3E%3C/svg%3E") !important; }' },
   { name: '🍔 Hamburgare', css: '.krypin-layout { background-image: url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'60\' height=\'60\' viewBox=\'0 0 100 100\'%3E%3Ctext y=\'50\' font-size=\'40\'%3E🍔%3C/text%3E%3C/svg%3E") !important; }' },
   { name: '⚽ Fotbollar', css: '.krypin-layout { background-image: url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'60\' height=\'60\' viewBox=\'0 0 100 100\'%3E%3Ctext y=\'50\' font-size=\'40\'%3E⚽%3C/text%3E%3C/svg%3E") !important; }' },
   { name: '🦄 Enhörningar', css: '.krypin-layout { background-image: url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'60\' height=\'60\' viewBox=\'0 0 100 100\'%3E%3Ctext y=\'50\' font-size=\'40\'%3E🦄%3C/text%3E%3C/svg%3E") !important; }' },
   { name: '⭐ Stjärnor', css: '.krypin-layout { background-image: url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'60\' height=\'60\' viewBox=\'0 0 100 100\'%3E%3Ctext y=\'50\' font-size=\'40\'%3E⭐%3C/text%3E%3C/svg%3E") !important; }' },
   { name: '🐱 Katter', css: '.krypin-layout { background-image: url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'60\' height=\'60\' viewBox=\'0 0 100 100\'%3E%3Ctext y=\'50\' font-size=\'40\'%3E🐱%3C/text%3E%3C/svg%3E") !important; }' },
   { name: '🐶 Hundar', css: '.krypin-layout { background-image: url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'60\' height=\'60\' viewBox=\'0 0 100 100\'%3E%3Ctext y=\'50\' font-size=\'40\'%3E🐶%3C/text%3E%3C/svg%3E") !important; }' },
   { name: '💀 Dödskallar', css: '.krypin-layout { background-image: url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'60\' height=\'60\' viewBox=\'0 0 100 100\'%3E%3Ctext y=\'50\' font-size=\'40\'%3E💀%3C/text%3E%3C/svg%3E") !important; }' },
   { name: '💩 Bajs', css: '.krypin-layout { background-image: url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'60\' height=\'60\' viewBox=\'0 0 100 100\'%3E%3Ctext y=\'50\' font-size=\'40\'%3E💩%3C/text%3E%3C/svg%3E") !important; }' },
   { name: '🔥 Eldar', css: '.krypin-layout { background-image: url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'60\' height=\'60\' viewBox=\'0 0 100 100\'%3E%3Ctext y=\'50\' font-size=\'40\'%3E🔥%3C/text%3E%3C/svg%3E") !important; }' },
   { name: '❄️ Snö', css: '.krypin-layout { background-image: url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'60\' height=\'60\' viewBox=\'0 0 100 100\'%3E%3Ctext y=\'50\' font-size=\'40\'%3E❄️%3C/text%3E%3C/svg%3E") !important; }' },
   { name: '💸 Pengar', css: '.krypin-layout { background-image: url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'60\' height=\'60\' viewBox=\'0 0 100 100\'%3E%3Ctext y=\'50\' font-size=\'40\'%3E💸%3C/text%3E%3C/svg%3E") !important; }' },
   { name: '🏁 Schack (Nät)', css: '.krypin-layout { background-image: repeating-linear-gradient(45deg, rgba(255,255,255,0.1) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.1) 75%, rgba(255,255,255,0.1)), repeating-linear-gradient(45deg, rgba(255,255,255,0.1) 25%, transparent 25%, transparent 75%, rgba(255,255,255,0.1) 75%, rgba(255,255,255,0.1)) !important; background-position: 0 0, 20px 20px !important; background-size: 40px 40px !important; }' },
   { name: '🦓 Zebraränder', css: '.krypin-layout { background-image: repeating-linear-gradient(90deg, rgba(255,255,255,0.1), rgba(255,255,255,0.1) 10px, transparent 10px, transparent 20px) !important; }' },
   { name: '🌊 Vågor', css: '.krypin-layout { background-image: radial-gradient(circle at 100% 150%, transparent 20%, rgba(255,255,255,0.1) 21%, rgba(255,255,255,0.1) 34%, transparent 35%, transparent), radial-gradient(circle at 0% 150%, transparent 20%, rgba(255,255,255,0.1) 21%, rgba(255,255,255,0.1) 34%, transparent 35%, transparent) !important; background-size: 50px 50px !important; }' },
   { name: '🟢 Prickar', css: '.krypin-layout { background-image: radial-gradient(rgba(255,255,255,0.2) 15%, transparent 16%), radial-gradient(rgba(255,255,255,0.2) 15%, transparent 16%) !important; background-size: 40px 40px !important; background-position: 0 0, 20px 20px !important; }' },
];

const KIDS_EFFECTS = [
   { name: '✨ Neon Text', css: '.krypin-layout h1, .krypin-layout h2, .krypin-layout h3, .krypin-layout p, .krypin-layout button, .krypin-layout span, .krypin-layout strong { text-shadow: 0 0 5px currentColor, 0 0 15px currentColor !important; }' },
   { name: '✨ Super Neon', css: '.krypin-layout h1, .krypin-layout h2, .krypin-layout h3, .krypin-layout p, .krypin-layout button, .krypin-layout span { text-shadow: 0 0 10px #fff, 0 0 20px #fff, 0 0 30px currentColor, 0 0 40px currentColor !important; }' },
   { name: '🌈 Regnbågstext', css: '.krypin-layout, .krypin-layout h1, .krypin-layout h2, .krypin-layout h3, .krypin-layout p, .krypin-layout span, .krypin-layout button { animation: rainbow 3s linear infinite !important; }' },
   { name: '🤪 Skakig Text', css: '.krypin-layout h1, .krypin-layout h2, .krypin-layout h3, .krypin-layout button { animation: shake 0.5s infinite !important; }' },
   { name: '🤪 Max Skakning!', css: '.krypin-layout h1, .krypin-layout h2, .krypin-layout h3, .krypin-layout button { animation: crazy 0.2s infinite !important; }' },
   { name: '🚀 Flygande Bild', css: '.krypin-layout img { animation: float 3s ease-in-out infinite !important; }' },
   { name: '🚀 Snurrande Bild', css: '.krypin-layout img { animation: spin 4s linear infinite !important; }' },
   { name: '🚦 Blinkande Rubrik', css: '.krypin-layout h1, .krypin-layout h2, .krypin-layout h3 { animation: blinkEffect 1s infinite !important; }' },
   { name: '🚦 Disko Bakgrund', css: '.krypin-layout { animation: discoBg 2s infinite !important; }' },
   { name: '👻 Osynlig text', css: '.krypin-layout h1, .krypin-layout h2, .krypin-layout h3, .krypin-layout p, .krypin-layout span, .krypin-layout button { opacity: 0.1 !important; transition: opacity 0.4s !important; } .krypin-layout h1:hover, .krypin-layout h2:hover, .krypin-layout h3:hover, .krypin-layout p:hover, .krypin-layout span:hover, .krypin-layout button:hover { opacity: 1 !important; }' },
   { name: '⬆️ Skuttande knappar', css: '.krypin-layout button { animation: bounceBtn 1s infinite !important; }' },
   { name: '🪞 Spegelvänd', css: '.krypin-layout { transform: scaleX(-1) !important; } .krypin-layout * { transform: scaleX(-1) !important; }' },
   { name: '💤 Sömnig Layout', css: '.krypin-layout { filter: blur(2px) grayscale(50%) !important; transition: filter 0.5s; } .krypin-layout:hover { filter: blur(0px) grayscale(0%) !important; }' },
   { name: '💧 Tippande Boxar', css: '.card { transform: rotate(-2deg) !important; }' }
];

const KIDS_AVATAR_FRAMES = [
   { name: 'Standard', css: '.profile-frame { border: 4px solid #f3e8ff !important; box-shadow: none !important; animation: none !important; }' },
   { name: 'Guld', css: '.profile-frame { border: 4px solid #fbbf24 !important; box-shadow: 0 0 15px #f59e0b !important; }' },
   { name: 'Neon Grön', css: '.profile-frame { border: 4px solid #22c55e !important; box-shadow: 0 0 10px #22c55e, 0 0 20px #4ade80 !important; }' },
   { name: 'Neon Rosa', css: '.profile-frame { border: 4px solid #ec4899 !important; box-shadow: 0 0 10px #ec4899, 0 0 20px #f472b6 !important; }' },
   { name: 'Neon Blå', css: '.profile-frame { border: 4px solid #3b82f6 !important; box-shadow: 0 0 10px #3b82f6, 0 0 20px #60a5fa !important; }' },
   { name: 'Blinkande Röd', css: '.profile-frame { border: 4px solid #ef4444 !important; box-shadow: 0 0 15px #ef4444 !important; animation: blinkEffect 0.5s infinite !important; }' },
   { name: 'Disko Blinka', css: '.profile-frame { border: 4px solid #fff !important; animation: discoBg 0.5s infinite !important; box-shadow: 0 0 15px currentColor !important; }' },
   { name: 'Regnbåge', css: '.profile-frame { border: 4px solid transparent !important; background-origin: border-box !important; background-clip: content-box, border-box !important; background-image: linear-gradient(var(--bg-card), var(--bg-card)), linear-gradient(to right, red, orange, yellow, green, blue, indigo, violet) !important; animation: rainbow 2s linear infinite !important; }' },
   { name: 'Puls', css: '.profile-frame { border: 4px solid #a855f7 !important; animation: bounceBtn 1s infinite !important; box-shadow: 0 0 20px #a855f7 !important; }' },
   { name: 'Skakig', css: '.profile-frame { border: 4px dashed #f97316 !important; animation: shake 0.2s infinite !important; }' },
   { name: 'Utan Ram', css: '.profile-frame { border: none !important; box-shadow: none !important; }' }
];

const KIDS_NEON_TEXT = [
   { name: 'Neon Rosa', css: 'TARGET { color: #f472b6 !important; text-shadow: 0 0 5px #f472b6, 0 0 10px #f472b6, 0 0 20px #ec4899, 0 0 40px #ec4899, 0 0 80px #ec4899 !important; }' },
   { name: 'Neon Grön', css: 'TARGET { color: #4ade80 !important; text-shadow: 0 0 5px #4ade80, 0 0 10px #4ade80, 0 0 20px #22c55e, 0 0 40px #22c55e, 0 0 80px #22c55e !important; }' },
   { name: 'Neon Blå', css: 'TARGET { color: #60a5fa !important; text-shadow: 0 0 5px #60a5fa, 0 0 10px #60a5fa, 0 0 20px #3b82f6, 0 0 40px #3b82f6, 0 0 80px #3b82f6 !important; }' },
   { name: 'Neon Guld', css: 'TARGET { color: #fbbf24 !important; text-shadow: 0 0 5px #fbbf24, 0 0 10px #fbbf24, 0 0 20px #f59e0b, 0 0 40px #f59e0b, 0 0 80px #f59e0b !important; }' },
   { name: 'Neon Röd', css: 'TARGET { color: #ef4444 !important; text-shadow: 0 0 5px #ef4444, 0 0 10px #ef4444, 0 0 20px #dc2626, 0 0 40px #dc2626, 0 0 80px #dc2626 !important; }' },
   { name: 'Blinkande Neon', css: 'TARGET { color: #ef4444 !important; text-shadow: 0 0 5px #ef4444, 0 0 10px #ef4444, 0 0 20px #dc2626, 0 0 40px #dc2626 !important; animation: blinkEffect 0.5s infinite alternate !important; }' },
   { name: 'Ingen Neon', css: 'TARGET { text-shadow: none !important; animation: none !important; }' }
];

const KrypinSkeleton = () => (
   <div style={{ backgroundColor: 'var(--bg-color)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div className="main-content" style={{ display: 'flex', gap: '2rem', padding: '2.5rem 2rem', maxWidth: '1100px', margin: '0 auto', width: '100%' }}>
         <div style={{ width: '250px', display: 'flex', flexDirection: 'column', gap: '1.5rem', flexShrink: 0 }}>
            <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1rem' }}>
               <div className="skeleton-pulse" style={{ width: '100px', height: '100px', borderRadius: '50%' }}></div>
               <div className="skeleton-pulse" style={{ width: '150px', height: '20px' }}></div>
               <div className="skeleton-pulse" style={{ width: '100px', height: '15px' }}></div>
            </div>
            <div className="card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
               {[1, 2, 3, 4, 5].map(i => <div key={i} className="skeleton-pulse" style={{ width: '100%', height: '40px', borderRadius: '8px' }}></div>)}
            </div>
         </div>
         <div style={{ flex: 1 }}>
            <div className="card" style={{ minHeight: '600px', padding: '2.5rem' }}>
               <div className="skeleton-pulse" style={{ width: '200px', height: '30px', marginBottom: '2rem' }}></div>
               <div className="skeleton-pulse" style={{ width: '100%', height: '150px', marginBottom: '1.5rem', borderRadius: '12px' }}></div>
               <div className="skeleton-pulse" style={{ width: '100%', height: '300px', borderRadius: '12px' }}></div>
            </div>
         </div>
      </div>
   </div>
);

export default function MittKrypin() {
   return (
      <React.Suspense fallback={<KrypinSkeleton />}>
         <MittKrypinContent />
      </React.Suspense>
   )
}

const supabase = createClient();

function MittKrypinContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const targetUsername = searchParams?.get('u');
    const { mask } = useWordFilter();
    const { profile: globalViewer, loading: userLoading } = useUser();

    // REVERSIBLE WORD FILTER (MASKING TEXT WITHOUT DELETING FROM DB)
    const maskWords = (text: string) => mask(text);

   const [activeTab, setActiveTab] = useState((searchParams?.get('spela') || searchParams?.get('arcade')) ? 'Spel 🕹️' : (searchParams?.get('tab') || 'Profil'));
   const [currentUser, setCurrentUser] = useState<any>(null); // Den vems profil man KIKAR PÅ
   const [viewerUser, setViewerUser] = useState<any>(null); // Du som är INLOGGAD
   const [hasSentRequest, setHasSentRequest] = useState(false);

   // LIVE DESIGN STUDIO STATES
   const [isEditingKrypin, setIsEditingKrypin] = useState(false);
   const [designTab, setDesignTab] = useState<'simple' | 'advanced' | 'presentation'>('simple');
   const [draftCss, setDraftCss] = useState('');
   const [previewCss, setPreviewCss] = useState<string | null>(null);
   const [isEditingPresentation, setIsEditingPresentation] = useState(false);
   const [presentationText, setPresentationText] = useState('');
   const [showCssSchool, setShowCssSchool] = useState(false);

   // Databas-states
   const [guestbookPosts, setGuestbookPosts] = useState<any[]>([]);
   const [newGuestbookPost, setNewGuestbookPost] = useState('');
   const [privateMessages, setPrivateMessages] = useState<any[]>([]);
   const [friends, setFriends] = useState<any[]>([]);
   const [pendingRequests, setPendingRequests] = useState<any[]>([]);
   const [pmModalOpen, setPmModalOpen] = useState(false);
   const [isProcessingFriendship, setIsProcessingFriendship] = useState(false);
   const [pmContent, setPmContent] = useState('');
   const [replyingTo, setReplyingTo] = useState<any>(null);
   const [replyContent, setReplyContent] = useState('');
   const [isIpBlocked, setIsIpBlocked] = useState(false);
   const [userIp, setUserIp] = useState<string>('');
   const [isSending, setIsSending] = useState(false); // Förhindra 22-inläggs-felet
   const [forbiddenWords, setForbiddenWords] = useState<string[]>([]);
   const [showDuplicateModal, setShowDuplicateModal] = useState(false);
   const [isAndroid, setIsAndroid] = useState(false);

   // Sök & Skicka PM States
   const [composeModalOpen, setComposeModalOpen] = useState(false);
   const [composeSearchQuery, setComposeSearchQuery] = useState('');
   const [composeSearchResults, setComposeSearchResults] = useState<any[]>([]);
   const [composeSelectedUser, setComposeSelectedUser] = useState<any>(null);
   const [composeContent, setComposeContent] = useState('');
   const [selectedMail, setSelectedMail] = useState<any>(null); // Old state, kept for compatibility if needed.
   const [selectedThreadUserId, setSelectedThreadUserId] = useState<string | null>(null);
   const [isComposingNew, setIsComposingNew] = useState(false);
   const [patternTarget, setPatternTarget] = useState('.krypin-layout');
   const [textColorTarget, setTextColorTarget] = useState('.krypin-layout');
   const [bgColorTarget, setBgColorTarget] = useState('.krypin-layout');
   const [neonTextTarget, setNeonTextTarget] = useState('h1, h2, h3, .user-link');
   const [cssHistory, setCssHistory] = useState<string[]>([]);
   const [draftSong, setDraftSong] = useState('');
   const [isMusicMuted, setIsMusicMuted] = useState(false);

   const isMyProfile = viewerUser && currentUser && viewerUser.id === currentUser.id;

   useEffect(() => {
      if (activeTab !== 'Mejl') {
         setSelectedThreadUserId(null);
         setIsComposingNew(false);
      }
   }, [activeTab]);

   useEffect(() => {
      if (typeof window !== 'undefined') {
         const saved = localStorage.getItem('krypin_global_music_mute');
         if (saved === 'true') {
            setIsMusicMuted(true);
         }
      }
   }, []);

   useEffect(() => {
      if (currentUser && draftSong === '') {
         setDraftSong(currentUser.profile_song || '');
      }
   }, [currentUser]);


   // Visitors & Global Modal
   const [showVisitorsModal, setShowVisitorsModal] = useState(false);
   const [recentVisitors, setRecentVisitors] = useState<any[]>([]);

   // SELECTION STATES FOR HIGHLIGHTING
   const [selectedThemeName, setSelectedThemeName] = useState<string | null>(null);
   const [selectedBgColorName, setSelectedBgColorName] = useState<string | null>(null);
   const [selectedTextColorName, setSelectedTextColorName] = useState<string | null>(null);
   const [selectedPatternName, setSelectedPatternName] = useState<string | null>(null);
   const [selectedFontName, setSelectedFontName] = useState<string | null>(null);
   const [selectedEffectName, setSelectedEffectName] = useState<string | null>(null);
   const [selectedFrameName, setSelectedFrameName] = useState<string | null>(null);
   const [selectedNeonName, setSelectedNeonName] = useState<string | null>(null);

   // Initialize selection highlights when editor opens
   useEffect(() => {
      if (isEditingKrypin && currentUser?.custom_style) {
         const style = currentUser.custom_style;

         // Themes
         const matchedTheme = KIDS_THEMES.find(t => style.includes(t.css.slice(0, 50)));
         if (matchedTheme) setSelectedThemeName(matchedTheme.name);

         // Try mapping common colors (simple heuristic)
         if (!matchedTheme) {
            const lastBg = [...KIDS_COLORS].reverse().find(c => style.includes(c.css.slice(0, 30)));
            if (lastBg) setSelectedBgColorName(lastBg.name);

            const lastTxt = [...KIDS_TEXT_COLORS].reverse().find(c => style.includes(c.css.slice(0, 30)));
            if (lastTxt) setSelectedTextColorName(lastTxt.name);
         }

         const lastFont = KIDS_FONTS.find(f => style.includes(f.css.slice(0, 30)));
         if (lastFont) setSelectedFontName(lastFont.name);

         const lastPattern = KIDS_PATTERNS.find(p => style.includes(p.css.slice(0, 30)));
         if (lastPattern) setSelectedPatternName(lastPattern.name);

         const lastFrame = KIDS_AVATAR_FRAMES.find(f => style.includes(f.css.slice(0, 30)));
         if (lastFrame) setSelectedFrameName(lastFrame.name);
      }
   }, [isEditingKrypin, currentUser]);

   const [customAlert, setCustomAlert] = useState<string | null>(null);

   // Auto-hide custom alert toast
   useEffect(() => {
      if (customAlert) {
         const timer = setTimeout(() => setCustomAlert(null), 4000);
         return () => clearTimeout(timer);
      }
   }, [customAlert]);

   // Block & Report States
   const [isBlocked, setIsBlocked] = useState(false);
   const [hasBlockedMe, setHasBlockedMe] = useState(false);
   const [globalBlockedIds, setGlobalBlockedIds] = useState<Set<string>>(new Set());
   const [showReportModal, setShowReportModal] = useState(false);
   const [reportCategory, setReportCategory] = useState('Spam');
   const [reportTarget, setReportTarget] = useState<any>(null);
   const [reportReason, setReportReason] = useState('');


    useEffect(() => {
       let globalChannel: any;
       async function initData() {
          try {
             // Android-detect directly (Flash fast!)
             const isAndroidValue = /android/i.test(navigator.userAgent);
             setIsAndroid(isAndroidValue);

             // 1. Quick start: Use globalViewer if available
             if (globalViewer) {
                setViewerUser(globalViewer);
             } else {
                const { data: { session: s } } = await supabase.auth.getSession();
                if (!s) { /* Vänta på UserContext grace period */ return; }
                const { data: p } = await supabase.from('profiles').select('*').eq('id', s.user.id).single();
                setViewerUser(p || s.user);
             }

             const activeUser = globalViewer || viewerUser;
             if (!activeUser) return;

             // 2. Parallelize everything
             const [targetRes, blocksRes, wordsRes] = await Promise.all([
                targetUsername ? supabase.from('profiles').select('*').ilike('username', targetUsername).limit(1) : Promise.resolve({ data: [activeUser] }),
                activeUser?.id ? supabase.from('user_blocks').select('*').or(`blocker_id.eq.${activeUser.id},blocked_id.eq.${activeUser.id}`) : Promise.resolve({ data: [] }),
                supabase.from('forbidden_words').select('word')
             ]);

             // Background IP check (Zero-Tugging!)
             fetch('https://api64.ipify.org?format=json').then(r => r.json()).then(async ipRes => {
                if (ipRes?.ip) {
                   setUserIp(ipRes.ip);
                   const { data: bData } = await supabase.from('blocked_ips').select('*').eq('ip', ipRes.ip).limit(1);
                   if (bData?.length) setIsIpBlocked(true);
                }
             }).catch(() => {});

             if (wordsRes.data) setForbiddenWords(wordsRes.data.map(w => w.word));

             const profileToView = targetRes.data?.[0] || null;
             if (!profileToView) {
                setCustomAlert('Hittade inte användaren ' + targetUsername);
                window.location.href = '/krypin';
                return;
             }
             setCurrentUser(profileToView);

             const bSet = new Set<string>();
             if (blocksRes.data) {
                blocksRes.data.forEach((b: any) => {
                   if (b.blocker_id === activeUser.id) bSet.add(b.blocked_id);
                   if (b.blocked_id === activeUser.id) bSet.add(b.blocker_id);
                });
             }
             setGlobalBlockedIds(bSet);

             if (profileToView.id !== activeUser.id) {
                const iBlocked = bSet.has(profileToView.id) && blocksRes.data?.some((b: any) => b.blocker_id === activeUser.id && b.blocked_id === profileToView.id);
                const blockedMe = bSet.has(profileToView.id) && blocksRes.data?.some((b: any) => b.blocker_id === profileToView.id && b.blocked_id === activeUser.id);
                setIsBlocked(!!iBlocked);
                setHasBlockedMe(!!blockedMe);
                if (iBlocked || blockedMe) { window.location.href = '/krypin'; return; }
             }

             // 3. Final datafetch in parallel
             await Promise.all([
                fetchGuestbook(profileToView.id),
                fetchFriends(profileToView.id, activeUser.id),
                !targetUsername || targetUsername === activeUser.username ? fetchMessages(activeUser.id) : Promise.resolve()
             ]);

             // Realtime
             if (globalChannel) supabase.removeChannel(globalChannel);
             globalChannel = supabase.channel('realtime_krypin_' + profileToView.id)
                .on('postgres_changes', { event: '*', schema: 'public', table: 'guestbook' }, () => fetchGuestbook(profileToView.id))
                .on('postgres_changes', { event: '*', schema: 'public', table: 'private_messages' }, () => fetchMessages(activeUser.id))
                .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles' }, (payload: any) => {
                   if (payload.new.id === activeUser.id && payload.new.is_banned) window.location.href = '/bannad';
                   if (payload.new.id === profileToView.id) setCurrentUser((prev: any) => ({ ...prev, ...payload.new }));
                })
                .subscribe();
          } catch (err) { console.error("Init data error:", err); }
       }
       if (!userLoading) initData();

       return () => {
          if (globalChannel) supabase.removeChannel(globalChannel);
       };
    }, [targetUsername, globalViewer, userLoading, supabase]);

   const chatWith = searchParams?.get('chatWith');

   useEffect(() => {
      if (chatWith && privateMessages.length > 0 && !selectedThreadUserId) {
         setSelectedThreadUserId(chatWith);
         const unreads = privateMessages.filter(m => m.sender_id === chatWith && !m.is_read);
         if (unreads.length > 0) {
            unreads.forEach(msg => supabase.from('private_messages').update({ is_read: true }).eq('id', msg.id).then());
            setPrivateMessages(prev => prev.map(m => m.sender_id === chatWith ? { ...m, is_read: true } : m));
         }
      }
   }, [chatWith, privateMessages, selectedThreadUserId, viewerUser, supabase]);

   async function fetchGuestbook(userId: string) {
      const { data } = await supabase
         .from('guestbook')
         .select('*, sender:sender_id(username, avatar_url)')
         .eq('receiver_id', userId)
         .order('created_at', { ascending: false });
      if (data) {
         const filtered = data.filter(p => !globalBlockedIds.has(p.sender_id));
         setGuestbookPosts(filtered);
      }
   }

   async function fetchFriends(targetId: string, viewerId: string) {
      let friendIds: string[] = [];
      const { data: acceptedData } = await supabase.from('friendships').select('user_id_1, user_id_2').or(`user_id_1.eq.${targetId},user_id_2.eq.${targetId}`).eq('status', 'accepted');
      if (acceptedData) {
         friendIds = acceptedData.map(f => f.user_id_1 === targetId ? f.user_id_2 : f.user_id_1);
         friendIds = friendIds.filter(id => !globalBlockedIds.has(id));
         if (friendIds.length > 0) {
            const { data: profs } = await supabase.from('profiles').select('id, username, avatar_url').in('id', friendIds);
            if (profs) setFriends(profs);
         } else {
            setFriends([]);
         }
      }

      if (targetId === viewerId) {
         // Hämta alla rader där jag är inblandad och status är pending
         const { data: pendingData } = await supabase.from('friendships')
            .select('user_id_1, user_id_2, action_user_id, status')
            .or(`user_id_1.eq.${targetId},user_id_2.eq.${targetId}`)
            .eq('status', 'pending');

         if (pendingData) {
            // Inkommande förfrågningar: Jag är inblandad, men jag är INTE action_user_id.
            // VIKTIGT: Filtrera även bort personer som vi REDAN är vänner med (som finns i friendIds)
            const incomingReqIds = pendingData
               .filter(f => f.action_user_id !== targetId && f.user_id_1 !== f.user_id_2 && !friendIds.includes(f.user_id_1 === targetId ? f.user_id_2 : f.user_id_1))
               .map(f => f.user_id_1 === targetId ? f.user_id_2 : f.user_id_1);

            if (incomingReqIds.length > 0) {
               const { data: reqProfs } = await supabase.from('profiles').select('id, username, avatar_url').in('id', incomingReqIds);
               if (reqProfs) setPendingRequests(reqProfs);
            } else {
               setPendingRequests([]);
            }

            // Kolla om jag själv har en skickad förfrågan (för knappen "Bli vän")
            const hasSent = pendingData.some(f => f.action_user_id === targetId);
            setHasSentRequest(hasSent);
         } else {
            setPendingRequests([]);
            setHasSentRequest(false);
         }
      } else {
         const id1 = viewerId < targetId ? viewerId : targetId;
         const id2 = viewerId < targetId ? targetId : viewerId;
         const { data: penList } = await supabase.from('friendships').select('status, action_user_id').eq('user_id_1', id1).eq('user_id_2', id2).eq('status', 'pending').limit(1);
         const hasPen = penList && penList.length > 0 ? penList[0] : null;
         if (hasPen && hasPen.action_user_id === viewerId) {
            setHasSentRequest(true);
         } else {
            setHasSentRequest(false);
         }
      }
   }

   // Lås scroll på body när redigering är öppen
   useEffect(() => {
      if (isEditingKrypin) {
         document.body.style.overflow = 'hidden';
      } else {
         document.body.style.overflow = 'unset';
      }
      return () => {
         document.body.style.overflow = 'unset';
      };
   }, [isEditingKrypin]);

   async function fetchMessages(userId: string) {
      const { data } = await supabase
         .from('private_messages')
         .select('*, sender:sender_id(id, username, avatar_url), receiver:receiver_id(id, username, avatar_url)')
         .or(`receiver_id.eq.${userId},sender_id.eq.${userId}`)
         .order('created_at', { ascending: false });

      if (data) {
         const filtered = data.filter(msg => {
            if (msg.sender_id === userId && msg.sender_deleted) return false;
            if (msg.receiver_id === userId && msg.receiver_deleted) return false;

            // Filter out blocked users
            const otherId = msg.sender_id === userId ? msg.receiver_id : msg.sender_id;
            if (globalBlockedIds.has(otherId)) return false;

            return true;
         });
         setPrivateMessages(filtered);
      }
   }

   const handleDeletePM = async (msg: any) => {
      if (!viewerUser) return;
      const isSender = msg.sender_id === viewerUser.id;

      setPrivateMessages(prev => prev.filter(m => m.id !== msg.id));
      if (selectedMail && selectedMail.id === msg.id) {
         setSelectedMail(null);
      }

      if (isSender) {
         await supabase.from('private_messages').update({ sender_deleted: true }).eq('id', msg.id);
      } else {
         await supabase.from('private_messages').update({ receiver_deleted: true }).eq('id', msg.id);
      }
   }

   const handleDeleteThread = async (otherUserId: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (!confirm('Säker att du vill radera denna konversation? (Raderas bara för dig)')) return;
      if (!viewerUser) return;

      // Optimistic UI updates
      const msgsToDelete = privateMessages.filter(m => m.sender_id === otherUserId || m.receiver_id === otherUserId);
      setPrivateMessages(prev => prev.filter(m => m.sender_id !== otherUserId && m.receiver_id !== otherUserId));
      if (selectedThreadUserId === otherUserId) setSelectedThreadUserId(null);

      const senderMsgIds = msgsToDelete.filter(m => m.sender_id === viewerUser.id).map(m => m.id);
      const receiverMsgIds = msgsToDelete.filter(m => m.receiver_id === viewerUser.id).map(m => m.id);

      if (senderMsgIds.length > 0) {
         await supabase.from('private_messages').update({ sender_deleted: true }).in('id', senderMsgIds);
      }
      if (receiverMsgIds.length > 0) {
         await supabase.from('private_messages').update({ receiver_deleted: true }).in('id', receiverMsgIds);
      }
   }

   const handleSendPM = async (receiverId: string, content: string) => {
      if (!content.trim() || !viewerUser) return;
      if (isBlocked || hasBlockedMe) {
         setCustomAlert('Du kan inte skicka meddelanden till en person som är blockerad.');
         return;
      }

      // Optimistic UI for PMs (Flash fast!)
      const tempId = 'temp-' + Date.now();
      const optimisticMsg = {
         id: tempId,
         sender_id: viewerUser.id,
         receiver_id: receiverId,
         content: content.trim(),
         created_at: new Date().toISOString(),
         is_read: false,
         sender: { id: viewerUser.id, username: viewerUser.username, avatar_url: viewerUser.avatar_url }
      };
      setPrivateMessages(prev => [optimisticMsg, ...prev]);
      setPmModalOpen(false);
      setPmContent('');
      setReplyingTo(null);
      setReplyContent('');
      setCustomAlert('Meddelande skickat!');

      const { data, error } = await supabase.from('private_messages').insert({
         sender_id: viewerUser.id,
         receiver_id: receiverId,
         content: content.trim()
      }).select().single();

      if (error) {
         setPrivateMessages(prev => prev.filter(m => m.id !== tempId));
         if (error.message?.includes('DUPLICATE_LIMIT_REACHED')) {
            setShowDuplicateModal(true);
            return;
         }
         setCustomAlert('Kunde inte skicka mejl: ' + error.message);
         return;
      }

      if (data) {
         setPrivateMessages(prev => prev.map(m => m.id === tempId ? { ...m, id: data.id } : m));
      }

      // Background logic (Non-blocking)
      supabase.from('notifications').insert({
         receiver_id: receiverId,
         actor_id: viewerUser.id,
         type: 'pm',
         content: 'skickade dig ett mejl.',
         link: `/krypin?tab=Mejl&chatWith=${viewerUser.id}`
      }).then();

      fetch('/api/send-push', {
         method: 'POST', body: JSON.stringify({
            userId: receiverId,
            title: 'Nytt mejl!',
            message: `${viewerUser.username} skickade ett mejl till dig.`,
            url: `/krypin?tab=Mejl&chatWith=${viewerUser.id}`
         }), headers: { 'Content-Type': 'application/json' }
      }).catch(() => {});
   }



   const handleSearchUsers = async (query: string) => {
      if (query.trim().length < 2) { setComposeSearchResults([]); return; }
      const { data } = await supabase.from('profiles').select('id, username, avatar_url').ilike('username', `%${query}%`).limit(10);
      if (data) {
         const filtered = data.filter(u => !globalBlockedIds.has(u.id));
         setComposeSearchResults(filtered);
      }
   };

   const handleSendComposedPM = async () => {
      if (!composeSelectedUser || !composeContent.trim() || !viewerUser) return;
      if (isSending) return;
      setIsSending(true);

      // Optimistic Update
      const tempId = 'temp-comp-' + Date.now();
      const optMsg = {
         id: tempId,
         sender_id: viewerUser.id,
         receiver_id: composeSelectedUser.id,
         content: composeContent.trim(),
         created_at: new Date().toISOString(),
         is_read: false,
         sender: { id: viewerUser.id, username: viewerUser.username, avatar_url: viewerUser.avatar_url }
      };
      setPrivateMessages(prev => [optMsg, ...prev]);
      setComposeModalOpen(false);
      setCustomAlert('Ditt mejl har flugit iväg!');

      const { data, error } = await supabase.from('private_messages').insert({
         sender_id: viewerUser.id,
         receiver_id: composeSelectedUser.id,
         content: composeContent.trim()
      }).select().single();

      setIsSending(false);
      if (error) {
         setPrivateMessages(prev => prev.filter(m => m.id !== tempId));
         if (error.message?.includes('DUPLICATE_LIMIT_REACHED')) {
            setShowDuplicateModal(true);
            return;
         }
         setCustomAlert('Kunde inte skicka mejl: ' + error.message);
         setComposeModalOpen(true); // Reopen on error
         return;
      }

      if (data) {
         setPrivateMessages(prev => prev.map(m => m.id === tempId ? { ...m, id: data.id } : m));
      }

      setComposeContent('');
      setComposeSelectedUser(null);
      setComposeSearchQuery('');

      // Background
      supabase.from('notifications').insert({
         receiver_id: composeSelectedUser.id,
         actor_id: viewerUser.id,
         type: 'pm',
         content: 'skickade dig ett mejl.',
         link: `/krypin?tab=Mejl&chatWith=${viewerUser.id}`
      }).then();

      fetch('/api/send-push', {
         method: 'POST', body: JSON.stringify({
            userId: composeSelectedUser.id,
            title: 'Nytt mejl!',
            message: `${viewerUser.username} skickade ett mejl till dig.`,
            url: `/krypin?tab=Mejl&chatWith=${viewerUser.id}`
         }), headers: { 'Content-Type': 'application/json' }
      }).catch(() => {});
   };

   const handleSignGuestbook = async () => {
      if (!newGuestbookPost.trim() || !currentUser || !viewerUser) return;
      if (isSending) return;
      setIsSending(true);

      // Optimistic update for Guestbook (Flash fast!)
      const tempId = 'temp-gb-' + Date.now();
      const optimisticPost = {
         id: tempId,
         receiver_id: currentUser.id,
         sender_id: viewerUser.id,
         content: newGuestbookPost,
         created_at: new Date().toISOString(),
         sender: { username: viewerUser.username, avatar_url: viewerUser.avatar_url }
      };
      setGuestbookPosts(prev => [optimisticPost, ...prev]);
      const savedPostContent = newGuestbookPost;
      setNewGuestbookPost('');

      const { data, error } = await supabase.from('guestbook').insert({
         receiver_id: currentUser.id,
         sender_id: viewerUser.id,
         content: savedPostContent
      }).select().single();

      setIsSending(false);

      if (error) {
         setGuestbookPosts(prev => prev.filter(p => p.id !== tempId));
         setNewGuestbookPost(savedPostContent);
         if (error.message?.includes('DUPLICATE_LIMIT_REACHED')) {
            setShowDuplicateModal(true);
            return;
         }
         setCustomAlert('Kunde inte skicka meddelande: ' + error.message);
         return;
      }

      if (data) {
         setGuestbookPosts(prev => prev.map(p => p.id === tempId ? { ...p, id: data.id } : p));
      }

      if (viewerUser.id !== currentUser.id) {
         // Background notifications
         supabase.from('notifications').insert({
            receiver_id: currentUser.id,
            actor_id: viewerUser.id,
            type: 'guestbook',
            content: 'skrev ett inlägg i din gästbok.',
            link: `/krypin?u=${currentUser.username}&tab=Gästbok`
         }).then();

         fetch('/api/send-push', {
            method: 'POST', body: JSON.stringify({
               userId: currentUser.id,
               title: 'Nytt Gästboksinlägg!',
               message: `${viewerUser.username} skrev i din gästbok.`,
               url: `/krypin?u=${currentUser.username}&tab=Gästbok`
            }), headers: { 'Content-Type': 'application/json' }
         }).catch(() => {});
      }
   };

   const handleAddFriend = async () => {
      if (!viewerUser || !currentUser || isMyProfile) return;
      if (viewerUser.id === currentUser.id) {
         setCustomAlert('Du kan inte skicka vänförfrågan till dig själv.');
         return;
      }
      if (isBlocked || hasBlockedMe) {
         setCustomAlert('Du kan inte skicka vänförfrågan till en person som är blockerad.');
         return;
      }
      const id1 = viewerUser.id < currentUser.id ? viewerUser.id : currentUser.id;
      const id2 = viewerUser.id < currentUser.id ? currentUser.id : viewerUser.id;

      const { error } = await supabase.from('friendships').insert({
         user_id_1: id1,
         user_id_2: id2,
         status: 'pending',
         action_user_id: viewerUser.id
      });
      if (!error) {
         setHasSentRequest(true);

         const targetId = id1 === viewerUser.id ? id2 : id1;

         // Lägg in i ringklockan (notiser)
         await supabase.from('notifications').insert({
            receiver_id: targetId,
            actor_id: viewerUser.id,
            type: 'friend_request',
            content: 'vill bli din vän på Facechat.',
            link: `/krypin?tab=Vänner`
         });

         // TRING! Send Web Push Notification to Receiver
         fetch('/api/send-push', {
            method: 'POST', body: JSON.stringify({
               userId: targetId,
               title: 'Ny vänförfrågan!',
               message: `${viewerUser.username} vill bli din vän på Facechat.`,
               url: `/krypin?tab=Vänner`
            }), headers: { 'Content-Type': 'application/json' }
         });
      } else {
         setCustomAlert('Ni är redan vänner eller så väntar en förfrågan!');
      }
   };

   const handleAcceptRequest = async (friendId: string) => {
      if (!currentUser || isProcessingFriendship) return;
      setIsProcessingFriendship(true);
      try {
         const id1 = currentUser.id < friendId ? currentUser.id : friendId;
         const id2 = currentUser.id < friendId ? friendId : currentUser.id;

         // Double check status before updating to avoid race conditions
         const { data: existingList } = await supabase.from('friendships').select('status').eq('user_id_1', id1).eq('user_id_2', id2).limit(1);
         const existing = existingList && existingList.length > 0 ? existingList[0] : null;

         if (!existing) {
            setCustomAlert("Hittade inte förfrågan i databasen. Försök ladda om sidan.");
            setIsProcessingFriendship(false);
            fetchFriends(currentUser.id, viewerUser.id);
            return;
         }

         if (existing.status !== 'pending') {
            setCustomAlert("Denna förfrågan är redan hanterad.");
            setIsProcessingFriendship(false);
            fetchFriends(currentUser.id, viewerUser.id);
            return;
         }

         const { error } = await supabase.from('friendships').update({
            status: 'accepted',
            action_user_id: currentUser.id
         }).eq('user_id_1', id1).eq('user_id_2', id2);

         if (error) throw error;

         // IMMEDIATE UI CLEANUP - Remove the friend from pending list manually
         setPendingRequests(prev => prev.filter(req => req.id !== friendId));

         // SQL TRIGGER SKÖTER DB-NOTISEN, MEN VI SKICKAR PUSH HÄR
         fetch('/api/send-push', {
            method: 'POST', body: JSON.stringify({
               userId: friendId,
               title: 'Vänförfrågan accepterad! 🎉',
               message: `${viewerUser.username} har accepterat din vänförfrågan! Ni är nu vänner.`,
               url: `/krypin?tab=Vänner`
            }), headers: { 'Content-Type': 'application/json' }
         }).catch(console.error);

         setCustomAlert("Vänförfrågan accepterad!");
         await fetchFriends(currentUser.id, viewerUser.id);
      } catch (err) {
         console.error("Error accepting friend request:", err);
      } finally {
         setIsProcessingFriendship(false);
      }
   }

   const handleDenyRequest = async (friendId: string) => {
      if (!currentUser || isProcessingFriendship) return;
      setIsProcessingFriendship(true);
      try {
         const id1 = currentUser.id < friendId ? currentUser.id : friendId;
         const id2 = currentUser.id < friendId ? friendId : currentUser.id;

         // Optimistic UI update
         setPendingRequests(prev => prev.filter(req => req.id !== friendId));

         const { error } = await supabase.from('friendships').delete()
            .eq('user_id_1', id1)
            .eq('user_id_2', id2);

         if (error) throw error;

         setCustomAlert("Vänförfrågan borttagen.");
         await fetchFriends(currentUser.id, viewerUser.id);
      } catch (err) {
         console.error("Error denying friend request:", err);
         fetchFriends(currentUser.id, viewerUser.id);
      } finally {
         setIsProcessingFriendship(false);
      }
   }

   const handleRemoveFriend = async (friendId: string) => {
      if (!currentUser) return;
      if (!confirm('Är du säker på att du vill ta bort den här personen som vän?')) return;
      const id1 = currentUser.id < friendId ? currentUser.id : friendId;
      const id2 = currentUser.id < friendId ? friendId : currentUser.id;
      await supabase.from('friendships').delete().eq('user_id_1', id1).eq('user_id_2', id2);

      // Optimistic UI update
      setFriends(prev => prev.filter(f => f.id !== friendId));
      fetchFriends(currentUser.id, viewerUser.id);
   }

   const handleCancelRequest = async () => {
      if (!viewerUser || !currentUser) return;
      const id1 = viewerUser.id < currentUser.id ? viewerUser.id : currentUser.id;
      const id2 = viewerUser.id < currentUser.id ? currentUser.id : viewerUser.id;
      await supabase.from('friendships').delete().eq('user_id_1', id1).eq('user_id_2', id2);
      setHasSentRequest(false);
      fetchFriends(currentUser.id, viewerUser.id);
   };

   const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file || !currentUser || !viewerUser || viewerUser.id !== currentUser.id) return;

      if (file.size > 15 * 1024 * 1024) {
         setCustomAlert("Bilden är alldeles för stor att ens försöka ladda upp. Max 15MB innan komprimering.");
         return;
      }

      // --- CLIENT SIDE IMAGE COMPRESSION (Max 800px) ---
      const compressImage = (inputFile: File): Promise<Blob> => {
         return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(inputFile);
            reader.onload = (event) => {
               const img = new Image();
               img.src = event.target?.result as string;
               img.onload = () => {
                  const cvs = document.createElement('canvas');
                  let width = img.width;
                  let height = img.height;
                  const MAX_SIZE = 400;

                  if (width > height) {
                     if (width > MAX_SIZE) {
                        height *= MAX_SIZE / width;
                        width = MAX_SIZE;
                     }
                  } else {
                     if (height > MAX_SIZE) {
                        width *= MAX_SIZE / height;
                        height = MAX_SIZE;
                     }
                  }

                  cvs.width = width;
                  cvs.height = height;
                  const ctx = cvs.getContext('2d');
                  ctx?.drawImage(img, 0, 0, width, height);

                  cvs.toBlob(
                     (blob) => { if (blob) resolve(blob); else reject(new Error('Canvas misslyckades')); },
                     'image/jpeg',
                     0.8
                  );
               };
               img.onerror = (err) => reject(err);
            };
            reader.onerror = (err) => reject(err);
         });
      };

      try {
         setCustomAlert('Optimerar och krymper bilden... 🚀');
         const compressedBlob = await compressImage(file);

         const fileExt = 'jpg';
         const fileName = `${currentUser.id}-${Math.random().toString(36).substring(7)}.${fileExt}`;
         const filePath = `${fileName}`;

         // 1. Spara undan gammal bild-URL för radering efter lyckad uppladdning
         const oldAvatarUrl = currentUser.avatar_url;

         // 2. Upload to Supabase Storage Bucket 'avatars'
         const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, compressedBlob, { contentType: 'image/jpeg' });

         if (uploadError) {
            if (uploadError.message.includes("Bucket not found")) {
               setCustomAlert("Databasen saknar rätt mapp! Du måste logga in på Supabase -> Storage -> New Bucket, döp den till 'avatars' och gör den Public.");
            } else if (uploadError.message.includes("violates row-level security policy")) {
               setCustomAlert("Säkerhetsfel i Databasen! Du måste lägga in RLS-policies (INSERT och SELECT) på din 'avatars' bucket inne i Supabase Dashboard.");
            } else {
               setCustomAlert('Kunde inte ladda upp bilden! Fel: ' + uploadError.message);
            }
            return;
         }

         const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(filePath);

         // 3. Update DB
         await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', currentUser.id);

         // 4. RADERA GAMMAL BILD (Optimering / GDPR)
         if (oldAvatarUrl && oldAvatarUrl.includes('/avatars/')) {
            try {
               const oldFileName = oldAvatarUrl.split('/').pop()?.split('?')[0];
               if (oldFileName && oldFileName.includes(currentUser.id)) {
                  await supabase.storage.from('avatars').remove([oldFileName]);
               }
            } catch (delErr) {
               console.error("Kunde inte radera gammal profilbild:", delErr);
            }
         }

         setCurrentUser({ ...currentUser, avatar_url: publicUrl });
         setCustomAlert('Snyggt! Bilden komprimerades till Jpeg och lades upp blixtsnabbt! 📸');
      } catch (err: any) {
         setCustomAlert('Misslyckades att optimera bilden: ' + err.message);
      }
   };

   const handleDeleteGuestbookPost = async (id: string) => {
      if (!confirm('Vill du verkligen radera detta inlägg?')) return;
      setGuestbookPosts(prev => prev.filter(p => p.id !== id));
      await supabase.from('guestbook').delete().eq('id', id);
   };

   const handleSavePresentation = async () => {
      if (!currentUser) return;
      const { error } = await supabase.from('profiles').update({ presentation: presentationText }).eq('id', currentUser.id);
      if (!error) {
         setCurrentUser({ ...currentUser, presentation: presentationText });
         setCustomAlert('Din presentation har sparats!');
      } else {
         alert("Ett fel uppstod när din text skulle sparas.");
      }
   };

   const fetchRecentVisitors = async () => {
      if (!currentUser) return;
      const { data } = await supabase.from('notifications').select('*, actor:actor_id(username, avatar_url)').eq('receiver_id', currentUser.id).eq('type', 'visit').order('created_at', { ascending: false }).limit(40);
      if (data) {
         const unique = [];
         const seenIds = new Set();
         for (const notif of data) {
            if (!seenIds.has(notif.actor_id) && !globalBlockedIds.has(notif.actor_id)) {
               seenIds.add(notif.actor_id);
               unique.push(notif);
               if (unique.length === 5) break;
            }
         }
         setRecentVisitors(unique);
      }
      setShowVisitorsModal(true);
   };

   const handleAdminResetCss = async () => {
      if (!confirm(`Säkerhetsvarning: Vill du verkligen nollställa all CSS-design för ${currentUser.username}?`)) return;
      await supabase.from('profiles').update({ custom_style: null }).eq('id', currentUser.id);
      setCurrentUser({ ...currentUser, custom_style: null });
   };

   const handleToggleBlock = async () => {
      if (!viewerUser || !currentUser) return;

      if (isBlocked) {
         if (!confirm('Vill du häva blockeringen mot denna användare?')) return;
         
         const result = await toggleUserBlockAction(currentUser.id, false);
         if (result.success) {
            setIsBlocked(false);
            setGlobalBlockedIds(prev => { 
               const next = new Set(prev); 
               if (!hasBlockedMe) next.delete(currentUser.id); 
               return next; 
            });
            setCustomAlert('Blockeringen är hävd.');
         } else {
            setCustomAlert('Misslyckades att häva blockering: ' + (result.error || 'Okänt fel'));
         }
      } else {
         if (!confirm('Är du säker på att du vill blockera denna användare? Ni kommer inte kunna se varandras profiler eller kommunicera längre.')) return;

         const result = await toggleUserBlockAction(currentUser.id, true);
         if (result.success) {
            setIsBlocked(true);
            setGlobalBlockedIds(prev => { 
               const next = new Set(prev); 
               next.add(currentUser.id); 
               return next; 
            });
            setCustomAlert('Användaren har blivit blockerad. Du skickas nu tillbaka till ditt krypin.');

            // Immediate redirect as requested
            setTimeout(() => {
               window.location.href = '/krypin';
            }, 1200);
         } else {
            setCustomAlert('Misslyckades att blockera: ' + (result.error || 'Okänt fel'));
         }
      }
   };

   const handleReportContent = async () => {
      if (!viewerUser || !reportTarget || !reportReason.trim()) return;
      let finalReason = `[${reportCategory}] ${reportReason.trim()}`;
      if (reportTarget.type === 'private_message' && reportTarget.content) {
         finalReason = `DM: "${reportTarget.content}"\n\n${finalReason}`;
      }
      await supabase.from('reports').insert({
         reporter_id: viewerUser.id,
         reported_user_id: reportTarget.reportedUserId,
         item_type: reportTarget.type,
         item_id: reportTarget.id,
         reason: finalReason
      });

      // Notifiera alla administratörer om den nya anmälan så de ser den i klockan!
      try {
         const { data: admins } = await supabase.from('profiles').select('id, username')
            .or('is_admin.eq.true,perm_content.eq.true');

         if (admins && admins.length > 0) {
            const filteredAdmins = admins.filter(admin => {
               // Om en admin blir anmäld ska hen INTE få notis, 
               // förutom om det är root (mrsunshine88).
               const isReportedAdmin = admin.id === reportTarget.reportedUserId;
               const isRoot = admin.username === 'mrsunshine88';

               if (isReportedAdmin && !isRoot) {
                  return false;
               }
               return true;
            });

            if (filteredAdmins.length > 0) {
               const adminNotifs = filteredAdmins.map(admin => ({
                  receiver_id: admin.id,
                  actor_id: viewerUser.id,
                  type: 'report',
                  content: 'har skickat in en ny anmälan.',
                  link: '/admin?tab=reports'
               }));

               await supabase.from('notifications').insert(adminNotifs);

               // Skicka även push-notiser till admins
               filteredAdmins.forEach(admin => {
                  fetch('/api/send-push', {
                     method: 'POST', body: JSON.stringify({
                        userId: admin.id,
                        title: 'Ny anmälan inkommen!',
                        message: `${viewerUser.username} har anmält ${reportTarget.type === 'profile' ? 'en person' : 'ett inlägg'}.`,
                        url: '/admin?tab=reports'
                     }), headers: { 'Content-Type': 'application/json' }
                  });
               });
            }
         }
      } catch (notifErr) {
         console.error("Misslyckades att notifiera admins:", notifErr);
      }

      setCustomAlert('Din anmälan har skickats till våra moderatorer. Tack för att du hjälper till att hålla Facechat tryggt!');
      setShowReportModal(false);
      setReportReason('');
      setReportCategory('Spam');
      setReportTarget(null);
   };

   const handlePreviewCss = () => {
      // Säkrad förhandsgranskning inuti webbläsaren (Fortnox Standard)
      const safeCss = sanitizeCSS(draftCss);
      setPreviewCss(safeCss);
      setIsEditingKrypin(false);
   };

   const handleSaveLiveCss = async () => {
      if (previewCss === null) return;

      // Vi använder nu den säkra Server Actionen istället för direkt DB-uppdatering
      const result = await saveKrypinDesign(previewCss, presentationText);

      if (result.success) {
         setCurrentUser({
            ...currentUser,
            custom_style: result.cleanedCss || previewCss,
            presentation: presentationText
         });
         setPreviewCss(null);
         setCustomAlert(result.message);
      } else {
         setCustomAlert("Fel vid sparande: " + result.error);
      }
   };

   // --- THREAD LOGIC ---
   const threads = React.useMemo(() => {
      if (!viewerUser) return [];
      const threadMap = new Map<string, any>();
      privateMessages.forEach(msg => {
         const isSentByMe = msg.sender_id === viewerUser.id;
         const otherUser = isSentByMe ? msg.receiver : msg.sender;
         if (!otherUser) return;
         const otherId = otherUser.id;
         if (globalBlockedIds.has(otherId)) return;
         if (!threadMap.has(otherId)) {
            threadMap.set(otherId, {
               otherUser,
               messages: [],
               unreadCount: 0,
               lastMessageAt: msg.created_at
            });
         }
         const t = threadMap.get(otherId);
         t.messages.push(msg);
         if (!isSentByMe && !msg.is_read) {
            t.unreadCount++;
         }
         if (new Date(msg.created_at) > new Date(t.lastMessageAt)) {
            t.lastMessageAt = msg.created_at;
         }
      });

      // Sort messages in each thread chronologically (oldest to newest)
      threadMap.forEach(t => {
         t.messages.sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
      });

      // Sort threads by latest message
      return Array.from(threadMap.values()).sort((a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime());
   }, [privateMessages, viewerUser, globalBlockedIds]);

   const messagesEndRef = React.useRef<HTMLDivElement>(null);

   const scrollToBottom = () => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
   };

   useEffect(() => {
      if (activeTab === 'Mejl' && (selectedThreadUserId || isComposingNew)) {
         scrollToBottom();
      }
   }, [threads, selectedThreadUserId, isComposingNew, activeTab]);


   const canModerate = viewerUser?.is_admin || viewerUser?.perm_content;

   const menuItems = [
      { id: 'Profil', icon: User, show: true },
      { id: 'Gästbok', icon: Book, show: true },
      { id: 'Vänner', icon: Users, show: true },
      { id: 'Mejl', icon: Mail, show: isMyProfile },
      { id: 'Inställningar', icon: Settings, show: isMyProfile }
   ].filter(i => i.show);

   const isSuperAdmin = currentUser?.perm_roles;
   const isAdminLabel = isSuperAdmin ||
      currentUser?.is_admin ||
      currentUser?.perm_users ||
      currentUser?.perm_content ||
      currentUser?.perm_rooms ||
      currentUser?.perm_roles ||
      currentUser?.perm_support ||
      currentUser?.perm_logs ||
      currentUser?.perm_stats ||
      currentUser?.perm_diagnostics ||
      currentUser?.perm_chat;
   const isViewerAdmin = viewerUser?.is_admin ||
      viewerUser?.perm_users ||
      viewerUser?.perm_content ||
      viewerUser?.perm_rooms ||
      viewerUser?.perm_roles ||
      viewerUser?.perm_support ||
      viewerUser?.perm_logs ||
      viewerUser?.perm_stats ||
      viewerUser?.perm_diagnostics ||
      viewerUser?.perm_chat;

   const adminText = isSuperAdmin ? 'SUPERADMIN' : 'ADMIN';

   if (!currentUser) return <KrypinSkeleton />;

   return (
      <>
         <style>{`
        /* Säkrad rendering av CSS instängsel */
        #krypin-custom-container {
          ${previewCss !== null ? previewCss : (currentUser.custom_style || '')}
        }
        
        /* Standardtemafärger för meddelandebubblor */
        .krypin-message-bubble.is-me {
          background-color: var(--theme-krypin) !important;
          color: white !important;
        }
        .krypin-message-bubble.is-other {
          background-color: var(--bg-card);
          color: var(--text-main);
        }
        
        .krypin-thread-container { border: none !important; border-radius: 0 !important; }
        .krypin-thread-header { padding: 1.5rem 2rem !important; }
        .krypin-thread-chat { padding: 1.5rem 2rem !important; }
        .krypin-thread-input { padding: 1.5rem 2rem !important; border-top: 1px solid var(--border-color); }
        .krypin-thread-wrapper { height: 700px; max-height: calc(100vh - 120px) !important; margin: 0 !important; }
        .krypin-inbox-header { padding: 2rem 2.5rem !important; border-bottom: 1px solid var(--border-color) !important; }
        .krypin-inbox-list { padding: 0 !important; }
        .krypin-inbox-item { border-radius: 0 !important; border-left: none !important; border-right: none !important; margin-bottom: 0 !important; padding: 1.5rem 2.5rem !important; }
        .krypin-compose-card { padding: 2rem 2.5rem !important; border-radius: 0 !important; border: none !important; }

        /* Flyttade stilar för att tillåta editor-overrides */
        .status-badge {
          background-color: #f3e8ff;
          color: #6b21a8;
        }
        .interest-badge {
          background-color: var(--theme-krypin);
          color: white;
        }
        .profile-frame {
          border: 4px solid #f3e8ff;
          background-color: var(--theme-krypin);
        }
        .krypin-sidebar-menu button.active {
          background-color: var(--theme-krypin) !important;
          color: white !important;
        }

        @media (max-width: 768px) {
            .krypin-editor-modal {
               position: fixed !important;
               top: 0 !important; left: 0 !important; right: 0 !important; bottom: 0 !important;
               width: 100vw !important;
               height: 100vh !important;
               max-height: 100vh !important;
               border-radius: 0 !important;
               z-index: 9999 !important;
            }
           .krypin-layout { padding: 0 !important; gap: 0 !important; }
           .krypin-content-wrapper { padding: 0 !important; }
           .krypin-main-card { padding: 0 !important; border: none !important; border-radius: 0 !important; }
           .krypin-thread-header { padding: 0.75rem 1rem !important; }
           .krypin-thread-chat { padding: 1rem 0.5rem !important; }
           .krypin-thread-input { padding: 0.75rem 0.5rem !important; }
           .krypin-inbox-header { padding: 1rem !important; border-bottom: none !important; }
           .krypin-inbox-item { padding: 1rem !important; }
           .krypin-compose-card { padding: 1rem 0.5rem !important; }
           .krypin-thread-wrapper { height: calc(100dvh - 80px) !important; max-height: none !important; }
           .hacker-school-mobile {
              position: fixed !important;
              top: 0; left: 0; right: 0; bottom: 0;
              z-index: 9999 !important;
              background-color: rgba(15, 23, 42, 0.98) !important;
              padding: 1.5rem !important;
              border-radius: 0 !important;
              max-height: 100vh !important;
              border: none !important;
           }
        }
        @media (min-width: 769px) {
           .hide-on-desktop { display: none !important; }
        }

        /* Stora Trimmarn: Android Edition - Grafikoptimering 🎷💎🚀 */
        ${isAndroid ? `
           .card, .inner-box, .krypin-sidebar, .status-badge { 
              backdrop-filter: blur(4px) !important; 
              -webkit-backdrop-filter: blur(4px) !important;
              box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1) !important;
           }
        ` : ''}
      `}</style>

         {/* STUNNING 2026 LUNARSTORM EDITOR MODAL */}
         {isEditingKrypin && (
            <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.85)', zIndex: 2000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0' }}>
               <div className="krypin-editor-modal" style={{ backgroundColor: '#0f172a', width: '95%', maxWidth: '1000px', borderRadius: '16px', border: '1px solid #334155', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)', maxHeight: '90vh' }}>
                  <div style={{ padding: '1.25rem 1.5rem', borderBottom: '1px solid #1e293b', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                     <div>
                        <h2 style={{ color: 'white', margin: 0, fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}><FileEdit size={24} color="#a78bfa" /> Krypin Design</h2>
                     </div>
                     <button onClick={() => setIsEditingKrypin(false)} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '1.5rem' }}>&times;</button>
                  </div>

                  {/* TABS */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', backgroundColor: '#1e293b' }}>
                     <button onClick={() => setDesignTab('simple')} style={{ flex: '1 1 100px', padding: '1rem', background: designTab === 'simple' ? '#334155' : 'transparent', color: designTab === 'simple' ? 'white' : '#94a3b8', border: 'none', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                        🎨 Design (Enkel)
                     </button>
                     <button onClick={() => setDesignTab('presentation')} style={{ flex: '1 1 100px', padding: '1rem', background: designTab === 'presentation' ? '#334155' : 'transparent', color: designTab === 'presentation' ? 'white' : '#94a3b8', border: 'none', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                        📝 Presentation
                     </button>
                     <button onClick={() => setDesignTab('advanced')} style={{ flex: '1 1 100px', padding: '1rem', background: designTab === 'advanced' ? '#334155' : 'transparent', color: designTab === 'advanced' ? 'white' : '#94a3b8', border: 'none', fontWeight: 'bold', fontSize: '1rem', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}>
                        💻 Hacker (CSS)
                     </button>
                  </div>

                  <div style={{ flex: 1, overflowY: 'auto' }}>
                     {designTab === 'simple' ? (
                        <div style={{ padding: '2rem' }}>
                           <p style={{ color: '#cbd5e1', marginBottom: '1.5rem' }}>Dina val här skapar automatiskt koden åt dig. Du kan klicka på flera för att bygga ihop ditt drömkrypin!</p>

                           <div style={{ display: 'flex', gap: '1rem', marginBottom: '2rem', flexWrap: 'wrap', padding: '1rem', backgroundColor: '#1e293b', borderRadius: '12px', border: '1px solid #334155', alignItems: 'center' }}>
                              <span style={{ color: '#94a3b8', fontWeight: 'bold', fontSize: '1rem' }}>Verktyg:</span>
                              <button
                                 onClick={() => {
                                    if (cssHistory.length > 0) {
                                       const historyCopy = [...cssHistory];
                                       const prevCss = historyCopy.pop() || '';
                                       setDraftCss(prevCss);
                                       setPreviewCss(prevCss);
                                       setCssHistory(historyCopy);
                                    }
                                 }}
                                 disabled={cssHistory.length === 0}
                                 style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: 'none', background: cssHistory.length > 0 ? '#3b82f6' : '#334155', color: cssHistory.length > 0 ? 'white' : '#64748b', cursor: cssHistory.length > 0 ? 'pointer' : 'not-allowed', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'all 0.2s' }}>
                                 <Undo size={16} /> Ångra
                              </button>
                              <button
                                 onClick={() => {
                                    if (draftCss) {
                                       setCssHistory(prev => [...prev, draftCss]);
                                       setDraftCss('');
                                       setPreviewCss('');
                                       setSelectedThemeName(null);
                                       setSelectedBgColorName(null);
                                       setSelectedTextColorName(null);
                                       setSelectedPatternName(null);
                                       setSelectedFontName(null);
                                       setSelectedEffectName(null);
                                       setSelectedFrameName(null);
                                       setSelectedNeonName(null);
                                    }
                                 }}
                                 disabled={!draftCss}
                                 style={{ padding: '0.5rem 1rem', borderRadius: '8px', border: 'none', background: draftCss ? 'rgba(239, 68, 68, 0.1)' : 'transparent', color: draftCss ? '#ef4444' : '#64748b', cursor: draftCss ? 'pointer' : 'not-allowed', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem', marginLeft: 'auto', transition: 'all 0.2s' }}>
                                 <Trash2 size={16} /> Radera Allt
                              </button>
                           </div>

                           <h3 style={{ color: '#a78bfa', marginBottom: '1rem', fontSize: '1.1rem', marginTop: '1rem' }}>Färdiga Teman (Startpaket)</h3>
                           <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                              {KIDS_THEMES.map((theme, i) => (
                                 <button
                                    key={i}
                                    onClick={() => {
                                       setCssHistory(prev => [...prev, draftCss]);
                                       setDraftCss(theme.css);
                                       setPreviewCss(theme.css);
                                       setSelectedThemeName(theme.name);
                                       // Nollställ andra val när tema byts helt
                                       setSelectedBgColorName(null);
                                       setSelectedTextColorName(null);
                                       setSelectedPatternName(null);
                                       setSelectedFontName(null);
                                       setSelectedEffectName(null);
                                       setSelectedFrameName(null);
                                       setSelectedNeonName(null);
                                    }}
                                    style={{
                                       padding: '1rem',
                                       backgroundColor: '#1e293b',
                                       color: 'white',
                                       border: selectedThemeName === theme.name ? '2px solid white' : '2px solid #334155',
                                       borderRadius: '12px',
                                       cursor: 'pointer',
                                       fontWeight: 'bold',
                                       transition: 'all 0.2s',
                                       textAlign: 'center',
                                       boxShadow: selectedThemeName === theme.name ? '0 0 15px #a78bfa' : 'none'
                                    }}
                                    onMouseOver={e => e.currentTarget.style.borderColor = '#a78bfa'}
                                    onMouseOut={e => e.currentTarget.style.borderColor = selectedThemeName === theme.name ? 'white' : '#334155'}
                                    title="Klicka för att ladda detta tema!"
                                 >
                                    {theme.name}
                                 </button>
                              ))}
                           </div>

                           <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                              <h3 style={{ color: '#a78bfa', margin: 0, fontSize: '1.1rem' }}>Färger (Bakgrund)</h3>
                              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', backgroundColor: '#1e293b', padding: '0.25rem', borderRadius: '12px', border: '1px solid #334155', flexWrap: 'wrap' }}>
                                 <button onClick={() => setBgColorTarget('.krypin-layout')} style={{ padding: '0.4rem 0.8rem', borderRadius: '8px', background: bgColorTarget === '.krypin-layout' ? '#8b5cf6' : 'transparent', color: bgColorTarget === '.krypin-layout' ? 'white' : '#94a3b8', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem', transition: 'all 0.2s', border: bgColorTarget === '.krypin-layout' ? '2px solid white' : '1px solid #334155', boxShadow: bgColorTarget === '.krypin-layout' ? '0 0 15px #a78bfa' : 'none' }}>För Bakgrunden</button>
                                 <button onClick={() => setBgColorTarget('.card, .inner-box')} style={{ padding: '0.4rem 0.8rem', borderRadius: '8px', background: bgColorTarget === '.card, .inner-box' ? '#8b5cf6' : 'transparent', color: bgColorTarget === '.card, .inner-box' ? 'white' : '#94a3b8', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem', transition: 'all 0.2s', border: bgColorTarget === '.card, .inner-box' ? '2px solid white' : '1px solid #334155', boxShadow: bgColorTarget === '.card, .inner-box' ? '0 0 15px #a78bfa' : 'none' }}>I Rutorna & Inlägg</button>
                                 <button onClick={() => setBgColorTarget('.status-badge')} style={{ padding: '0.4rem 0.8rem', borderRadius: '8px', background: bgColorTarget === '.status-badge' ? '#8b5cf6' : 'transparent', color: bgColorTarget === '.status-badge' ? 'white' : '#94a3b8', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem', transition: 'all 0.2s', border: bgColorTarget === '.status-badge' ? '2px solid white' : '1px solid #334155', boxShadow: bgColorTarget === '.status-badge' ? '0 0 15px #a78bfa' : 'none' }}>Status-Känslan</button>
                                 <button onClick={() => setBgColorTarget('.interest-badge.interest-badge.interest-badge.interest-badge')} style={{ padding: '0.4rem 0.8rem', borderRadius: '8px', background: bgColorTarget === '.interest-badge.interest-badge.interest-badge.interest-badge' ? '#8b5cf6' : 'transparent', color: bgColorTarget === '.interest-badge.interest-badge.interest-badge.interest-badge' ? 'white' : '#94a3b8', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem', transition: 'all 0.2s', border: bgColorTarget === '.interest-badge.interest-badge.interest-badge.interest-badge' ? '2px solid white' : '1px solid #334155', boxShadow: bgColorTarget === '.interest-badge.interest-badge.interest-badge.interest-badge' ? '0 0 15px #a78bfa' : 'none' }}>Intresse-bubblorna</button>
                                 <button onClick={() => setBgColorTarget('.krypin-layout .krypin-message-bubble:not(.is-me)')} style={{ padding: '0.4rem 0.8rem', borderRadius: '8px', background: bgColorTarget === '.krypin-layout .krypin-message-bubble:not(.is-me)' ? '#8b5cf6' : 'transparent', color: bgColorTarget === '.krypin-layout .krypin-message-bubble:not(.is-me)' ? 'white' : '#94a3b8', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem', transition: 'all 0.2s', border: bgColorTarget === '.krypin-layout .krypin-message-bubble:not(.is-me)' ? '2px solid white' : '1px solid #334155', boxShadow: bgColorTarget === '.krypin-layout .krypin-message-bubble:not(.is-me)' ? '0 0 15px #a78bfa' : 'none' }}>Mottagna Mejl</button>
                              </div>
                           </div>
                           <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '0.75rem', marginBottom: '2rem' }}>
                              {KIDS_COLORS.map((color, i) => (
                                 <button
                                    key={i}
                                    onClick={() => {
                                       setCssHistory(prev => [...prev, draftCss]);
                                       const targetedCss = color.css.replace(/\.krypin-layout/g, bgColorTarget);
                                       const newCss = draftCss + '\n' + targetedCss;
                                       setDraftCss(newCss);
                                       setPreviewCss(newCss);
                                       setSelectedBgColorName(color.name);
                                    }}
                                    style={{
                                       padding: '0.75rem',
                                       backgroundColor: '#1e293b',
                                       color: 'white',
                                       border: selectedBgColorName === color.name ? '2px solid white' : '1px solid #475569',
                                       borderRadius: '8px',
                                       cursor: 'pointer',
                                       fontSize: '0.875rem',
                                       transition: 'all 0.2s',
                                       boxShadow: selectedBgColorName === color.name ? '0 0 10px #a78bfa' : 'none'
                                    }}
                                    onMouseOver={e => e.currentTarget.style.backgroundColor = '#334155'}
                                    onMouseOut={e => e.currentTarget.style.backgroundColor = '#1e293b'}
                                 >
                                    {color.name}
                                 </button>
                              ))}
                           </div>

                           <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem', marginTop: '1rem' }}>
                              <h3 style={{ color: '#a78bfa', margin: 0, fontSize: '1.1rem' }}>Textfärger (I Rutorna)</h3>
                              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', backgroundColor: '#1e293b', padding: '0.25rem', borderRadius: '12px', border: '1px solid #334155', flexWrap: 'wrap' }}>
                                 <button onClick={() => setTextColorTarget('.krypin-layout')} style={{ padding: '0.4rem 0.8rem', borderRadius: '8px', background: textColorTarget === '.krypin-layout' ? '#8b5cf6' : 'transparent', color: textColorTarget === '.krypin-layout' ? 'white' : '#94a3b8', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem', transition: 'all 0.2s', border: textColorTarget === '.krypin-layout' ? '2px solid white' : '1px solid #334155', boxShadow: textColorTarget === '.krypin-layout' ? '0 0 15px #a78bfa' : 'none' }}>Överallt</button>
                                 <button onClick={() => setTextColorTarget('.username-display')} style={{ padding: '0.4rem 0.8rem', borderRadius: '8px', background: textColorTarget === '.username-display' ? '#8b5cf6' : 'transparent', color: textColorTarget === '.username-display' ? 'white' : '#94a3b8', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem', transition: 'all 0.2s', border: textColorTarget === '.username-display' ? '2px solid white' : '1px solid #334155', boxShadow: textColorTarget === '.username-display' ? '0 0 15px #a78bfa' : 'none' }}>Användarnamnet</button>
                                 <button onClick={() => setTextColorTarget('.interest-badge.interest-badge.interest-badge.interest-badge')} style={{ padding: '0.4rem 0.8rem', borderRadius: '8px', background: textColorTarget === '.interest-badge.interest-badge.interest-badge.interest-badge' ? '#8b5cf6' : 'transparent', color: textColorTarget === '.interest-badge.interest-badge.interest-badge.interest-badge' ? 'white' : '#94a3b8', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem', transition: 'all 0.2s', border: textColorTarget === '.interest-badge.interest-badge.interest-badge.interest-badge' ? '2px solid white' : '1px solid #334155', boxShadow: textColorTarget === '.interest-badge.interest-badge.interest-badge.interest-badge' ? '0 0 15px #a78bfa' : 'none' }}>Intressen (Bubblorna)</button>
                                 <button onClick={() => setTextColorTarget('.krypin-sidebar')} style={{ padding: '0.4rem 0.8rem', borderRadius: '8px', background: textColorTarget === '.krypin-sidebar' ? '#8b5cf6' : 'transparent', color: textColorTarget === '.krypin-sidebar' ? 'white' : '#94a3b8', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem', transition: 'all 0.2s', border: textColorTarget === '.krypin-sidebar' ? '2px solid white' : '1px solid #334155', boxShadow: textColorTarget === '.krypin-sidebar' ? '0 0 15px #a78bfa' : 'none' }}>Vänstermeny</button>
                                 <button onClick={() => setTextColorTarget('.krypin-sidebar + div .card')} style={{ padding: '0.4rem 0.8rem', borderRadius: '8px', background: textColorTarget === '.krypin-sidebar + div .card' ? '#8b5cf6' : 'transparent', color: textColorTarget === '.krypin-sidebar + div .card' ? 'white' : '#94a3b8', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem', transition: 'all 0.2s', border: textColorTarget === '.krypin-sidebar + div .card' ? '2px solid white' : '1px solid #334155', boxShadow: textColorTarget === '.krypin-sidebar + div .card' ? '0 0 15px #a78bfa' : 'none' }}>Högerspalt</button>
                                 <button onClick={() => setTextColorTarget('.krypin-layout .krypin-message-bubble:not(.is-me)')} style={{ padding: '0.4rem 0.8rem', borderRadius: '8px', background: textColorTarget === '.krypin-layout .krypin-message-bubble:not(.is-me)' ? '#8b5cf6' : 'transparent', color: textColorTarget === '.krypin-layout .krypin-message-bubble:not(.is-me)' ? 'white' : '#94a3b8', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem', transition: 'all 0.2s', border: textColorTarget === '.krypin-layout .krypin-message-bubble:not(.is-me)' ? '2px solid white' : '1px solid #334155', boxShadow: textColorTarget === '.krypin-layout .krypin-message-bubble:not(.is-me)' ? '0 0 15px #a78bfa' : 'none' }}>Mottagna Mejl</button>
                              </div>
                           </div>
                           <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(110px, 1fr))', gap: '0.75rem', marginBottom: '2rem' }}>
                              {KIDS_TEXT_COLORS.map((color, i) => (
                                 <button
                                    key={i}
                                    onClick={() => {
                                       setCssHistory(prev => [...prev, draftCss]);
                                       const targetedCss = color.css.replace(/TARGET/g, textColorTarget);
                                       const newCss = draftCss + '\n' + targetedCss;
                                       setDraftCss(newCss);
                                       setPreviewCss(newCss);
                                       setSelectedTextColorName(color.name);
                                    }}
                                    style={{
                                       padding: '0.75rem',
                                       backgroundColor: '#1e293b',
                                       color: 'white',
                                       border: selectedTextColorName === color.name ? '2px solid white' : '1px solid #475569',
                                       borderRadius: '8px',
                                       cursor: 'pointer',
                                       fontSize: '0.875rem',
                                       transition: 'all 0.2s',
                                       boxShadow: selectedTextColorName === color.name ? '0 0 10px #a78bfa' : 'none'
                                    }}
                                    onMouseOver={e => e.currentTarget.style.backgroundColor = '#334155'}
                                    onMouseOut={e => e.currentTarget.style.backgroundColor = '#1e293b'}
                                 >
                                    {color.name}
                                 </button>
                              ))}
                           </div>

                           <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                              <h3 style={{ color: '#a78bfa', margin: 0, fontSize: '1.1rem' }}>Roliga Mönster & Emojis</h3>
                              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', backgroundColor: '#1e293b', padding: '0.25rem', borderRadius: '12px', border: '1px solid #334155', flexWrap: 'wrap' }}>
                                 <button onClick={() => setPatternTarget('.krypin-layout')} style={{ padding: '0.4rem 0.8rem', borderRadius: '8px', border: 'none', background: patternTarget === '.krypin-layout' ? '#a78bfa' : 'transparent', color: patternTarget === '.krypin-layout' ? 'white' : '#94a3b8', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem', transition: 'all 0.2s' }}>För Bakgrunden</button>
                                 <button onClick={() => setPatternTarget('.card, .inner-box')} style={{ padding: '0.4rem 0.8rem', borderRadius: '8px', background: patternTarget === '.card, .inner-box' ? '#a78bfa' : 'transparent', color: patternTarget === '.card, .inner-box' ? 'white' : '#94a3b8', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem', transition: 'all 0.2s', border: patternTarget === '.card, .inner-box' ? '2px solid white' : '1px solid #334155', boxShadow: patternTarget === '.card, .inner-box' ? '0 0 15px #a78bfa' : 'none' }}>I Rutorna & Inlägg</button>
                              </div>
                           </div>
                           <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                              {KIDS_PATTERNS.map((pattern, i) => (
                                 <button
                                    key={i}
                                    onClick={() => {
                                       setCssHistory(prev => [...prev, draftCss]);
                                       const targetedCss = pattern.css.replace(/\.krypin-layout/g, patternTarget);
                                       const newCss = draftCss + '\n' + targetedCss;
                                       setDraftCss(newCss);
                                       setPreviewCss(newCss);
                                       setSelectedPatternName(pattern.name);
                                    }}
                                    style={{
                                       padding: '1rem',
                                       backgroundColor: '#1e293b',
                                       color: 'white',
                                       border: selectedPatternName === pattern.name ? '2px solid white' : '2px dashed #475569',
                                       borderRadius: '12px',
                                       cursor: 'pointer',
                                       fontWeight: 'bold',
                                       transition: 'all 0.2s',
                                       boxShadow: selectedPatternName === pattern.name ? '0 0 10px #a78bfa' : 'none'
                                    }}
                                    onMouseOver={e => e.currentTarget.style.backgroundColor = '#334155'}
                                    onMouseOut={e => e.currentTarget.style.backgroundColor = '#1e293b'}
                                 >
                                    {pattern.name}
                                 </button>
                              ))}
                           </div>

                           <h3 style={{ color: '#a78bfa', marginBottom: '1rem', fontSize: '1.1rem' }}>Häftiga Effekter & Animationer</h3>
                           <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                              {KIDS_EFFECTS.map((eff, i) => (
                                 <button
                                    key={i}
                                    onClick={() => {
                                       setCssHistory(prev => [...prev, draftCss]);
                                       const newCss = draftCss + '\n' + eff.css;
                                       setDraftCss(newCss);
                                       setPreviewCss(newCss);
                                       setSelectedEffectName(eff.name);
                                    }}
                                    style={{
                                       padding: '1rem',
                                       backgroundColor: '#1e293b',
                                       color: '#6ee7b7',
                                       border: selectedEffectName === eff.name ? '2px solid white' : '2px solid #059669',
                                       borderRadius: '12px',
                                       cursor: 'pointer',
                                       fontWeight: 'bold',
                                       transition: 'all 0.2s',
                                       boxShadow: selectedEffectName === eff.name ? '0 0 10px #a78bfa' : 'none'
                                    }}
                                    onMouseOver={e => e.currentTarget.style.backgroundColor = '#064e3b'}
                                    onMouseOut={e => e.currentTarget.style.backgroundColor = '#1e293b'}
                                 >
                                    {eff.name}
                                 </button>
                              ))}
                           </div>

                           <h3 style={{ color: '#a78bfa', marginBottom: '1rem', fontSize: '1.1rem' }}>🖼️ Ram Runt Profilbilden</h3>
                           <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                              {KIDS_AVATAR_FRAMES.map((frame, i) => (
                                 <button
                                    key={i}
                                    onClick={() => {
                                       setCssHistory(prev => [...prev, draftCss]);
                                       const newCss = draftCss + '\n' + frame.css;
                                       setDraftCss(newCss);
                                       setPreviewCss(newCss);
                                       setSelectedFrameName(frame.name);
                                    }}
                                    style={{
                                       padding: '1rem',
                                       backgroundColor: '#1e293b',
                                       color: '#e879f9',
                                       border: selectedFrameName === frame.name ? '2px solid white' : '2px solid #86198f',
                                       borderRadius: '12px',
                                       cursor: 'pointer',
                                       fontWeight: 'bold',
                                       transition: 'all 0.2s',
                                       boxShadow: selectedFrameName === frame.name ? '0 0 10px #a78bfa' : 'none'
                                    }}
                                    onMouseOver={e => e.currentTarget.style.backgroundColor = '#4a044e'}
                                    onMouseOut={e => e.currentTarget.style.backgroundColor = '#1e293b'}
                                 >
                                    {frame.name}
                                 </button>
                              ))}
                           </div>

                           <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem', flexWrap: 'wrap', gap: '1rem' }}>
                              <h3 style={{ color: '#a78bfa', margin: 0, fontSize: '1.1rem' }}>💡 Neon & Lysande Text</h3>
                              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', backgroundColor: '#1e293b', padding: '0.25rem', borderRadius: '12px', border: '1px solid #334155', flexWrap: 'wrap' }}>
                                 <button onClick={() => setNeonTextTarget('.krypin-layout *')} style={{ padding: '0.4rem 0.8rem', borderRadius: '8px', border: 'none', background: neonTextTarget === '.krypin-layout *' ? '#a78bfa' : 'transparent', color: neonTextTarget === '.krypin-layout *' ? 'white' : '#94a3b8', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem', transition: 'all 0.2s' }}>Överallt</button>
                                 <button onClick={() => setNeonTextTarget('h1, h2, h3, .user-link, .username-display')} style={{ padding: '0.4rem 0.8rem', borderRadius: '8px', border: 'none', background: neonTextTarget === 'h1, h2, h3, .user-link, .username-display' ? '#a78bfa' : 'transparent', color: neonTextTarget === 'h1, h2, h3, .user-link, .username-display' ? 'white' : '#94a3b8', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem', transition: 'all 0.2s' }}>Rubriker & Länkar</button>
                                 <button onClick={() => setNeonTextTarget('.username-display')} style={{ padding: '0.4rem 0.8rem', borderRadius: '8px', background: neonTextTarget === '.username-display' ? '#a78bfa' : 'transparent', color: neonTextTarget === '.username-display' ? 'white' : '#94a3b8', fontWeight: 'bold', cursor: 'pointer', fontSize: '0.8rem', transition: 'all 0.2s', border: neonTextTarget === '.username-display' ? '2px solid white' : '1px solid #334155', boxShadow: neonTextTarget === '.username-display' ? '0 0 15px #a78bfa' : 'none' }}>Bara Användarnamnet</button>
                              </div>
                           </div>
                           <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '1rem', marginBottom: '2rem' }}>
                              {KIDS_NEON_TEXT.map((target, i) => (
                                 <button
                                    key={i}
                                    onClick={() => {
                                       setCssHistory(prev => [...prev, draftCss]);
                                       const targetedCss = target.css.replace(/TARGET/g, neonTextTarget);
                                       const newCss = draftCss + '\n' + targetedCss;
                                       setDraftCss(newCss);
                                       setPreviewCss(newCss);
                                       setSelectedNeonName(target.name);
                                    }}
                                    style={{
                                       padding: '1rem',
                                       backgroundColor: '#1e293b',
                                       color: '#ff7eb3',
                                       border: selectedNeonName === target.name ? '2px solid white' : '2px solid #ff7eb3',
                                       borderRadius: '12px',
                                       cursor: 'pointer',
                                       fontWeight: 'bold',
                                       transition: 'all 0.2s',
                                       textShadow: '0 0 5px #ff7eb3',
                                       boxShadow: selectedNeonName === target.name ? '0 0 10px #ff7eb3' : 'none'
                                    }}
                                    onMouseOver={e => e.currentTarget.style.backgroundColor = '#ff7eb333'}
                                    onMouseOut={e => e.currentTarget.style.backgroundColor = '#1e293b'}
                                 >
                                    {target.name}
                                 </button>
                              ))}
                           </div>

                           <h3 style={{ color: '#a78bfa', marginBottom: '1rem', fontSize: '1.1rem' }}>Typsnitt (Textstil)</h3>
                           <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '1rem' }}>
                              {KIDS_FONTS.map((font, i) => (
                                 <button
                                    key={i}
                                    onClick={() => {
                                       setCssHistory(prev => [...prev, draftCss]);
                                       const newCss = draftCss + '\n' + font.css;
                                       setDraftCss(newCss);
                                       setPreviewCss(newCss);
                                       setSelectedFontName(font.name);
                                    }}
                                    style={{
                                       padding: '1rem',
                                       backgroundColor: '#1e293b',
                                       color: '#fcd34d',
                                       border: selectedFontName === font.name ? '2px solid white' : '2px solid #b45309',
                                       borderRadius: '12px',
                                       cursor: 'pointer',
                                       fontWeight: 'bold',
                                       transition: 'all 0.2s',
                                       boxShadow: selectedFontName === font.name ? '0 0 10px #fcd34d' : 'none'
                                    }}
                                    onMouseOver={e => e.currentTarget.style.backgroundColor = '#78350f'}
                                    onMouseOut={e => e.currentTarget.style.backgroundColor = '#1e293b'}
                                 >
                                    {font.name}
                                 </button>
                              ))}
                           </div>

                           {/* BAKGRUNDSMUSIK (AUTOSPARA) */}
                           <div style={{ padding: '1.5rem', backgroundColor: '#0f172a', borderRadius: '12px', border: '1px solid #334155', marginTop: '2rem' }}>
                              <h3 style={{ color: '#a78bfa', margin: 0, marginBottom: '1rem', fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                 <Music size={24} /> Bakgrundsmusik (Spelas Automatiskt)
                              </h3>
                              <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '1.5rem', lineHeight: '1.5' }}>Välj en låt som spelas när andra besöker din profil! (Tips: Välj "Ingen musik" för att stänga av). <strong>Ditt val sparas direkt när du klickar!</strong></p>

                              {draftSong && !isMusicMuted && (
                                 <iframe
                                    width="1" height="1"
                                    src={`https://www.youtube.com/embed/${draftSong}?autoplay=1&loop=1&playlist=${draftSong}&controls=0`}
                                    frameBorder="0"
                                    allow="autoplay; encrypted-media"
                                    style={{ position: 'absolute', top: '-9999px', left: '-9999px', opacity: 0 }}
                                    title="Preview Music"
                                 ></iframe>
                              )}

                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '0.75rem' }}>
                                 {PROFILE_SONGS.map((song, i) => {
                                    const isSelected = draftSong === song.videoId;
                                    return (
                                       <button
                                          key={i}
                                          onClick={async () => {
                                             setDraftSong(song.videoId);
                                             const { error } = await supabase.from('profiles').update({ profile_song: song.videoId }).eq('id', currentUser.id);
                                             if (error) {
                                                console.error(error);
                                                setCustomAlert('Varning: Vänligen kör update_schema.sql i databasen för att aktivera denna funktion!');
                                             } else {
                                                setCurrentUser((prev: any) => ({ ...prev, profile_song: song.videoId }));
                                             }
                                          }}
                                          style={{
                                             padding: '0.75rem',
                                             backgroundColor: isSelected ? '#a78bfa' : '#1e293b',
                                             color: isSelected ? '#ffffff' : '#cbd5e1',
                                             border: `1px solid ${isSelected ? '#8b5cf6' : '#475569'}`,
                                             borderRadius: '8px',
                                             cursor: 'pointer',
                                             fontSize: '0.85rem',
                                             fontWeight: isSelected ? 'bold' : 'normal',
                                             textAlign: 'left',
                                             display: 'flex',
                                             alignItems: 'center',
                                             gap: '0.5rem',
                                             transition: 'all 0.2s',
                                             whiteSpace: 'nowrap',
                                             overflow: 'hidden',
                                             textOverflow: 'ellipsis'
                                          }}
                                          className="hover-lift"
                                       >
                                          {isSelected && <Volume2 size={16} style={{ flexShrink: 0 }} />}
                                          {!isSelected && <span style={{ opacity: 0.5 }}>🎵</span>}
                                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{song.name}</span>
                                       </button>
                                    );
                                 })}
                              </div>
                           </div>
                        </div>
                     ) : designTab === 'presentation' ? (
                        <div style={{ padding: '2rem', display: 'flex', flexDirection: 'column', height: '100%', minHeight: '600px' }}>
                           <h3 style={{ color: '#a78bfa', margin: 0, marginBottom: '1rem', fontSize: '1.25rem' }}>📝 Skriv om dig själv</h3>
                           <p style={{ color: '#94a3b8', fontSize: '0.85rem', marginBottom: '1.5rem', lineHeight: '1.5' }}>Gör ditt krypin personligt genom att skriva en bra text om vem du är! Vad gillar du och varför är du här? <strong style={{ color: '#e2e8f0' }}>Denna text uppdateras live direkt under krypinet bakom, så klicka "KÖR FÖRHANDSGRANSKNING" neråt i rutan för att se hur allt ser ut tillsammans!</strong></p>
                           <textarea
                              value={presentationText}
                              onChange={e => {
                                 setPresentationText(e.target.value);
                                 setCurrentUser((prev: any) => ({ ...prev, presentation: e.target.value }));
                              }}
                              placeholder="Hej allihopa och välkomna till min sida! Jag gillar datorer, spela gitarr och hänga..."
                              style={{ flex: 1, padding: '1.5rem', borderRadius: '12px', border: '2px solid #334155', backgroundColor: '#0f172a', color: '#f8fafc', resize: 'vertical', fontFamily: 'inherit', fontSize: '1.1rem', outline: 'none', marginBottom: '1.5rem', minHeight: '300px', lineHeight: '1.6' }}
                           />
                           <div style={{ display: 'flex', gap: '1rem', justifyContent: 'flex-end', marginTop: 'auto' }}>
                              <button onClick={handleSavePresentation} style={{ background: '#10b981', color: 'white', padding: '0.875rem 2.5rem', borderRadius: '8px', border: 'none', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', fontSize: '1rem' }} className="hover-lift">Spara Text Direkt</button>
                           </div>
                        </div>
                     ) : (
                        <div style={{ padding: '1.5rem', height: '100%', minHeight: '600px', display: 'flex', gap: '1.5rem', backgroundColor: '#0f172a', flexWrap: 'wrap' }}>
                           {/* CSS EDITOR */}
                           <div className="card" style={{ flex: '2 1 400px', backgroundColor: '#1e293b', padding: '1rem', display: 'flex', flexDirection: 'column', borderRadius: '8px', border: '1px solid #334155', minHeight: '450px', position: 'sticky', top: '10px', zIndex: 10 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                 <h3 style={{ color: '#6ee7b7', margin: 0, fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>💻 CSS Kodeditor</h3>
                                 <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <button
                                       onClick={() => setShowCssSchool(!showCssSchool)}
                                       style={{ padding: '0.4rem 0.75rem', backgroundColor: '#8b5cf6', color: 'white', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                                       className="hover-lift"
                                    >
                                       🎓 {showCssSchool ? 'Dölj Skolan' : 'Visa Skolan'}
                                    </button>
                                    <button
                                       onClick={() => {
                                          if (confirm('Är du säker på att du vill rensa all din kod och börja från en helt tom ruta?')) {
                                             setDraftCss('');
                                          }
                                       }}
                                       style={{ padding: '0.4rem 0.75rem', backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444', border: '1px solid #ef4444', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', fontWeight: 'bold' }}
                                       className="hover-lift"
                                    >
                                       🗑️ Töm Editor
                                    </button>
                                 </div>
                              </div>
                              <div style={{ backgroundColor: '#0f172a', flex: 1, padding: '1.5rem', display: 'flex', flexDirection: 'column', fontFamily: '"Courier New", Courier, monospace', borderRadius: '8px', border: '1px solid #000', boxShadow: 'inset 0 0 10px rgba(0,0,0,0.5)' }}>
                                 <textarea
                                    value={draftCss}
                                    onChange={e => setDraftCss(e.target.value)}
                                    placeholder={`/* Skriv din egen CSS-kod här... */\n\n`}
                                    style={{ flex: 1, width: '100%', minHeight: '350px', backgroundColor: 'transparent', color: '#e2e8f0', fontFamily: '"Courier New", Courier, monospace', fontSize: '1.05rem', border: 'none', outline: 'none', resize: 'vertical', lineHeight: '1.5' }}
                                    spellCheck={false}
                                 />
                              </div>
                           </div>

                           {/* CSS SKOLAN (UTBILDNINGSSYFTE) */}
                           {showCssSchool && (
                              <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', gap: '0' }}>
                                 <div className="animate-fade-in hacker-school-mobile" style={{ backgroundColor: '#1e293b', borderRadius: '8px', border: '1px solid #334155', padding: '1.5rem', overflowY: 'auto', color: '#cbd5e1', maxHeight: '550px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
                                       <h3 style={{ color: '#a78bfa', fontSize: '1.25rem', margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>🎓 Krypin CSS-Skola</h3>
                                       <button onClick={() => setShowCssSchool(false)} className="hide-on-desktop" style={{ background: 'none', border: 'none', color: '#cbd5e1', fontSize: '2.5rem', cursor: 'pointer', lineHeight: 0.5 }}>&times;</button>
                                    </div>
                                    <p style={{ fontSize: '0.85rem', marginBottom: '1.5rem', lineHeight: '1.5' }}>Välkommen! Här är en steg-för-steg guide för att bygga ett riktigt grymt layout. Kopiera koden i rutorna och klistra in till vänster!</p>

                                    <div style={{ marginBottom: '1.5rem' }}>
                                       <h4 style={{ color: '#f8fafc', marginBottom: '0.5rem', fontSize: '1rem' }}>Steg 1: Rymd-bakgrunden 🌌</h4>
                                       <p style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>Vi sätter en stjärnhimmel som bakgrundsbild på hela sidan.</p>
                                       <code style={{ display: 'block', backgroundColor: '#0f172a', padding: '0.75rem', borderRadius: '6px', color: '#6ee7b7', fontSize: '0.85rem', fontFamily: 'monospace' }}>
                                          .krypin-layout {'{'}<br />
                                          &nbsp;&nbsp;background-image: url('https://images.unsplash.com/photo-1534796636918-9f1b2dd94931');<br />
                                          &nbsp;&nbsp;background-size: cover;<br />
                                          &nbsp;&nbsp;background-attachment: fixed;<br />
                                          {'}'}
                                       </code>
                                    </div>

                                    <div style={{ marginBottom: '1.5rem' }}>
                                       <h4 style={{ color: '#f8fafc', marginBottom: '0.5rem', fontSize: '1rem' }}>Steg 2: Genomskinliga Rutor (Glassmorphism) 🪟</h4>
                                       <p style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>Nu gör vi rutorna suddiga och halvgenomskinliga, så bakgrunden lyser igenom!</p>
                                       <code style={{ display: 'block', backgroundColor: '#0f172a', padding: '0.75rem', borderRadius: '6px', color: '#6ee7b7', fontSize: '0.85rem', fontFamily: 'monospace' }}>
                                          .card {'{'}<br />
                                          &nbsp;&nbsp;background: rgba(15, 23, 42, 0.7) !important;<br />
                                          &nbsp;&nbsp;backdrop-filter: blur(10px);<br />
                                          &nbsp;&nbsp;border: 1px solid rgba(255,255,255,0.2) !important;<br />
                                          &nbsp;&nbsp;box-shadow: 0 8px 32px rgba(0,0,0,0.5);<br />
                                          &nbsp;&nbsp;color: #f8fafc !important;<br />
                                          {'}'}
                                       </code>
                                    </div>

                                    <div style={{ marginBottom: '1.5rem' }}>
                                       <h4 style={{ color: '#f8fafc', marginBottom: '0.5rem', fontSize: '1rem' }}>Steg 3: Neon på texter och länkar ⚡</h4>
                                       <p style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>Låt oss få ditt namn och rubriker att LYSA upp i neonrosa!</p>
                                       <code style={{ display: 'block', backgroundColor: '#0f172a', padding: '0.75rem', borderRadius: '6px', color: '#6ee7b7', fontSize: '0.85rem', fontFamily: 'monospace' }}>
                                          h1, h2, h3, .user-link {'{'}<br />
                                          &nbsp;&nbsp;color: #fff !important;<br />
                                          &nbsp;&nbsp;text-shadow: 0 0 5px #fff, 0 0 10px #fff, 0 0 20px #f0f !important;<br />
                                          {'}'}
                                       </code>
                                    </div>

                                    <div style={{ marginBottom: '1.5rem' }}>
                                       <h4 style={{ color: '#f8fafc', marginBottom: '0.5rem', fontSize: '1rem' }}>Steg 4: Studsande Avatar (Sväva-effekt) 🎈</h4>
                                       <p style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>Gör så att din profilbild rör sig när folk har musen över den!</p>
                                       <code style={{ display: 'block', backgroundColor: '#0f172a', padding: '0.75rem', borderRadius: '6px', color: '#6ee7b7', fontSize: '0.85rem', fontFamily: 'monospace' }}>
                                          .avatar-frame {'{'}<br />
                                          &nbsp;&nbsp;transition: transform 0.3s ease-in-out;<br />
                                          {'}'}<br />
                                          .avatar-frame:hover {'{'}<br />
                                          &nbsp;&nbsp;transform: scale(1.1) rotate(5deg);<br />
                                          {'}'}
                                       </code>
                                    </div>

                                    <div style={{ backgroundColor: '#2e1065', padding: '1rem', borderRadius: '8px', border: '1px solid #4c1d95', marginTop: '1rem' }}>
                                       <h4 style={{ color: '#ddd6fe', marginBottom: '0.5rem', fontSize: '0.95rem' }}>💡 Pro-Tip från Senior Dev:</h4>
                                       <p style={{ fontSize: '0.85rem', color: '#c4b5fd', margin: 0 }}>
                                          Glöm inte <code>!important</code> efter värden som inte biter. Det garanterar att redigeringen tvingas igenom.
                                       </p>
                                    </div>
                                 </div>
                              </div>
                           )}
                        </div>
                     )}
                  </div>

                  <div style={{ padding: '1.25rem 1.5rem', borderTop: '1px solid #1e293b', backgroundColor: '#0f172a', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem' }}>
                     <button onClick={() => { setIsEditingKrypin(false); setPreviewCss(null); }} style={{ background: 'rgba(255,255,255,0.05)', color: 'white', border: '1px solid #334155', padding: '0.6rem 1.2rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem' }}>Avbryt</button>
                     <button onClick={handlePreviewCss} style={{ background: '#a78bfa', color: '#4c1d95', border: 'none', padding: '0.75rem 1.25rem', borderRadius: '8px', cursor: 'pointer', fontWeight: '900', fontSize: '1rem', flex: 1, boxShadow: '0 0 15px rgba(167, 139, 250, 0.4)' }}>👉 KÖR FÖRHANDSGRANSKNING</button>
                  </div>
               </div>
            </div>
         )}

         {/* FLYTANDE FÖRHANDSGRANSKNINGS-BAR */}
         {/* FLYTANDE FÖRHANDSGRANSKNINGS-BAR */}
         {previewCss !== null && (
            <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, backgroundColor: 'rgba(15, 23, 42, 0.95)', backdropFilter: 'blur(10px)', color: 'white', padding: '1rem', display: 'flex', flexWrap: 'wrap', gap: '1rem', justifyContent: 'space-between', alignItems: 'center', zIndex: 1000, borderTop: '2px solid #a78bfa', boxShadow: '0 -10px 30px rgba(0,0,0,0.3)', maxHeight: '40vh', overflowY: 'auto' }}>
               <div style={{ flex: '1 1 250px' }}>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#a78bfa' }}><Eye size={20} /> Preview-läge aktivt!</h3>
                  <p style={{ margin: 0, color: '#e2e8f0', fontSize: '0.8rem', fontWeight: '500', marginTop: '0.25rem' }}>Bara du ser detta just nu. Nöjd?</p>
               </div>
               <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', flex: '1 1 100%' }}>
                  <button onClick={() => setPreviewCss(null)} style={{ flex: 1, minWidth: '110px', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', color: '#ef4444', padding: '0.75rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}>Skrota</button>
                  <button onClick={() => setIsEditingKrypin(true)} style={{ flex: 1, minWidth: '110px', background: '#334155', border: '1px solid #475569', color: 'white', padding: '0.75rem', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}>Redigera mer</button>
                  <button onClick={handleSaveLiveCss} style={{ flex: '2 1 100%', background: '#10b981', border: 'none', color: 'white', padding: '0.75rem', borderRadius: '8px', cursor: 'pointer', fontWeight: '900', fontSize: '0.95rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', boxShadow: '0 0 15px rgba(16, 185, 129, 0.4)' }}><CheckCircle size={18} /> PUBLICERA DESIGN</button>
               </div>
            </div>
         )}

         {/* BAKGRUNDSMUSIK SPELARE FÖR BESÖKARE (Visas inte i Edit Mode) */}
         {!isEditingKrypin && currentUser?.profile_song && (
            <>
               {/* Osynlig YouTube Spelare tricket */}


               {/* Flytande Ljudkontroll (Nedre högra hörnet) */}
               <div
                  onClick={() => {
                     const newMuted = !isMusicMuted;
                     setIsMusicMuted(newMuted);
                     localStorage.setItem('krypin_global_music_mute', newMuted ? 'true' : 'false');
                  }}
                  className="hover-lift"
                  style={{ position: 'fixed', bottom: '20px', right: '20px', backgroundColor: '#0f172a', border: '1px solid #334155', padding: '0.75rem 1rem', borderRadius: '50px', display: 'flex', alignItems: 'center', gap: '0.75rem', zIndex: 9999, color: 'white', boxShadow: '0 10px 25px rgba(0,0,0,0.5)', cursor: 'pointer', transition: 'all 0.2s' }}
               >
                  {isMusicMuted ? <VolumeX size={18} color="#ef4444" /> : <Music size={18} color="#a78bfa" className="animate-pulse" />}
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                     <span style={{ fontSize: '0.7rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '1px', lineHeight: '1' }}>Spelar nu</span>
                     <span style={{ fontSize: '0.85rem', fontWeight: 'bold' }}>
                        {isMusicMuted ? 'Muted' : PROFILE_SONGS.find(s => s.videoId === currentUser.profile_song)?.name?.replace(/^[^\w]*/, '') || 'Musik'}
                     </span>
                  </div>
               </div>
            </>
         )}

         <iframe
            width="1" height="1"
            src={`https://www.youtube.com/embed/${currentUser.profile_song}?autoplay=1&loop=1&playlist=${currentUser.profile_song}&controls=0&mute=${isMusicMuted ? '1' : '0'}`}
            frameBorder="0"
            allow="autoplay; encrypted-media"
            style={{ position: 'absolute', top: '-9999px', left: '-9999px', opacity: 0 }}
            title="Background Music"
         ></iframe>
         <div id="krypin-custom-container">
            {/* FIX FÖR ATT SKYDDA UI-KNAPPAR MOT TEMAN SOM ANVÄNDER !IMPORTANT */}
            <style dangerouslySetInnerHTML={{
               __html: `
          .krypin-layout button.fb-action-btn, 
          .krypin-layout button.fb-trash-btn {
             background: none !important;
             border: none !important;
             box-shadow: none !important;
             padding: 4px !important;
             width: auto !important;
             height: auto !important;
             min-width: 0 !important;
             min-height: 0 !important;
             margin: 0 !important;
             display: flex !important;
             align-items: center !important;
             justify-content: center !important;
             transform: none !important;
             animation: none !important;
          }
          .krypin-layout button.fb-action-btn:hover {
             background: rgba(245, 158, 11, 0.1) !important;
             border-radius: 50% !important;
          }
          .krypin-layout button.fb-trash-btn:hover {
             background: rgba(239, 68, 68, 0.1) !important;
             border-radius: 50% !important;
          }
        ` }} />
            <div style={{ display: 'flex', gap: '2rem', minHeight: 'calc(100vh - 120px)', padding: '2rem' }} className="krypin-layout">

               {/* Global Custom Alert Toast */}
               {customAlert && (
                  <div className="animate-fade-in" style={{ position: 'fixed', bottom: '2rem', left: '50%', transform: 'translateX(-50%)', backgroundColor: 'var(--theme-krypin)', color: 'white', padding: '1rem 2rem', borderRadius: '999px', zIndex: 9999, display: 'flex', alignItems: 'center', gap: '1rem', boxShadow: '0 10px 25px rgba(0,0,0,0.3)', fontWeight: 'bold' }}>
                     <AlertTriangle size={20} />
                     <span>{customAlert}</span>
                     <button onClick={() => setCustomAlert(null)} style={{ background: 'none', border: 'none', color: 'white', cursor: 'pointer', marginLeft: '1rem', opacity: 0.8, fontSize: '1.2rem', padding: '0 0.5rem' }}>&times;</button>
                  </div>
               )}

               {/* Report Modal */}
               {showReportModal && (
                  <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                     <div className="card animate-fade-in" style={{ width: '100%', maxWidth: '400px', padding: '2rem' }}>
                        <h3 style={{ marginTop: 0, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#b91c1c' }}>
                           <AlertTriangle size={24} /> {reportTarget?.type === 'profile' ? 'Anmäl Person' : 'Anmäl Innehåll'}
                        </h3>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '0.875rem' }}>
                           {reportTarget?.type === 'profile'
                              ? `Varför vill du anmäla ${currentUser.username}? Beskriv händelsen.`
                              : 'Vad gäller anmälan? Välj en kategori och beskriv kortfattat.'}
                        </p>

                        <select
                           value={reportCategory}
                           onChange={e => setReportCategory(e.target.value)}
                           style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', marginBottom: '1rem', fontWeight: 'bold' }}
                        >
                           <option value="Spam">Spam/Nedskräpning</option>
                           <option value="Hatretorik">Hatretorik/Kränkande</option>
                           <option value="Trakasserier">Trakasserier/Mobbning</option>
                           <option value="Olämpligt">Olämpligt Innehåll</option>
                           <option value="Annat">Annat</option>
                        </select>

                        <textarea
                           value={reportReason}
                           onChange={e => setReportReason(e.target.value)}
                           rows={4}
                           className="card inner-box"
                           style={{ width: '100%', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)', resize: 'vertical', marginBottom: '1rem', color: 'var(--text-main)' }}
                           placeholder="Beskriv vad som är fel (t.ex. personangrepp, spamlänk)..."
                        ></textarea>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                           <button onClick={() => { setShowReportModal(false); setReportReason(''); setReportTarget(null); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 'bold', color: 'var(--text-muted)' }}>Avbryt</button>
                           <button onClick={handleReportContent} disabled={!reportReason.trim()} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '8px', fontWeight: 'bold', cursor: reportReason.trim() ? 'pointer' : 'not-allowed', opacity: reportReason.trim() ? 1 : 0.5 }}>Skicka Anmälan</button>
                        </div>
                     </div>
                  </div>
               )}

               {/* Visitors Modal */}
               {showVisitorsModal && (
                  <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 4000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                     <div className="card animate-fade-in" style={{ width: '100%', maxWidth: '400px', padding: '2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1rem' }}>
                           <h3 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Eye size={20} color="var(--theme-krypin)" /> Senaste 5 Besökarna</h3>
                           <button onClick={() => setShowVisitorsModal(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontWeight: 'bold', color: '#ef4444' }}>Stäng</button>
                        </div>
                        {recentVisitors.length === 0 ? (
                           <p style={{ color: 'var(--text-muted)', textAlign: 'center' }}>Inga besök registrerade än.</p>
                        ) : (
                           <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                              {recentVisitors.map((v, idx) => (
                                 <div key={idx} onClick={() => { setShowVisitorsModal(false); router.push(`/krypin?u=${v.actor?.username}`); }} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem', backgroundColor: '#f8fafc', borderRadius: '8px', cursor: 'pointer', border: '1px solid #e2e8f0' }} className="hover-lift">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                                       <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--theme-krypin)', overflow: 'hidden' }}>
                                          {v.actor?.avatar_url && <img src={v.actor?.avatar_url} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                                       </div>
                                       <strong style={{ color: 'var(--text-main)' }}>{v.actor?.username}</strong>
                                    </div>
                                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(v.created_at).toLocaleString('sv-SE', { dateStyle: 'short', timeStyle: 'short' })}</span>
                                 </div>
                              ))}
                           </div>
                        )}
                     </div>
                  </div>
               )}

               {/* PM Modal */}
               {pmModalOpen && (
                  <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 3000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                     <div className="card" style={{ width: '100%', maxWidth: '500px', padding: '2rem' }}>
                        <h3 style={{ marginTop: 0, marginBottom: '1rem' }}>Skicka mejl till {currentUser.username}</h3>
                        <textarea
                           value={pmContent}
                           onChange={e => setPmContent(e.target.value)}
                           rows={5}
                           className="card inner-box"
                           style={{ width: '100%', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)', resize: 'vertical', marginBottom: '1rem', color: 'var(--text-main)' }}
                           placeholder="Skriv ditt meddelande..."
                        ></textarea>
                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                           <button onClick={() => setPmModalOpen(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 'bold', color: 'var(--text-muted)' }}>Avbryt</button>
                           <button onClick={() => handleSendPM(currentUser.id, pmContent)} disabled={!pmContent.trim()} style={{ background: 'var(--theme-krypin)', color: 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '8px', fontWeight: 'bold', cursor: pmContent.trim() ? 'pointer' : 'not-allowed', opacity: pmContent.trim() ? 1 : 0.5 }}>Skicka</button>
                        </div>
                     </div>
                  </div>
               )}

               {/* Sidebar */}
               <div style={{ width: '250px', display: 'flex', flexDirection: 'column', gap: '1.5rem', flexShrink: 0 }} className="krypin-sidebar">
                  <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', position: 'relative' }}>

                     <div style={{ position: 'relative', width: '100px', height: '100px', marginBottom: '1rem', cursor: 'pointer' }}>
                        <div className="profile-frame" style={{ width: '100%', height: '100%', borderRadius: '50%', overflow: 'hidden', boxSizing: 'border-box' }}>
                           {currentUser.avatar_url ? <img src={cleanUrl(currentUser.avatar_url) || ''} alt="Profile" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : ''}
                        </div>
                        {isMyProfile && (
                           <div
                              onClick={() => document.getElementById('avatarUpload')?.click()}
                              style={{ position: 'absolute', bottom: '0', right: '0', backgroundColor: 'var(--bg-card)', padding: '0.4rem', borderRadius: '50%', boxShadow: 'var(--shadow-md)', display: 'flex', border: '1px solid var(--border-color)', zIndex: 10 }}
                              className="hover-lift"
                           >
                              <Camera size={14} color="var(--text-main)" />
                              <input type="file" id="avatarUpload" style={{ display: 'none' }} accept="image/*" onChange={handleAvatarUpload} />
                           </div>
                        )}
                     </div>
                     <h2 className="username-display" style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--text-main)' }}>{currentUser.username}</h2>

                     {isAdminLabel && (
                        <div style={{ marginTop: '0.1rem', marginBottom: '0.25rem' }}>
                           <span className="username-display" style={{
                              fontSize: '0.7rem',
                              fontWeight: '900',
                              textTransform: 'uppercase',
                              letterSpacing: '3px',
                              color: 'var(--theme-krypin)',
                              opacity: 0.8
                           }}>
                              {adminText}
                           </span>
                        </div>
                     )}

                     <div className="status-badge" style={{ marginTop: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '0.5rem', padding: '0.25rem 0.75rem', borderRadius: '999px', fontSize: '0.75rem', fontWeight: '600' }}>
                        {currentUser.status_icon === 'star' && <><Star size={14} /> Sugen på fest!</>}
                        {currentUser.status_icon === 'moon' && <><Moon size={14} /> Sömntuta</>}
                        {currentUser.status_icon === 'heart' && <><Heart size={14} /> Kär & galen!</>}
                        {currentUser.status_icon === 'zap' && <><Zap size={14} /> Stressad / Full fart</>}
                        {currentUser.status_icon === 'coffee' && <><Coffee size={14} /> Behöver kaffe</>}
                        {currentUser.status_icon === 'ghost' && <><Ghost size={14} /> På bushumör!</>}
                        {currentUser.status_icon === 'sun' && <><Sun size={14} /> Cool & lugn</>}
                        {currentUser.status_icon === 'gamepad' && <><Gamepad2 size={14} /> Sitter och spelar</>}
                        {(!currentUser.status_icon || currentUser.status_icon === 'user') && <><User size={14} /> Bara online</>}
                     </div>

                     {isMyProfile && (
                        <button onClick={fetchRecentVisitors} style={{ marginTop: '1rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', width: '100%', padding: '0.5rem', backgroundColor: '#e0f2fe', color: '#0369a1', border: '1px solid #bae6fd', borderRadius: '8px', fontWeight: 'bold', cursor: 'pointer', transition: 'all 0.1s' }} className="hover-lift">
                           <Eye size={16} /> Senaste Besökare
                        </button>
                     )}

                  </div>

                  <div className="card krypin-sidebar-menu" style={{ padding: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                     {[
                        { id: 'Profil', icon: User },
                        { id: 'Mejl', icon: Mail },
                        { id: 'Vänner', icon: Users },
                        { id: 'Gästbok', icon: Book },
                        { id: 'Spel 🕹️', icon: Gamepad2 },
                        { id: 'Inställningar', icon: Settings }
                     ].filter(item => isMyProfile || (item.id !== 'Mejl' && item.id !== 'Inställningar')).map(item => (
                        <button
                           key={item.id}
                           onClick={() => { setActiveTab(item.id); setSelectedMail(null); }}
                           className={`hover-lift ${activeTab === item.id ? 'active' : ''}`}
                           style={{
                              display: 'flex', alignItems: 'center', gap: '0.75rem',
                              padding: '0.75rem 1rem', borderRadius: '8px',
                              fontWeight: activeTab === item.id ? '600' : '500',
                              textAlign: 'left', border: 'none', cursor: 'pointer',
                              backgroundColor: 'transparent',
                              color: activeTab === item.id ? 'white' : 'var(--text-main)',
                           }}
                        >
                           <item.icon size={18} opacity={activeTab === item.id ? 1 : 0.6} /> {item.id}
                        </button>
                     ))}
                  </div>

                  {/* REDIGERA DESIGN KNAPP (Visas bara om det är ditt krypin) */}
                  {isMyProfile && (
                     <button
                        onClick={() => { setDraftCss(currentUser.custom_style || ''); setPresentationText(currentUser.presentation || ''); setIsEditingKrypin(true); setDesignTab('simple'); }}
                        style={{ width: '100%', padding: '0.875rem', backgroundColor: 'var(--theme-krypin)', color: 'white', border: 'none', borderRadius: '8px', fontWeight: '800', fontSize: '0.875rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', cursor: 'pointer', boxShadow: '0 4px 6px rgba(0, 132, 118, 0.3)', transition: 'transform 0.1s' }}
                     >
                        <FileEdit size={16} /> REDIGERA KRYPIN
                     </button>
                  )}
               </div>

               {/* Main Content */}
               <div style={{ flex: 1 }} className="krypin-content-wrapper">
                  <div className={`card krypin-main-card ${activeTab === 'Mejl' ? 'krypin-main-card-mejl' : ''}`} style={{ minHeight: '500px', padding: activeTab === 'Mejl' ? '0' : '2.5rem', overflow: 'hidden' }}>
                     {activeTab !== 'Mejl' && (
                        <h1 style={{ fontSize: '1.75rem', marginBottom: '2rem', color: 'var(--theme-krypin)', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', fontWeight: '700' }}>
                           {activeTab}
                        </h1>
                     )}

                     {activeTab === 'Profil' && (
                        <div>
                           <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                              <h3 style={{ fontSize: '1.25rem', color: 'var(--text-main)', fontWeight: '700', margin: 0 }}>Välkommen till mitt krypin! ✌️</h3>

                              {!isMyProfile && (
                                 <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                                    {!hasBlockedMe && !isBlocked && (
                                       <>
                                          <button
                                             onClick={friends.some(f => f.id === viewerUser?.id) ? undefined : (hasSentRequest ? handleCancelRequest : handleAddFriend)}
                                             disabled={friends.some(f => f.id === viewerUser?.id)}
                                             style={{
                                                backgroundColor: friends.some(f => f.id === viewerUser?.id) ? '#10b981' : (hasSentRequest ? '#f59e0b' : 'var(--theme-krypin)'),
                                                color: 'white',
                                                padding: '0.6rem 1rem',
                                                borderRadius: '8px',
                                                border: 'none',
                                                cursor: friends.some(f => f.id === viewerUser?.id) ? 'default' : 'pointer',
                                                fontWeight: 'bold',
                                                display: 'flex', alignItems: 'center', gap: '0.4rem',
                                                boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                                                flex: '1 1 auto',
                                                justifyContent: 'center'
                                             }}>
                                             {friends.some(f => f.id === viewerUser?.id) ? '✓ Vänner' : (hasSentRequest ? '❌ Ångra' : 'Bli vän')}
                                          </button>
                                          <button onClick={() => setPmModalOpen(true)} style={{ backgroundColor: '#fff', color: 'var(--theme-krypin)', padding: '0.6rem 1rem', borderRadius: '8px', border: '2px solid var(--theme-krypin)', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.5rem', boxShadow: '0 4px 6px rgba(0,0,0,0.05)', flex: '1 1 auto', justifyContent: 'center' }}>
                                             <Mail size={16} /> Mejl
                                          </button>
                                       </>
                                    )}
                                    {!isViewerAdmin && !isAdminLabel && (
                                       <button onClick={handleToggleBlock} style={{ backgroundColor: isBlocked ? '#fca5a5' : '#ef4444', color: 'white', padding: '0.6rem 1rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '0.4rem', boxShadow: '0 4px 6px rgba(0,0,0,0.1)', flex: '1 1 auto', justifyContent: 'center' }}>
                                          <ShieldAlert size={16} /> {isBlocked ? 'Häv Blockering' : 'Blockera'}
                                       </button>
                                    )}
                                    <button
                                       onClick={() => {
                                          setReportTarget({ id: currentUser.id, type: 'profile', reportedUserId: currentUser.id });
                                          setShowReportModal(true);
                                       }}
                                       style={{ background: 'none', border: 'none', color: '#f59e0b', cursor: 'pointer', display: 'flex', alignItems: 'center', padding: '8px', borderRadius: '50%', transition: 'background-color 0.2s', flex: '0 0 auto' }}
                                       className="fb-action-btn"
                                       title="Anmäl person"
                                    >
                                       <AlertTriangle size={20} />
                                    </button>
                                 </div>
                              )}
                           </div>

                           {/* Här kommer din presentation (Main Profil area) vara */}
                           <div className="card inner-box" style={{ padding: '1.5rem', minHeight: '300px', display: 'flex', flexDirection: 'column', border: 'none', borderRadius: '12px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
                              {currentUser.presentation ? (
                                 <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.7', fontSize: '1rem', color: 'inherit', overflowWrap: 'break-word' }}>
                                    {maskWords(currentUser.presentation)}
                                 </div>
                              ) : (
                                 <div style={{ display: 'flex', flex: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '1rem', textAlign: 'center' }}>
                                    <p style={{ color: 'var(--text-muted)' }}>Användaren har ingen presentation.</p>
                                 </div>
                              )}
                           </div>

                           {/* OM MIG BOX */}
                           <div className="card inner-box" style={{ marginTop: '1.5rem', padding: '1.5rem', border: '1px solid var(--border-color)', borderRadius: '12px' }}>
                              <h4 style={{ fontSize: '1.25rem', color: 'var(--text-main)', marginBottom: '1rem', fontWeight: '700', borderBottom: '1px dashed var(--border-color)', paddingBottom: '0.5rem' }}>Om mig</h4>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                                 <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-main)' }}>
                                    <span style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px' }}>📍</span>
                                    <span style={{ fontSize: '0.95rem' }}><strong>Bor i:</strong> {currentUser.city || 'Hemligt'}</span>
                                 </div>

                                 {currentUser.show_phone && currentUser.phone && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-main)' }}>
                                       <span style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px' }}>📞</span>
                                       <span style={{ fontSize: '0.95rem' }}><strong>Telefon:</strong> {currentUser.phone}</span>
                                    </div>
                                 )}

                                 {currentUser.show_address && currentUser.address && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-main)' }}>
                                       <span style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px' }}>🏠</span>
                                       <span style={{ fontSize: '0.95rem' }}><strong>Adress:</strong> {currentUser.address} {currentUser.show_zipcode ? currentUser.zipcode : ''}</span>
                                    </div>
                                 )}

                                 {(!currentUser.show_address && currentUser.show_zipcode && currentUser.zipcode) && (
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', color: 'var(--text-main)' }}>
                                       <span style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px' }}>📮</span>
                                       <span style={{ fontSize: '0.95rem' }}><strong>Postnummer:</strong> {currentUser.zipcode}</span>
                                    </div>
                                 )}

                                 {currentUser.show_interests && currentUser.interests && currentUser.interests.length > 0 && (
                                    <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.75rem', color: 'var(--text-main)', marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px dashed var(--border-color)' }}>
                                       <span style={{ fontSize: '1.2rem', display: 'flex', alignItems: 'center', justifyContent: 'center', width: '28px', marginTop: '2px' }}>⭐</span>
                                       <div style={{ flex: 1 }}>
                                          <strong style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.95rem' }}>Intressen:</strong>
                                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                                             {currentUser.interests.map((interest: string, idx: number) => (
                                                <span key={idx} className="interest-badge" style={{ padding: '0.35rem 0.85rem', borderRadius: '999px', fontSize: '0.85rem', fontWeight: 'bold', display: 'inline-block' }}>{interest}</span>
                                             ))}
                                          </div>
                                       </div>
                                    </div>
                                 )}
                              </div>
                           </div>
                        </div>
                     )}

                     {activeTab === 'Gästbok' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
                           <div style={{ display: 'flex', gap: '1rem', flexDirection: 'column' }}>
                              <textarea
                                 value={newGuestbookPost}
                                 onChange={(e) => setNewGuestbookPost(e.target.value)}
                                 placeholder="Skriv i min gästbok..."
                                 className="card inner-box"
                                 style={{ width: '100%', padding: '1rem', border: '1px solid var(--border-color)', borderRadius: 'var(--radius)', fontFamily: 'inherit', resize: 'vertical', outline: 'none', minHeight: '80px', color: 'var(--text-main)' }}
                              ></textarea>
                              <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
                                 <button onClick={handleSignGuestbook} disabled={!newGuestbookPost.trim()} style={{ backgroundColor: 'var(--theme-krypin)', color: 'white', fontWeight: '600', padding: '0.875rem 3rem', borderRadius: 'var(--radius)', border: 'none', cursor: 'pointer', opacity: !newGuestbookPost.trim() ? 0.5 : 1 }}>
                                    Skicka Inlägg
                                 </button>
                              </div>
                           </div>

                           <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                              {guestbookPosts.filter(post => !globalBlockedIds.has(post.sender_id)).length === 0 && <p style={{ color: 'var(--text-muted)' }}>Gästboken är helt tom än så länge.</p>}

                              {guestbookPosts.filter(post => !globalBlockedIds.has(post.sender_id)).map(post => (
                                 <div key={post.id} className="card inner-box" style={{ padding: '1.5rem', borderRadius: '12px', border: '1px solid #e2e8f0', borderLeft: '4px solid var(--theme-krypin)', boxShadow: '0 4px 6px rgba(0,0,0,0.02)', position: 'relative' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '0.5rem', marginBottom: '1rem', borderBottom: '1px solid #f1f5f9', paddingBottom: '0.75rem' }}>
                                       <span className="user-link" onClick={() => window.location.href = `/krypin?u=${post.sender?.username}`} style={{ cursor: 'pointer', fontWeight: 'bold', fontSize: '1.1rem', wordBreak: 'break-all' }}>{post.sender?.username || 'Okänd'}</span>
                                       <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
                                          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                                             {new Date(post.created_at).toLocaleDateString('sv-SE')}
                                          </span>
                                          {(isMyProfile || viewerUser?.id === post.sender_id) && (
                                             <button onClick={() => handleDeleteGuestbookPost(post.id)} className="fb-trash-btn" style={{ color: '#ef4444', background: 'none', border: 'none', cursor: 'pointer', padding: '0.25rem' }} title="Radera inlägg"><Trash2 size={18} /></button>
                                          )}
                                          {viewerUser?.id !== post.sender_id && (
                                             <button
                                                onClick={() => { setReportTarget({ id: post.id, type: 'guestbook', reportedUserId: post.sender_id }); setShowReportModal(true); }}
                                                style={{ color: '#f59e0b', background: 'none', border: 'none', cursor: 'pointer', padding: '0.4rem', borderRadius: '50%', transition: 'background-color 0.2s' }}
                                                className="fb-action-btn"
                                                title="Anmäl inlägg"
                                             >
                                                <AlertTriangle size={20} />
                                             </button>
                                          )}
                                       </div>
                                    </div>
                                    <p style={{ color: 'var(--text-main)', whiteSpace: 'pre-wrap', fontSize: '1.05rem', lineHeight: '1.6' }}>{maskWords(post.content)}</p>
                                 </div>
                              ))}
                           </div>
                        </div>
                     )}

                     {activeTab === 'Vänner' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

                           {/* Vänförfrågningar (visas bara för min profil) */}
                           {isMyProfile && pendingRequests.filter(req => !globalBlockedIds.has(req.id) && !friends.some(f => f.id === req.id)).length > 0 && (
                              <div>
                                 <h4 style={{ fontSize: '1.1rem', color: '#f59e0b', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <AlertTriangle size={18} /> Vänförfrågningar ({pendingRequests.filter(req => !globalBlockedIds.has(req.id) && !friends.some(f => f.id === req.id)).length})
                                 </h4>
                                 <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                                    {pendingRequests.filter(req => !globalBlockedIds.has(req.id) && !friends.some(f => f.id === req.id)).map((req, i) => (
                                       <div key={i} style={{ padding: '1rem', border: '1px solid #fcd34d', backgroundColor: '#fffbeb', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
                                          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer' }} onClick={() => router.push(`?u=${req.username}`)}>
                                             <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: '#fcd34d', overflow: 'hidden' }}>
                                                {req.avatar_url && <img src={req.avatar_url} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />}
                                             </div>
                                             <span style={{ fontWeight: 'bold' }}>{req.username} vill bli din vän!</span>
                                          </div>
                                          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                                             <button onClick={() => handleAcceptRequest(req.id)} style={{ padding: '0.5rem 1rem', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', flex: '1 1 auto', minWidth: '100px' }}>Acceptera</button>
                                             <button onClick={() => handleDenyRequest(req.id)} style={{ padding: '0.5rem 1rem', backgroundColor: '#ef4444', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold', flex: '1 1 auto', minWidth: '80px' }}>Neka</button>
                                          </div>
                                       </div>
                                    ))}
                                 </div>
                              </div>
                           )}

                           {/* Vänlista */}
                           <div>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1rem' }}>
                                 <h3 style={{ fontSize: '1.25rem', color: 'var(--text-main)', margin: 0 }}>Vänlista</h3>
                              </div>
                              {friends.filter(f => !globalBlockedIds.has(f.id)).length === 0 ? (
                                 <p style={{ color: 'var(--text-muted)' }}>{isMyProfile ? 'Du har inga vänner på listan än.' : 'Denna användare har inga vänner tillagda.'}</p>
                              ) : (
                                 <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '1rem' }}>
                                    {friends.filter(f => !globalBlockedIds.has(f.id)).map((f, i) => (
                                       <div key={i} className="card hover-lift" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer' }} onClick={() => window.location.href = `/krypin?u=${f.username}`}>
                                          <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'var(--theme-krypin)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', overflow: 'hidden', flexShrink: 0 }}>
                                             {f.avatar_url ? <img src={f.avatar_url} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <User size={20} />}
                                          </div>
                                          <span style={{ fontWeight: 'bold', color: 'var(--text-main)' }}>{f.username}</span>
                                          {isMyProfile && (
                                             <div style={{ marginLeft: 'auto' }}>
                                                <button onClick={(e) => { e.stopPropagation(); handleRemoveFriend(f.id); }} style={{ padding: '0.4rem 0.75rem', fontSize: '0.75rem', backgroundColor: '#fee2e2', color: '#ef4444', border: '1px solid #fca5a5', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold', transition: 'all 0.1s' }} className="hover-lift">Ta bort</button>
                                             </div>
                                          )}
                                       </div>
                                    ))}
                                 </div>
                              )}
                           </div>
                        </div>
                     )}

                     {activeTab === 'Mejl' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }} className="krypin-inbox-wrapper">
                           {!isComposingNew && !selectedThreadUserId && (
                              <div className="desktop-inbox-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '1rem', marginBottom: '1rem' }}>
                                 <h3 style={{ fontSize: '1.25rem', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem', margin: 0 }}>
                                    <Mail size={20} color="var(--theme-krypin)" /> Din Inkorg
                                 </h3>
                                 <button onClick={() => { setIsComposingNew(true); setSelectedThreadUserId(null); }} style={{ backgroundColor: 'var(--theme-krypin)', color: 'white', padding: '0.6rem 1.25rem', borderRadius: '8px', border: 'none', cursor: 'pointer', fontWeight: 'bold', boxShadow: '0 4px 6px rgba(0,0,0,0.1)' }}>+ Skriv Nytt Mejl</button>
                              </div>
                           )}

                           {isComposingNew && (
                              <div className="animate-fade-in krypin-thread-wrapper desktop-chat-wrapper" style={{ display: 'flex', flexDirection: 'column', height: '600px', maxHeight: '100%' }}>
                                 <div className="card inner-box krypin-thread-container desktop-chat-container" style={{ flex: 1, display: 'flex', flexDirection: 'column', border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
                                    <div className="krypin-thread-header desktop-chat-header" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)' }}>
                                       <button onClick={() => { setIsComposingNew(false); setComposeSearchQuery(''); setComposeSearchResults([]); }} style={{ background: 'var(--theme-krypin)', border: 'none', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'white', flexShrink: 0, boxShadow: '0 2px 5px rgba(0,0,0,0.2)' }} title="Tillbaka">
                                          <ArrowLeft size={18} />
                                       </button>
                                       <strong style={{ fontSize: '1.2rem', color: 'var(--text-main)' }}>Nytt mejl</strong>
                                    </div>
                                    <div className="krypin-thread-chat" style={{ flex: 1, padding: '1.5rem', backgroundColor: 'var(--bg-color)', overflowY: 'auto' }}>
                                       <p style={{ fontSize: '0.875rem', fontWeight: 'bold', marginBottom: '1rem', color: 'var(--text-muted)' }}>Vem vill du skriva till?</p>
                                       <div style={{ position: 'relative' }}>
                                          <input type="text" value={composeSearchQuery} onChange={e => { setComposeSearchQuery(e.target.value); handleSearchUsers(e.target.value); }} placeholder="Sök efter användarnamn..." style={{ width: '100%', padding: '0.875rem 1rem', borderRadius: '24px', border: '1px solid var(--border-color)', fontSize: '1rem', color: 'var(--text-main)', backgroundColor: 'white', outline: 'none', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }} />
                                       </div>

                                       {composeSearchResults.length > 0 && (
                                          <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                             {composeSearchResults.map(u => (
                                                <div key={u.id} onClick={() => { setIsComposingNew(false); setSelectedThreadUserId(u.id); setComposeSearchQuery(''); setComposeSearchResults([]); }} style={{ padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }} className="hover-lift">
                                                   <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'var(--theme-krypin)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                      {u.avatar_url ? <img src={u.avatar_url} loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <User size={20} color="white" />}
                                                   </div>
                                                   <strong style={{ color: 'var(--text-main)', fontSize: '1.1rem' }}>{u.username}</strong>
                                                   <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--theme-krypin)', fontWeight: 'bold' }}>Skriv till {u.username} ➔</span>
                                                </div>
                                             ))}
                                          </div>
                                       )}
                                       {composeSearchQuery.length > 2 && composeSearchResults.length === 0 && (
                                          <div style={{ textAlign: 'center', marginTop: '2rem', color: 'var(--text-muted)' }}>
                                             <p style={{ fontWeight: 'bold' }}>Hittade tyvärr ingen användare med det namnet.</p>
                                          </div>
                                       )}
                                    </div>
                                 </div>
                              </div>
                           )}

                           {!isComposingNew && selectedThreadUserId && (
                              <div className="animate-fade-in krypin-thread-wrapper desktop-chat-wrapper" style={{ display: 'flex', flexDirection: 'column', height: '600px', maxHeight: '70vh' }}>
                                 {(() => {
                                    const thread = threads.find((t: any) => t.otherUser.id === selectedThreadUserId) || { otherUser: composeSearchResults.find((u: any) => u.id === selectedThreadUserId) || { id: selectedThreadUserId, username: 'Ny Chatt', avatar_url: '' }, messages: [] };
                                    return (
                                       <div className="card inner-box krypin-thread-container desktop-chat-container" style={{ flex: 1, display: 'flex', flexDirection: 'column', border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
                                          {/* Header */}
                                          <div className="krypin-thread-header desktop-chat-header" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)' }}>
                                             <button onClick={() => setSelectedThreadUserId(null)} style={{ background: 'var(--theme-krypin)', border: 'none', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'white', flexShrink: 0, boxShadow: '0 2px 5px rgba(0,0,0,0.2)' }} title="Tillbaka">
                                                <ArrowLeft size={18} />
                                             </button>
                                             <div style={{ cursor: 'pointer', overflow: 'hidden', flex: 1 }} onClick={() => window.location.href = `/krypin?u=${thread.otherUser.username}`}>
                                                <strong style={{ fontSize: '1.2rem', color: 'var(--text-main)', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', display: 'block' }}>{thread.otherUser.username}</strong>
                                             </div>
                                             <button onClick={(e) => handleDeleteThread(thread.otherUser.id, e)} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.5rem', opacity: 0.7, flexShrink: 0 }} title="Radera konversation"><Trash2 size={20} /></button>
                                          </div>

                                          {/* Chat Area */}
                                          <div className="krypin-thread-chat" style={{ flex: 1, overflowY: 'auto', padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem', backgroundColor: 'var(--bg-color)' }}>
                                             {thread.messages.length === 0 ? (
                                                <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: 'auto', marginBottom: 'auto' }}>Skicka ett första mejl för att starta chatt!</div>
                                             ) : (
                                                thread.messages.map((msg: any) => {
                                                   const isMe = msg.sender_id === viewerUser?.id;
                                                   return (
                                                      <div key={msg.id} style={{ display: 'flex', justifyContent: isMe ? 'flex-end' : 'flex-start' }}>
                                                         <div className={`krypin-message-bubble ${isMe ? 'is-me' : 'is-other'}`} style={{ maxWidth: '75%', padding: '0.75rem 1rem', borderRadius: '16px', borderBottomRightRadius: isMe ? '4px' : '16px', borderBottomLeftRadius: !isMe ? '4px' : '16px', boxShadow: '0 2px 4px rgba(0,0,0,0.05)', border: isMe ? 'none' : '1px solid var(--border-color)', minHeight: '1.5rem' }}>
                                                            <div style={{ whiteSpace: 'pre-wrap', lineHeight: '1.4', fontSize: '0.95rem' }}>{maskWords(msg.content)}</div>
                                                            <div style={{ fontSize: '0.7rem', display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px', marginTop: '0.4rem', opacity: 0.7 }}>
                                                               {!isMe && (
                                                                  <button
                                                                     onClick={() => {
                                                                        setReportTarget({ id: msg.id, type: 'private_message', reportedUserId: msg.sender_id, content: msg.content });
                                                                        setShowReportModal(true);
                                                                     }}
                                                                     style={{ background: 'none', border: 'none', color: '#f59e0b', cursor: 'pointer', padding: '4px', borderRadius: '50%', display: 'flex', alignItems: 'center', transition: 'background-color 0.2s' }}
                                                                     className="fb-action-btn"
                                                                     title="Anmäl meddelande"
                                                                  >
                                                                     <AlertTriangle size={18} />
                                                                  </button>
                                                               )}
                                                               {new Date(msg.created_at).toLocaleTimeString('sv-SE', { hour: '2-digit', minute: '2-digit' })}
                                                               {isMe && <span style={{ marginLeft: '4px' }}>{msg.is_read ? '✓✓' : '✓'}</span>}
                                                            </div>
                                                         </div>
                                                      </div>
                                                   );
                                                })
                                             )}
                                             <div ref={messagesEndRef} />
                                          </div>

                                          {/* Input Area */}
                                          <div className="krypin-thread-input desktop-inbox-header" style={{ padding: '1rem 0', borderTop: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', display: 'flex', gap: '0.75rem', alignItems: 'flex-end' }}>
                                             <textarea className="desktop-chat-input" value={replyContent} onChange={(e: any) => setReplyContent(e.target.value)} onKeyDown={(e: any) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendPM(thread.otherUser.id, replyContent); } }} rows={1} placeholder="Skriv ett meddelande..." style={{ flex: 1, padding: '0.75rem 1rem', borderRadius: '24px', border: '1px solid var(--border-color)', resize: 'none', backgroundColor: 'var(--bg-color)', color: 'var(--text-main)', outline: 'none', fontFamily: 'inherit' }}></textarea>
                                             <button onClick={() => handleSendPM(thread.otherUser.id, replyContent)} disabled={!replyContent.trim()} style={{ background: 'var(--theme-krypin)', color: 'white', border: 'none', borderRadius: '50%', width: '45px', height: '45px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: replyContent.trim() ? 'pointer' : 'default', opacity: replyContent.trim() ? 1 : 0.5, flexShrink: 0, marginBottom: '2px' }} title="Skicka">
                                                <MessageSquare size={20} />
                                             </button>
                                          </div>
                                       </div>
                                    );
                                 })()}
                              </div>
                           )}

                           {!isComposingNew && !selectedThreadUserId && (
                              <>
                                 {threads.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>Din inkorg är tom! Hittills inga konversationer.</div>
                                 ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                       {threads.map((thread: any) => (
                                          <div key={thread.otherUser.id} onClick={async () => {
                                             setSelectedThreadUserId(thread.otherUser.id);
                                             if (thread.unreadCount > 0) {
                                                const unreadMsgs = thread.messages.filter((m: any) => m.sender_id === thread.otherUser.id && !m.is_read);
                                                for (const msg of unreadMsgs) {
                                                   supabase.from('private_messages').update({ is_read: true }).eq('id', msg.id).then();
                                                }
                                                setPrivateMessages((prev: any[]) => prev.map((m: any) => m.sender_id === thread.otherUser.id ? { ...m, is_read: true } : m));
                                             }
                                          }} style={{ padding: '1rem', borderBottom: '1px solid var(--border-color)', backgroundColor: thread.unreadCount > 0 ? '#fef3c7' : undefined, display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', borderRadius: '8px', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }} className="card inner-box hover-lift">
                                             <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', overflow: 'hidden' }}>
                                                <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: 'var(--theme-krypin)', overflow: 'hidden', flexShrink: 0 }}>
                                                   {thread.otherUser.avatar_url ? <img src={thread.otherUser.avatar_url} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : <User size={24} style={{ margin: '12px', color: 'white' }} />}
                                                </div>
                                                <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                                                   <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                                      <strong style={{ color: 'var(--text-main)' }}>{thread.otherUser.username}</strong>
                                                      {thread.unreadCount > 0 && <span style={{ backgroundColor: '#ef4444', color: 'white', borderRadius: '999px', padding: '0.1rem 0.5rem', fontSize: '0.75rem', fontWeight: 'bold' }}>{thread.unreadCount} nya</span>}
                                                   </div>
                                                   <span style={{ color: thread.unreadCount > 0 ? 'var(--text-main)' : 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: '0.9rem', fontWeight: thread.unreadCount > 0 ? 'bold' : 'normal', marginTop: '0.2rem' }}>
                                                      {thread.messages.length > 0 && thread.messages[thread.messages.length - 1].sender_id === viewerUser?.id && <span style={{ color: '#94a3b8', marginRight: '0.3rem' }}>Ni:</span>}
                                                      {thread.messages.length > 0 ? thread.messages[thread.messages.length - 1].content : ''}
                                                   </span>
                                                </div>
                                             </div>
                                             <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0, gap: '0.5rem' }}>
                                                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(thread.lastMessageAt).toLocaleDateString('sv-SE', { month: 'short', day: 'numeric', ...((new Date().getFullYear() !== new Date(thread.lastMessageAt).getFullYear()) ? { year: 'numeric' } : {}) })}</span>
                                                <button onClick={(e) => handleDeleteThread(thread.otherUser.id, e)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0.2rem', opacity: 0.5 }} title="Radera konversation"><Trash2 size={16} /></button>
                                             </div>
                                          </div>
                                       ))}
                                    </div>
                                 )}
                              </>
                           )}
                        </div>
                     )}

                     {activeTab === 'Spel 🕹️' && (
                        <SnakeGame viewerUser={viewerUser} />
                     )}

                     {activeTab === 'Inställningar' && (
                        <div className="card" style={{ padding: '2rem' }}>
                           <h3 style={{ fontSize: '1.25rem', color: 'var(--text-main)', marginBottom: '1.5rem', fontWeight: '700' }}>Mitt Krypin - Inställningar</h3>
                           <form onSubmit={async (e) => {
                              e.preventDefault();
                              const formData = new FormData(e.currentTarget);
                              const sIcon = formData.get('status_icon') as string;
                              if (!currentUser) return;
                              
                              // 1. Check Cooldown (10 minuter)
                              const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
                              const lastChange = currentUser.last_status_change ? new Date(currentUser.last_status_change) : new Date(0);
                              const isCooldownActive = lastChange > tenMinutesAgo;
                              const isIconChanged = sIcon !== currentUser.status_icon;

                              // 2. Update DB
                              const updatePayload: any = { status_icon: sIcon, last_status_change: new Date().toISOString() };
                              const { error } = await supabase.from('profiles').update(updatePayload).eq('id', currentUser.id);
                              
                              if (error) {
                                 alert('Kunde inte spara: ' + error.message);
                                 return;
                              }

                              // 3. Notify Friends (Bara om ändrad och inte i cooldown)
                              if (isIconChanged && !isCooldownActive) {
                                 const { data: friendsList } = await supabase.from('friendships').select('user_id_1, user_id_2').or(`user_id_1.eq.${currentUser.id},user_id_2.eq.${currentUser.id}`);
                                 
                                 if (friendsList) {
                                    const friendIds = friendsList.map(f => f.user_id_1 === currentUser.id ? f.user_id_2 : f.user_id_1);
                                    
                                    const iconMap: any = {
                                       'user': '🧍 (Standard)',
                                       'star': '⭐ Sugen på fest!',
                                       'moon': '🌙 Sömntuta',
                                       'heart': '❤️ Hjärta - Kär & galen!',
                                       'zap': '⚡ Stressad / Full fart',
                                       'coffee': '☕ Behöver kaffe',
                                       'ghost': '👻 På bushumör!',
                                       'sun': '😎 Cool & lugn',
                                       'gamepad': '🎮 Sitter och spelar'
                                    };
                                    const statusLabel = iconMap[sIcon] || 'en ny status';
                                    
                                    const notifs = friendIds.map(fid => ({
                                       receiver_id: fid,
                                       actor_id: currentUser.id,
                                       type: 'status_change',
                                       content: `har ändrat sin status till: ${statusLabel}`,
                                       link: `/krypin?u=${currentUser.username}`
                                    }));

                                    if (notifs.length > 0) {
                                       await supabase.from('notifications').insert(notifs);
                                       
                                       // Push notifs
                                       friendIds.forEach(fid => {
                                          fetch('/api/send-push', {
                                             method: 'POST',
                                             body: JSON.stringify({
                                                userId: fid,
                                                title: '✨ Ny status!',
                                                message: `${currentUser.username} har ändrat sin status: ${statusLabel}`,
                                                url: `/krypin?u=${currentUser.username}`
                                             }),
                                             headers: { 'Content-Type': 'application/json' }
                                          }).catch(() => {});
                                       });
                                    }
                                 }
                              }

                              setCurrentUser({ ...currentUser, ...updatePayload });
                              setCustomAlert(isIconChanged && isCooldownActive ? 'Status sparad! (Ingen ny notis skickades pga 10-minuters spärren)' : 'Inställningar sparade!');
                           }} style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>

                              <div>
                                 <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: 'var(--text-main)' }}>Din Status Ikon</label>
                                 <select name="status_icon" style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none' }} defaultValue={currentUser.status_icon || 'user'}>
                                    <option value="user">🧍 Gubbe - Bara online</option>
                                    <option value="star">⭐ Stjärna - Sugen på fest!</option>
                                    <option value="moon">🌙 Måne - Sömntuta</option>
                                    <option value="heart">❤️ Hjärta - Kär & galen!</option>
                                    <option value="zap">⚡ Blixt - Stressad / Full fart</option>
                                    <option value="coffee">☕ Kaffe - Behöver kaffe</option>
                                    <option value="ghost">👻 Spöke - På bushumör!</option>
                                    <option value="sun">😎 Solglasögon - Cool & lugn</option>
                                    <option value="gamepad">🎮 Gamepad - Sitter och spelar</option>
                                 </select>
                              </div>

                              <div>
                                 <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '600', color: 'var(--text-main)' }}>Vem får skriva i din gästbok?</label>
                                 <select name="guestbook_privacy" style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none' }} defaultValue="Alla inloggade medlemmar">
                                    <option>Alla inloggade medlemmar</option>
                                    <option>Endast mina Vänner</option>
                                    <option>Lås Gästboken</option>
                                 </select>
                              </div>

                              {/* GLOBAL MUTE TOGGLE */}
                              <div style={{ backgroundColor: 'var(--bg-card)', padding: '1.5rem', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }} className="card inner-box">
                                 <div>
                                    <strong style={{ display: 'block', color: 'var(--text-main)', marginBottom: '0.25rem' }}>Dämpa Andras Musik? (Global Mute)</strong>
                                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Stänger av musik överallt i Krypinet tills du slår på den igen.</span>
                                 </div>
                                 <button
                                    type="button"
                                    onClick={async () => {
                                       const newMuted = !isMusicMuted;
                                       setIsMusicMuted(newMuted);
                                       
                                       if (currentUser) {
                                          const { error } = await supabase.from('profiles').update({ global_mute: newMuted }).eq('id', currentUser.id);
                                          if (error) console.error("Kunde inte synka ljudinställning:", error);
                                       }
                                       
                                       localStorage.setItem('krypin_global_music_mute', newMuted ? 'true' : 'false');
                                       setCustomAlert(newMuted ? 'All profilmusik är nu avstängd.' : 'Nu spelas profilmusik igen!');
                                    }}
                                    style={{ padding: '0.5rem 1rem', borderRadius: '50px', border: '1px solid', backgroundColor: isMusicMuted ? '#ef4444' : '#10b981', color: 'white', fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem', transition: 'all 0.2s' }}
                                 >
                                    {isMusicMuted ? <VolumeX size={16} /> : <Music size={16} />}
                                    {isMusicMuted ? 'Ljudet är AV' : 'Ljudet är PÅ'}
                                 </button>
                              </div>

                              <div style={{ marginBottom: '1.5rem' }}></div>

                              <button type="submit" style={{ alignSelf: 'flex-start', border: 'none', cursor: 'pointer', backgroundColor: 'var(--theme-krypin)', color: 'white', fontWeight: '600', padding: '0.75rem 2rem', borderRadius: '8px' }}>Spara ändringar</button>
                           </form>
                        </div>
                     )}
                  </div>
               </div>
               {/* DUPLICATE WARNING MODAL */}
               {showDuplicateModal && (
                  <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} onClick={() => setShowDuplicateModal(false)}>
                     <div className="card" style={{ maxWidth: '400px', width: '100%', padding: '2.5rem 2rem', textAlign: 'center', borderRadius: '24px', position: 'relative', border: '2px solid #ef4444', animation: 'modalBounce 0.4s ease-out', backgroundColor: 'white', display: 'flex', flexDirection: 'column' }} onClick={e => e.stopPropagation()}>
                        <div style={{ width: '80px', height: '80px', backgroundColor: '#fee2e2', color: '#ef4444', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto' }}>
                           <ShieldAlert size={40} />
                        </div>
                        <h2 style={{ fontSize: '1.5rem', fontWeight: '800', marginBottom: '1rem', color: 'var(--text-main)' }}>Hoppsan! 👋</h2>
                        <p style={{ color: 'var(--text-muted)', lineHeight: '1.6', fontSize: '1.1rem', marginBottom: '2rem' }}>
                           Du verkar posta samma sak många gånger. <br /><strong>Vänta lite eller skriv något nytt istället!</strong>
                        </p>
                        <button
                           onClick={() => setShowDuplicateModal(false)}
                           style={{ width: '100%', backgroundColor: '#ef4444', color: 'white', border: 'none', padding: '1rem', borderRadius: '14px', fontSize: '1.1rem', fontWeight: 'bold', cursor: 'pointer', boxShadow: '0 4px 12px rgba(239,68,68,0.3)' }}
                        >
                           Jag fattar!
                        </button>
                     </div>
                  </div>
               )}

               {/* REPORT MODAL */}
               {showReportModal && (
                  <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(8px)', zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }}>
                     <div className="card" style={{ maxWidth: '400px', width: '100%', padding: '2rem', borderRadius: '18px', backgroundColor: 'white' }}>
                        <h3 style={{ marginTop: 0, marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f59e0b' }}><AlertTriangle size={24} /> Anmäl Innehåll</h3>
                        <p style={{ color: 'var(--text-muted)', marginBottom: '1rem', fontSize: '0.85rem' }}>Vad gällar anmälan? Välj en kategori och beskriv kortfattat vad som är fel.</p>

                        <select
                           value={reportCategory}
                           onChange={e => setReportCategory(e.target.value)}
                           style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid var(--border-color)', outline: 'none', marginBottom: '1rem', fontWeight: 'bold' }}
                        >
                           <option value="Spam">Spam/Nedskräpning</option>
                           <option value="Hatretorik">Hatretorik/Kränkande</option>
                           <option value="Trakasserier">Trakasserier/Mobbning</option>
                           <option value="Olämpligt">Olämpligt Innehåll</option>
                           <option value="Annat">Annat</option>
                        </select>

                        <textarea
                           value={reportReason}
                           onChange={e => setReportReason(e.target.value)}
                           rows={4}
                           style={{ width: '100%', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-color)', resize: 'vertical', marginBottom: '1rem', outline: 'none' }}
                           placeholder="Beskriv problemet..."
                        ></textarea>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                           <button onClick={() => { setShowReportModal(false); setReportReason(''); setReportTarget(null); }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: 'bold', color: 'var(--text-muted)' }}>Avbryt</button>
                           <button
                              onClick={async () => {
                                 if (!reportReason.trim() || !viewerUser || !reportTarget) return;

                                 const finalReason = `[${reportCategory}] ${reportReason.trim()}`;
                                 const { error } = await supabase.from('reports').insert({
                                    reporter_id: viewerUser.id,
                                    reported_user_id: reportTarget.reportedUserId,
                                    item_type: reportTarget.type,
                                    item_id: reportTarget.id,
                                    reason: finalReason,
                                    category: reportCategory,
                                    status: 'open',
                                    reported_content: reportTarget.content || '(Innehåll saknas)'
                                 });

                                 if (!error) {
                                    // Notifiera admins
                                    const { data: admins } = await supabase.from('profiles').select('id, username').or('is_admin.eq.true,perm_content.eq.true');
                                    if (admins) {
                                        const filteredAdmins = admins.filter(admin => {
                                           const isReported = admin.id === reportTarget.reportedUserId;
                                           const isRoot = admin.username === 'mrsunshine88' || admin.username === 'apersson508';
                                           if (isReported && !isRoot) return false;
                                           return true;
                                        });

                                        const adminNotifs = filteredAdmins.map(admin => ({
                                           receiver_id: admin.id,
                                           actor_id: viewerUser.id,
                                           type: 'report',
                                           content: `ny anmälan: ${reportTarget.type}`,
                                           link: '/admin?tab=reports'
                                        }));
                                       await supabase.from('notifications').insert(adminNotifs);
                                    }
                                    alert('Anmälan skickad! Tack för din hjälp.');
                                 } else {
                                    alert('Kunde inte skicka anmälan: ' + error.message);
                                 }

                                 setShowReportModal(false);
                                 setReportReason('');
                                 setReportTarget(null);
                              }}
                              disabled={!reportReason.trim()}
                              style={{ background: '#f59e0b', color: 'white', border: 'none', padding: '0.75rem 1.5rem', borderRadius: '8px', fontWeight: 'bold', cursor: reportReason.trim() ? 'pointer' : 'not-allowed', opacity: reportReason.trim() ? 1 : 0.5 }}
                           >
                              Skicka Anmälan
                           </button>
                        </div>
                     </div>
                  </div>
               )}

               <style jsx>{`
        @keyframes modalBounce {
          0% { transform: scale(0.8); opacity: 0; }
          70% { transform: scale(1.05); }
          100% { transform: scale(1); opacity: 1; }
        }
      `}</style>

               {/* SÄKERHETSKONTROLL: LOCKOUT OVERLAY (IP-SPÄRR) */}
               {isIpBlocked && (
                  <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.9)', backdropFilter: 'blur(20px)', zIndex: 99999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem' }} className="lockout-overlay">
                     <div className="card" style={{ maxWidth: '550px', width: '100%', padding: '3rem 2rem', border: '2px solid #ef4444', borderRadius: '30px', backgroundColor: '#000', color: 'white', textAlign: 'center', boxShadow: '0 0 50px rgba(239, 68, 68, 0.4)' }}>
                        <div style={{ width: '90px', height: '90px', borderRadius: '50%', backgroundColor: 'rgba(239, 68, 68, 0.1)', color: '#ef4444', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1.5rem auto', border: '2px solid #ef4444' }}>
                           <ShieldOff size={48} />
                        </div>
                        <h1 style={{ fontSize: '2rem', fontWeight: '900', color: '#ef4444', marginBottom: '0.5rem', letterSpacing: '-1px' }}>ÅTKOMST BEGRÄNSAD</h1>
                        <p style={{ fontSize: '1.2rem', color: '#94a3b8', marginBottom: '2rem' }}>Ditt konto eller din IP-adress har blivit föremål för en administrativ avstängning.</p>

                        <div style={{ backgroundColor: 'rgba(255,255,255,0.05)', padding: '1.5rem', borderRadius: '15px', marginBottom: '2rem', textAlign: 'left', border: '1px solid rgba(255,255,255,0.1)' }}>
                           <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                              <span style={{ color: '#64748b', fontSize: '0.9rem' }}>Ditt användar-ID:</span>
                              <code style={{ color: '#94a3b8' }}>{viewerUser?.id?.slice(0, 8)}...</code>
                           </div>
                           <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                              <span style={{ color: '#64748b', fontSize: '0.9rem' }}>Din IP-adress:</span>
                              <code style={{ color: '#f8fafc', fontWeight: 'bold' }}>{userIp || 'Hämtar...'}</code>
                           </div>
                        </div>

                        <div style={{ marginBottom: '2rem', textAlign: 'left' }}>
                           <h3 style={{ fontSize: '1rem', color: '#f1f5f9', marginBottom: '0.75rem' }}>Överklaga beslut</h3>
                           <textarea
                              placeholder="Skriv din förklaring här för att kontakta supporten..."
                              style={{ width: '100%', backgroundColor: '#111', border: '1px solid #333', borderRadius: '12px', padding: '1rem', color: 'white', fontSize: '0.9rem', minHeight: '100px', outline: 'none', marginBottom: '1rem' }}
                           ></textarea>
                           <button style={{ width: '100%', padding: '1rem', borderRadius: '12px', border: 'none', backgroundColor: '#ef4444', color: 'white', fontWeight: 'bold', cursor: 'pointer', transition: 'transform 0.2s' }} className="hover-lift">Skicka överklagan</button>
                        </div>

                        <p style={{ color: '#475569', fontSize: '0.8rem' }}>Facechat Security System v2.0 • Zero-Trust Policy</p>
                     </div>
                  </div>
               )}
            </div>
         </div>
      </>
   );
}
