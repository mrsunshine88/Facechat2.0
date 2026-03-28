"use client"

import { useState, useEffect, useCallback } from 'react'
import { createBrowserClient } from '@supabase/ssr'
import { maskContent } from '@/utils/wordFilter'

export function useWordFilter() {
  const [forbiddenWords, setForbiddenWords] = useState<string[]>([])
  
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const fetchWords = useCallback(async () => {
    try {
      const { data } = await supabase
        .from('forbidden_words')
        .select('word')
      
      if (data) {
        setForbiddenWords(data.map(d => d.word));
      }
    } catch (err) {
      console.error("Error fetching forbidden words:", err);
    }
  }, [supabase])

  useEffect(() => {
    fetchWords()

    const channel = supabase.channel('realtime_forbidden_words')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'forbidden_words' }, () => {
        fetchWords()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, fetchWords])

  const mask = useCallback((text: string) => {
    return maskContent(text, forbiddenWords)
  }, [forbiddenWords])

  return { mask, forbiddenWords }
}
