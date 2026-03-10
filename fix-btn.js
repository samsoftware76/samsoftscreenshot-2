const fs = require('fs');

let pageTsx = fs.readFileSync('./app/page.tsx', 'utf8');
pageTsx = pageTsx.replace(
    "className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${mode === m ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}",
    "className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${mode === m ? 'bg-white text-black shadow-md font-bold' : 'text-gray-500 hover:text-black hover:bg-gray-200'}`}"
);
fs.writeFileSync('./app/page.tsx', pageTsx);

console.log("Fixed desktop buttons");
