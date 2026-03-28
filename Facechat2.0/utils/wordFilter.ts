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
    const trimmedWord = word.trim();
    if (!trimmedWord) return;

    // Escape special regex characters in the word
    const escapedWord = trimmedWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // Case-insensitive regex with global flag and word boundaries
    // We use \b to ensure we only match whole words
    const regex = new RegExp(`\\b${escapedWord}\\b`, 'gi');
    
    maskedText = maskedText.replace(regex, (match) => '*'.repeat(match.length));
  });

  return maskedText;
}
