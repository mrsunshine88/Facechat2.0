"use client"

import { useEffect } from 'react'
import { useUser } from './UserContext'

export default function PushManager() {
  const { loading } = useUser()

  useEffect(() => {
    // Vi fördröjer registreringen tills profilen är helt laddad för att undvika "Auth Lock Stolen"
    if (loading) return;

    if ('serviceWorker' in navigator && window.location.protocol === 'https:') {
      navigator.serviceWorker.register('/sw.js?v=4').then(
        function (registration) {
          console.log('Service Worker registration successful with scope: ', registration.scope)
        },
        function (err) {
          console.log('Service Worker registration failed: ', err)
        }
      ).catch(err => console.log(err))
    }
  }, [loading])
  
  return null
}
