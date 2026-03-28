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
    // Escape special regex characters in the word
    const escapedWord = word.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    
    // Case-insensitive regex with Swedish-safe word boundaries
    // We avoid \b because it doesn't support ÅÄÖ. 
    const regex = new RegExp(`(^|[^a-zA-Z0-9åäöÅÄÖ])${escapedWord}(?=$|[^a-zA-Z0-9åäöÅÄÖ])`, 'gi');
    
    maskedText = maskedText.replace(regex, (match, p1) => {
      return p1 + '*'.repeat(word.trim().length);
    });
  });

  return maskedText;
}
