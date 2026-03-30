const fs = require('fs');

const pathReplies = {
  'app/whiteboard/page.tsx': [
    { o: "` gillade ditt inlägg!`", n: "`${currentUser.username} gillade ditt inlägg!`" },
    { o: "` gillade din kommentar!`", n: "`${currentUser.username} gillade din kommentar!`" },
    { o: "` ${contentMsg}`", n: "`${currentUser.username} ${contentMsg}`" },
    { o: "inlägget från  på din", n: "inlägget från ${post.profiles?.username} på din" },
    { o: "[Delat från ]:\\n", n: "[Delat från ${post.profiles?.username}]:\\n" },
    { o: "` delade ditt inlägg!`", n: "`${currentUser.username} delade ditt inlägg!`" },
    { o: "fontSize: '1.1rem' }></span>", n: "fontSize: '1.1rem' }>{post.profiles?.username || 'Okänd Användare'}</span>" },
    { o: "marginBottom: '0.2rem' }></span>", n: "marginBottom: '0.2rem' }>{comment.profiles?.username || 'Okänd'}</span>" }
  ],
  'app/sok/page.tsx': [
    { o: "textAlign: 'center' }></h3>", n: "textAlign: 'center' }>{person.username || 'Okänd'}</h3>" }
  ],
  'app/minasidor/page.tsx': [
    { o: "Användaren  skrotade", n: "Användaren ${currentUser.username} skrotade" },
    { o: "Användaren  skapade", n: "Användaren ${currentUser.username} skapade" },
    { o: "Användaren  svarade", n: "Användaren ${currentUser.username} svarade" }
  ],
  'app/krypin/page.tsx': [
    { o: "` skickade ett mejl", n: "`${viewerUser.username} skickade ett mejl" },
    { o: "` skrev i din gästbok.", n: "`${viewerUser.username} skrev i din gästbok." },
    { o: "CSS-design för ?", n: "CSS-design för ${currentUser.username}?" },
    { o: "color: 'var(--text-main)' }></strong>", n: "color: 'var(--text-main)' }>{v.actor?.username || thread?.otherUser?.username || ''}</strong>" },
    { o: "Skicka mejl till </h3>", n: "Skicka mejl till {currentUser.username}</h3>" },
    { o: "color: 'var(--text-main)' }></h2>", n: "color: 'var(--text-main)' }>{currentUser.username}</h2>" },
    { o: "wordBreak: 'break-all'}></span>", n: "wordBreak: 'break-all'}>{post.sender?.username || 'Okänd'}</span>" },
    { o: "fontWeight: 'bold' }> vill bli din vän!</span>", n: "fontWeight: 'bold' }>{req.username} vill bli din vän!</span>" },
    { o: "color: 'var(--text-main)' }></span>", n: "color: 'var(--text-main)' }>{f.username}</span>" },
    { o: "fontSize: '1.1rem' }></strong>", n: "fontSize: '1.1rem' }>{u.username}</strong>" },
    { o: "display: 'block' }></strong>", n: "display: 'block' }>{thread.otherUser.username}</strong>" }
  ],
  'app/forum/[id]/page.tsx': [
    { o: "message: ` svarade i tråden:", n: "message: `${currentUser.username} svarade i tråden:" },
    { o: "(currentUser ? `` : 'Laddar...')", n: "(currentUser ? `${currentUser.username}` : 'Laddar...')" },
    { o: "cursor: 'pointer', fontWeight: 'bold' }></span>", n: "cursor: 'pointer', fontWeight: 'bold' }>{authorUsername}</span>" },
    { o: "var(--theme-forum)' : 'inherit' }></span>", n: "var(--theme-forum)' : 'inherit' }>{useAlias ? (currentUser?.alias_name || 'Stenansikte') : `${currentUser?.username}`}</span>" }
  ],
  'app/forum/page.tsx': [
    { o: "(currentUser ? `` : 'Laddar...')", n: "(currentUser ? `${currentUser.username}` : 'Laddar...')" },
    { o: "cursor: 'pointer', fontWeight: 'bold' }></span>", n: "cursor: 'pointer', fontWeight: 'bold' }>{authorUsername}</span>" },
    { o: "'inherit', fontWeight: 'bold' }></span>", n: "'inherit', fontWeight: 'bold' }>{useAlias ? (currentUser?.alias_name || 'Stenansikte') : `${currentUser?.username}`}</span>" }
  ],
  'app/chattrum/page.tsx': [
    { o: "message: `: ${preview}`", n: "message: `${currentUser.username}: ${preview}`" },
    { o: "cursor: 'pointer', fontWeight: 'bold' }></span>", n: "cursor: 'pointer', fontWeight: 'bold' }>{msg.profiles?.username || 'Okänd'}</span>" },
    { o: "currentUser?.id ? 'Du' : ``", n: "currentUser?.id ? 'Du' : `${user.username}`" }
  ],
  'app/admin/page.tsx': [
    { o: "Inloggad: </p>", n: "Inloggad: {userProfile.username}</p>" },
    { o: "color: 'var(--theme-primary)' }></td>", n: "color: 'var(--theme-primary)' }>{user.username}</td>" },
    { o: "color: 'var(--theme-primary)' }></strong>", n: "color: 'var(--theme-primary)' }>{user.username}</strong>" },
    { o: "` ${newStatus ? 'Blockerade' : 'Avblockerade'} `", n: "` ${newStatus ? 'Blockerade' : 'Avblockerade'} ${user.username}`" },
    { o: "tar bort  och", n: "tar bort ${user.username} och" },
    { o: "kontot  permanent", n: "kontot ${user.username} permanent" },
    { o: "color: 'var(--text-main)' }> ", n: "color: 'var(--text-main)' }>{u.username} " },
    { o: "användare  bannas globalt", n: "användare ${report.reported?.username || 'Okänd'} bannas globalt" },
    { o: "användare  pga", n: "användare ${report.reported?.username} pga" },
    { o: "marginBottom: '0.5rem' }> anmäler </p>", n: "marginBottom: '0.5rem' }>{report.reporter?.username} anmäler {report.reported?.username}</p>" },
    { o: "<Ban size={14}/> Banna ", n: "<Ban size={14}/> Banna {report.reported?.username}" },
    { o: "               {post.is_comment", n: "               {post.profiles?.username || 'Okänd'} {post.is_comment" },
    { o: "marginBottom: '0.5rem' }> ➔  • ", n: "marginBottom: '0.5rem' }>{post.sender?.username} ➔ {post.receiver?.username} • " },
    { o: "marginBottom: '0.5rem' }> i tråden", n: "marginBottom: '0.5rem' }>{post.profiles?.username || 'Okänd'} i tråden" },
    { o: "marginBottom: '0.5rem' }> i rummet", n: "marginBottom: '0.5rem' }>{msg.profiles?.username || 'Okänd'} i rummet" }
  ]
};

for (const [file, replaces] of Object.entries(pathReplies)) {
  if (fs.existsSync(file)) {
    let content = fs.readFileSync(file, 'utf8');
    for (const r of replaces) {
      content = content.split(r.o).join(r.n);
    }
    fs.writeFileSync(file, content);
  }
}
console.log('Restoration complete!');
