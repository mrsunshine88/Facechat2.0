# Facechat 2.0 – Komplett Säkerhetsdokumentation 🛡️🔐

Detta dokument beskriver de tekniska säkerhetssystemen implementerade i Facechat 2.0. Systemet är byggt på en "Defense-in-Depth"-modell (Zero-Trust) där flera lager samverkar för att skydda plattformen mot allt från enkla spamskript till avancerade försök till privilegieeskalering.

---

## 1. Zero-Trust Arkitektur & Autentisering
Facechat har migrerat till en fullständig **Zero-Trust-modell** för alla kritiska operationer.
- **Server-Side Validation**: Backend (Server Actions) förlitar sig aldrig på ID:n eller behörighetsflaggor som skickas från webbläsaren. Varje anrop till `userActions`, `adminActions` och `securityActions` hämtar användarens identitet direkt från Supabase Auth-sessionen via `auth.getUser()`.
- **F12-Immunitet**: Eftersom alla beslut tas på servern baserat på den inloggade sessionen, är det tekniskt omöjligt för en användare att "hacka" sig till andras data eller admin-funktioner genom att manipulera JavaScript-kod i webbläsaren.
- **Granulär Behörighetsstyrning (Zero-Trust)**: Admin-rättigheter är nu uppdelade i specifika roller (`perm_users`, `perm_content`, `perm_images`, `perm_stats`, `perm_diagnostics`, `perm_logs`). Detta förhindrar att en moderator med rättigheter att rensa bilder får tillgång till systemets diagnostik eller loggar.
- **Root-Admin Skydd**: Kontot `apersson508@gmail.com` har hårdkodad immunitet i både källkod och databas. Det kan inte raderas, bannas eller få sina rättigheter ändrade av någon, inte ens andra administratörer.

---

## 2. CSS-Sanering & Profilskydd (The Washing Machine) 🧼
För att förhindra injektion av skadlig kod via profil-design (CSS) genomgår all användardefinierad stil en strikt saneringsprocess.
- **`sanitizeCSS`**: En säkerhetsfunktion som körs på servern innan design sparas. Den blockerar:
  - `url()`: Förhindrar stöld av IP-adresser och cookies via externa bildanrop.
  - `@import`: Förhindrar laddning av externa, elakartade stilmallar.
  - `position: fixed`: Förhindrar "UI-redressing" eller att lägga osynliga lager över knappar för att lura användare.
  - **Specialtecken**: Parenteser `()` och semikolon `;` saneras för att förhindra att användare bryter sig ur CSS-kontexten för att köra JavaScript.

---

## 3. Databashärdning (The Master Shield) 💎
Databasen i Supabase är låst med avancerade PostgreSQL-funktioner för att fungera som en sista försvarslinje.
- **Privilegie-Escalation Shield**: Triggern `trg_security_shield` övervakar tabellen `profiles`. Om en icke-auktoriserad användare försöker ändra fält som `is_admin`, `is_banned` eller `perm_*` (t.ex. via direkt API-anrop), återställer triggern omedelbart värdena till deras ursprungliga tillstånd.
- **GDPR Isolation (`user_secrets`)**: Känsliga personuppgifter som telefonnummer, hemadress och postnummer förvaras i en isolerad tabell (`user_secrets`) med extremt strikta **RLS (Row Level Security)** regler. Endast ägaren själv kan läsa eller skriva till sin egen rad.
- **DM Privacy Lockdown (`private_messages`)**: Privata meddelanden är tekniskt skyddade från insyn. RLS-regler säkerställer att endast avsändaren och mottagaren kan läsa innehållet. Inte ens administratörer har åtkomst till denna tabell i sitt normala arbete.
- **Automated Sanitization**: Triggern `trg_sanitize_username` rensar automatiskt bort skadliga HTML-tecken från användarnamn direkt vid insättning i databasen.

---

## 4. Nätverksnivå & Dynamiskt IP-skydd
- **Middleware Lockdown**: `proxy.ts` fungerar som dörrvakt. Varje inkommande request matchas mot tabellen `blocked_ips`. Vid träff omdirigeras användaren omedelbart till `/blocked`.
- **Skyddad IP**: Systemet skyddar automatiskt den IP-adress som används av Root-Admin. Om den skulle hamna i en spärrlista av misstag finns självläkande funktioner som rensar spärren.

---

## 5. Innehållsmoderering & Anti-Spam
- **Globalt Ord-filter**: Trigger rensar automatiskt förbjudna ord i realtid i Chatt, Forum, Gästbok och PM.
- **Rate Limiting**: Inbyggda tidsspärrar mellan inlägg förhindrar automatiserade spambotar.
- **Auto-Ban**: Systemet bannlyser automatiskt användare som överskrider extrema gränser för meddelandefrekvens.

---

## 6. Audit Logging & Modereringsverktyg
Varje administrativ handling loggas för att säkerställa transparens och ansvarstagande.
- **Admin Logs**: Varje betydande administrativ åtgärd (spärra IP, radera konto, ändra behörigheter) loggas i tabellen `admin_logs`. Detta skapar en permanent "papperskedja".
- **Diagnostics Audit (Deep Scan)**: Varje körning av Vårdcentralens systemskanning loggas med detaljerade resultat (`Diagnosverktyg resultat: [X] felfria...`) för att säkerställa full spårbarhet av alla automatiska reparationer.
- **Avatar Review Gallery**: En dedikerad vy i Admin-panelen tillåter moderatorer att visuellt granska alla profilbilder på plattformen i realtid via `perm_images`. Allt innehållsrensning loggas.
- **Zero-Trust Content Resets**: Administratörer har tillgång till säkrade verktyg för att nollställa specifika delar av en användarprofil (Avatar, Bio eller CSS-tema). Processen kräver en aktiv sökning och val av profil för att eliminera mänskliga misstag vid delvisa namnmatchningar.
- **Support & Överklagan**: Ett isolerat system på `/blocked` tillåter spärrade användare att kommunicera med moderatorer utan att få tillgång till resten av plattformen.

---

> [!IMPORTANT]
> **Säkerhetsfilosofi**: Facechat 2.0 utgår från att klienten (webbläsaren) är osäker. Genom att flytta all logik till servern och installera djupt databasskydd har vi skapat en plattform som står emot även seniora penetrationstester.
