"use client"

import { useEffect } from 'react'

export default function PushManager() {
  useEffect(() => {
    if ('serviceWorker' in navigator && window.location.protocol === 'https:') {
      navigator.serviceWorker.register('/sw.js?v=3').then(
        function (registration) {
          console.log('Service Worker registration successful with scope: ', registration.scope)
        },
        function (err) {
          console.log('Service Worker registration failed: ', err)
        }
      ).catch(err => console.log(err))
    }
  }, [])
  
  return null
}
