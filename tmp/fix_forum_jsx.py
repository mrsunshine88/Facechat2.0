import os

path = r"c:\Users\perss\Downloads\Facechat2.0-main\Facechat2.0-main\app\forum\[id]\page.tsx"
if not os.path.exists(path):
    print(f"Error: Path {path} not found")
    exit(1)

with open(path, 'r', encoding='utf-8') as f:
    text = f.read()

# Surgical replacement of the problematic block
# We look for the exact line 321 content and wrap it in a fragment
target = '              <div key={post.id} className="forum-post-row" style={{ display: \'flex\', border: \'1px solid var(--border-color)\', borderRadius: \'8px\', overflow: \'hidden\', backgroundColor: \'var(--bg-card)\', boxShadow: \'var(--shadow-sm)\', marginBottom: \'1rem\' }}>'

# Replacement including the divider and improved styling
replacement = """              <React.Fragment key={post.id}>
                {idx === 1 && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', margin: '2.5rem 0 1.5rem 0' }}>
                    <div style={{ height: '2px', flex: 1, backgroundColor: 'var(--border-color)' }}></div>
                    <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: '900', color: 'var(--theme-forum)', textTransform: 'uppercase', letterSpacing: '0.15em' }}>Svar & Kommentarer</h3>
                    <div style={{ height: '2px', flex: 1, backgroundColor: 'var(--border-color)' }}></div>
                  </div>
                )}
                <div key={post.id} className="forum-post-row" style={{ display: 'flex', border: isFirst ? '2px solid var(--theme-forum)' : '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', backgroundColor: 'var(--bg-card)', boxShadow: isFirst ? '0 8px 24px rgba(0,0,0,0.08)' : 'var(--shadow-sm)', marginBottom: '1rem' }}>"""

if target in text:
    new_text = text.replace(target, replacement)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(new_text)
    print("Successfully patched Forum page!")
else:
    print("Could not find target string in Forum page. Check characters and whitespace.")
    # Search for a sub-string
    if '<div key={post.id} className="forum-post-row"' in text:
        print("Found partial match. Indentation might be different.")
