const fs = require('fs');
let content = fs.readFileSync('app/minasidor/page.tsx', 'utf8');
content = content.replace(
  '                  </div>\r\n                </div>\r\n              </form>',
  '                  </div>\r\n                 )}\r\n                </div>\r\n              </form>'
);
content = content.replace(
  '                  </div>\n                </div>\n              </form>',
  '                  </div>\n                 )}\n                </div>\n              </form>'
);
fs.writeFileSync('app/minasidor/page.tsx', content);
console.log('Fixed');
