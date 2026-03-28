/**
 * Utility to mask forbidden words in a text.
 * Uses word boundaries and case-insensitive matching.
 */
export function maskContent(text: string, forbiddenWords: string[]): string {
  if (!text || !forbiddenWords || forbiddenWords.length === 0) return text;

  let maskedText = text;
  
  // Sort by length descending to prioritize longer matches (e.g. "assface" before "ass")
  const sortedWords = [...forbiddenWords].sort((a, b) => b.length - a.length);

  sortedWords.forEach(word => {
    if (!word.trim()) return;
    
    // Escape special regex characters in the word
    const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // Case-insensitive regex with global flag
    const regex = new RegExp(escapedWord, 'gi');
    
    maskedText = maskedText.replace(regex, (match) => '*'.repeat(match.length));
  });

  return maskedText;
}
