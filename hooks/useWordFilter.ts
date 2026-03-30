"use client"

import { useState, useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/utils/supabase/client'
import { maskContent } from '@/utils/wordFilter'

export function useWordFilter(onMassDelete?: () => void) {
  const [forbiddenWords, setForbiddenWords] = useState<string[]>([])
  const onMassDeleteRef = useRef(onMassDelete)
  const channelRef = useRef<any>(null)

  useEffect(() => {
    onMassDeleteRef.current = onMassDelete
  }, [onMassDelete])
  
  const supabase = createClient()

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

    const channel = supabase.channel('global_moderation')
      .on('broadcast', { event: 'word_filter_updated' }, () => {
        fetchWords()
      })
      .on('broadcast', { event: 'mass_delete' }, () => {
        if (onMassDeleteRef.current) onMassDeleteRef.current()
      })
      .subscribe()
      
    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
    }
  }, [supabase, fetchWords])

  const mask = useCallback((text: string) => {
    return maskContent(text, forbiddenWords)
  }, [forbiddenWords])

  const triggerUpdate = useCallback(() => {
    if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'word_filter_updated',
          payload: {}
        });
    }
  }, []);

  const triggerMassDelete = useCallback(() => {
    if (channelRef.current) {
        channelRef.current.send({
          type: 'broadcast',
          event: 'mass_delete',
          payload: {}
        });
    }
  }, []);

  return { mask, forbiddenWords, triggerUpdate, triggerMassDelete }
}
