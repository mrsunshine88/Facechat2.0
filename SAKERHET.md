# Facechat 2.0 – Komplett Säkerhetsdokumentation 🛡️🔐

Detta dokument beskriver de tekniska säkerhetssystemen implementerade i Facechat 2.0. Systemet är byggt på en "Defense-in-Depth"-modell där flera lager samverkar för att skydda plattformen.

---

## 1. Arkitektur & Autentisering
Facechat använder **Supabase Auth** som primär identitetshanterare.
- **Verifiering**: Obligatorisk e-postverifiering för alla nya konton innan åtkomst ges till interaktiva funktioner.
- **Sessioner**: JWT-baserade sessioner med automatisk refresh.
- **RBAC (Role-Based Access Control)**: Behörigheter styrs via kolumner i tabellen `profiles` (t.ex. `is_admin`, `perm_users`, `perm_content`). Varje Server Action i backend validerar dessa flaggor mot `auth.uid()` via en central behörighetskontroll (`verifyAdminPermission`).

---

## 2. Nätverksnivå & Dynamiskt IP-skydd
- **Middleware Blacklisting**: `middleware.ts` fungerar som dörrvakt. Varje inkommande request matchas mot tabellen `blocked_ips`. Vid träff blockeras anropet direkt på Edge-nivå (Next.js Middleware).
- **IMMUNITET FÖR ROOT-ADMIN**: Systemet skyddar automatiskt den IP-adress som används av kontot `apersson508`. Om en administratör försöker spärra denna IP – oavsett vilken profil de försöker nå den genom – nekas åtgärden automatiskt. Skyddet är dynamiskt och följer Root-Admin om de byter nätverk.
- **IP-spårning**: Varje lyckad profil-interaktion loggar användarens `last_ip` för forensisk analys och spårbarhet.

---

## 3. Innehållsmoderering (Automated)
Vi använder **PostgreSQL Triggers** för att säkerställa att inga genvägar kan tas i frontend.

### A. Globalt Ord-filter
- **Trigger**: `trg_auto_clean_content`
- **Funktion**: All inkommande text i tabellerna för Chatt, Forum, Gästbok, Whiteboard och PM rensas mot en lista av förbjudna ord (`forbidden_words`) och byts ut mot stjärnor (****).

### B. Dubbelpost-prevention
- **Trigger**: `trg_prevent_duplicate_posts`
- **Funktion**: Förhindrar repetitiva inlägg genom att jämföra det inkommande innehållet med de senaste 5 inläggen från samma användare.

---

## 4. Anti-Spam & Auto-Moderering
- **Auto-Ban**: Om en användare når 50 inlägg på 60 sekunder triggas en automatisk bannlysning (`is_banned = true`) med anledningen *"System: Automatiskt spärrad pga spam"*.
- **Early Warning System**: Administratörer notifieras omedelbart vid 30 inlägg på 60 sekunder för att kunna agera proaktivt.

---

## 5. Systemstabilitet & Självläkning (Vårdcentralen)
Facechat har ett proaktivt diagnosverktyg för säkerhetsövervakning:
- **Root-IP Check**: En specifik diagnos kontrollerar om Root-Admins IP av misstag hamnat i spärrlistan och erbjuder en omedelbar "Fixa Auto"-lösning.
- **Cleanup of Broken CSS**: Skydd mot missbruk av profil-design där administratörer kan återställa profiler som har blivit trasiga eller elakartade pga felaktig CSS.
- **GDPR Orphan Removal**: Automatisk sanering av "föräldralös" data (inlägg kvarlämnade av raderade konton) för att säkerställa integritet och databasstabilitet.

---

## 6. Audit Logging & Transparens
- **Admin Logs**: Varje betydande administrativ åtgärd (spärra IP, radera konto, ändra behörigheter) loggas i tabellen `admin_logs` med administratörens ID och detaljerad händelsebeskrivning för spårbarhet.

---

## 7. Dataintegritet
- **Transaktioner**: Alla kritiska ändringar sker inom SQL-transaktioner för att förhindra ofullständiga uppdateringar.
- **Backend Validation**: Alla administrativa funktioner kräver validering mot både autentiserings-sessionen och databasens roll-tabell.

---

> [!IMPORTANT]
> Detta dokument representerar den nuvarande säkerhetsstandarden i Facechat 2.0 (utökat mars 2026).
