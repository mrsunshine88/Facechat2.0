const fs = require('fs');
const path = 'c:/Users/perss/Downloads/Facechat2.0-main/Facechat2.0-main/app/krypin/page.tsx';
let content = fs.readFileSync(path, 'utf8');

const replacement = `                                     if (admins) {
                                        const filteredAdmins = admins.filter(admin => {
                                           const isReported = admin.id === reportTarget.reportedUserId;
                                           const isRoot = admin.username === 'mrsunshine88';
                                           if (isReported && !isRoot) return false;
                                           return true;
                                        });

                                        const adminNotifs = filteredAdmins.map(admin => ({
                                           receiver_id: admin.id,
                                           actor_id: viewerUser.id,
                                           type: 'report',
                                           content: \`ny anmälan: \${reportTarget.type}\`,
                                           link: '/admin?tab=reports'
                                        }));`;

// Flexible regex for the second occurrence (the one without 'filteredAdmins')
const targetRegex = /if \(admins\) \{\s+const adminNotifs = admins\.map\(admin => \(\{\s+receiver_id: admin\.id,\s+actor_id: viewerUser\.id,\s+type: 'report',\s+content: `ny anmälan: \${reportTarget\.type}`,\s+link: '\/admin\?tab=reports'\s+\}\)\);/g;

let matches = 0;
content = content.replace(targetRegex, (match) => {
    matches++;
    return replacement;
});

if (matches > 0) {
    fs.writeFileSync(path, content);
    console.log(`Success: Replaced ${matches} occurrences`);
} else {
    console.error('Error: Could not find target block even with flexible regex');
}
