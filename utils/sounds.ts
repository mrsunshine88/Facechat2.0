export interface NotifSound {
  id: string;
  name: string;
  url: string;
}

export const NOTIF_SOUNDS: NotifSound[] = [
  { id: 'none', name: 'Inget ljud (Tyst)', url: '' },
  { id: 'default', name: 'Standard (Facechat)', url: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3' },
  { id: 'bubble', name: 'Bubble Pop', url: 'https://assets.mixkit.co/active_storage/sfx/2868/2868-preview.mp3' },
  { id: 'chime', name: 'Chime Bliss', url: 'https://assets.mixkit.co/active_storage/sfx/2867/2867-preview.mp3' },
  { id: 'bell', name: 'Light Bell', url: 'https://assets.mixkit.co/active_storage/sfx/2866/2866-preview.mp3' },
  { id: 'arcade', name: 'Arcade Retro', url: 'https://assets.mixkit.co/active_storage/sfx/2859/2859-preview.mp3' },
  { id: 'magic', name: 'Magic Wand', url: 'https://assets.mixkit.co/active_storage/sfx/2858/2858-preview.mp3' },
  { id: 'pop', name: 'Simple Pop', url: 'https://assets.mixkit.co/active_storage/sfx/2857/2857-preview.mp3' },
  { id: 'nokia_low', name: 'Nokia (Låg)', url: 'https://assets.mixkit.co/active_storage/sfx/2856/2856-preview.mp3' },
  { id: 'nokia_beep', name: 'Nokia (Beep-Beep)', url: 'https://assets.mixkit.co/active_storage/sfx/2855/2855-preview.mp3' },
  { id: 'retro_phone', name: 'Nostalgiskt Pip', url: 'https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3' },
  { id: 'glass', name: 'Glass Ting', url: 'https://assets.mixkit.co/active_storage/sfx/2851/2851-preview.mp3' },
  { id: 'robot', name: 'Robot Beep', url: 'https://assets.mixkit.co/active_storage/sfx/2853/2853-preview.mp3' },
  { id: 'wood', name: 'Wood Knock', url: 'https://assets.mixkit.co/active_storage/sfx/2854/2854-preview.mp3' },
  { id: 'nature', name: 'Fågelkvitter', url: 'https://assets.mixkit.co/active_storage/sfx/2849/2849-preview.mp3' },
  { id: 'success', name: 'Success!', url: 'https://assets.mixkit.co/active_storage/sfx/1997/1997-preview.mp3' },
];

export function getSoundUrl(id: string): string {
  const sound = NOTIF_SOUNDS.find(s => s.id === id);
  return sound ? sound.url : NOTIF_SOUNDS[0].url;
}
