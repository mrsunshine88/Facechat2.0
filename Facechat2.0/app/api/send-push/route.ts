import { NextResponse } from 'next/server';
import webpush from 'web-push';
import { createClient } from '@supabase/supabase-js';

// We need a Service Role key to read push_subscriptions securely
// If not available, we use the Anon key, but Service Role is required if RLS blocks reading others' subs.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: Request) {
  try {
    // Check if VAPID keys exist before trying to send (prevents build crashes)
    if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
      console.warn("Push keys missing: Web push is disabled.");
      return NextResponse.json({ error: 'Push notifications are not configured on this server.' }, { status: 500 });
    }

    // Setup Web Push safely at runtime
    webpush.setVapidDetails(
      'mailto:apersson508@gmail.com',
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );

    const { userId, title, message, url } = await request.json();

    if (!userId || !title || !message) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Fetch all active subscriptions for this user
    const { data: subscriptions, error } = await supabase
      .from('push_subscriptions')
      .select('endpoint, auth, p256dh')
      .eq('user_id', userId);

    if (error || !subscriptions || subscriptions.length === 0) {
      return NextResponse.json({ message: 'No subscriptions found for user' });
    }

    // Filtrera bort dubbletter om databasen har sparats samma prenumeration flera gånger (förhindrar dubbla notiser)
    const uniqueSubscriptions = Array.from(new Map(subscriptions.map(s => [s.endpoint, s])).values());

    const payload = JSON.stringify({
      title,
      body: message,
      url: url || '/'
    });

    const sendPromises = uniqueSubscriptions.map((sub) => {
      const pushSubscription = {
        endpoint: sub.endpoint,
        keys: {
          auth: sub.auth,
          p256dh: sub.p256dh
        }
      };
      
      return webpush.sendNotification(pushSubscription, payload).catch(err => {
        // If the subscription is gone/expired (410 Gone), we should technically delete it from the DB.
        if (err.statusCode === 410 || err.statusCode === 404) {
           console.log('Subscription expired, could delete from DB', sub.endpoint);
           supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint).then();
        } else {
           console.error('Push error:', err);
        }
      });
    });

    await Promise.all(sendPromises);

    return NextResponse.json({ success: true, message: 'Push sent to ' + uniqueSubscriptions.length + ' endpoints.' });
  } catch (error: any) {
    console.error('Error sending push:', error);
    return NextResponse.json({ error: 'Failed to send push notification', details: error.message }, { status: 500 });
  }
}
