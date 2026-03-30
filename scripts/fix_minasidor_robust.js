const fs = require('fs');
let content = fs.readFileSync('app/minasidor/page.tsx', 'utf8');

const target1 = `                  </div>
                </div>
              </form>
           )}

           {activeTab === 'Personuppgifter'`;

const replacement1 = `                  </div>
                 )}
                </div>
              </form>
           )}

           {activeTab === 'Personuppgifter'`;

const target2 = '                  </div>\r\n                </div>\r\n              </form>\r\n           )}\r\n\r\n           {activeTab === \'Personuppgifter\'';

const replacement2 = '                  </div>\r\n                 )}\r\n                </div>\r\n              </form>\r\n           )}\r\n\r\n           {activeTab === \'Personuppgifter\'';

content = content.replace(target1, replacement1);
content = content.replace(target2, replacement2);

fs.writeFileSync('app/minasidor/page.tsx', content);
console.log("Fixed!");
