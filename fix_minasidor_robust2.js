const fs = require('fs');
let content = fs.readFileSync('app/minasidor/page.tsx', 'utf8');

const regex = /<button type="button" onClick=\{handleDeleteMyAccount\}[\s\S]*?<\/button>\s*<\/div>\s*<\/div>\s*\)\}\s*<\/div>\s*<\/div>\s*<\/form>/g;

const replacement = `<button type="button" onClick={handleDeleteMyAccount} style={{ flex: 1, padding: '0.5rem', backgroundColor: '#ef4444', color: 'white', border: 'none', cursor: 'pointer', borderRadius: '6px', fontWeight: '600', fontSize: '0.875rem' }}>Radera</button>
                        </div>
                      </div>
                    )}
                  </div>
                 )}
                </div>
              </form>`;

content = content.replace(regex, replacement);
fs.writeFileSync('app/minasidor/page.tsx', content);
console.log("Fixed!");
