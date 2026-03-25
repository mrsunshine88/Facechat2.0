const fs = require('fs');

let content = fs.readFileSync('app/krypin/page.tsx', 'utf8');

const startMarker = '{isComposingNew && (';
const endMarker = '{!isComposingNew && selectedThreadUserId && (';

const startIndex = content.lastIndexOf(startMarker, content.indexOf(endMarker));
const endIndex = content.indexOf(endMarker);

if (startIndex === -1 || endIndex === -1) {
    console.error("Markers not found");
    process.exit(1);
}

const replacement = `                {isComposingNew && (
                  <div className="animate-fade-in krypin-thread-wrapper" style={{ display: 'flex', flexDirection: 'column', height: '600px', maxHeight: '100%' }}>
                     <div className="card inner-box krypin-thread-container" style={{ flex: 1, display: 'flex', flexDirection: 'column', border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
                        <div className="krypin-thread-header" style={{ padding: '1rem', display: 'flex', alignItems: 'center', gap: '1rem', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)' }}>
                           <button onClick={() => { setIsComposingNew(false); setComposeSearchQuery(''); setComposeSearchResults([]); }} style={{ background: 'var(--theme-krypin)', border: 'none', borderRadius: '50%', width: '36px', height: '36px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: 'white', flexShrink: 0, boxShadow: '0 2px 5px rgba(0,0,0,0.2)' }} title="Tillbaka">
                              <ArrowLeft size={18} />
                           </button>
                           <strong style={{ fontSize: '1.2rem', color: 'var(--text-main)' }}>Nytt mejl</strong>
                        </div>
                        <div className="krypin-thread-chat" style={{ flex: 1, padding: '1.5rem', backgroundColor: 'var(--bg-color)', overflowY: 'auto' }}>
                           <p style={{ fontSize: '0.875rem', fontWeight: 'bold', marginBottom: '1rem', color: 'var(--text-muted)' }}>Vem vill du skriva till?</p>
                           <div style={{ position: 'relative' }}>
                             <input type="text" value={composeSearchQuery} onChange={e => { setComposeSearchQuery(e.target.value); handleSearchUsers(e.target.value); }} placeholder="Sök efter användarnamn..." style={{ width: '100%', padding: '0.875rem 1rem', borderRadius: '24px', border: '1px solid var(--border-color)', fontSize: '1rem', color: 'var(--text-main)', backgroundColor: 'white', outline: 'none', boxShadow: '0 2px 4px rgba(0,0,0,0.05)' }} />
                           </div>
                           
                           {composeSearchResults.length > 0 && (
                              <div style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                {composeSearchResults.map(u => (
                                   <div key={u.id} onClick={() => { setIsComposingNew(false); setSelectedThreadUserId(u.id); setComposeSearchQuery(''); setComposeSearchResults([]); }} style={{ padding: '0.75rem 1.25rem', display: 'flex', alignItems: 'center', gap: '1rem', cursor: 'pointer', borderRadius: '12px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }} className="hover-lift">
                                      <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'var(--theme-krypin)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                          {u.avatar_url ? <img src={u.avatar_url} style={{width:'100%', height:'100%', objectFit:'cover'}}/> : <User size={20} color="white" />}
                                      </div>
                                      <strong style={{ color: 'var(--text-main)', fontSize: '1.1rem' }}>@{u.username}</strong>
                                      <span style={{ marginLeft: 'auto', fontSize: '0.8rem', color: 'var(--theme-krypin)', fontWeight: 'bold' }}>Skriv till {u.username} ➔</span>
                                   </div>
                                ))}
                              </div>
                           )}
                           {composeSearchQuery.length > 2 && composeSearchResults.length === 0 && (
                              <div style={{ textAlign: 'center', marginTop: '2rem', color: 'var(--text-muted)' }}>
                                 <p style={{ fontWeight: 'bold' }}>Hittade tyvärr ingen användare med det namnet.</p>
                              </div>
                           )}
                        </div>
                     </div>
                  </div>
                )}
               
               `;

const newContent = content.substring(0, startIndex) + replacement + content.substring(endIndex);
fs.writeFileSync('app/krypin/page.tsx', newContent);
console.log("Success");
